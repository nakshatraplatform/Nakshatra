begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(72);

select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000001', 'a1100000-0000-4000-8000-000000000001', 'owner@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000002', 'a1100000-0000-4000-8000-000000000002', 'viewer@access.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000003', 'a1100000-0000-4000-8000-000000000003', 'stranger@access.test');

insert into app_private.b2c_creator_entitlements (email_hash)
values (app_private.normalized_email_hash('owner@access.test'));

insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Aditi Rao',
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.candidates (id, primary_owner_user_id, display_name, created_by)
values (
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000002',
  'Rohan Mehta',
  'a1000000-0000-4000-8000-000000000002'
);

update app_private.identity_verification_subjects
set status = 'verified', verified_at = now() - interval '1 day', expires_at = now() + interval '365 days'
where candidate_id = 'a2000000-0000-4000-8000-000000000001';

insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data,
  is_published, expires_at, template_id, theme_color, sun_sign
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'phase2_secure_token_1',
  '{"personal":{"name":"Original Draft"}}'::jsonb,
  '{"personal":{"name":"Original Draft"}}'::jsonb,
  false,
  now() + interval '90 days',
  3,
  '#17151c',
  'kanya'
);

insert into public.portfolios (
  id, user_id, candidate_id, share_token, draft_data, published_data,
  is_published, expires_at, template_id, theme_color, sun_sign
) values (
  'a3000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000002',
  'viewer_private_token_1',
  '{"personal":{"name":"Rohan Mehta","profile_for":"self"}}'::jsonb,
  null,
  false,
  null,
  3,
  '#17151c',
  'kanya'
);

insert into public.portfolio_media (
  id, portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order, metadata
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'hero',
  'a1000000-0000-4000-8000-000000000001/a3000000-0000-4000-8000-000000000001/hero.webp',
  'public',
  0,
  '{"width":800,"height":1200}'::jsonb
);

