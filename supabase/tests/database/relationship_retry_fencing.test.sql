begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(20);
select pg_temp.create_auth_actor('ba740000-1111-4111-8111-111111111111','bb740000-1111-4111-8111-111111111111','retry@test.local');
insert into app_private.notification_outbox(notification_ref,recipient_user_id,notification_type,deduplication_key,created_at,first_attempt_at,attempt_count)
values
('ntf_11111111111141118111111111111111','ba740000-1111-4111-8111-111111111111','introduction_declined','ready-stale-relationship',now()-interval '25 hours',null,0),
('ntf_22222222222242228222222222222222','ba740000-1111-4111-8111-111111111111','introduction_declined','ready-uncertain-relationship',now()-interval '23 hours',now()-interval '23 hours',1),
('ntf_33333333333343338333333333333333','ba740000-1111-4111-8111-111111111111','introduction_declined','ready-fresh-relationship',now(),null,0),
('ntf_44444444444444448444444444444444','ba740000-1111-4111-8111-111111111111','pilot_access_declined','ready-pilot-untouched',now()-interval '25 hours',null,0);
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_relationship_notification_outbox(10)),1,'only fresh relationship event is claimed');
reset role;
select is((select last_error_code from app_private.notification_outbox where notification_ref='ntf_11111111111141118111111111111111'),'STALE_NOTIFICATION_REVIEW_REQUIRED','old unattempted event quarantined');
select is((select last_error_code from app_private.notification_outbox where notification_ref='ntf_22222222222242228222222222222222'),'EMAIL_RETRY_WINDOW_EXPIRED','first-attempt horizon is durable');
select is((select status from app_private.notification_outbox where notification_ref='ntf_44444444444444448444444444444444'),'queued','relationship claim does not alter pilot mail');
select ok((select first_attempt_at is not null from app_private.notification_outbox where notification_ref='ntf_33333333333343338333333333333333'),'first dispatch sets durable clock');
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.complete_relationship_notification_outbox('ntf_33333333333343338333333333333333',1,false,'EMAIL_TIMEOUT',true),'queued','uncertain send can retry inside safe horizon');
select is(public.requeue_failed_relationship_notification('ntf_11111111111141118111111111111111'),'manual_review_required','old intent needs explicit per-message review');
select is(public.requeue_failed_relationship_notification('ntf_22222222222242228222222222222222'),'manual_review_required','uncertain old send needs duplicate-risk review');
select is(public.requeue_failed_relationship_notifications(100),0,'bulk recovery cannot bypass stale review');
select is(public.requeue_failed_relationship_notification('ntf_11111111111141118111111111111111',true),'queued','reviewed stale event may be explicitly released');
reset role;
select ok((select delivery_reviewed_at is not null and first_attempt_at is null from app_private.notification_outbox where notification_ref='ntf_11111111111141118111111111111111'),'reviewed release restarts safe attempt clock');
update app_private.notification_outbox set first_attempt_at=now()-interval '23 hours',available_at=now() where notification_ref='ntf_33333333333343338333333333333333';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_relationship_notification_outbox(10)),1,'requeued timeout cannot cross horizon, reviewed stale event may dispatch');
reset role;
select is((select status from app_private.notification_outbox where notification_ref='ntf_33333333333343338333333333333333'),'failed','age fence persists failure');
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.complete_relationship_notification_outbox('ntf_11111111111141118111111111111111',2,true),'unavailable','old attempt fence cannot finish current claim');
select ok(public.suppress_failed_relationship_notification('ntf_22222222222242228222222222222222'),'operator may retire obsolete delivery without sending');
select is(public.requeue_failed_relationship_notification('ntf_22222222222242228222222222222222',true),'unavailable','suppression cannot be undone by duplicate-risk acknowledgement');
reset role;
select is((select last_error_code from app_private.notification_outbox where notification_ref='ntf_22222222222242228222222222222222'),'OPERATOR_SUPPRESSED','intentional non-delivery is durable');
reset role;
update app_private.notification_outbox set status='failed',attempt_count=5,
  first_attempt_at=now()-interval '22 hours',last_error_code='EMAIL_RATE_LIMITED',lease_expires_at=null
where notification_ref='ntf_33333333333343338333333333333333';
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.requeue_failed_relationship_notification('ntf_33333333333343338333333333333333',false),'queued','recent safe error recovery does not require a horizon reset');
reset role;
select is((select first_attempt_at from app_private.notification_outbox where notification_ref='ntf_33333333333343338333333333333333'),now()-interval '22 hours','unacknowledged recovery preserves original first attempt after earlier uncertainty');
update app_private.notification_outbox set first_attempt_at=now()-interval '25 hours' where notification_ref='ntf_33333333333343338333333333333333';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_relationship_notification_outbox(10)),0,'later dispatch cannot cross original provider horizon');
select * from finish();
rollback;
