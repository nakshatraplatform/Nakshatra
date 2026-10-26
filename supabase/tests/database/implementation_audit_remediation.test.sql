begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
\ir auth-fixtures.psql
select plan(29);
select pg_temp.create_auth_actor('c1840000-1111-4111-8111-111111111111','c2840000-1111-4111-8111-111111111111','audit-owner@test.local');
select pg_temp.create_auth_actor('c5840000-1111-4111-8111-111111111111','c6840000-1111-4111-8111-111111111111','audit-other@test.local');
insert into public.portfolios(id,user_id,draft_data) values('c4840000-1111-4111-8111-111111111111','c1840000-1111-4111-8111-111111111111','{}');
insert into public.portfolio_media(id,portfolio_id,media_type,storage_path,thumbnail_path,metadata,visibility)
values('c7840000-1111-4111-8111-111111111111','c4840000-1111-4111-8111-111111111111','gallery',
 'c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/photo.webp',
 'c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/thumb.webp',
 '{"blurPath":"c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/blur.webp"}','public');
select ok(not has_function_privilege('anon','public.list_relationship_queue(text,integer,text,text)','execute'),'anonymous queue access is revoked');
select ok(not has_function_privilege('authenticated','public.claim_photo_cleanup(integer)','execute'),'photo cleanup is service-only');
select ok(not has_table_privilege('authenticated','app_private.photo_object_cleanup','select'),'cleanup paths are private');
set local role authenticated;
select pg_temp.set_authenticated_claims('c1840000-1111-4111-8111-111111111111','c2840000-1111-4111-8111-111111111111');
delete from public.portfolio_media where id='c7840000-1111-4111-8111-111111111111';
reset role;
select is((select count(*)::integer from app_private.photo_object_cleanup),3,'metadata deletion atomically retires all three objects');
select throws_ok($$insert into public.portfolio_media(portfolio_id,media_type,storage_path,visibility) values('c4840000-1111-4111-8111-111111111111','gallery','c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/photo.webp','public')$$,
 '23514','retired photo cannot be reattached','a queued object cannot be reattached while cleanup runs');
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_photo_cleanup(5)),3,'worker claims retired paths');
reset role;
select storage_path as cleanup_path,claim_token as cleanup_token from app_private.photo_object_cleanup order by storage_path limit 1 \gset
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(not public.finish_photo_cleanup(:'cleanup_path',gen_random_uuid(),null),'stale acknowledgement cannot remove the job');
select ok(public.finish_photo_cleanup(:'cleanup_path',:'cleanup_token','STORAGE_CLEANUP_FAILED'),'storage failure is recorded for retry');
reset role;
select ok((select claim_token is null and run_after>now() from app_private.photo_object_cleanup where storage_path=:'cleanup_path'),'failure releases its lease with bounded backoff');
update app_private.photo_object_cleanup set run_after=now(),lease_expires_at=now()-interval '1 second';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_photo_cleanup(5)),3,'failed and expired leases are reclaimable');
reset role;
select storage_path as cleanup_path,claim_token as retry_token from app_private.photo_object_cleanup order by storage_path limit 1 \gset
set local role service_role;
select pg_temp.set_service_role_claims();
select ok(public.finish_photo_cleanup(:'cleanup_path',:'retry_token',null),'successful storage deletion completes its exact lease');
reset role;
select is((select count(*)::integer from app_private.photo_object_cleanup),2,'only the acknowledged obligation is removed');

