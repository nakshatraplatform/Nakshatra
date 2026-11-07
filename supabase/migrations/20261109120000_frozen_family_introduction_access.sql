
alter table app_private.broker_introductions
  add column source_family_complete_consented boolean not null default false,
  add column recipient_family_complete_consented boolean not null default false,
  add constraint broker_introduction_family_consent_requires_acceptance check (
    (not source_family_complete_consented or (source_response is not distinct from 'accepted' and source_complete_access_confirmed_at is not null))
    and (not recipient_family_complete_consented or (response is not distinct from 'accepted' and recipient_complete_access_confirmed_at is not null))
  );

create table app_private.broker_introduction_family_grants (
  introduction_id uuid not null references app_private.broker_introductions(id) on delete cascade,
  family_viewer_id uuid not null references app_private.candidate_family_viewers(id) on delete cascade,
  participant_side text not null check (participant_side in ('source','recipient')),
  granted_at timestamptz not null,
  revoked_at timestamptz,
  primary key (introduction_id,family_viewer_id)
);
create index broker_introduction_family_grants_viewer_idx
  on app_private.broker_introduction_family_grants(family_viewer_id) where revoked_at is null;
alter table app_private.broker_introduction_family_grants enable row level security;
revoke all on app_private.broker_introduction_family_grants from public,anon,authenticated,service_role;

-- This trigger fires once inside the existing mutual response transaction.
-- Both sides must have V3 mandates. A grant also needs consent from the side
-- whose portfolio would be disclosed. There is no historical grant backfill.
create function app_private.freeze_broker_introduction_family_grants()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  grant_count integer;
begin
  insert into app_private.broker_introduction_family_grants(
    introduction_id,family_viewer_id,participant_side,granted_at
  )
  select new.id,viewer.id,
    case when viewer.candidate_id=source.candidate_id then 'source' else 'recipient' end,
    new.mutual_interest_confirmed_at
  from public.organizations agency
  join public.broker_clients source on source.organization_id=agency.id and source.id=new.broker_client_id
  join public.broker_clients recipient on recipient.organization_id=agency.id and recipient.id=new.recipient_broker_client_id
  join public.candidates source_candidate on source_candidate.id=source.candidate_id
  join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
  join app_private.candidate_family_viewers viewer on
    (viewer.candidate_id=source.candidate_id and new.recipient_family_complete_consented)
    or (viewer.candidate_id=recipient.candidate_id and new.source_family_complete_consented)
  join auth.users account on account.id=viewer.verified_user_id and account.email_confirmed_at is not null
  where agency.id=new.organization_id and viewer.status='active' and viewer.revoked_at is null
    and account.id not in (source_candidate.primary_owner_user_id,recipient_candidate.primary_owner_user_id)
    and viewer.intended_email_hash=app_private.normalized_email_hash(account.email)
    and app_private.user_has_google_identity(account.id,viewer.intended_email_hash)
    and not exists (
      select 1 from app_private.candidate_family_viewers other_viewer
      where other_viewer.verified_user_id=account.id
        and other_viewer.intended_email_hash=viewer.intended_email_hash
        and other_viewer.candidate_id in (source.candidate_id,recipient.candidate_id)
        and other_viewer.candidate_id<>viewer.candidate_id
        and other_viewer.status='active' and other_viewer.revoked_at is null
    )
    and app_private.relationship_has_active_mandate_version(agency.workspace_ref,source.relationship_ref,'broker-representation-v3')
    and app_private.relationship_has_active_mandate_version(agency.workspace_ref,recipient.relationship_ref,'broker-representation-v3')
  order by viewer.id for share of viewer;
  get diagnostics grant_count = row_count;
  if grant_count>0 then
    insert into app_private.brokerdesk_audit_events(
      organization_id,event_name,resource_type,outcome,safe_details
    ) values (new.organization_id,'introduction.family_grants_frozen','broker_introduction','succeeded',
      jsonb_build_object('introductionRef',new.introduction_ref,'grantCount',grant_count));
  end if;
  return null;
