-- Scheduled, bounded cleanup with independent evidence for every implemented class.
create table app_private.retention_run_state (
  class text primary key,
  last_succeeded_at timestamptz,
  affected integer not null default 0
);
alter table app_private.retention_run_state enable row level security;
revoke all on app_private.retention_run_state from public,anon,authenticated,service_role;
insert into app_private.retention_run_state(class) values
('rateLimitsDeleted'),
('viewerSessionsDeleted'),
('portfolioViewsDeleted'),
('portfolioEventsDeleted'),
('accessAuditEventsDeleted'),
('interestRequestsAnonymized'),
('deletionReceiptsDeleted');

-- Shared erasure signature also recognizes records already processed by the
-- previous cleanup, which refreshed updated_at but left a duplicate message.
create function app_private.interest_request_details_cleared(p_row public.interest_requests)
returns boolean language sql immutable set search_path='' as $$
  select coalesce((p_row).viewer_name is null and (p_row).viewer_phone is null
    and (p_row).viewer_email is null and (p_row).viewer_family_context is null
    and (p_row).message is null and (p_row).requester_user_id is null
    and (p_row).prospect_key_hash is null and (p_row).metadata='{}'::jsonb,false)
$$;
create function app_private.interest_request_retention_due(p_row public.interest_requests)
returns boolean language sql stable set search_path='' as $$
  select coalesce((p_row).status in ('rejected','closed')
    and (not app_private.interest_request_details_cleared(p_row) or (p_row).request_reason is not null)
    and ((p_row).updated_at<now()-interval '180 days'
      or ((p_row).created_at<now()-interval '180 days'
        and app_private.interest_request_details_cleared(p_row) and (p_row).request_reason is not null)),false)
$$;
revoke all on function app_private.interest_request_details_cleared(public.interest_requests),
  app_private.interest_request_retention_due(public.interest_requests) from public,anon,authenticated,service_role;

-- Account deletion uses the same cleared-field transition as retention. Keep
-- its historical writer from retaining the second message copy as well.
create function app_private.complete_interest_text_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if app_private.interest_request_details_cleared(new)
    and not app_private.interest_request_details_cleared(old) then
    new.request_reason:=null;
  end if;
  return new;
end $$;
revoke all on function app_private.complete_interest_text_erasure() from public,anon,authenticated,service_role;
create trigger complete_interest_text_erasure before update of viewer_name,viewer_phone,viewer_email,
  viewer_family_context,message,requester_user_id,prospect_key_hash,metadata on public.interest_requests
for each row execute function app_private.complete_interest_text_erasure();

create function app_private.retention_overdue_counts() returns jsonb
language sql security definer set search_path='' as $$
select jsonb_build_object(
'rateLimitsDeleted',(select count(*) from app_private.api_rate_limits where updated_at < now()-interval '2 days'),
'viewerSessionsDeleted',(select count(*) from public.viewer_sessions where started_at < now()-interval '90 days'),
'portfolioViewsDeleted',(select count(*) from public.portfolio_views where viewed_at < now()-interval '395 days'),
'portfolioEventsDeleted',(select count(*) from public.portfolio_events where created_at < now()-interval '395 days'),
'accessAuditEventsDeleted',(select count(*) from public.access_audit_events where created_at < now()-interval '730 days'),
'interestRequestsAnonymized',(select count(*) from public.interest_requests r where app_private.interest_request_retention_due(r)),
'deletionReceiptsDeleted',(select count(*) from public.account_deletion_requests where (status='completed' and retention_until < now()) or (user_id is null and updated_at < now()-interval '30 days')))
$$;
revoke all on function app_private.retention_overdue_counts() from public,anon,authenticated,service_role;

