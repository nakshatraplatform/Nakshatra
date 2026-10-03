begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(27);

select pg_temp.create_auth_actor(
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'creator@readiness.test'
);
select pg_temp.create_auth_actor(
  'a1000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000002',
  'viewer@readiness.test'
);

insert into app_private.b2c_creator_entitlements(email_hash)
values (app_private.normalized_email_hash('creator@readiness.test'));

insert into public.candidates(id, primary_owner_user_id, display_name, created_by)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'Ready Creator',
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.candidate_personal_details(candidate_id, profile_for)
values ('a3000000-0000-4000-8000-000000000001', 'self');

insert into public.portfolios(
  id, user_id, candidate_id, share_token, draft_data, published_data, is_published
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'readiness_test_token_01',
  '{
    "personal":{"first_name":"Aditi","last_name":"Rao","dob":"1996-08-12","current_location":"Boston","short_bio":"A thoughtful introduction.","profile_for":"self"},
    "career":{"title":"Engineer"}
  }'::jsonb,
  null,
  false
);
insert into public.portfolio_media(
  portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'hero',
  'a1000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/hero.webp',
  'public', 0
);

select has_table('app_private', 'portfolio_publication_progress', 'publication journey is durable');
select has_table('app_private', 'portfolio_payment_events', 'payment callback idempotency is durable');
select ok(not has_function_privilege('anon', 'public.get_portfolio_publication_readiness()', 'EXECUTE'), 'anonymous callers cannot read owner readiness');
select ok(has_function_privilege('authenticated', 'public.get_portfolio_publication_readiness()', 'EXECUTE'), 'authenticated owners can read their readiness');
select ok(not has_function_privilege('authenticated', 'public.record_portfolio_payment_event(uuid,text,text,text,text,text,text,timestamptz)', 'EXECUTE'), 'browser sessions cannot forge payments');

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001'
);
select is(jsonb_array_length(public.get_portfolio_publication_readiness() -> 'missingRequired'), 0, 'the inclusive minimum is complete without optional cultural or astrology details');
select is(public.get_portfolio_publication_readiness() ->> 'verificationStatus', 'required', 'verification is initially required');
select throws_ok(
  $$select public.update_portfolio_onboarding_progress('select_plan', 'launch_30')$$,
  '22023', null, 'plan selection stays deferred during the free private pilot'
);

reset role;
insert into app_private.portfolio_publication_progress(
  portfolio_id,selected_plan_code,plan_selected_at
) values (
  'a4000000-0000-4000-8000-000000000001','launch_30',now()
) on conflict(portfolio_id) do update set
  selected_plan_code=excluded.selected_plan_code,
  plan_selected_at=excluded.plan_selected_at,
  updated_at=now();
set local role service_role;
do $$ begin perform pg_temp.set_service_role_claims(); end $$;
select is(
  public.record_portfolio_payment_event(
    'a4000000-0000-4000-8000-000000000001', 'testpay', 'evt_pending_001', repeat('a', 64),
    'pending', 'launch_30', 'payment_001', now() + interval '30 days'
  ) ->> 'status',
  'verification_required',
  'payment cannot start before verification succeeds'
);

reset role;
select is((select count(*)::integer from app_private.portfolio_payment_events), 0, 'a rejected callback does not consume its idempotency key');

insert into app_private.identity_verification_attempts(
  id,subject_id,candidate_id,provider_subject_ref,status,verification_method,
  portfolio_id,reference_media_id,reference_storage_path,reference_sha256,
  provider_workflow_id,provider_workflow_version,completed_at
)
select 'a5000000-0000-4000-8000-000000000001',subject.id,subject.candidate_id,
  subject.provider_subject_ref,'verified','portfolio_photo_liveness',portfolio.id,
  media.id,media.storage_path,repeat('d',64),'a8000000-0000-4000-8000-000000000001',1,now()
from app_private.identity_verification_subjects subject
join public.portfolios portfolio on portfolio.candidate_id=subject.candidate_id
join public.portfolio_media media on media.portfolio_id=portfolio.id and media.media_type='hero'
where subject.candidate_id='a3000000-0000-4000-8000-000000000001';
update app_private.identity_verification_subjects subject set
  status='verified',verified_at=now(),expires_at=now()+interval '365 days',
  current_proof_method='portfolio_photo_liveness',
  current_proof_attempt_id='a5000000-0000-4000-8000-000000000001',
  current_proof_portfolio_id=portfolio.id,current_proof_media_id=media.id,
  current_proof_sha256=repeat('d',64),
  current_proof_workflow_id='a8000000-0000-4000-8000-000000000001',
  current_proof_workflow_version=1
