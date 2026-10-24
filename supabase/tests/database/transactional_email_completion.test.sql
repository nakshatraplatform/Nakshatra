begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(29);

create function pg_temp.mail_owner(p_index integer) returns void language plpgsql as $$
declare
  u uuid:=('88010000-0000-4000-8000-'||lpad(p_index::text,12,'0'))::uuid;
  s uuid:=('88020000-0000-4000-8000-'||lpad(p_index::text,12,'0'))::uuid;
  c uuid:=('88030000-0000-4000-8000-'||lpad(p_index::text,12,'0'))::uuid;
  p uuid:=('88040000-0000-4000-8000-'||lpad(p_index::text,12,'0'))::uuid;
  draft jsonb:=pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Mail","last_name":"Fixture","name":"Mail Fixture"}}');
begin
  perform pg_temp.create_auth_actor(u,s,'mail-'||p_index||'@example.test');
  insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values(c,u,'Mail Fixture',u);
  update app_private.identity_verification_subjects set status='verified',verified_at=now(),expires_at=now()+interval '365 days' where candidate_id=c;
  insert into public.portfolios(id,user_id,candidate_id,draft_data) values(p,u,c,draft);
  insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility) values(p,c,'hero',u::text||'/mail/hero.webp','public');
  perform pg_temp.prime_paid_publication(p,draft);
end; $$;
select pg_temp.mail_owner(1);
select pg_temp.mail_owner(2);
select is((select count(*) from app_private.notification_outbox),0::bigint,'drafts send no email');
select ok(not has_table_privilege('authenticated','app_private.portfolio_publication_receipts','INSERT'),'clients cannot forge publication markers');
select ok(not has_table_privilege('service_role','app_private.portfolio_publication_receipts','DELETE'),'workers cannot reset first-publication dedup');
select ok(not has_table_privilege('authenticated','public.access_audit_events','INSERT'),'clients cannot forge submission audit events');
select ok(not has_function_privilege('authenticated','app_private.enqueue_interest_receipt()','EXECUTE'),'clients cannot invoke receipt producer');
select ok(not has_function_privilege('service_role','app_private.enqueue_publication_receipt()','EXECUTE'),'service must use guarded publication');

set local role authenticated;
select pg_temp.set_authenticated_claims('88010000-0000-4000-8000-000000000001','88020000-0000-4000-8000-000000000001');
select is(pg_temp.publish_portfolio_as_owner('88040000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Mail","last_name":"Fixture","name":"Mail Fixture"}}'),'{}','{}',null,null,1,'#f7f5ef',null)->>'status','ok','guarded publication succeeds');
reset role;
select is((select count(*) from app_private.notification_outbox where notification_type='vivara_published' and recipient_user_id='88010000-0000-4000-8000-000000000001'),1::bigint,'first publication queues exactly one owner confirmation');
-- Simulate retained mail pruning and republication: durable marker must survive.
delete from app_private.notification_outbox where notification_type='vivara_published';
update public.portfolios set is_published=false where id='88040000-0000-4000-8000-000000000001';
update public.portfolios set is_published=true where id='88040000-0000-4000-8000-000000000001';
select is((select count(*) from app_private.notification_outbox),0::bigint,'republishing after mail retention does not duplicate confirmation');
savepoint rollback_publication;
update public.portfolios set is_published=true where id='88040000-0000-4000-8000-000000000002';
rollback to rollback_publication;
select is((select count(*) from app_private.portfolio_publication_receipts),1::bigint,'rolled back publication leaves no marker');
select is((select count(*) from app_private.notification_outbox),0::bigint,'rolled back publication leaves no email');