create function public.run_retention_class(p_class text,p_limit integer default 500) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_affected integer; remaining bigint;
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid retention batch' using errcode='22023'; end if;
  perform 1 from app_private.retention_run_state where class=p_class for update;
  if not found then raise exception 'invalid retention class' using errcode='22023'; end if;
  case p_class
  when 'rateLimitsDeleted' then
    delete from app_private.api_rate_limits where ctid in (select ctid from app_private.api_rate_limits where updated_at < now()-interval '2 days' limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from app_private.api_rate_limits where updated_at < now()-interval '2 days';
  when 'viewerSessionsDeleted' then
    delete from public.viewer_sessions where ctid in (select ctid from public.viewer_sessions where started_at < now()-interval '90 days' limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.viewer_sessions where started_at < now()-interval '90 days';
  when 'portfolioViewsDeleted' then
    delete from public.portfolio_views where ctid in (select ctid from public.portfolio_views where viewed_at < now()-interval '395 days' limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.portfolio_views where viewed_at < now()-interval '395 days';
  when 'portfolioEventsDeleted' then
    delete from public.portfolio_events where ctid in (select ctid from public.portfolio_events where created_at < now()-interval '395 days' limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.portfolio_events where created_at < now()-interval '395 days';
  when 'accessAuditEventsDeleted' then
    delete from public.access_audit_events where ctid in (select ctid from public.access_audit_events where created_at < now()-interval '730 days' limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.access_audit_events where created_at < now()-interval '730 days';
  when 'interestRequestsAnonymized' then
    update public.interest_requests set viewer_name=null,viewer_phone=null,viewer_email=null,viewer_family_context=null,message=null,request_reason=null,requester_user_id=null,prospect_key_hash=null,metadata='{}'::jsonb,updated_at=now() where ctid in (select ctid from public.interest_requests r where app_private.interest_request_retention_due(r) limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.interest_requests r where app_private.interest_request_retention_due(r);
  when 'deletionReceiptsDeleted' then
    delete from public.account_deletion_requests where ctid in (select ctid from public.account_deletion_requests where (status='completed' and retention_until < now()) or (user_id is null and updated_at < now()-interval '30 days') limit p_limit for update skip locked);
    get diagnostics v_affected=row_count;
    select count(*) into remaining from public.account_deletion_requests where (status='completed' and retention_until < now()) or (user_id is null and updated_at < now()-interval '30 days');
  end case;
  update app_private.retention_run_state set last_succeeded_at=now(),affected=v_affected where class=p_class;
  return jsonb_build_object('affected',v_affected,'remaining',remaining);
end $$;
revoke all on function public.run_retention_class(text,integer) from public,anon,authenticated;
grant execute on function public.run_retention_class(text,integer) to service_role;

-- Preserve the operator command's response keys; one call now performs bounded work.
create or replace function public.run_data_retention() returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; result jsonb:='{}'::jsonb; outcome jsonb;
begin
  perform app_private.require_identity_verification_worker();
  for item in select class from app_private.retention_run_state order by class loop
    outcome:=public.run_retention_class(item.class,500);
    result:=result||jsonb_build_object(item.class,(outcome->>'affected')::integer);
  end loop;
  return result;
end $$;
create or replace function public.production_worker_health() returns jsonb
language plpgsql security definer set search_path='' as $$
declare state app_private.production_worker_state%rowtype; oldest timestamptz; held integer; cleanup_oldest timestamptz; identity_oldest timestamptz; retention jsonb; retention_healthy boolean; cleanup_due bigint; overdue_counts jsonb;
begin
  perform app_private.require_identity_verification_worker();
  select * into state from app_private.production_worker_state where singleton;
  select min(available_at) filter(where status in ('queued','processing')),
    count(*) filter(where status='failed' and last_error_code is distinct from 'OPERATOR_SUPPRESSED')::integer into oldest,held
  from app_private.notification_outbox where notification_type in (
    'new_introduction','full_view_approved','introduction_declined','full_view_renewed',
    'full_view_revoked','full_view_expiring','full_view_access_expiring','broker_introduction_ready',
    'broker_introduction_response','broker_mutual_interest','broker_introduction_revoked',
    'broker_introduction_expired','broker_complete_access_expired');
  select min(run_after) into cleanup_oldest from app_private.deleted_provider_cleanup;
  select min(run_after) into identity_oldest from app_private.identity_verification_worker_state where completed_at is null and candidate_id is not null;
  overdue_counts:=app_private.retention_overdue_counts();
  select jsonb_object_agg(s.class,jsonb_build_object('lastSucceededAt',s.last_succeeded_at,
    'lastAffected',s.affected,'overdue',(overdue_counts->>s.class)::bigint)),
    bool_and(coalesce(s.last_succeeded_at>now()-interval '15 minutes',false)
      and (overdue_counts->>s.class)::bigint=0)
    into retention,retention_healthy from app_private.retention_run_state s;
  select count(*) into cleanup_due from app_private.horoscope_object_cleanup q where run_after<now()-interval '15 minutes'
    and not exists(select 1 from app_private.portfolio_disclosure_versions v where v.horoscope->>'accessPath'=q.storage_path);
  return jsonb_build_object('retention',retention,'horoscopeCleanupOverdue',cleanup_due,

    'healthy',state.enabled and not state.last_failed and retention_healthy and cleanup_due=0
      and coalesce(state.last_succeeded_at>now()-interval '15 minutes',false)
      and coalesce(oldest>now()-interval '15 minutes',true)
      and coalesce(cleanup_oldest>now()-interval '15 minutes',true) and coalesce(identity_oldest>now()-interval '15 minutes',true) and held=0,
    'enabled',state.enabled,'lastStartedAt',state.last_started_at,
    'lastCompletedAt',state.last_completed_at,'lastSucceededAt',state.last_succeeded_at,
    'lastFailed',state.last_failed,'oldestRelationshipDueAt',oldest,
    'heldRelationshipNotifications',held,'oldestDeletedProviderCleanupDueAt',cleanup_oldest,'oldestIdentityDueAt',identity_oldest);
end; $$;