from public.portfolios portfolio
join public.portfolio_media media on media.portfolio_id=portfolio.id and media.media_type='hero'
where subject.candidate_id='a3000000-0000-4000-8000-000000000001'
  and portfolio.candidate_id=subject.candidate_id;

set local role authenticated;
select pg_temp.set_authenticated_claims(
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001'
);
select is(public.update_portfolio_onboarding_progress('confirm_disclosure', 'publication-disclosure-v1') ->> 'status', 'ok', 'an entitled pilot creator can finalize disclosure without payment');

reset role;
set local role service_role;
do $$ begin perform pg_temp.set_service_role_claims(); end $$;
select is(
  public.record_portfolio_payment_event(
    'a4000000-0000-4000-8000-000000000001', 'testpay', 'evt_paid_001', repeat('b', 64),
    'paid', 'launch_30', 'payment_001', now() + interval '30 days'
  ) ->> 'status', 'processed', 'a verified paid callback activates the entitlement'
);
select is(
  public.record_portfolio_payment_event(
    'a4000000-0000-4000-8000-000000000001', 'testpay', 'evt_paid_001', repeat('b', 64),
    'paid', 'launch_30', 'payment_001', now() + interval '30 days'
  ) ->> 'status', 'duplicate', 'an exact callback retry is idempotent'
);
select is(
  public.record_portfolio_payment_event(
    'a4000000-0000-4000-8000-000000000001', 'testpay', 'evt_paid_001', repeat('c', 64),
    'paid', 'launch_30', 'payment_001', now() + interval '30 days'
  ) ->> 'status', 'conflict', 'an event id cannot be reused with different content'
);

reset role;
set local role authenticated;
select pg_temp.set_authenticated_claims(
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001'
);
select is(public.update_portfolio_onboarding_progress('confirm_disclosure', 'publication-disclosure-v1') ->> 'status', 'ok', 'the final disclosure can be confirmed after verification and payment');
select is(public.get_portfolio_publication_readiness() ->> 'disclosureConfirmed', 'true', 'the disclosure fingerprint is current');
select lives_ok($$update public.portfolios set draft_data = jsonb_set(draft_data, '{personal,short_bio}', '"Updated introduction"') where id = 'a4000000-0000-4000-8000-000000000001'$$, 'draft edits remain available before publication');
select is(public.get_portfolio_publication_readiness() ->> 'disclosureConfirmed', 'false', 'editing disclosure-relevant content invalidates consent');
select throws_ok($$update public.portfolios set is_published = true, published_data = draft_data where id = 'a4000000-0000-4000-8000-000000000001'$$, '23514', 'publication_disclosure_required', 'publication is blocked until changed content is reviewed again');
select is(public.update_portfolio_onboarding_progress('confirm_disclosure', 'publication-disclosure-v1') ->> 'status', 'ok', 'the owner can reconfirm the changed disclosure');
select lives_ok($$update public.portfolios set is_published = true, published_data = draft_data where id = 'a4000000-0000-4000-8000-000000000001'$$, 'all publication gates permit the final transition');
select is(public.get_portfolio_publication_readiness() ->> 'published', 'true', 'the journey reports publication completion');

reset role;
insert into public.interest_requests(
  id, portfolio_id, requester_user_id, viewer_name, viewer_phone, viewer_email,
  email_verified_at, verification_channel, status, metadata
) values (
  'a6000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'Viewer', '+14155550100', 'viewer@readiness.test', now(), 'email', 'approved', '{}'
);
insert into public.access_audit_events(
  portfolio_id, interest_request_id, actor_user_id, subject_user_id, event_type
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000002',
  'request_submitted'
);
select is((select count(*)::integer from app_private.notification_outbox where notification_type = 'new_introduction'), 1, 'a new introduction queues an owner notification');

insert into public.reveal_grants(
  id, interest_request_id, portfolio_id, viewer_user_id, access_level,
  granted_sections, granted_by, expires_at
) values (
  'a7000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'full', array['full'], 'a1000000-0000-4000-8000-000000000001', now() + interval '12 hours'
);

set local role service_role;
do $$ begin perform pg_temp.set_service_role_claims(); end $$;
select is(public.enqueue_due_full_view_expiry_reminders(), 2, 'expiry scheduling notifies both the viewer and portfolio owner');
select is(public.enqueue_due_full_view_expiry_reminders(), 0, 'expiry reminder scheduling is idempotent');
select ok(exists(select 1 from public.claim_notification_outbox_v2(10) where payload ? 'portfolioId'), 'the versioned worker claim includes relationship context');
select ok(has_function_privilege('service_role', 'public.claim_notification_outbox_v2(integer)', 'EXECUTE'), 'only the delivery worker receives the rich claim contract');

select * from finish();
rollback;