end;
$$;
revoke all on function app_private.freeze_broker_introduction_family_grants() from public,anon,authenticated,service_role;
create trigger broker_introduction_freeze_family_grants
after update of mutual_interest_confirmed_at on app_private.broker_introductions
for each row when (old.mutual_interest_confirmed_at is null and new.mutual_interest_confirmed_at is not null
  and new.access_model='identity_bound' and (new.source_family_complete_consented or new.recipient_family_complete_consented))
execute function app_private.freeze_broker_introduction_family_grants();

create function app_private.revoke_broker_introduction_family_grants()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update app_private.broker_introduction_family_grants
  set revoked_at=new.revoked_at
  where family_viewer_id=new.id and revoked_at is null;
  return null;
end;
$$;
revoke all on function app_private.revoke_broker_introduction_family_grants() from public,anon,authenticated,service_role;
create trigger family_viewer_revoke_frozen_grants
after update of revoked_at on app_private.candidate_family_viewers
for each row when (old.revoked_at is null and new.revoked_at is not null)
execute function app_private.revoke_broker_introduction_family_grants();


create function app_private.respond_to_broker_introduction_with_consent(
  p_introduction_ref text,
  p_session_token_hash text,
  p_response text,
  p_comment text,
  p_confirm_complete_access boolean, p_confirm_family_access boolean
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
  for update of item;
  if introduction.id is null or introduction.expires_at<=pg_catalog.clock_timestamp()
  then return '{"available":false}'::jsonb; end if;

  -- A pause can hold the row at the deadline without updating an expired
  -- non-mutual Introduction. Use a fresh snapshot after acquiring the lock
  -- so a response that waited cannot act on the prior live mandates.
  if not exists (
    select 1 from public.organizations organization
    join public.broker_clients source on source.organization_id=organization.id and source.id=introduction.broker_client_id
    join public.broker_clients recipient on recipient.organization_id=organization.id and recipient.id=introduction.recipient_broker_client_id
    join public.candidates source_candidate on source_candidate.id=source.candidate_id
    join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
    where organization.id=introduction.organization_id
      and (case when introduction.actor_side='source' then source_candidate.primary_owner_user_id
        else recipient_candidate.primary_owner_user_id end)=actor_id
      and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
      and source.relationship_status='active' and recipient.relationship_status='active'
      and app_private.candidate_is_introduction_ready(source.candidate_id)
      and app_private.candidate_is_introduction_ready(recipient.candidate_id)
      and app_private.relationship_has_active_mandate(
        organization.workspace_ref,source.relationship_ref,'introductions.send')
      and app_private.relationship_has_active_mandate(
        organization.workspace_ref,recipient.relationship_ref,'customers.read')
  ) then return '{"available":false}'::jsonb; end if;

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
        source_family_complete_consented=p_confirm_family_access is true,
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
        recipient_family_complete_consented=p_confirm_family_access is true,
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
      source_family_complete_consented=p_response='accepted' and p_confirm_family_access is true,
      source_complete_access_confirmed_at=case when p_response='accepted'
        then pg_catalog.now() else null end,
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id returning * into updated_introduction;
    response_added:=true;
  else
    update app_private.broker_introductions
    set status='responded',response=p_response,
      response_comment=nullif(pg_catalog.btrim(p_comment),''),responded_at=pg_catalog.now(),
      recipient_family_complete_consented=p_response='accepted' and p_confirm_family_access is true,
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

create function app_private.record_introduction_family_update_with_consent(
  p_workspace_ref text,p_introduction_ref text,p_side text,p_reported_status text,
  p_reported_by text,p_channel text,p_comment text,p_consent_attested boolean,
  p_expected_version bigint,p_idempotency_key text,p_confirm_family_access boolean
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

  if p_confirm_family_access is true and p_reported_status<>'accepted'
  then raise exception 'family disclosure requires Interested' using errcode='22023'; end if;
  request_hash := encode(extensions.digest((jsonb_build_array(
    p_workspace_ref,p_introduction_ref,p_side,p_reported_status,p_reported_by,p_channel,
    normalized_comment,p_consent_attested,p_expected_version
  ) || case when p_confirm_family_access is true then '[true]'::jsonb else '[]'::jsonb end)::text,'sha256'),'hex');
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

  if item.expires_at<=pg_catalog.clock_timestamp()
    or not app_private.can_record_introduction_family_update(actor,p_workspace_ref,item)
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
    source_family_complete_consented=case when p_reported_status='accepted' and p_side='source'
      then p_confirm_family_access is true else source_family_complete_consented end,
    source_complete_access_confirmed_at=case when p_reported_status='accepted' and p_side='source' then now() else source_complete_access_confirmed_at end,
    response=case when final_response and p_side='recipient' then p_reported_status else response end,
    responded_at=case when final_response and p_side='recipient' then now() else responded_at end,
    recipient_family_complete_consented=case when p_reported_status='accepted' and p_side='recipient'
      then p_confirm_family_access is true else recipient_family_complete_consented end,
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
      'reportedBy',p_reported_by,'channel',p_channel,'consentAttested',p_consent_attested,
      'familyDisclosureConfirmed',p_confirm_family_access is true));

  result := jsonb_build_object('available',true,'rowVersion',item.row_version,
    'completeAccessExpiresAt',item.complete_access_expires_at);
  insert into app_private.brokerdesk_command_idempotency(actor_user_id,command_name,idempotency_key,request_hash,organization_id,safe_result)
  values (actor,'record_introduction_family_update',p_idempotency_key,request_hash,item.organization_id,result);
  return result;
