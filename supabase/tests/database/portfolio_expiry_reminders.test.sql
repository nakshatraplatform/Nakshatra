begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(62);
select pg_temp.create_auth_actor('a1660000-1111-4111-8111-000000000001','a2660000-1111-4111-8111-000000000001','owner@expiry.test');
do $$ begin
  for i in 1..31 loop
    perform pg_temp.create_auth_actor(('b1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,
      ('b2660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,'viewer'||i::text||'@expiry.test');
  end loop;
end $$;
insert into public.candidates(id,primary_owner_user_id,created_by,display_name)
 values('c1660000-1111-4111-8111-000000000001','a1660000-1111-4111-8111-000000000001','a1660000-1111-4111-8111-000000000001','Expiry Owner');
insert into public.portfolios(id,user_id,candidate_id,draft_data,is_published,share_token)
 values('d1660000-1111-4111-8111-000000000001','a1660000-1111-4111-8111-000000000001','c1660000-1111-4111-8111-000000000001',pg_temp.complete_portfolio_draft(),false,'expiry_fixture_tok_01');
insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order)
 values('d1660000-1111-4111-8111-000000000001','c1660000-1111-4111-8111-000000000001','hero','a1660000-1111-4111-8111-000000000001/d1660000-1111-4111-8111-000000000001/hero.webp','public',0);
update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days' where candidate_id='c1660000-1111-4111-8111-000000000001';
select pg_temp.prime_paid_publication('d1660000-1111-4111-8111-000000000001',pg_temp.complete_portfolio_draft());
select pg_temp.set_service_role_claims();
select is(public.service_publish_portfolio_transaction('a1660000-1111-4111-8111-000000000001','a2660000-1111-4111-8111-000000000001',
 'd1660000-1111-4111-8111-000000000001',pg_temp.complete_portfolio_draft(),'{}','{}','expiry_fixture_tok_01',now()+interval '90 days',3,'#17151c','kanya')->>'status','ok','fixture satisfies publication safeguards');
insert into public.interest_requests(id,portfolio_id,requester_user_id,viewer_name,viewer_email,email_verified_at,verification_channel,status)
 select ('e1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,'d1660000-1111-4111-8111-000000000001',
 ('b1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,'Synthetic viewer','viewer'||i::text||'@expiry.test',now(),'email','approved' from generate_series(1,31) i;
insert into public.reveal_grants(id,interest_request_id,portfolio_id,viewer_user_id,access_level,granted_sections,granted_by,expires_at,created_at)
 select ('f1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,('e1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,
 'd1660000-1111-4111-8111-000000000001',('b1660000-1111-4111-8111-'||lpad(i::text,12,'0'))::uuid,
 'full',array['full'],'a1660000-1111-4111-8111-000000000001',now()+case when i=1 then interval '24 hours' else interval '25 hours' end,now()-interval '2 days' from generate_series(1,31) i;
create function pg_temp.clear_core_mail() returns void language sql as $$
 delete from app_private.notification_outbox where grant_id='f1660000-1111-4111-8111-000000000001'; $$;
create function pg_temp.claim_core() returns void language sql as $$ select public.claim_relationship_notification_outbox(5); $$;
create function pg_temp.prepare_core(p_kind text,p_digest text default repeat('a',64),p_hash text default null,p_attempt integer default 1)
returns text language sql as $$
 select public.prepare_full_view_expiry_email(o.notification_ref,p_attempt,
   coalesce(p_hash,encode(extensions.digest(case when p_kind='full_view_expiring' then 'viewer1@expiry.test' else 'owner@expiry.test' end,'sha256'),'hex')),p_digest)
 from app_private.notification_outbox o where o.grant_id='f1660000-1111-4111-8111-000000000001' and notification_type=p_kind order by o.id desc limit 1;
$$;
select ok(not has_function_privilege('anon','public.enqueue_due_full_view_expiry_reminders()','EXECUTE'),'anon cannot produce reminders');
select ok(not has_function_privilege('authenticated','public.prepare_full_view_expiry_email(text,integer,text,text)','EXECUTE'),'browser cannot prepare arbitrary email');
select ok(not has_function_privilege('service_role','app_private.expiry_reminder_is_current(uuid,uuid,text,jsonb)','EXECUTE'),'canonical private rule is not a callable service API');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1660000-1111-4111-8111-000000000001','a2660000-1111-4111-8111-000000000001');
select throws_ok($$select public.enqueue_due_full_view_expiry_reminders()$$,'42501',null,'authenticated actor cannot enqueue');
reset role;
select pg_temp.set_service_role_claims();
select is(public.portfolio_expiry_reminder_health()->>'healthy','true','newly entered 24-hour window has grace for scheduling');
set local role service_role;
select is(public.enqueue_due_full_view_expiry_reminders(),2,'24-hour boundary queues owner and viewer only');
select is(public.enqueue_due_full_view_expiry_reminders(),0,'repeated schedule is idempotent');
reset role;
select is((select count(*)::integer from app_private.notification_outbox where grant_id='f1660000-1111-4111-8111-000000000001'),2,'exactly two distinct recipients');
select ok(not exists(select 1 from app_private.notification_outbox where payload::text like '%@expiry.test%'),'queue contains no raw recipient address');
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5) where notification_type in ('full_view_expiring','full_view_access_expiring')),2,'both reminders claimed alongside regular publication mail');
select is(pg_temp.prepare_core('full_view_expiring'), 'ready','viewer dispatch bound to current recipient and lease');
select is(pg_temp.prepare_core('full_view_expiring'), 'ready','identical retry content retains binding');
select is(pg_temp.prepare_core('full_view_access_expiring',repeat('b',64),null,2),'unavailable','wrong claim attempt cannot prepare');
select is(pg_temp.prepare_core('full_view_access_expiring',repeat('b',64),repeat('0',64)),'skipped','mismatched actual recipient skips without sending');
select is((select status from app_private.notification_outbox where notification_type='full_view_access_expiring'),'skipped','obsolete mail is not reported sent or failed');
select is(pg_temp.prepare_core('full_view_expiring',repeat('c',64)),'skipped','changed request content cannot reuse stable provider key');
select is(public.enqueue_due_full_view_expiry_reminders(),0,'skipped same-period work is not recreated');
select pg_temp.clear_core_mail();
update public.reveal_grants set expires_at=now()+interval '23 hours' where id='f1660000-1111-4111-8111-000000000001';
select is(public.portfolio_expiry_reminder_health()->>'healthy','false','missed enqueue is visible even when outbox empty');
select is(public.enqueue_due_full_view_expiry_reminders(),2,'new exact expiry period produces two jobs');
select is(public.portfolio_expiry_reminder_health()->>'healthy','true','enqueue clears missing-production health');
select pg_temp.claim_core();
select is(pg_temp.prepare_core('full_view_access_expiring'),'ready','owner requires current grant too');
update public.reveal_grants set expires_at=now()+interval '15 days',renewed_at=now() where id='f1660000-1111-4111-8111-000000000001';
select is(pg_temp.prepare_core('full_view_access_expiring'),'skipped','renewal after claim invalidates owner reminder');
select is(pg_temp.prepare_core('full_view_expiring'),'skipped','renewal after claim invalidates viewer reminder');
select is(public.enqueue_due_full_view_expiry_reminders(),0,'renewed access outside window does not queue');
select pg_temp.clear_core_mail();
update public.reveal_grants set expires_at=now()+interval '22 hours' where id='f1660000-1111-4111-8111-000000000001';
select is(public.enqueue_due_full_view_expiry_reminders(),2,'remaining valid period queues normally');
update public.reveal_grants set revoked_at=now() where id='f1660000-1111-4111-8111-000000000001';
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5)),0,'revoked queue not claimed');
select is((select count(*)::integer from app_private.notification_outbox where status='skipped'),2,'revoked queue retired honestly');
select pg_temp.clear_core_mail();
update public.reveal_grants set revoked_at=null,expires_at=now()-interval '1 second' where id='f1660000-1111-4111-8111-000000000001';
select is(public.enqueue_due_full_view_expiry_reminders(),0,'already expired window never produces reminders');
update public.reveal_grants set expires_at=now()+interval '1 hour' where id='f1660000-1111-4111-8111-000000000001';
select is(public.enqueue_due_full_view_expiry_reminders(),2,'missed schedule catches up while access remains eligible');
select pg_temp.claim_core();
update public.portfolios set is_published=false where id='d1660000-1111-4111-8111-000000000001';
select is(pg_temp.prepare_core('full_view_access_expiring'),'skipped','unpublishing after claim invalidates owner');
select is(pg_temp.prepare_core('full_view_expiring'),'skipped','unpublishing after claim invalidates viewer');
select pg_temp.clear_core_mail();
select public.service_publish_portfolio_transaction('a1660000-1111-4111-8111-000000000001','a2660000-1111-4111-8111-000000000001',
 'd1660000-1111-4111-8111-000000000001',pg_temp.complete_portfolio_draft(),'{}','{}','expiry_fixture_tok_01',now()+interval '90 days',3,'#17151c','kanya');