select pg_temp.prime_paid_publication(
  'a3000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft('{"personal":{"name":"Aditi Draft"},"contact":{"phone":"private"}}'::jsonb)
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';

select is(
  public.publish_portfolio_transaction(
    'a3000000-0000-4000-8000-000000000001',
    pg_temp.complete_portfolio_draft('{"personal":{"name":"Aditi Draft"},"contact":{"phone":"private"}}'::jsonb),
    '{"personal":{"name":"Aditi Public"}}'::jsonb,
    '{"personal":{"name":"Aditi Full"},"family":{"father":{"name":"Private Parent"}}}'::jsonb,
    'phase2_secure_token_1', now() + interval '90 days', 3, '#17151c', 'kanya'
  ) ->> 'status',
  'ok',
  'owner publication commits the public and approved projections together'
);
select is((select is_active from public.public_portfolio_snapshots where portfolio_id = 'a3000000-0000-4000-8000-000000000001'), true, 'publication activates the public snapshot');
select is((select data #>> '{personal,name}' from public.approved_portfolio_snapshots where portfolio_id = 'a3000000-0000-4000-8000-000000000001'), 'Aditi Full', 'publication stores the approved projection');
select ok(public.is_published_portfolio('a3000000-0000-4000-8000-000000000001'), 'the shared publication predicate accepts an active token-aligned snapshot');
update public.public_portfolio_snapshots
set share_token = 'mismatch_secure_tok01'
where portfolio_id = 'a3000000-0000-4000-8000-000000000001';
select ok(not public.is_published_portfolio('a3000000-0000-4000-8000-000000000001'), 'the shared publication predicate rejects a token mismatch');
update public.public_portfolio_snapshots
set share_token = 'phase2_secure_token_1'
where portfolio_id = 'a3000000-0000-4000-8000-000000000001';
select ok(public.is_published_portfolio('a3000000-0000-4000-8000-000000000001'), 'restoring token alignment restores the publication predicate');

select throws_ok(
  $$select public.publish_portfolio_transaction(
    'a3000000-0000-4000-8000-000000000001',
    '{"personal":{"name":"Rollback Draft"}}'::jsonb,
    '{"personal":{"name":"Unsafe"},"contact":{"phone":"leak"}}'::jsonb,
    '{"personal":{"name":"Rollback Full"}}'::jsonb,
    'unused_secure_token01', now() + interval '90 days', 3, '#17151c', 'kanya'
  )$$,
  '23514', null,
  'a forbidden public projection aborts the publication transaction'
);
select is((select draft_data #>> '{personal,name}' from public.portfolios where id = 'a3000000-0000-4000-8000-000000000001'), 'Aditi Draft', 'failed publication rolls the private draft back');
select is((select data #>> '{personal,name}' from public.approved_portfolio_snapshots where portfolio_id = 'a3000000-0000-4000-8000-000000000001'), 'Aditi Full', 'failed publication rolls the approved projection back');

select throws_ok(
  $$select public.publish_portfolio_transaction(
    'a3000000-0000-4000-8000-000000000001',
    '{"personal":{"name":"Approved Rollback Draft"}}'::jsonb,
    '{"personal":{"name":"Still Safe"}}'::jsonb,
    '{"personal":{"name":"Unsafe Full"},"private_notes":"must remain owner-only"}'::jsonb,
    'unused_secure_token01', now() + interval '90 days', 3, '#17151c', 'kanya'
  )$$,
  '23514', null,
  'an owner-only field aborts the approved publication transaction'
);
select is((select draft_data #>> '{personal,name}' from public.portfolios where id = 'a3000000-0000-4000-8000-000000000001'), 'Aditi Draft', 'an invalid approved projection rolls the private draft back');
select is((select data #>> '{personal,name}' from public.approved_portfolio_snapshots where portfolio_id = 'a3000000-0000-4000-8000-000000000001'), 'Aditi Full', 'an invalid approved projection preserves the prior Complete Portfolio snapshot');

reset role;
select ok(not has_function_privilege('anon', 'public.submit_public_interest(text,text,text,text,text,text,text,text,text,text,text,text)', 'EXECUTE'), 'anonymous visitors cannot execute the access request command');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select ok(
  public.submit_public_interest(
    'phase2_secure_token_1', 'Rohan Mehta', 'self', '',
    'viewer@access.test', 'Toronto, Canada',
    'A family introduction with sufficient detail.',
    'We would be glad to introduce our families.', null
  ),
  'an authenticated viewer can submit a request'
);
select is((select requester_user_id from public.interest_requests limit 1), 'a1000000-0000-4000-8000-000000000002'::uuid, 'the request is bound to the authenticated identity');
select is((select viewer_phone from public.interest_requests limit 1), null, 'a registered viewer can reuse a portfolio without supplying a phone number');

-- Access audit events are intentionally visible only to portfolio managers.
-- Inspect the immutable event from the migration-test role rather than weakening that RLS boundary.
reset role;
select is((select metadata ->> 'profile_source' from public.access_audit_events where event_type = 'request_submitted' limit 1), 'vivintro_portfolio', 'the request audit records that identity came from a VivIntro portfolio');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is((select status::text from public.interest_requests limit 1), 'new', 'new requests start in the expected state');
select ok(
  public.submit_public_interest(
    'phase2_secure_token_1', 'Different Display Name', 'relative', '+1 555 010 9999',
    'viewer@access.test', 'Vancouver, Canada',
    'A second family introduction with enough detail.',
    'This repeat must not bypass the existing request.', null
  ),
  'repeat submissions return the same privacy-preserving success response'
);
select is((select count(*)::integer from public.interest_requests), 1, 'repeat submissions do not create duplicate active requests');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'approved'), 'approved', 'the owner can approve a new request');
select is((select count(*)::integer from public.reveal_grants where revoked_at is null), 1, 'approval creates exactly one active grant');
select ok((select expires_at between now() + interval '14 days' and now() + interval '16 days' from public.reveal_grants limit 1), 'new Complete Portfolio access expires after 15 days');
select is((select count(*)::integer from public.access_audit_events where event_type = 'grant_created'), 1, 'approval creates an immutable grant audit event');
select is(public.list_portfolio_access() #>> '{grants,0,viewerName}', 'Rohan Mehta', 'the owner access summary returns the bounded grant history');
select ok(pg_catalog.jsonb_array_length(public.list_portfolio_access() -> 'events') >= 2, 'the owner access summary includes recent lifecycle events');
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'approved'), 'already_approved', 'repeated approval is idempotent');
select is((select count(*)::integer from public.reveal_grants), 1, 'repeated approval never duplicates the grant');

reset role;
select ok(not has_function_privilege('anon', 'public.resolve_complete_portfolio_access(uuid)', 'EXECUTE'), 'anonymous callers cannot resolve Complete Portfolio email links');
select ok(has_function_privilege('authenticated', 'public.resolve_complete_portfolio_access(uuid)', 'EXECUTE'), 'authenticated viewers can resolve their identity-bound access link');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.resolve_complete_portfolio_access((select id from public.reveal_grants limit 1)) ->> 'status', 'active', 'the approved viewer can resolve the per-grant landing link');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select is(public.resolve_complete_portfolio_access((select id from public.reveal_grants limit 1)) ->> 'status', 'unavailable', 'the same per-grant link reveals nothing to another account');

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select ok(exists(select 1 from public.claim_relationship_notification_outbox(10) where notification_type = 'full_view_approved'), 'the relationship worker can claim the approval email without consuming unrelated pilot jobs');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000003"}';
select is(public.resolve_approved_portfolio('phase2_secure_token_1'), null, 'another authenticated user cannot use someone else''s grant');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.resolve_approved_portfolio('phase2_secure_token_1') #>> '{data,personal,name}', 'Aditi Full', 'the approved viewer receives the Complete Portfolio projection');
select ok(
  (public.resolve_approved_portfolio('phase2_secure_token_1') ->> 'accessExpiresAt')::timestamptz > now(),
  'the approved projection includes the grant expiry used to bound signed capabilities'
);
reset role;
select is((select count(*)::integer from public.access_audit_events where event_type = 'grant_accessed'), 1, 'approved access is recorded without sensitive payload data');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.resolve_approved_portfolio('phase2_secure_token_1') #>> '{data,personal,name}', 'Aditi Full', 'repeat Complete Portfolio access remains available');
reset role;
select is((select count(*)::integer from public.access_audit_events where event_type = 'grant_accessed'), 1, 'repeat access within one hour does not create duplicate audit noise');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'rejected'), 'rejected', 'the owner can reject an approved request');
select ok((select revoked_at is not null and revocation_reason = 'request_rejected' from public.reveal_grants limit 1), 'rejection revokes the active grant atomically');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.resolve_approved_portfolio('phase2_secure_token_1'), null, 'a rejected viewer loses Complete Portfolio access immediately');
select ok(
  public.submit_public_interest(
    'phase2_secure_token_1', 'Rohan Mehta', 'self', '+1 555 010 2200',
    'viewer@access.test', 'Toronto, Canada',
    'A family introduction with sufficient detail.',
    'A repeat after rejection must still use owner reopen.', null
  ),
  'a rejected viewer receives a non-enumerating request response'
);
select is((select count(*)::integer from public.interest_requests), 1, 'rejection cannot be bypassed by submitting a second request');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'approved'), 'invalid_transition', 'a rejected request cannot jump directly back to approved');
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'reopened'), 'reopened', 'the owner can explicitly reopen a rejected request');
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'approved'), 'approved', 'a reopened request can be approved again');
select is((select count(*)::integer from public.reveal_grants where revoked_at is null), 1, 'reapproval creates one replacement active grant');