end;
$$;
create or replace function public.manage_customer_broker_consent(
  p_relationship_ref text,
  p_action text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  relationship_record public.broker_clients%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
  mandate_end timestamptz;
  renewal_consent_version text;
  revoked_introduction_count integer := 0;
  revoked_pass_count integer := 0;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_action not in ('pause', 'renew', 'terminate')
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'broker relationship action unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':customer-broker-consent:' || p_relationship_ref, 0
  ));

  select relationship.* into relationship_record
  from public.broker_clients relationship
  join public.candidates candidate on candidate.id = relationship.candidate_id
  where relationship.relationship_ref = p_relationship_ref
    and candidate.primary_owner_user_id = actor_id
  for update of relationship;

  if relationship_record.id is null then
    return '{"available":false}'::jsonb;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'broker-relationship:' || relationship_record.id::text, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'relationshipRef', p_relationship_ref,
      'action', p_action
    )::text, 'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'manage_customer_broker_consent'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  if p_action = 'pause' then
    if relationship_record.relationship_status = 'paused' then
      return pg_catalog.jsonb_build_object(
        'available', true, 'relationshipRef', p_relationship_ref,
        'relationshipStatus', 'paused', 'endsAt', relationship_record.ends_at
      );
    end if;
    if relationship_record.relationship_status <> 'active'
      or (relationship_record.ends_at is not null
        and relationship_record.ends_at <= pg_catalog.now())
    then
      return '{"available":false}'::jsonb;
    end if;
  elsif p_action = 'renew' then
    if relationship_record.relationship_status not in ('active', 'paused', 'expired')
      or (
        relationship_record.relationship_status = 'active'
        and (relationship_record.ends_at is null
          or relationship_record.ends_at > pg_catalog.now() + interval '30 days')
      )
    then
      return '{"available":false}'::jsonb;
    end if;

    select mandate.consent_version into renewal_consent_version
    from app_private.broker_client_mandates mandate
    where mandate.organization_id = relationship_record.organization_id
      and mandate.broker_client_id = relationship_record.id
    order by mandate.created_at desc, mandate.id desc
    limit 1;

    if renewal_consent_version not in (
      'broker-representation-v1',
      'broker-representation-v2',
      'broker-representation-v3'
    ) then
      return '{"available":false}'::jsonb;
    end if;
  else
    if relationship_record.relationship_status = 'terminated' then
      return pg_catalog.jsonb_build_object(
        'available', true, 'relationshipRef', p_relationship_ref,
        'relationshipStatus', 'terminated', 'endsAt', relationship_record.ends_at
      );
    end if;
  end if;

  if p_action in ('pause', 'terminate') then
    update app_private.broker_client_mandates
    set revoked_at = pg_catalog.now(), revoked_by = actor_id,
        updated_at = pg_catalog.now()
    where organization_id = relationship_record.organization_id
      and broker_client_id = relationship_record.id
      and revoked_at is null;

    -- Close live bilateral Introductions from either side, including any
    -- Complete window that outlasts the original response period.
    with locked_introductions as materialized (
      select item.id,item.expires_at,item.complete_access_expires_at
      from app_private.broker_introductions item
      where item.organization_id=relationship_record.organization_id
        and item.revoked_at is null and item.status in ('created','shared','responded')
        and (item.broker_client_id=relationship_record.id
          or (item.access_model='identity_bound' and item.recipient_broker_client_id=relationship_record.id))
        -- Include a potentially in-flight bilateral response at the deadline.
        -- Inspect the live window again using the post-lock row.
        and (item.expires_at>now() or item.complete_access_expires_at>now()
          or (item.access_model='identity_bound' and item.status in ('shared','responded')
            and item.mutual_interest_confirmed_at is null
            and item.source_response is distinct from 'declined' and item.response is distinct from 'declined'))
      order by item.id for update
    ), revoked_introductions as (
      update app_private.broker_introductions introduction
      set status=case when introduction.status='responded' then 'responded' else 'revoked' end,
          revoked_at=now(),row_version=row_version+1,updated_at=now()
      where introduction.id in (
        select id from locked_introductions where expires_at>now() or complete_access_expires_at>now()
      )
      returning introduction.id
    ), revoked_passes as (
      update app_private.broker_introduction_passes pass
      set revoked_at = pg_catalog.now(), claim_token_hash = null
      where pass.introduction_id in (select id from revoked_introductions) and pass.revoked_at is null
      returning pass.id
    ), recorded_events as (
      insert into app_private.broker_introduction_events (
        organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
      )
      select relationship_record.organization_id,revoked.id,'revoked','system',actor_id,
        pg_catalog.jsonb_build_object('reason','customer_' || p_action)
      from revoked_introductions revoked
      returning introduction_id
    )
    select (select count(*)::integer from revoked_passes), (select count(*)::integer from recorded_events)
    into revoked_pass_count, revoked_introduction_count;

    update public.broker_clients
    set relationship_status = case when p_action = 'pause'
          then 'paused' else 'terminated' end,
        ends_at = case when p_action = 'terminate'
          then greatest(pg_catalog.now(), starts_at + interval '1 microsecond')
          else ends_at end,
        row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = relationship_record.id
    returning * into relationship_record;
  else
    mandate_end := pg_catalog.now() + interval '1 year';
    update app_private.broker_client_mandates
    set revoked_at = pg_catalog.now(), revoked_by = actor_id,
        updated_at = pg_catalog.now()
    where organization_id = relationship_record.organization_id
      and broker_client_id = relationship_record.id
      and revoked_at is null;

    insert into app_private.broker_client_mandates (
      organization_id, broker_client_id, purpose, permitted_capabilities,
      evidence_reference, consent_version, customer_approved_by, starts_at, ends_at
    ) values (
      relationship_record.organization_id, relationship_record.id,
      'Matrimonial matchmaking representation',
      app_private.broker_mandate_capabilities(renewal_consent_version),
      p_relationship_ref || ':' || renewal_consent_version || ':renewal:' ||
        pg_catalog.left(p_idempotency_key, 96),
      renewal_consent_version, actor_id, pg_catalog.now(), mandate_end
    );

    update public.broker_clients
    set relationship_status = 'active', consented_at = pg_catalog.now(),
        ends_at = mandate_end, row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = relationship_record.id
    returning * into relationship_record;
  end if;

  result := pg_catalog.jsonb_build_object(
    'available', true,
    'relationshipRef', relationship_record.relationship_ref,
    'relationshipStatus', relationship_record.relationship_status,
    'endsAt', relationship_record.ends_at
  );

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome, safe_details
  ) values (
    relationship_record.organization_id, actor_id,
    'customer.broker_consent.' || p_action, 'broker_client', 'succeeded',
    pg_catalog.jsonb_build_object(
      'relationshipRef', relationship_record.relationship_ref,
      'consentVersion', renewal_consent_version,
      'revokedIntroductionCount', revoked_introduction_count,
      'revokedPassCount', revoked_pass_count
    )
  );

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'manage_customer_broker_consent', p_idempotency_key,
    request_hash, relationship_record.organization_id, result
  );

  return result;
