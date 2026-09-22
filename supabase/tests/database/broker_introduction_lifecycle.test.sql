begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(34);

select has_table('app_private','portfolio_disclosure_versions','immutable disclosure versions are private');
select has_table('app_private','broker_portfolio_update_notices','per-mandate update notices are private');
select has_table('app_private','broker_introductions','broker introductions are private');
select has_table('app_private','broker_introduction_passes','claim credentials are private');
select has_table('app_private','broker_introduction_events','minimal audit events are private');

select ok((select relrowsecurity from pg_class where oid='app_private.portfolio_disclosure_versions'::regclass),'disclosure versions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='app_private.broker_portfolio_update_notices'::regclass),'update notices have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='app_private.broker_introductions'::regclass),'introductions have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='app_private.broker_introduction_passes'::regclass),'passes have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='app_private.broker_introduction_events'::regclass),'events have RLS enabled');

select ok(not has_table_privilege('authenticated','app_private.portfolio_disclosure_versions','select'),'clients cannot read version snapshots directly');
select ok(not has_table_privilege('authenticated','app_private.broker_portfolio_update_notices','select'),'clients cannot enumerate update notices directly');
select ok(not has_table_privilege('authenticated','app_private.broker_introductions','select'),'clients cannot enumerate introductions directly');
select ok(not has_table_privilege('authenticated','app_private.broker_introduction_passes','select'),'clients cannot read credential hashes directly');
select ok(not has_table_privilege('authenticated','app_private.broker_introduction_events','select'),'clients cannot enumerate audit events directly');

select has_function('public','prepare_broker_introduction',array['text','text'],'authorized preparation command exists');
select has_function('public','create_broker_introduction',array['text','text','text','jsonb','text','text','text','text','text'],'version-pinned create command exists');
select has_function('public','mark_broker_introduction_shared',array['text','text','bigint'],'share transition exists');
select has_function('public','revoke_broker_introduction',array['text','text','bigint'],'revocation transition exists');
select has_function('public','resolve_broker_introductions',array['text','text'],'broker-scoped list projection exists');
select has_function('public','claim_broker_introduction_pass',array['text','text','text'],'single-use claim command exists');
select has_function('public','resolve_broker_introduction',array['text','text'],'device-scoped resolver exists');
select has_function('public','respond_to_broker_introduction',array['text','text','text','text','boolean'],'confirmation-aware immutable response command exists');
select has_function('public','resolve_broker_portfolio_update_notices',array['text','text'],'isolated notice projection exists');
select has_function('public','flag_broker_portfolio_update',array['text','text','text'],'optional clarification command exists');
select has_function('public','resolve_my_broker_introduction_responses',array[]::text[],'owner response projection exists');
select has_column('app_private','broker_introductions','response_seen_at','broker response follow-up has lightweight review state');
select has_function('public','resolve_brokerdesk_dashboard',array['text'],'tenant-scoped broker action queue exists');
select has_function('public','mark_broker_introduction_response_reviewed',array['text','text'],'response review command exists');
select has_function('public','acknowledge_broker_portfolio_update',array['text','text','text'],'portfolio update acknowledgement exists');
select has_function('public','run_broker_introduction_maintenance',array[]::text[],'service maintenance command exists');
select has_trigger('app_private','broker_introductions','scrub_closed_broker_introduction_pass','closed introductions scrub pass credentials');

select ok(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conrelid='app_private.broker_introduction_events'::regclass
     and contype='c' and pg_get_constraintdef(oid) like '%created%shared%claimed%response_submitted%complete_access_confirmed%mutual_access_granted%revoked%expired%')
  not like '%approved%',
  'audit vocabulary is limited to the approved lifecycle events'
);
select has_trigger('public','approved_portfolio_snapshots','capture_portfolio_disclosure_version','publication captures an immutable disclosure version');

select * from finish();
rollback;
