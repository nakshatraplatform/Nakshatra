-- NAK-205 records off-app consent through a scoped broker command. The
-- existing Introduction remains the sole authority for Complete access.

create or replace function app_private.can_access_introduction_action(
  p_actor uuid,p_workspace_ref text,p_introduction_id uuid,p_capability app_private.brokerdesk_capability
) returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from app_private.broker_introductions item
    join public.organizations organization on organization.id=item.organization_id
    join public.broker_clients source on source.id=item.broker_client_id and source.organization_id=item.organization_id
    join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id and recipient.organization_id=item.organization_id
    where item.id=p_introduction_id and item.access_model='identity_bound'
      and organization.workspace_ref=p_workspace_ref
      and p_capability in ('customers.read','introductions.manage_sharing','introductions.record_family_update')
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

create table app_private.broker_introduction_family_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  introduction_id uuid not null,
  participant_side text not null check (participant_side in ('source','recipient')),
  reported_status text not null
    check (reported_status in ('accepted','declined','needs_time','callback_requested','no_response','other')),
  reported_by text not null check (reported_by in ('candidate','authorized_parent','family')),
  channel text not null check (channel in ('phone','whatsapp','in_person','other')),
  consent_attested boolean not null,
  internal_comment text check (char_length(internal_comment) <= 1000),
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id,introduction_id)
    references app_private.broker_introductions(organization_id,id) on delete cascade,
  check (
    (reported_status in ('accepted','declined') and consent_attested and reported_by in ('candidate','authorized_parent'))
    or (reported_status not in ('accepted','declined') and not consent_attested)
  )
);
create index broker_introduction_family_updates_latest_idx
  on app_private.broker_introduction_family_updates(introduction_id,participant_side,recorded_at desc,id desc);
alter table app_private.broker_introduction_family_updates enable row level security;
revoke all on app_private.broker_introduction_family_updates from public,anon,authenticated,service_role;

-- Both response entry points hold the same Introduction row lock. The
-- guarded update emits the existing mutual event once, with no new grant type.
create function app_private.start_broker_complete_access(p_id uuid,p_actor uuid,p_actor_kind text)
returns app_private.broker_introductions language plpgsql security definer set search_path='' as $$
declare
  item app_private.broker_introductions%rowtype;
begin
  update app_private.broker_introductions
  set mutual_interest_confirmed_at=now(),
    complete_access_expires_at=now()+interval '30 days',
    row_version=row_version+1,updated_at=now()
  where id=p_id and source_response='accepted' and response='accepted'
    and source_complete_access_confirmed_at is not null
    and recipient_complete_access_confirmed_at is not null
    and mutual_interest_confirmed_at is null
    and revoked_at is null and status='responded' and expires_at>now()
  returning * into item;
  if found then
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
    ) values (item.organization_id,item.id,'mutual_access_granted',p_actor_kind,p_actor,
      jsonb_build_object('expiresAt',item.complete_access_expires_at));
  else
    select * into item from app_private.broker_introductions where id=p_id;
  end if;
  return item;
end;
$$;
revoke all on function app_private.start_broker_complete_access(uuid,uuid,text)
  from public,anon,authenticated,service_role;

