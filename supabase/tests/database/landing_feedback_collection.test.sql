begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
\ir auth-fixtures.psql
select plan(15);

select has_table('app_private', 'landing_feedback_submissions', 'landing feedback is stored privately');
select ok(not has_table_privilege('anon', 'app_private.landing_feedback_submissions', 'SELECT'), 'anonymous clients cannot read submissions');
select ok(not has_table_privilege('authenticated', 'app_private.landing_feedback_submissions', 'SELECT'), 'signed-in clients cannot read submissions');
select ok(not has_table_privilege('anon', 'app_private.landing_feedback_submissions', 'INSERT'), 'anonymous clients cannot insert directly');
select ok(not has_function_privilege('anon', 'public.submit_landing_feedback(text,text,text,text,text,boolean,text)', 'EXECUTE'), 'anonymous clients cannot call the submission function');
select ok(not has_function_privilege('authenticated', 'public.submit_landing_feedback(text,text,text,text,text,boolean,text)', 'EXECUTE'), 'signed-in clients cannot call the submission function');
select ok(not has_function_privilege('anon', 'public.purge_landing_feedback()', 'EXECUTE'), 'anonymous clients cannot purge feedback');

set local role service_role;
select is(public.submit_landing_feedback('viewer', 'The public view was clear.', null, null, null, false, repeat('a',64))->>'status', 'saved', 'a viewer can leave private feedback through the service boundary');
select is(public.submit_landing_feedback('creator', 'It was easy to share.', null, 'Aditi', 'aditi@example.test', true, repeat('a',64))->>'status', 'saved', 'a creator may opt in to contact');
select is(public.submit_landing_feedback('family', 'The link was current.', null, null, null, false, repeat('a',64))->>'status', 'saved', 'third submission stays within daily quota');
select is(public.submit_landing_feedback('family', 'A fourth submission.', null, null, null, false, repeat('a',64))->>'status', 'rate_limited', 'the fourth submission is refused');
select is(public.submit_landing_feedback('family', 'A fifth submission.', null, null, null, false, repeat('a',64))->>'status', 'rate_limited', 'later attempts do not create more rows');
select throws_ok($$select public.submit_landing_feedback('viewer','short',null,null,null,false,repeat('b',64))$$, '22023', 'invalid feedback', 'short feedback is rejected');
reset role;
select is((select count(*)::integer from app_private.landing_feedback_submissions), 3, 'the refused submission created no row');
select is((select request_count from app_private.api_rate_limits where action = 'landing_feedback_submit' and subject_key = 'anonymous:' || repeat('a',64)), 4, 'over-limit retries stop updating the quota row');
select * from finish();
rollback;
