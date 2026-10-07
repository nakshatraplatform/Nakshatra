begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql

select plan(32);

select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'owner@feedback.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'viewer@feedback.test');
select pg_temp.create_auth_actor('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 'admin@feedback.test');

insert into public.candidates(id, primary_owner_user_id, display_name, created_by)
values ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Feedback Owner', 'a1000000-0000-4000-8000-000000000001');
insert into public.portfolios(id, user_id, candidate_id, share_token, draft_data, published_data, is_published, template_id, theme_color)
values ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'feedback_token_01', '{}', '{}', false, 1, '#17151c');

select has_table('app_private', 'creator_onboarding_feedback', 'feedback has a private table');
select ok(not has_table_privilege('authenticated', 'app_private.creator_onboarding_feedback', 'SELECT'), 'clients cannot enumerate feedback rows');
select ok(not has_table_privilege('authenticated', 'app_private.creator_onboarding_feedback', 'INSERT'), 'clients cannot bypass the feedback RPC');
select ok(not has_function_privilege('anon', 'public.submit_creator_onboarding_feedback(integer,text,text)', 'EXECUTE'), 'anonymous users cannot submit feedback');
select ok(not has_function_privilege('anon', 'public.submit_creator_onboarding_feedback_v2(integer,text[],text[],text)', 'EXECUTE'), 'anonymous users cannot submit multi-select feedback');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001');
select throws_ok($$select public.submit_creator_onboarding_feedback(5, 'details', 'good')$$,
  '42501', 'completed portfolio required', 'incomplete portfolios cannot submit completion feedback');
select throws_ok($$select public.submit_creator_onboarding_feedback(6, 'details', 'good')$$,
  '22023', 'invalid onboarding feedback', 'ratings are bounded');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['details'], array['preview'], null)$$,
  '42501', 'completed portfolio required', 'multi-select cannot bypass portfolio completion');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['none','photos'], array[]::text[], null)$$,
  '22023', 'invalid onboarding feedback', 'nothing stood out cannot be combined with another difficulty');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['details','details'], array[]::text[], null)$$,
  '22023', 'invalid onboarding feedback', 'duplicate difficulty values are rejected');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array[]::text[], array[]::text[], null)$$,
  '22023', 'invalid onboarding feedback', 'at least one difficulty choice is required');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['details'], array['privacy','privacy'], null)$$,
  '22023', 'invalid onboarding feedback', 'duplicate liked choices are rejected');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['unknown'], array[]::text[], null)$$,
  '22023', 'invalid onboarding feedback', 'unknown difficulty choices are rejected');

reset role;
insert into public.candidate_personal_details(candidate_id, profile_for)
values ('a3000000-0000-4000-8000-000000000001', 'self');
update public.portfolios set draft_data = pg_temp.complete_portfolio_draft(
  '{"personal":{"name":"Feedback Owner"}}'::jsonb
) where id = 'a4000000-0000-4000-8000-000000000001';
insert into public.portfolio_media(portfolio_id, candidate_id, media_type, storage_path, visibility, sort_order, metadata)
values ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'hero',
  'a1000000-0000-4000-8000-000000000001/a4000000-0000-4000-8000-000000000001/hero.webp', 'public', 0, '{}');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001');
select is(public.submit_creator_onboarding_feedback_v2(3, array['photos','publishing'], array['preview','privacy'], 'More control') ->> 'status', 'saved', 'completed owner can submit one private response');
select is(public.get_creator_onboarding_feedback() ->> 'comment', 'More control', 'owner can retrieve own feedback');
select is(public.get_creator_onboarding_feedback() ->> 'easeRating', '3', 'owner can retrieve initial rating');
select is(public.export_my_account_data() #>> '{onboardingFeedback,hardest_step}', 'photos', 'feedback is included in own data export');
select is(public.get_creator_onboarding_feedback() -> 'hardestSteps', '["photos", "publishing"]'::jsonb, 'owner can retrieve multiple hardest steps');
select is(public.get_creator_onboarding_feedback() -> 'likedAspects', '["preview", "privacy"]'::jsonb, 'owner can retrieve liked aspects');
select is(public.export_my_account_data() #> '{onboardingFeedback,liked_aspects}', '["preview", "privacy"]'::jsonb, 'liked aspects are included in own data export');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(5, array['details'], array[]::text[], 'Changed')$$,
  '23505', 'feedback already submitted', 'repeat multi-select submission cannot overwrite feedback');
select throws_ok($$select public.submit_creator_onboarding_feedback(5, 'details', 'Changed')$$,
  '23505', 'feedback already submitted', 'older single-choice clients cannot overwrite feedback');
select is(public.get_creator_onboarding_feedback() -> 'hardestSteps', '["photos", "publishing"]'::jsonb, 'duplicate submissions preserve original choices');
select is(public.get_creator_onboarding_feedback() ->> 'comment', 'More control', 'duplicate submissions preserve original comment');

set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002');
select is(public.get_creator_onboarding_feedback(), null::jsonb, 'another account cannot retrieve owner feedback');
select throws_ok($$select public.submit_creator_onboarding_feedback(1, 'other', 'not mine')$$,
  '42501', 'completed portfolio required', 'another account cannot submit against the owner portfolio');
select throws_ok($$select public.submit_creator_onboarding_feedback_v2(1, array['other'], array[]::text[], null)$$,
  '42501', 'completed portfolio required', 'another account cannot submit multi-select feedback against the owner portfolio');
select throws_ok($$select public.list_creator_onboarding_feedback(50)$$,
  '42501', 'pilot administrator required', 'an ordinary user cannot list aggregate feedback');

reset role;
insert into app_private.pilot_administrators(user_id) values ('a1000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.set_authenticated_claims('a1000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003');
select is(pg_catalog.jsonb_array_length(public.list_creator_onboarding_feedback(50)), 1, 'only the administrator can list feedback');
select is(pg_catalog.jsonb_array_length(public.list_creator_onboarding_feedback(null)), 1, 'null list limit still uses a bounded default');
select is(public.list_creator_onboarding_feedback(50) #> '{0,likedAspects}', '["preview", "privacy"]'::jsonb, 'administrator list includes liked choices');

reset role;
select is((select count(*)::integer from app_private.creator_onboarding_feedback), 1, 'duplicate submissions do not create another row');

select * from finish();
rollback;