create or replace function public.respond_to_broker_introduction(
  p_introduction_ref text,
  p_session_token_hash text,
  p_response text,
  p_comment text,
  p_confirm_complete_access boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid:=auth.uid();
  introduction record;
  updated_introduction app_private.broker_introductions%rowtype;
  confirmation_added boolean:=false;
  response_added boolean:=false;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  if p_response not in ('accepted','declined')
    or pg_catalog.length(coalesce(p_comment,''))>1000
    or (p_response='accepted' and p_confirm_complete_access is not true)
  then return '{"available":false}'::jsonb; end if;

  select item.*,
    case when source_candidate.primary_owner_user_id=actor_id then 'source' else 'recipient' end actor_side
  into introduction
  from app_private.broker_introductions item
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients source on source.id=item.broker_client_id
  join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id
  join public.candidates source_candidate on source_candidate.id=source.candidate_id
  join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
  where item.introduction_ref=p_introduction_ref
    and item.access_model='identity_bound' and item.status in ('shared','responded')
    and item.revoked_at is null and item.expires_at>pg_catalog.now()
    and (source_candidate.primary_owner_user_id=actor_id
      or recipient_candidate.primary_owner_user_id=actor_id)
    and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
    and source.relationship_status='active' and recipient.relationship_status='active'
    and app_private.candidate_is_introduction_ready(source.candidate_id)
    and app_private.candidate_is_introduction_ready(recipient.candidate_id)
    and app_private.relationship_has_active_mandate(
      organization.workspace_ref,source.relationship_ref,'introductions.send')
    and app_private.relationship_has_active_mandate(
      organization.workspace_ref,recipient.relationship_ref,'customers.read')
  for update of item;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;

  if introduction.actor_side='source' and introduction.source_response is not null then
    if introduction.source_response<>p_response
      or coalesce(introduction.source_response_comment,'')<>coalesce(nullif(pg_catalog.btrim(p_comment),''),'')
    then return '{"available":false}'::jsonb; end if;
    if introduction.source_response='accepted'
      and introduction.source_complete_access_confirmed_at is null
      and p_confirm_complete_access is true
    then
      update app_private.broker_introductions
      set source_complete_access_confirmed_at=pg_catalog.now(),
        row_version=row_version+1,updated_at=pg_catalog.now()
      where id=introduction.id returning * into updated_introduction;
      confirmation_added:=true;
    else
      select * into updated_introduction
      from app_private.broker_introductions where id=introduction.id;
    end if;
  elsif introduction.actor_side='recipient' and introduction.response is not null then
    if introduction.response<>p_response
      or coalesce(introduction.response_comment,'')<>coalesce(nullif(pg_catalog.btrim(p_comment),''),'')
    then return '{"available":false}'::jsonb; end if;
    if introduction.response='accepted'
      and introduction.recipient_complete_access_confirmed_at is null
      and p_confirm_complete_access is true
    then
      update app_private.broker_introductions
      set recipient_complete_access_confirmed_at=pg_catalog.now(),
        row_version=row_version+1,updated_at=pg_catalog.now()
      where id=introduction.id returning * into updated_introduction;
      confirmation_added:=true;
    else
      select * into updated_introduction
      from app_private.broker_introductions where id=introduction.id;
    end if;
  elsif introduction.actor_side='source' then
    update app_private.broker_introductions
    set status='responded',source_response=p_response,
      source_response_comment=nullif(pg_catalog.btrim(p_comment),''),source_responded_at=pg_catalog.now(),
      source_complete_access_confirmed_at=case when p_response='accepted'
        then pg_catalog.now() else null end,
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id returning * into updated_introduction;
    response_added:=true;
  else
    update app_private.broker_introductions
    set status='responded',response=p_response,
      response_comment=nullif(pg_catalog.btrim(p_comment),''),responded_at=pg_catalog.now(),
      recipient_complete_access_confirmed_at=case when p_response='accepted'
        then pg_catalog.now() else null end,
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id returning * into updated_introduction;
    response_added:=true;
  end if;

  if response_added then
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
    ) values (introduction.organization_id,introduction.id,'response_submitted','recipient',actor_id,
      pg_catalog.jsonb_build_object(
        'response',p_response,
        'participantSide',introduction.actor_side,
        'completeAccessConfirmed',p_response='accepted' and p_confirm_complete_access is true
      ));
  elsif confirmation_added then
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
    ) values (introduction.organization_id,introduction.id,'complete_access_confirmed','recipient',actor_id,
      pg_catalog.jsonb_build_object('participantSide',introduction.actor_side));
  end if;
  updated_introduction := app_private.start_broker_complete_access(introduction.id, actor_id, 'recipient');

  return pg_catalog.jsonb_build_object(
    'available',true,'status','responded','response',p_response,
    'disclosureLevel',case when updated_introduction.complete_access_expires_at>pg_catalog.now()
      then 'complete' else 'broker_standard' end,
    'completeAccessExpiresAt',updated_introduction.complete_access_expires_at,
    'completeAccessConfirmed',case when introduction.actor_side='source'
      then updated_introduction.source_complete_access_confirmed_at is not null
      else updated_introduction.recipient_complete_access_confirmed_at is not null end
  );
end;
$$;