select is(public.manage_reveal_grant((select id from public.reveal_grants where revoked_at is null), 'renew') ->> 'status', 'renewed', 'the owner can renew active Complete Portfolio access');
select ok((select renewed_at is not null and expires_at between now() + interval '14 days' and now() + interval '16 days' from public.reveal_grants where revoked_at is null), 'renewal resets access to 15 days from the action time');
select is(public.manage_reveal_grant((select id from public.reveal_grants where revoked_at is null), 'revoke') ->> 'status', 'revoked', 'the owner can revoke Complete Portfolio access');
select is((select status::text from public.interest_requests limit 1), 'rejected', 'manual revocation returns the request to rejected');

reset role;
select throws_ok(
  $$update public.access_audit_events set metadata = '{"changed":true}'::jsonb where id = (select min(id) from public.access_audit_events)$$,
  '55000', null,
  'access audit events cannot be edited'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000001"}';
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'reopened'), 'reopened', 'revoked access can be deliberately reopened');
select is(public.decide_interest_request((select id from public.interest_requests limit 1), 'approved'), 'approved', 'reopened access can receive a new grant');
select is(public.rotate_portfolio_transaction('rotated_secure_tok_01') ->> 'status', 'rotated', 'link rotation completes as one owner transaction');
select is(public.resolve_public_portfolio('phase2_secure_token_1'), null, 'rotation invalidates the former public token immediately');
select is((select count(*)::integer from public.reveal_grants where revoked_at is null), 0, 'rotation revokes every outstanding grant');
select is((select status::text from public.interest_requests limit 1), 'closed', 'rotation closes approved access requests');

