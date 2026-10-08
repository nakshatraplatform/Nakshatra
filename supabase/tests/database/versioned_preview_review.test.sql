begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(14);

select pg_temp.create_auth_actor('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','review@fixture.test');
select pg_temp.create_auth_actor('81000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','other@fixture.test');
insert into app_private.b2c_creator_entitlements(email_hash) values
  (app_private.normalized_email_hash('review@fixture.test')),(app_private.normalized_email_hash('other@fixture.test'));
insert into public.candidates(id,primary_owner_user_id,display_name,created_by) values('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Test Person','81000000-0000-4000-8000-000000000001');
insert into public.candidate_personal_details(candidate_id,profile_for) values('83000000-0000-4000-8000-000000000001','self');
insert into public.portfolios(id,user_id,candidate_id,draft_data,is_published) values('84000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft(),false);
insert into public.portfolio_media(id,portfolio_id,candidate_id,media_type,storage_path,visibility,sort_order) values('85000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','hero','81000000-0000-4000-8000-000000000001/hero.webp','public',0);
select ok(not has_function_privilege('authenticated','app_private.portfolio_review_fingerprint(uuid)','EXECUTE'),'hash function is not a cross-owner browser endpoint');
set local role authenticated;
select pg_temp.set_authenticated_claims('81000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001');
select is(public.update_portfolio_onboarding_progress('previewed')#>>'{readiness,publicPreviewReviewed}','false','old preview-started does not count as both views');
select is(public.update_portfolio_onboarding_progress('public_preview',public.get_portfolio_publication_readiness()->>'reviewFingerprint')#>>'{readiness,publicPreviewReviewed}','true','owner can record first preview');
select is(public.get_portfolio_publication_readiness()->>'completePreviewReviewed','false','one preview does not complete the other');
select is(public.update_portfolio_onboarding_progress('complete_preview',public.get_portfolio_publication_readiness()->>'reviewFingerprint')#>>'{readiness,completePreviewReviewed}','true','second preview is durable');
select is(public.get_portfolio_publication_readiness()->>'publicPreviewReviewed','true','later reads remember the first preview');
select is(public.get_portfolio_publication_readiness()->>'disclosureConfirmed','false','preview evidence never auto-confirms publication consent');
select is(public.update_portfolio_onboarding_progress('confirm_disclosure','publication-disclosure-v2')->>'status','verification_required','review evidence never bypasses liveness');
select is(public.update_portfolio_onboarding_progress('public_preview',repeat('a',64))->>'status','review_changed','stale revision is rejected');
update public.portfolios set draft_data=jsonb_set(draft_data,'{personal,short_bio}','"Changed introduction"') where user_id=auth.uid();
select is(public.get_portfolio_publication_readiness()->>'publicPreviewReviewed','false','answer edit invalidates reviewed version');
select is(public.update_portfolio_onboarding_progress('public_preview',public.get_portfolio_publication_readiness()->>'reviewFingerprint')#>>'{readiness,publicPreviewReviewed}','true','changed version can be reviewed anew');
update public.portfolio_media set visibility='blurred' where id='85000000-0000-4000-8000-000000000001';
select is(public.get_portfolio_publication_readiness()->>'publicPreviewReviewed','false','photo visibility invalidates review');
select pg_temp.set_authenticated_claims('81000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002');
select is(public.update_portfolio_onboarding_progress('public_preview',repeat('a',64))->>'status','not_found','other owner cannot mutate this review');
select is(public.get_portfolio_publication_readiness()->>'reviewFingerprint',null::text,'other owner receives no hash for this portfolio');
reset role;
select * from finish();
rollback;