create function app_private.can_record_introduction_family_update(
  p_actor uuid,p_workspace_ref text,p_item app_private.broker_introductions
) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(
    p_item.status in ('shared','responded') and p_item.revoked_at is null
    and p_item.expires_at>now()
    and p_item.source_response is distinct from 'declined'
    and p_item.response is distinct from 'declined'
    and app_private.can_access_introduction_action(
      p_actor,p_workspace_ref,p_item.id,'introductions.record_family_update'
    )
    and exists (
      select 1 from public.broker_clients source
      join public.broker_clients recipient on recipient.id=p_item.recipient_broker_client_id
        and recipient.organization_id=p_item.organization_id
      join public.candidates source_candidate on source_candidate.id=source.candidate_id
      join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
      where source.id=p_item.broker_client_id and source.organization_id=p_item.organization_id
        and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
        and app_private.candidate_is_introduction_ready(source.candidate_id)
        and app_private.candidate_is_introduction_ready(recipient.candidate_id)
        and app_private.relationship_has_active_mandate(p_workspace_ref,source.relationship_ref,'introductions.send')
    ), false
  );
$$;
revoke all on function app_private.can_record_introduction_family_update(uuid,text,app_private.broker_introductions)
  from public,anon,authenticated,service_role;

-- A separate resolver preserves the exact DTO returned by the older workspace
-- RPC to deployed clients during the schema-first rollout.
create function public.resolve_brokerdesk_introduction_action_with_responses(p_workspace_ref text,p_introduction_ref text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  base jsonb;
  item app_private.broker_introductions%rowtype;
  can_view_updates boolean;
  can_record boolean;
  sides jsonb;
begin
  perform app_private.require_current_session();
  base := public.resolve_brokerdesk_introduction_action(p_workspace_ref,p_introduction_ref);
  if not coalesce((base->>'available')::boolean,false) then return base; end if;

  select * into item from app_private.broker_introductions where introduction_ref=p_introduction_ref;
  can_view_updates := app_private.can_access_introduction_action(
    auth.uid(),p_workspace_ref,item.id,'introductions.record_family_update'
  );
  can_record := app_private.can_record_introduction_family_update(auth.uid(),p_workspace_ref,item);
  select jsonb_agg(side.value || jsonb_build_object(
    'canRecordResponse',can_record and side.value->>'response' is null,
    'latestUpdate',(
      select jsonb_build_object('status',entry.reported_status,'reportedBy',entry.reported_by,
        'channel',entry.channel,'comment',entry.internal_comment,'recordedAt',entry.recorded_at)
      from app_private.broker_introduction_family_updates entry
      where can_view_updates and entry.organization_id=item.organization_id and entry.introduction_id=item.id
        and entry.participant_side=side.value->>'side'
      order by entry.recorded_at desc,entry.id desc limit 1
    )
  ) order by side.position) into sides
  from jsonb_array_elements(base->'sides') with ordinality as side(value,position);
  return base || jsonb_build_object('sides',sides,'completeAccessExpiresAt',
    case when item.status='responded' and item.revoked_at is null and item.complete_access_expires_at>now()
      then item.complete_access_expires_at end);
end;
$$;
revoke all on function public.resolve_brokerdesk_introduction_action_with_responses(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.resolve_brokerdesk_introduction_action_with_responses(text,text) to authenticated;

create function public.record_introduction_family_update(
  p_workspace_ref text,p_introduction_ref text,p_side text,p_reported_status text,
  p_reported_by text,p_channel text,p_comment text,p_consent_attested boolean,
  p_expected_version bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  item app_private.broker_introductions%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  normalized_comment text := nullif(btrim(p_comment),'');
  final_response boolean;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if p_side is null or p_side not in ('source','recipient')
    or p_reported_status is null or p_reported_status not in ('accepted','declined','needs_time','callback_requested','no_response','other')
    or p_reported_by is null or p_reported_by not in ('candidate','authorized_parent','family')
    or p_channel is null or p_channel not in ('phone','whatsapp','in_person','other')
    or char_length(coalesce(normalized_comment,''))>1000
    or p_consent_attested is null or p_expected_version is null or p_expected_version<1
    or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then raise exception 'invalid response record' using errcode='22023'; end if;
  final_response := p_reported_status in ('accepted','declined');
  if final_response is distinct from p_consent_attested
    or (final_response and p_reported_by='family')
  then raise exception 'candidate or authorized parent consent is required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text||':introduction-response:'||p_idempotency_key,0));
  select * into item from app_private.broker_introductions where introduction_ref=p_introduction_ref for update;
  if item.id is null or not app_private.can_access_introduction_action(
    actor,p_workspace_ref,item.id,'introductions.record_family_update'
  ) then return '{"available":false}'::jsonb; end if;

  request_hash := encode(extensions.digest(jsonb_build_array(
    p_workspace_ref,p_introduction_ref,p_side,p_reported_status,p_reported_by,p_channel,
    normalized_comment,p_consent_attested,p_expected_version
  )::text,'sha256'),'hex');
  delete from app_private.brokerdesk_command_idempotency
  where actor_user_id=actor and command_name='record_introduction_family_update'
    and idempotency_key=p_idempotency_key and expires_at<=now();
  select * into existing from app_private.brokerdesk_command_idempotency
  where actor_user_id=actor and command_name='record_introduction_family_update'
    and idempotency_key=p_idempotency_key and expires_at>now();
  if found then
    if existing.request_hash<>request_hash then raise exception 'response record key conflict' using errcode='22023'; end if;
    return existing.safe_result;
  end if;

  if not app_private.can_record_introduction_family_update(actor,p_workspace_ref,item)
  then return '{"available":false}'::jsonb; end if;
  if item.row_version is distinct from p_expected_version
    or (case when p_side='source' then item.source_response else item.response end) is not null
  then raise exception 'response state changed; refresh and retry' using errcode='40001'; end if;

  insert into app_private.broker_introduction_family_updates(
    organization_id,introduction_id,participant_side,reported_status,reported_by,channel,
    consent_attested,internal_comment,recorded_by
  ) values (item.organization_id,item.id,p_side,p_reported_status,p_reported_by,p_channel,
    p_consent_attested,normalized_comment,actor);

  -- Notes stay in the private report table. Canonical response fields are
  -- written only for an attested decision and never carry the internal note.
  update app_private.broker_introductions set
    status=case when final_response then 'responded' else status end,
    source_response=case when final_response and p_side='source' then p_reported_status else source_response end,
    source_responded_at=case when final_response and p_side='source' then now() else source_responded_at end,
    source_complete_access_confirmed_at=case when p_reported_status='accepted' and p_side='source' then now() else source_complete_access_confirmed_at end,
    response=case when final_response and p_side='recipient' then p_reported_status else response end,
    responded_at=case when final_response and p_side='recipient' then now() else responded_at end,
    recipient_complete_access_confirmed_at=case when p_reported_status='accepted' and p_side='recipient' then now() else recipient_complete_access_confirmed_at end,
    row_version=row_version+1,updated_at=now()
  where id=item.id returning * into item;

  if final_response then
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
    ) values (item.organization_id,item.id,'response_submitted','broker',actor,
      jsonb_build_object('side',p_side,'participantSide',p_side,'response',p_reported_status,
        'completeAccessConfirmed',p_reported_status='accepted'));
    item := app_private.start_broker_complete_access(item.id,actor,'broker');
  end if;

  insert into app_private.brokerdesk_audit_events(organization_id,actor_user_id,event_name,resource_type,outcome,safe_details)
  values (item.organization_id,actor,'introduction.family_update_recorded','broker_introduction','succeeded',
    jsonb_build_object('introductionRef',item.introduction_ref,'side',p_side,'status',p_reported_status,
      'reportedBy',p_reported_by,'channel',p_channel,'consentAttested',p_consent_attested));

  result := jsonb_build_object('available',true,'rowVersion',item.row_version,
    'completeAccessExpiresAt',item.complete_access_expires_at);
  insert into app_private.brokerdesk_command_idempotency(actor_user_id,command_name,idempotency_key,request_hash,organization_id,safe_result)
  values (actor,'record_introduction_family_update',p_idempotency_key,request_hash,item.organization_id,result);
  return result;
end;
$$;
revoke all on function public.record_introduction_family_update(text,text,text,text,text,text,text,boolean,bigint,text)
  from public,anon,authenticated,service_role;
grant execute on function public.record_introduction_family_update(text,text,text,text,text,text,text,boolean,bigint,text)
  to authenticated;