end;
$$;



revoke all on function app_private.respond_to_broker_introduction_with_consent(text,text,text,text,boolean,boolean)
  from public,anon,authenticated,service_role;
revoke all on function app_private.record_introduction_family_update_with_consent(text,text,text,text,text,text,text,boolean,bigint,text,boolean)
  from public,anon,authenticated,service_role;

-- Old clients retain candidate-only disclosure. Explicit new consent uses a
-- separate RPC signature so a stale tab cannot authorize a wider audience.
create or replace function public.respond_to_broker_introduction(
  p_introduction_ref text,p_session_token_hash text,p_response text,p_comment text,p_confirm_complete_access boolean
) returns jsonb language sql security definer set search_path='' as $$
  select app_private.respond_to_broker_introduction_with_consent(
    p_introduction_ref,p_session_token_hash,p_response,p_comment,p_confirm_complete_access,false);
$$;

create function public.respond_to_broker_introduction_with_family_consent(
  p_introduction_ref text,p_response text,p_comment text,p_confirm_complete_access boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return app_private.respond_to_broker_introduction_with_consent(
    p_introduction_ref,null,p_response,p_comment,p_confirm_complete_access,true);
end;
$$;
revoke all on function public.respond_to_broker_introduction_with_family_consent(text,text,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.respond_to_broker_introduction_with_family_consent(text,text,text,boolean) to authenticated;

create or replace function public.record_introduction_family_update(
  p_workspace_ref text,p_introduction_ref text,p_side text,p_reported_status text,p_reported_by text,
  p_channel text,p_comment text,p_consent_attested boolean,p_expected_version bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return app_private.record_introduction_family_update_with_consent(
    p_workspace_ref,p_introduction_ref,p_side,p_reported_status,p_reported_by,p_channel,p_comment,
    p_consent_attested,p_expected_version,p_idempotency_key,false);
end;
$$;

create function public.record_introduction_family_update_with_family_consent(
  p_workspace_ref text,p_introduction_ref text,p_side text,p_reported_status text,p_reported_by text,
  p_channel text,p_comment text,p_consent_attested boolean,p_expected_version bigint,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return app_private.record_introduction_family_update_with_consent(
    p_workspace_ref,p_introduction_ref,p_side,p_reported_status,p_reported_by,p_channel,p_comment,
    p_consent_attested,p_expected_version,p_idempotency_key,true);
end;
$$;
revoke all on function public.record_introduction_family_update_with_family_consent(text,text,text,text,text,text,text,boolean,bigint,text)
  from public,anon,authenticated,service_role;
grant execute on function public.record_introduction_family_update_with_family_consent(text,text,text,text,text,text,text,boolean,bigint,text) to authenticated;

-- Repair still-live pre-migration windows if a recorded pause or termination
-- followed mutual interest. Ordinary uninterrupted renewal does not close access.
with closed as (
  update app_private.broker_introductions item
  set revoked_at=now(),updated_at=now(),row_version=row_version+1
  where item.access_model='identity_bound' and item.status='responded'
    and item.revoked_at is null and item.complete_access_expires_at>now()
    and exists (
      select 1 from public.broker_clients relationship
      where relationship.organization_id=item.organization_id
        and relationship.id in (item.broker_client_id,item.recipient_broker_client_id)
        and (relationship.relationship_status in ('paused','terminated') or exists (
          select 1 from app_private.brokerdesk_audit_events audit
          where audit.organization_id=item.organization_id and audit.occurred_at>=item.mutual_interest_confirmed_at
            and audit.event_name in ('customer.broker_consent.pause','customer.broker_consent.terminate')
            and audit.outcome='succeeded' and audit.safe_details->>'relationshipRef'=relationship.relationship_ref
        ))
    )
  returning item.id,item.organization_id
)
insert into app_private.broker_introduction_events(organization_id,introduction_id,event_type,actor_kind,safe_details)
select organization_id,id,'revoked','system',jsonb_build_object('reason','historical_customer_mandate_closed') from closed;

create function app_private.resolve_family_introduction(p_introduction_ref text,actor uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  email_hash text;
  result jsonb;
begin
  select app_private.normalized_email_hash(account.email) into email_hash
    from auth.users account where account.id=actor and account.email_confirmed_at is not null;
  if email_hash is null or not app_private.user_has_google_identity(actor,email_hash)
  then return '{"available":false}'::jsonb; end if;

  with eligible as materialized (
    select item.id,item.expires_at,item.complete_access_expires_at,item.mutual_interest_confirmed_at,
      viewer.id as viewer_id,
      case when viewer.candidate_id=source.candidate_id then 'source' else 'recipient' end as viewer_side,
      case when viewer.candidate_id=source.candidate_id
        then item.recipient_portfolio_version_id else item.portfolio_version_id end as opposite_version
    from app_private.broker_introductions item
    join public.organizations agency on agency.id=item.organization_id
    join public.broker_clients source on source.organization_id=agency.id and source.id=item.broker_client_id
    join public.broker_clients recipient on recipient.organization_id=agency.id and recipient.id=item.recipient_broker_client_id
    join public.candidates source_candidate on source_candidate.id=source.candidate_id
    join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
    join app_private.candidate_family_viewers viewer on viewer.candidate_id in (source.candidate_id,recipient.candidate_id)
    where item.introduction_ref=p_introduction_ref and item.access_model='identity_bound'
      and item.status in ('shared','responded') and item.shared_at is not null and item.revoked_at is null
      and item.source_response is distinct from 'declined' and item.response is distinct from 'declined'
      and (item.expires_at>now() or item.complete_access_expires_at>now())
      and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
      and actor not in (source_candidate.primary_owner_user_id,recipient_candidate.primary_owner_user_id)
      and viewer.verified_user_id=actor and viewer.intended_email_hash=email_hash
      and viewer.status='active' and viewer.revoked_at is null
      and app_private.candidate_is_introduction_ready(source.candidate_id)
      and app_private.candidate_is_introduction_ready(recipient.candidate_id)
      and app_private.relationship_has_active_mandate(agency.workspace_ref,source.relationship_ref,'introductions.send')
      and app_private.relationship_has_active_mandate(agency.workspace_ref,recipient.relationship_ref,'customers.read')
      and app_private.relationship_has_active_mandate_version(agency.workspace_ref,source.relationship_ref,'broker-representation-v3')
      and app_private.relationship_has_active_mandate_version(agency.workspace_ref,recipient.relationship_ref,'broker-representation-v3')
  ), disclosure as (
    select eligible.*,
      coalesce(eligible.complete_access_expires_at>now() and grant_row.family_viewer_id is not null,false) as complete
    from eligible
    left join app_private.broker_introduction_family_grants grant_row on grant_row.introduction_id=eligible.id
      and grant_row.family_viewer_id=eligible.viewer_id and grant_row.participant_side=eligible.viewer_side
      and grant_row.revoked_at is null
    where (select count(*) from eligible)=1
  )
  select jsonb_build_object(
    'available',true,'introductionRef',p_introduction_ref,
    'disclosureLevel',case when disclosure.complete then 'complete' else 'broker_standard' end,
    'data',case when disclosure.complete then pinned.complete_data else pinned.broker_standard_data end,
    'media',pinned.complete_media,'horoscope',pinned.horoscope,
    'assetNamespace',portfolio.user_id::text || '/' || portfolio.id::text,
    'templateId',pinned.template_id,'sunSign',pinned.sun_sign,
    'expiresAt',case when disclosure.complete then disclosure.complete_access_expires_at else disclosure.expires_at end,
    'versionNumber',pinned.version_number
  ) into result
  from disclosure join app_private.portfolio_disclosure_versions pinned on pinned.id=disclosure.opposite_version
  join public.portfolios portfolio on portfolio.id=pinned.portfolio_id
  where disclosure.complete or (disclosure.mutual_interest_confirmed_at is null and disclosure.expires_at>now());
  return coalesce(result,'{"available":false}'::jsonb);
end;
$$;
revoke all on function app_private.resolve_family_introduction(text,uuid) from public,anon,authenticated,service_role;

create function public.resolve_family_introduction(p_introduction_ref text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  profile jsonb;
  route text;
  safe_media jsonb;
  safe_horoscope jsonb;
begin
  perform app_private.require_current_session();
  profile := app_private.resolve_family_introduction(p_introduction_ref,auth.uid());
  if profile->>'available' is distinct from 'true' then return profile; end if;
  route := '/api/v1/family/introductions/' || p_introduction_ref;

  select coalesce(jsonb_agg(entry.value || jsonb_build_object(
    'key','photo-' || (entry.position-1)::text,
    'accessPath',route || '?asset=photo-' || (entry.position-1)::text
  ) order by entry.position),'[]'::jsonb) into safe_media
  from jsonb_array_elements(profile->'media') with ordinality as entry(value,position);

  if jsonb_typeof(profile->'horoscope')='object' then
    safe_horoscope := profile->'horoscope' || jsonb_build_object('accessPath',route || '?asset=horoscope');
  end if;
  return (profile-'assetNamespace') || jsonb_build_object('media',safe_media,'horoscope',safe_horoscope);
end;
$$;
revoke all on function public.resolve_family_introduction(text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_family_introduction(text) to authenticated;

-- The server verifies the caller's JWT before passing its actor and session.
-- Raw storage locators stay behind the service-role boundary. Recheck that
-- exact session and the same live Family Viewer scope before resolving a file.
create function public.resolve_family_introduction_asset(
  p_introduction_ref text,p_asset text,p_actor uuid,p_session_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  profile jsonb;
  path text;
  extension text;
begin
  if not exists (
    select 1 from auth.sessions session_record where session_record.id=p_session_id and session_record.user_id=p_actor
  ) or exists (
    select 1 from public.account_deletion_requests deletion_request
    where deletion_request.user_id=p_actor and deletion_request.status='processing'
  ) then return null; end if;

  profile := app_private.resolve_family_introduction(p_introduction_ref,p_actor);
  if profile->>'available' is distinct from 'true' then return null; end if;
  if p_asset='horoscope' then
    path := profile#>>'{horoscope,accessPath}';
    extension := profile#>>'{horoscope,fileExtension}';
  elsif p_asset ~ '^photo-[0-7]$' then
    path := profile->'media'->(right(p_asset,1)::integer)->>'accessPath';
  end if;
  if not app_private.storage_path_is_canonical(path) or not (
    (split_part(path,'/',1) || '/' || split_part(path,'/',2))=profile->>'assetNamespace'
    -- Historical photos used owner/file. Horoscopes always need a portfolio namespace.
    or (p_asset<>'horoscope' and split_part(path,'/',3)=''
      and split_part(path,'/',1)=split_part(profile->>'assetNamespace','/',1))
  ) then return null; end if;
  return jsonb_build_object('path',path,'extension',extension);
end;
$$;
revoke all on function public.resolve_family_introduction_asset(text,text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolve_family_introduction_asset(text,text,uuid,uuid) to service_role;