select is(public.enqueue_due_full_view_expiry_reminders(),2,'republished valid access can receive reminders');
select pg_temp.claim_core();
update auth.users set email_confirmed_at=null where id='b1660000-1111-4111-8111-000000000001';
select is(pg_temp.prepare_core('full_view_expiring'),'skipped','unverified recipient cannot receive reminder');
update auth.users set email_confirmed_at=now() where id='b1660000-1111-4111-8111-000000000001';
update public.portfolios set user_id='b1660000-1111-4111-8111-000000000002' where id='d1660000-1111-4111-8111-000000000001';
select is(pg_temp.prepare_core('full_view_access_expiring'),'skipped','former owner cannot receive reminder');
update public.portfolios set user_id='a1660000-1111-4111-8111-000000000001' where id='d1660000-1111-4111-8111-000000000001';
select pg_temp.clear_core_mail();
select public.enqueue_due_full_view_expiry_reminders();
select pg_temp.claim_core();
update public.reveal_grants set expires_at=now()-interval '1 second' where id='f1660000-1111-4111-8111-000000000001';
select is(pg_temp.prepare_core('full_view_expiring'),'skipped','expiry after claim prevents a new viewer send');
select is(pg_temp.prepare_core('full_view_access_expiring'),'skipped','expiry after claim prevents a new owner send');
select pg_temp.clear_core_mail();
update public.reveal_grants set expires_at=now()+interval '1 hour' where id='f1660000-1111-4111-8111-000000000001';
-- Legacy sent records retain the old date identity even after payload erasure.
insert into app_private.notification_outbox(recipient_user_id,notification_type,grant_id,deduplication_key,status,delivered_at)
values('b1660000-1111-4111-8111-000000000001','full_view_expiring','f1660000-1111-4111-8111-000000000001',
 'full-view-expiring:viewer:f1660000-1111-4111-8111-000000000001:'||(now()+interval '1 hour')::date::text,'sent',now());