-- Old pending interests and old active grants must survive newer records.
insert into public.interest_requests(id,portfolio_id,viewer_name,viewer_email,status,created_at)
select ('d1840000-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,'c4840000-1111-4111-8111-111111111111',
 'Viewer '||n,'viewer'||n||'@test.local','new',now()-n*interval '1 minute' from generate_series(1,60) n;
insert into public.reveal_grants(id,portfolio_id,interest_request_id,viewer_user_id,granted_by,access_level,granted_sections,expires_at,created_at)
select ('d2840000-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,'c4840000-1111-4111-8111-111111111111',
 ('d1840000-1111-4111-8111-'||lpad(n::text,12,'0'))::uuid,'c5840000-1111-4111-8111-111111111111',
 'c1840000-1111-4111-8111-111111111111','full',array['full'],now()+interval '1 day',now()-n*interval '1 minute' from generate_series(1,60) n;
set local role authenticated;
select pg_temp.set_authenticated_claims('c1840000-1111-4111-8111-111111111111','c2840000-1111-4111-8111-111111111111');
select is(public.list_relationship_queue('awaiting')->>'total','60','queue total includes all pending requests');
select is(jsonb_array_length(public.list_relationship_queue('awaiting')->'records'),8,'queue payload is bounded');
select is(public.list_relationship_queue('awaiting',56)#>>'{records,3,item,viewer_name}','Viewer 60','old pending request is reachable beyond newest fifty');
select is(public.list_relationship_queue('access',56)#>>'{records,3,item,id}','d2840000-1111-4111-8111-000000000060','old active grant retains its management ID');
select is(public.list_portfolio_access()#>>'{counts,awaiting}','60','initial summary counts the entire queue');
select is(public.list_portfolio_access()#>>'{counts,access}','60','active count is independent of recent grant window');
select is(public.list_relationship_queue('awaiting',0,'Viewer 60')->>'total','1','search reaches old records');
select is(public.list_relationship_queue('awaiting',0,'%')->>'total','0','search treats wildcard characters literally');
select throws_ok($$select public.list_relationship_queue('access',100001)$$,'22023','invalid relationship page','database bounds untrusted offsets');
select pg_temp.set_authenticated_claims('c5840000-1111-4111-8111-111111111111','c6840000-1111-4111-8111-111111111111');
select is(public.list_relationship_queue('awaiting')->>'total','0','another user cannot enumerate owner interests');
select is(public.list_relationship_queue('access')->>'total','0','another user cannot enumerate owner grants');
reset role;
select pg_temp.set_invalid_session_claims('c1840000-1111-4111-8111-111111111111','c9840000-1111-4111-8111-111111111111');
set local role authenticated;
select throws_ok($$select public.list_relationship_queue('awaiting')$$,'42501',null,'revoked sessions cannot read owner queues');
reset role;
insert into public.portfolio_media(portfolio_id,media_type,storage_path,visibility)
select 'c4840000-1111-4111-8111-111111111111','gallery','c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/gallery-'||n||'.webp','public' from generate_series(1,8) n;
select throws_ok($$insert into public.portfolio_media(portfolio_id,media_type,storage_path,visibility) values('c4840000-1111-4111-8111-111111111111','gallery','c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/ninth.webp','public')$$,
 '23514','a portfolio can contain at most 8 profile photos','the database rejects a ninth photo');
-- Legacy owner/file paths and retained disclosure versions have different lifecycles.
insert into public.candidates(id,primary_owner_user_id,display_name,created_by)
values('ca840000-1111-4111-8111-111111111111','c1840000-1111-4111-8111-111111111111','Audit','c1840000-1111-4111-8111-111111111111');
insert into app_private.portfolio_disclosure_versions(portfolio_id,candidate_id,version_number,public_data,complete_data,public_media,complete_media,template_id,published_at)
values('c4840000-1111-4111-8111-111111111111','ca840000-1111-4111-8111-111111111111',1,'{}','{}',
 '[{"accessPath":"c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/gallery-1.webp"}]','[]',1,now());
delete from public.portfolio_media where storage_path like '%gallery-1.webp';
insert into public.portfolio_media(id,portfolio_id,media_type,storage_path,visibility)
values('cb840000-1111-4111-8111-111111111111','c4840000-1111-4111-8111-111111111111','gallery','c1840000-1111-4111-8111-111111111111/legacy.webp','public');
delete from public.portfolio_media where id='cb840000-1111-4111-8111-111111111111';
set local role service_role;
select pg_temp.set_service_role_claims();
select is((select count(*)::integer from public.claim_photo_cleanup(5)),1,'only the unreferenced legacy path is claimable');
reset role;
select ok((select claim_token is null from app_private.photo_object_cleanup where storage_path like '%gallery-1.webp'),'historical disclosure objects remain held');
select ok((select claim_token is not null from app_private.photo_object_cleanup where storage_path like '%/legacy.webp'),'legacy owner/file layout can be cleaned');
insert into public.portfolio_media(id,portfolio_id,media_type,storage_path,visibility)
values('cc840000-1111-4111-8111-111111111111','c4840000-1111-4111-8111-111111111111','gallery','c1840000-1111-4111-8111-111111111111/c4840000-1111-4111-8111-111111111111/gallery-2.webp','public');
delete from public.portfolio_media where id='cc840000-1111-4111-8111-111111111111';
select ok(not exists(select 1 from app_private.photo_object_cleanup where storage_path like '%gallery-2.webp'),'a shared live path is not retired by deleting its duplicate');
select * from finish();
rollback;
