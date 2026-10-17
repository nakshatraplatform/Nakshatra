begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(35);

select pg_temp.create_auth_actor('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','pdf-owner@example.test');
select pg_temp.create_auth_actor('f7100000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000002','pdf-viewer@example.test');
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('f7300000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','Test Person','f7100000-0000-4000-8000-000000000001');
update app_private.identity_verification_subjects set status='verified',verified_at=now()-interval '1 day',expires_at=now()+interval '365 days'
where candidate_id='f7300000-0000-4000-8000-000000000001';
insert into public.portfolios(id,user_id,candidate_id,draft_data)
values('f7400000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft());
insert into public.portfolio_media(portfolio_id,candidate_id,media_type,storage_path,visibility)
values('f7400000-0000-4000-8000-000000000001','f7300000-0000-4000-8000-000000000001','hero','f7100000-0000-4000-8000-000000000001/pdf/hero.webp','public');
select pg_temp.prime_paid_publication('f7400000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft());

select ok(not has_function_privilege('anon','public.prepare_portfolio_pdf()','EXECUTE'),'anonymous users cannot generate a PDF');
select ok(not has_function_privilege('anon','public.validate_portfolio_pdf(text,jsonb)','EXECUTE'),'anonymous users cannot validate owner PDF delivery');
select ok(not has_table_privilege('authenticated','app_private.portfolio_pdf_channels','SELECT'),'codes are not listable by owners');
select ok(not has_table_privilege('anon','app_private.portfolio_pdf_channels','SELECT'),'codes are not listable anonymously');
select ok(not has_function_privilege('authenticated','app_private.invalidate_portfolio_pdf_channels()','EXECUTE'),'trigger helper is private');

set local role authenticated;
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');
select is(public.prepare_portfolio_pdf()->>'status','unavailable','unpublished owner cannot create a PDF channel');
select is(pg_temp.publish_portfolio_as_owner('f7400000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft(),'{}'::jsonb,'{}'::jsonb,'pdf_original_token_01',now()+interval '90 days',1,'#f7f5ef',null)->>'status','ok','fixture publishes through canonical rules');
select set_config('test.pdf_ticket',public.prepare_portfolio_pdf()::text,true);
select is(current_setting('test.pdf_ticket')::jsonb->>'status','ready','published owner receives a PDF ticket');
select set_config('test.pdf_code',current_setting('test.pdf_ticket')::jsonb->>'code',true);
select is(length(current_setting('test.pdf_code')),32,'channel uses a long random code');
select is(public.prepare_portfolio_pdf()->>'code',current_setting('test.pdf_code'),'repeated downloads preserve the channel');
select ok(public.validate_portfolio_pdf(current_setting('test.pdf_code'),current_setting('test.pdf_ticket')::jsonb->'projection'),'unchanged public snapshot validates');
select ok(not public.validate_portfolio_pdf(current_setting('test.pdf_code'),'{}'::jsonb),'modified client projection is rejected');
reset role;
select is((select count(*)::integer from app_private.portfolio_pdf_channels where portfolio_id='f7400000-0000-4000-8000-000000000001' and active),1,'preparation keeps one active reference');
update app_private.api_rate_limits set request_count=10 where action='portfolio_pdf' and subject_key='user:f7100000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');
select is(public.prepare_portfolio_pdf()->>'status','rate_limited','generation quota fails closed');
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_code')),'pdf_original_token_01','quota exhaustion does not revoke a working QR');
reset role;
update app_private.api_rate_limits set request_count=1 where action='portfolio_pdf' and subject_key='user:f7100000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');

select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000002');
select is(public.prepare_portfolio_pdf()->>'status','unavailable','another customer cannot prepare the owner PDF');
select ok(not public.validate_portfolio_pdf(current_setting('test.pdf_code'),current_setting('test.pdf_ticket')::jsonb->'projection'),'another customer cannot validate delivery');
set local role anon;
select pg_temp.set_anon_claims();
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_code')),'pdf_original_token_01','QR opens only the current public introduction');
select is(public.resolve_portfolio_pdf_link('malformed'),null,'malformed code is uniformly unavailable');

set local role authenticated;
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');
select is(public.unpublish_portfolio_transaction()->>'status','unpublished','owner can unpublish');
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_code')),null,'unpublish closes QR');
reset role;
select pg_temp.prime_paid_publication('f7400000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft());
set local role authenticated;
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');
select is(pg_temp.publish_portfolio_as_owner('f7400000-0000-4000-8000-000000000001',pg_temp.complete_portfolio_draft(),'{}'::jsonb,'{}'::jsonb,'pdf_original_token_01',now()+interval '90 days',1,'#f7f5ef',null)->>'status','ok','republication keeps reference');
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_code')),'pdf_original_token_01','republication resumes non-revoked QR');
select is(public.rotate_portfolio_transaction('pdf_replace_token_001')->>'status','rotated','existing rotation succeeds');
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_code')),null,'rotation closes the old PDF reference');
select set_config('test.pdf_new',public.prepare_portfolio_pdf()->>'code',true);
select isnt(current_setting('test.pdf_new'),current_setting('test.pdf_code'),'next download creates a distinct code');
select throws_ok($$select public.rotate_portfolio_transaction('pdf_original_token_01')$$,'23505',null,'retired web token collision fails the whole rotation');
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_new')),'pdf_replace_token_001','failed rotation does not revoke the current PDF');
select ok(public.resolve_public_portfolio('pdf_replace_token_001') is not null,'failed rotation preserves the current web link');
reset role;
select ok(exists(select 1 from app_private.portfolio_web_token_reservations where token='pdf_original_token_01'),'old web token stays reserved');
select throws_ok(format('insert into app_private.portfolio_pdf_channels(code,portfolio_id,active) values(%L,null,false)',current_setting('test.pdf_code')),'23505',null,'retired QR cannot be reused');
delete from public.portfolios where id='f7400000-0000-4000-8000-000000000001';
select is(public.resolve_portfolio_pdf_link(current_setting('test.pdf_new')),null,'deletion closes current QR');
select ok(exists(select 1 from app_private.portfolio_pdf_channels where code=current_setting('test.pdf_new') and portfolio_id is null and not active),'deleted profile leaves only an unassociated retired code');
select pg_temp.set_authenticated_claims('f7100000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001');
delete from auth.sessions where id='f7200000-0000-4000-8000-000000000001';
-- Keep the formerly valid JWT claims, but remove its backing session first.
set local role authenticated;
select throws_ok($$select public.prepare_portfolio_pdf()$$,'42501','authentication session is no longer active','revoked session cannot prepare a file');
select throws_ok(format('select public.validate_portfolio_pdf(%L,%L::jsonb)',current_setting('test.pdf_new'),'{}'),'42501','authentication session is no longer active','revoked session cannot validate delivery');

select * from finish();
rollback;