select is(public.enqueue_due_full_view_expiry_reminders(),1,'old sent viewer reminder is not duplicated on migration');
select pg_temp.claim_core();
select is(pg_temp.prepare_core('full_view_access_expiring'),'ready','new owner message ready');
select is(public.complete_relationship_notification_outbox((select notification_ref from app_private.notification_outbox where notification_type='full_view_access_expiring'),1,true),'sent','provider acceptance completes with existing command');
select is((select count(*)::integer from app_private.notification_outbox where status='sent'),2,'successful and legacy records remain accepted');
select pg_temp.clear_core_mail();
-- Uncertain legacy retries cannot be re-rendered into a different request.
select public.enqueue_due_full_view_expiry_reminders();
update app_private.notification_outbox set payload=payload-'schemaVersion',attempt_count=1 where notification_type='full_view_expiring';
select pg_temp.claim_core();
select is(pg_temp.prepare_core('full_view_expiring',repeat('a',64),null,2),'skipped','legacy attempted message needs safe retirement rather than changed retry');
select pg_temp.clear_core_mail();
-- Invalid snapshots are fail-closed rather than breaking the entire claim batch.
select public.enqueue_due_full_view_expiry_reminders();
update app_private.notification_outbox set payload=jsonb_set(payload,'{expiresAt}','"not a date"') where notification_type='full_view_expiring';
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5)),1,'malformed reminder is skipped while other recipient proceeds');
select is((select status from app_private.notification_outbox where notification_type='full_view_expiring'),'skipped','invalid date is obsolete, not an unbounded retry');
select pg_temp.clear_core_mail();
-- Producer limit and balanced consumer selection under a controlled backlog.
update public.reveal_grants set expires_at=now()+interval '2 hours';
select is(public.enqueue_due_full_view_expiry_reminders(),50,'producer bounds first batch to 25 grants / 50 messages');
select is(public.enqueue_due_full_view_expiry_reminders(),12,'next batch reaches remaining six grants');
select is(public.enqueue_due_full_view_expiry_reminders(),0,'bounded producer eventually exhausts only due work');
insert into app_private.notification_outbox(recipient_user_id,notification_type,deduplication_key)
select 'a1660000-1111-4111-8111-000000000001','introduction_declined','expiry-test-normal-'||i from generate_series(1,8) i;
create temp table mixed_claim as select * from public.claim_relationship_notification_outbox(5);
select is((select count(*)::integer from mixed_claim where notification_type='introduction_declined'),3,'regular email retains three of five mixed-backlog slots');
select is((select count(*)::integer from mixed_claim where notification_type in ('full_view_expiring','full_view_access_expiring')),2,'reminders retain two of five mixed-backlog slots');
select is((select count(*)::integer from public.claim_relationship_notification_outbox(2) where notification_type in ('full_view_expiring','full_view_access_expiring')),1,'small two-item batch cannot starve reminders');
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5)),5,'other jobs remain claimable while first batch owns its leases');
select throws_ok($$select public.claim_relationship_notification_outbox(51)$$,'42501',null,'consumer limit enforced');
select throws_ok($$select public.prepare_full_view_expiry_email('bad',1,repeat('a',64),repeat('b',64))$$,'22023',null,'invalid preparation input rejected');
-- Review regression: a bounded sweep must not quarantine its obsolete overflow.
delete from app_private.notification_outbox where recipient_user_id='a1660000-1111-4111-8111-000000000001' or recipient_user_id::text like 'b1660000-%';
insert into app_private.notification_outbox(recipient_user_id,notification_type,deduplication_key,created_at)
select 'a1660000-1111-4111-8111-000000000001','full_view_expiring','expiry-obsolete-'||i,now()-interval '25 hours' from generate_series(1,150) i;
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5)),0,'obsolete overflow never enters delivery');
select is((select count(*)::integer from app_private.notification_outbox where status='failed'),0,'obsolete overflow does not become permanent failure');
select is((select count(*)::integer from app_private.notification_outbox where status='skipped'),100,'first sweep is bounded to 100');
select is((select count(*)::integer from public.claim_relationship_notification_outbox(5)),0,'second sweep also sends nothing obsolete');
select is((select count(*)::integer from app_private.notification_outbox where status='skipped'),150,'subsequent bounded sweep drains the overflow');
delete from app_private.notification_outbox where recipient_user_id='a1660000-1111-4111-8111-000000000001';
-- Preparation failed before provider I/O: preserve the clock when an operator
-- releases recent known-safe work, and keep the pilot queue isolated.
select public.enqueue_due_full_view_expiry_reminders();
update app_private.notification_outbox set status='failed',attempt_count=5,first_attempt_at=now()-interval '45 minutes',last_error_code='REMINDER_PREPARE_FAILED'
 where grant_id='f1660000-1111-4111-8111-000000000001' and notification_type='full_view_expiring';