set local role authenticated;
select pg_temp.set_authenticated_claims('88010000-0000-4000-8000-000000000002','88020000-0000-4000-8000-000000000002');
select is(pg_temp.publish_portfolio_as_owner('88040000-0000-4000-8000-000000000002',pg_temp.complete_portfolio_draft('{"personal":{"first_name":"Mail","last_name":"Fixture","name":"Mail Fixture"}}'),'{}','{}',null,null,1,'#f7f5ef',null)->>'status','ok','second actor publishes using live session');
select ok(public.submit_existing_interest('mail-fixture','Our family values kindness, honesty, and a thoughtful introduction.',null,
  '{"country":"United States","state":"Massachusetts","city":"Boston","countryCode":"US","subdivisionCode":"US-MA","postalCode":"02108","locationSource":"manual"}'),'live requester submits interest');
reset role;
select is((select count(*) from app_private.notification_outbox where notification_type='new_introduction' and recipient_user_id='88010000-0000-4000-8000-000000000001'),1::bigint,'existing owner notification preserved');
select is((select count(*) from app_private.notification_outbox where notification_type='interest_received' and recipient_user_id='88010000-0000-4000-8000-000000000002'),1::bigint,'requester receives one distinct receipt');
select is((select count(*) from public.reveal_grants),0::bigint,'receipt does not grant private access');
savepoint rollback_request;
insert into public.access_audit_events(portfolio_id,interest_request_id,actor_user_id,subject_user_id,event_type)
select portfolio_id,id,requester_user_id,requester_user_id,'request_submitted' from public.interest_requests;
rollback to rollback_request;
select is((select count(*) from app_private.notification_outbox where notification_type='interest_received'),1::bigint,'rolled back submission creates no extra receipt');
set local role anon;
select pg_temp.set_anon_claims();
select throws_ok($$select public.submit_existing_interest('mail-fixture','Our family values kindness, honesty, and a thoughtful introduction.',null,
  '{"country":"United States","state":"Massachusetts","city":"Boston","countryCode":"US","subdivisionCode":"US-MA","postalCode":"02108","locationSource":"manual"}')$$,'42501',null,'anonymous requests cannot generate email');
reset role;
select is((select count(*) from app_private.notification_outbox),3::bigint,'unauthorized submission leaves all mail unchanged');

set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*) from public.claim_relationship_notification_outbox(10)),3::bigint,'worker claims publication, requester receipt and owner notice');
select is((select count(*) from public.claim_relationship_notification_outbox(10)),0::bigint,'leased jobs cannot be claimed twice');
reset role;
-- Store references only in session settings, avoiding role-dependent temp tables.
select set_config('test.publication_ref',(select notification_ref from app_private.notification_outbox where notification_type='vivara_published'),true);
select set_config('test.receipt_ref',(select notification_ref from app_private.notification_outbox where notification_type='interest_received'),true);
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.complete_relationship_notification_outbox(current_setting('test.publication_ref'),2,true),'unavailable','stale attempt cannot complete new email');
select is(public.complete_relationship_notification_outbox(current_setting('test.publication_ref'),1,true),'sent','publication uses fenced completion');
select is(public.complete_relationship_notification_outbox(current_setting('test.receipt_ref'),1,false,'EMAIL_NOT_CONFIGURED',false),'failed','receipt failure is recorded');
select is((public.production_worker_health()->>'heldRelationshipNotifications')::integer,1,'health reports failed new type');
select is(public.requeue_failed_relationship_notification(current_setting('test.receipt_ref'),false),'queued','safe individual receipt retry supported');
reset role;
update app_private.notification_outbox set status='failed',last_error_code='EMAIL_NOT_CONFIGURED',lease_expires_at=null where notification_type='interest_received';
set local role service_role;
select pg_temp.set_service_role_claims();
select is(public.requeue_failed_relationship_notifications(10),1,'safe bounded bulk recovery includes receipts');
reset role;
update app_private.notification_outbox set status='failed',last_error_code='STALE_NOTIFICATION_REVIEW_REQUIRED',lease_expires_at=null where notification_type='interest_received';
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.suppress_failed_relationship_notification(current_setting('test.receipt_ref')),'operator can suppress obsolete receipt');
select is((public.production_worker_health()->>'heldRelationshipNotifications')::integer,0,'suppressed receipt no longer reports unresolved work');
reset role;
select * from finish();
rollback;
