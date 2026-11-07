-- NAK-204 records broker operations per participant. Candidate responses and
-- portfolio grants continue through their existing authoritative commands.
alter table app_private.broker_introductions
  add constraint broker_introductions_organization_identity_key unique(organization_id,id);

create table app_private.broker_introduction_share_states (
  introduction_id uuid not null,
  organization_id uuid not null,
  participant_side text not null check(participant_side in ('source','recipient')),
  share_state text not null default 'not_started'
    check(share_state in ('not_started','initiated','broker_confirmed')),
  initiated_at timestamptz,
  initiated_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  last_reminded_at timestamptz,
  last_reminded_by uuid references auth.users(id) on delete set null,
  reminder_count integer not null default 0 check(reminder_count between 0 and 30),
  row_version bigint not null default 1 check(row_version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(introduction_id,participant_side),
  foreign key(organization_id,introduction_id)
    references app_private.broker_introductions(organization_id,id) on delete cascade,
  check(share_state<>'initiated' or initiated_at is not null),
  check(share_state<>'broker_confirmed' or confirmed_at is not null),
  check((last_reminded_at is null)=(reminder_count=0))
);
alter table app_private.broker_introduction_share_states enable row level security;
revoke all on app_private.broker_introduction_share_states from public,anon,authenticated,service_role;

create function app_private.initialize_introduction_share_states() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.access_model='identity_bound' then
    insert into app_private.broker_introduction_share_states(introduction_id,organization_id,participant_side)
    values(new.id,new.organization_id,'source'),(new.id,new.organization_id,'recipient');
  end if;
  return new;
end; $$;
revoke all on function app_private.initialize_introduction_share_states() from public,anon,authenticated,service_role;
create trigger initialize_introduction_share_states after insert on app_private.broker_introductions
for each row execute function app_private.initialize_introduction_share_states();

-- Historical activation is not evidence of delivery to either family.
insert into app_private.broker_introduction_share_states(introduction_id,organization_id,participant_side)
select item.id,item.organization_id,side
from app_private.broker_introductions item cross join unnest(array['source','recipient']) side
where item.access_model='identity_bound';

alter table app_private.broker_introduction_events drop constraint broker_introduction_events_event_type_check;
alter table app_private.broker_introduction_events add constraint broker_introduction_events_event_type_check
check(event_type in ('created','shared','claimed','response_submitted','complete_access_confirmed',
  'mutual_access_granted','revoked','expired','share_initiated','share_confirmed','reminder_initiated'));

create function app_private.can_access_introduction_action(
  p_actor uuid,p_workspace_ref text,p_introduction_id uuid,p_capability app_private.brokerdesk_capability
) returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from app_private.broker_introductions item
    join public.organizations organization on organization.id=item.organization_id
    join public.broker_clients source on source.id=item.broker_client_id and source.organization_id=item.organization_id
    join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id and recipient.organization_id=item.organization_id
    where item.id=p_introduction_id and item.access_model='identity_bound'
      and organization.workspace_ref=p_workspace_ref
      and p_capability in ('customers.read','introductions.manage_sharing')
      and app_private.member_has_brokerdesk_capability(p_actor,p_workspace_ref,p_capability::text,source.relationship_ref)
      and app_private.member_has_brokerdesk_capability(p_actor,p_workspace_ref,p_capability::text,recipient.relationship_ref)
      and app_private.relationship_has_active_mandate(p_workspace_ref,source.relationship_ref,'customers.read')
      and app_private.relationship_has_active_mandate(p_workspace_ref,recipient.relationship_ref,'customers.read')
      and (p_capability='customers.read' or (
        app_private.relationship_has_active_mandate(p_workspace_ref,source.relationship_ref,p_capability::text)
        and app_private.relationship_has_active_mandate(p_workspace_ref,recipient.relationship_ref,p_capability::text)
        and app_private.relationship_has_active_mandate_version(p_workspace_ref,source.relationship_ref,'broker-representation-v3')
        and app_private.relationship_has_active_mandate_version(p_workspace_ref,recipient.relationship_ref,'broker-representation-v3')
      ))
  );
$$;
revoke all on function app_private.can_access_introduction_action(uuid,text,uuid,app_private.brokerdesk_capability)
from public,anon,authenticated,service_role;