select is(public.unpublish_portfolio_transaction() ->> 'status', 'unpublished', 'unpublish completes as one owner transaction');
select is(public.resolve_public_portfolio('rotated_secure_tok_01'), null, 'unpublish removes public access without deleting the draft');
select ok(not public.is_published_portfolio('a3000000-0000-4000-8000-000000000001'), 'Storage publication checks fail closed after unpublish');
select is((select count(*)::integer from public.access_audit_events where event_type in ('portfolio_rotated', 'portfolio_unpublished')), 2, 'rotation and unpublish are both present in owner history');

select is(
  public.replace_candidate_relationships_and_timeline(
    'a2000000-0000-4000-8000-000000000001',
    '[{"relationship":"father","name":"Saved Parent"}]'::jsonb,
    '{"degree":"MBA","end_year":"2020"}'::jsonb,
    '{"title":"Engineer","is_current":"true"}'::jsonb
  ),
  'updated',
  'candidate relationships and timeline replace together'
);
select is((select name from public.candidate_family_members where candidate_id = 'a2000000-0000-4000-8000-000000000001'), 'Saved Parent', 'the valid replacement is persisted');
select throws_ok(
  $$select public.replace_candidate_relationships_and_timeline(
    'a2000000-0000-4000-8000-000000000001',
    '[{"relationship":"mother","name":"Should Roll Back"}]'::jsonb,
    '{"degree":"Invalid","end_year":"not-a-year"}'::jsonb,
    null
  )$$,
  '22P02', null,
  'an invalid timeline row aborts the replacement transaction'
);
select is((select name from public.candidate_family_members where candidate_id = 'a2000000-0000-4000-8000-000000000001'), 'Saved Parent', 'failed replacement preserves the last known-good family data');

select pg_temp.prime_paid_publication(
  'a3000000-0000-4000-8000-000000000001',
  pg_temp.complete_portfolio_draft('{"personal":{"name":"Republished Draft"}}'::jsonb)
);
select is(
  public.publish_portfolio_transaction(
    'a3000000-0000-4000-8000-000000000001',
    pg_temp.complete_portfolio_draft('{"personal":{"name":"Republished Draft"}}'::jsonb),
    '{"personal":{"name":"Republished Public"}}'::jsonb,
    '{"personal":{"name":"Republished Full"}}'::jsonb,
    'ignored_secure_token1', now() + interval '90 days', 3, '#17151c', 'kanya'
  ) ->> 'status',
  'ok',
  'an owner can republish a previously unpublished portfolio'
);
select ok(public.is_published_portfolio('a3000000-0000-4000-8000-000000000001'), 'republish restores the shared Storage publication predicate');

reset role;
insert into public.interest_requests (
  id, portfolio_id, requester_user_id, viewer_name, status, requested_sections
) values (
  'a5000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'Expired Viewer',
  'approved',
  array['full']::text[]
);
insert into public.reveal_grants (
  id, interest_request_id, portfolio_id, viewer_user_id, access_level,
  granted_sections, granted_by, created_at, expires_at
) values (
  'a6000000-0000-4000-8000-000000000002',
  'a5000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'full',
  array['full']::text[],
  'a1000000-0000-4000-8000-000000000001',
  now() - interval '7 days',
  now() - interval '1 day'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"a1100000-0000-4000-8000-000000000002"}';
select is(public.resolve_approved_portfolio('rotated_secure_tok_01'), null, 'an expired grant cannot resolve Complete Portfolio data');
select is((select count(*)::integer from public.reveal_grants), 0, 'RLS hides expired grants from the viewer');
reset role;
select is((select count(*)::integer from public.access_audit_events where grant_id = 'a6000000-0000-4000-8000-000000000002' and event_type = 'grant_expired'), 1, 'the first expired access attempt records one expiry event');

select * from finish();
rollback;