select is(public.requeue_failed_relationship_notification((select notification_ref from app_private.notification_outbox where grant_id='f1660000-1111-4111-8111-000000000001' and notification_type='full_view_expiring')),'queued','preparation outage has a supported per-item recovery path');
select is((select first_attempt_at from app_private.notification_outbox where grant_id='f1660000-1111-4111-8111-000000000001' and notification_type='full_view_expiring'),now()-interval '45 minutes','manual safe recovery does not reset retry horizon');
update app_private.notification_outbox set status='failed',attempt_count=5,first_attempt_at=now()-interval '5 minutes',last_error_code='REMINDER_PREPARE_FAILED'
 where grant_id='f1660000-1111-4111-8111-000000000001' and notification_type='full_view_access_expiring';
insert into app_private.notification_outbox(recipient_user_id,notification_type,deduplication_key,status,last_error_code)
 values('a1660000-1111-4111-8111-000000000001','pilot_access_declined','expiry-pilot-isolation','failed','REMINDER_PREPARE_FAILED');
select is(public.requeue_failed_relationship_notifications(50),1,'recent safe bulk recovery includes preparation failures');
select is((select status from app_private.notification_outbox where deduplication_key='expiry-pilot-isolation'),'failed','bulk recovery preserves pilot isolation');
select * from finish();
rollback;