create function public.resolve_brokerdesk_introduction_action(p_workspace_ref text,p_introduction_ref text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  item app_private.broker_introductions%rowtype;
  can_manage boolean;
  live boolean;
begin
  perform app_private.require_current_session();
  select * into item from app_private.broker_introductions where introduction_ref=p_introduction_ref;
  if item.id is null or not app_private.can_access_introduction_action(
    auth.uid(),p_workspace_ref,item.id,'customers.read'
  ) then return '{"available":false}'::jsonb; end if;
  live := item.revoked_at is null and item.status in ('created','shared','responded')
    and greatest(item.expires_at,coalesce(item.complete_access_expires_at,item.expires_at))>now()
    and item.source_response is distinct from 'declined' and item.response is distinct from 'declined';
  can_manage := live and app_private.can_access_introduction_action(
    auth.uid(),p_workspace_ref,item.id,'introductions.manage_sharing'
  ) and exists(
    select 1 from public.broker_clients source,public.broker_clients recipient
    where source.id=item.broker_client_id and recipient.id=item.recipient_broker_client_id
      and app_private.candidate_is_introduction_ready(source.candidate_id)
      and app_private.candidate_is_introduction_ready(recipient.candidate_id)
  );
  return jsonb_build_object(
    'available',true,'introductionRef',item.introduction_ref,
    'status',case when item.revoked_at is not null then 'revoked'
      when greatest(item.expires_at,coalesce(item.complete_access_expires_at,item.expires_at))<=now()
        then 'expired' else item.status end,
    'rowVersion',item.row_version,'createdAt',item.created_at,'expiresAt',item.expires_at,
    'canActivate',live and item.status='created' and exists(
      select 1 from public.broker_clients source where source.id=item.broker_client_id
        and app_private.member_has_brokerdesk_capability(auth.uid(),p_workspace_ref,'introductions.send',source.relationship_ref)
        and app_private.relationship_has_active_mandate(p_workspace_ref,source.relationship_ref,'introductions.send')
    ),
    'sides',(
      select jsonb_agg(jsonb_build_object(
        'side',state.participant_side,
        'name',coalesce(nullif(version.broker_standard_data #>> '{personal,name}',''),candidate.display_name),
        'relationshipRef',relationship.relationship_ref,
        'response',case when state.participant_side='source' then item.source_response else item.response end,
        'respondedAt',case when state.participant_side='source' then item.source_responded_at else item.responded_at end,
        'shareState',state.share_state,'initiatedAt',state.initiated_at,'confirmedAt',state.confirmed_at,
        'lastRemindedAt',state.last_reminded_at,'reminderCount',state.reminder_count,'rowVersion',state.row_version,
        'canShare',can_manage,
        'canRemind',can_manage and state.share_state<>'not_started' and item.expires_at>now()
          and (case when state.participant_side='source' then item.source_response else item.response end) is null
          and state.reminder_count<30
          and (state.last_reminded_at is null or state.last_reminded_at<=now()-interval '24 hours')
      ) order by state.participant_side desc)
      from app_private.broker_introduction_share_states state
      join public.broker_clients relationship on relationship.id=case when state.participant_side='source'
        then item.broker_client_id else item.recipient_broker_client_id end
      join public.candidates candidate on candidate.id=relationship.candidate_id
      join app_private.portfolio_disclosure_versions version on version.id=case when state.participant_side='source'
        then item.portfolio_version_id else item.recipient_portfolio_version_id end
      where state.introduction_id=item.id and state.organization_id=item.organization_id
    ),
    'timeline',coalesce((
      select jsonb_agg(jsonb_build_object('type',event_type,'occurredAt',created_at,
        'side',case when safe_details->>'side' in ('source','recipient') then safe_details->>'side' else null end
      ) order by created_at desc,id desc)
      from (select id,event_type,safe_details,created_at from app_private.broker_introduction_events
        where introduction_id=item.id and organization_id=item.organization_id
        order by created_at desc,id desc limit 100) history
    ),'[]'::jsonb)
  );
end; $$;
revoke all on function public.resolve_brokerdesk_introduction_action(text,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_brokerdesk_introduction_action(text,text) to authenticated;

create function public.record_introduction_share_action(
  p_workspace_ref text,p_introduction_ref text,p_side text,p_action text,
  p_expected_version bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  item app_private.broker_introductions%rowtype;
  state app_private.broker_introduction_share_states%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
  event_name text;
begin
  perform app_private.require_current_session();
  if p_side is null or p_side not in ('source','recipient')
    or p_action is null or p_action not in ('initiate','confirm','remind')
    or p_expected_version is null or p_expected_version<1
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then raise exception 'invalid share action' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':introduction-share:'||p_idempotency_key,0));
  select * into item from app_private.broker_introductions where introduction_ref=p_introduction_ref for update;
  if item.id is null or not app_private.can_access_introduction_action(
    actor,p_workspace_ref,item.id,'introductions.manage_sharing'
  ) then return '{"available":false}'::jsonb; end if;
  request_hash := encode(extensions.digest(jsonb_build_object(
    'workspaceRef',p_workspace_ref,'introductionRef',p_introduction_ref,'side',p_side,
    'action',p_action,'expectedVersion',p_expected_version
  )::text,'sha256'),'hex');
  delete from app_private.brokerdesk_command_idempotency
  where actor_user_id=actor and command_name='record_introduction_share_action'
    and idempotency_key=p_idempotency_key and expires_at<=now();
  select * into existing from app_private.brokerdesk_command_idempotency
  where actor_user_id=actor and command_name='record_introduction_share_action'
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if existing.request_hash<>request_hash then raise exception 'share action key conflict' using errcode='22023'; end if;
    return existing.safe_result;
  end if;
  -- Activation remains the existing canonical command. This command never
  -- calls its global expiry worker while holding an Introduction lock.
  if item.revoked_at is not null or item.status not in ('shared','responded')
    or greatest(item.expires_at,coalesce(item.complete_access_expires_at,item.expires_at))<=now()
    or item.source_response='declined' or item.response='declined'
    or not exists(
      select 1 from public.broker_clients source,public.broker_clients recipient
      where source.id=item.broker_client_id and recipient.id=item.recipient_broker_client_id
        and app_private.candidate_is_introduction_ready(source.candidate_id)
        and app_private.candidate_is_introduction_ready(recipient.candidate_id)
    )
  then return '{"available":false}'::jsonb; end if;
  select * into state from app_private.broker_introduction_share_states
  where introduction_id=item.id and participant_side=p_side for update;
  if state.row_version is distinct from p_expected_version then
    raise exception 'share state changed; refresh and retry' using errcode='40001';
  end if;
  if p_action='remind' and (
    state.share_state='not_started' or item.expires_at<=now() or state.reminder_count>=30
    or (case when p_side='source' then item.source_response else item.response end) is not null
    or state.last_reminded_at>now()-interval '24 hours'
  ) then raise exception 'reminder unavailable' using errcode='54000'; end if;
  update app_private.broker_introduction_share_states set
    share_state=case when p_action='confirm' then 'broker_confirmed'
      when share_state='not_started' then 'initiated' else share_state end,
    initiated_at=case when p_action='initiate' then coalesce(initiated_at,now()) else initiated_at end,
    initiated_by=case when p_action='initiate' then coalesce(initiated_by,actor) else initiated_by end,
    confirmed_at=case when p_action='confirm' then coalesce(confirmed_at,now()) else confirmed_at end,
    confirmed_by=case when p_action='confirm' then coalesce(confirmed_by,actor) else confirmed_by end,
    last_reminded_at=case when p_action='remind' then now() else last_reminded_at end,
    last_reminded_by=case when p_action='remind' then actor else last_reminded_by end,
    reminder_count=reminder_count+case when p_action='remind' then 1 else 0 end,
    row_version=row_version+1,updated_at=now()
  where introduction_id=item.id and participant_side=p_side returning * into state;
  event_name := case p_action when 'confirm' then 'share_confirmed' when 'remind' then 'reminder_initiated' else 'share_initiated' end;
  insert into app_private.broker_introduction_events(organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details)
  values(item.organization_id,item.id,event_name,'broker',actor,jsonb_build_object('side',p_side));
  insert into app_private.brokerdesk_audit_events(organization_id,actor_user_id,event_name,resource_type,outcome,safe_details)
  values(item.organization_id,actor,'introduction.'||event_name,'broker_introduction','succeeded',
    jsonb_build_object('introductionRef',item.introduction_ref,'side',p_side));
  result := jsonb_build_object('available',true,'side',p_side,'shareState',state.share_state,'rowVersion',state.row_version);
  insert into app_private.brokerdesk_command_idempotency(actor_user_id,command_name,idempotency_key,request_hash,organization_id,safe_result)
  values(actor,'record_introduction_share_action',p_idempotency_key,request_hash,item.organization_id,result);
  return result;
end; $$;
revoke all on function public.record_introduction_share_action(text,text,text,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.record_introduction_share_action(text,text,text,text,bigint,text) to authenticated;

-- Agency-wide keyset paging cannot use the existing participant-prefixed
-- history indexes to stop after one page. Keep legacy device-pass rows out.
create index broker_introductions_workspace_page_idx on app_private.broker_introductions
  (organization_id,created_at desc,introduction_ref desc) where access_model='identity_bound';

create function public.resolve_brokerdesk_introduction_actions(
  p_workspace_ref text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_ref text default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  if p_limit is null or p_limit<1 or p_limit>50
    or (p_before_created_at is null)<>(p_before_ref is null)
    or (p_before_ref is not null and p_before_ref !~ '^bir_[0-9a-f]{32}$')
    or (p_before_created_at is not null and not isfinite(p_before_created_at))
  then raise exception 'invalid Introduction page' using errcode='22023'; end if;
  if not exists(select 1 from public.organizations organization
    join public.organization_members member on member.organization_id=organization.id
    where organization.workspace_ref=p_workspace_ref and organization.status='active'
      and member.user_id=auth.uid() and member.status='active'
      and app_private.brokerdesk_entitlement_enabled(organization.id)
  ) then return '{"available":false}'::jsonb; end if;
  -- Evaluate policy once per workspace relationship, not once for every
  -- historical Introduction. Both participant joins remain mandatory.
  with authorized_relationships as materialized (
    select relationship.id,relationship.organization_id,relationship.candidate_id
    from public.organizations organization
    join public.broker_clients relationship on relationship.organization_id=organization.id
    where organization.workspace_ref=p_workspace_ref
      and app_private.member_has_brokerdesk_capability(auth.uid(),p_workspace_ref,'customers.read',relationship.relationship_ref)
      and app_private.relationship_has_active_mandate(p_workspace_ref,relationship.relationship_ref,'customers.read')
  ), scoped_items as materialized (
    select item.* from app_private.broker_introductions item
    where item.organization_id=(select id from public.organizations where workspace_ref=p_workspace_ref)
      and item.access_model='identity_bound'
      and exists(select 1 from authorized_relationships source where source.id=item.broker_client_id and source.organization_id=item.organization_id)
      and exists(select 1 from authorized_relationships recipient where recipient.id=item.recipient_broker_client_id and recipient.organization_id=item.organization_id)
      and (p_before_created_at is null or (item.created_at,item.introduction_ref)<(p_before_created_at,p_before_ref))
    order by item.created_at desc,item.introduction_ref desc limit p_limit+1
  ), page as materialized (
    select item.introduction_ref,item.created_at,item.expires_at,
      case when item.revoked_at is not null then 'revoked'
        when greatest(item.expires_at,coalesce(item.complete_access_expires_at,item.expires_at))<=now() then 'expired'
        else item.status end as status,
      coalesce(nullif(source_version.broker_standard_data #>> '{personal,name}',''),source_candidate.display_name) as source_name,
      coalesce(nullif(recipient_version.broker_standard_data #>> '{personal,name}',''),recipient_candidate.display_name) as recipient_name
    from scoped_items item
    join authorized_relationships source on source.id=item.broker_client_id and source.organization_id=item.organization_id
    join authorized_relationships recipient on recipient.id=item.recipient_broker_client_id and recipient.organization_id=item.organization_id
    join public.candidates source_candidate on source_candidate.id=source.candidate_id
    join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
    join app_private.portfolio_disclosure_versions source_version on source_version.id=item.portfolio_version_id
    join app_private.portfolio_disclosure_versions recipient_version on recipient_version.id=item.recipient_portfolio_version_id
  ), visible as materialized (
    select * from page order by created_at desc,introduction_ref desc limit p_limit
  )
  select jsonb_build_object('available',true,'introductions',coalesce((
    select jsonb_agg(jsonb_build_object('introductionRef',introduction_ref,'sourceName',source_name,
      'recipientName',recipient_name,'status',status,'createdAt',created_at,'expiresAt',expires_at
    ) order by created_at desc,introduction_ref desc) from visible
  ),'[]'::jsonb),'nextCursor',case when (select count(*) from page)>p_limit then (
    select jsonb_build_object('createdAt',created_at,'introductionRef',introduction_ref)
    from visible order by created_at asc,introduction_ref asc limit 1
  ) else null end) into result;
  return result;
end; $$;
revoke all on function public.resolve_brokerdesk_introduction_actions(text,integer,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_brokerdesk_introduction_actions(text,integer,timestamptz,text) to authenticated;
