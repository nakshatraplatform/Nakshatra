-- NAK-78: identity-bound BrokerDesk Introductions between two completed customers.
-- Personal VivIntro links remain unchanged and may still be viewed by guests.

alter table app_private.broker_introductions
  add column recipient_broker_client_id uuid,
  add column recipient_portfolio_version_id uuid references app_private.portfolio_disclosure_versions(id) on delete restrict,
  add column source_response text check (source_response in ('accepted','declined')),
  add column source_response_comment text,
  add column source_responded_at timestamptz,
  add column access_model text not null default 'legacy_device_pass';

alter table app_private.broker_introductions
  add constraint broker_introductions_recipient_relationship_fk
    foreign key (organization_id, recipient_broker_client_id)
    references public.broker_clients(organization_id, id) on delete restrict,
  add constraint broker_introductions_access_model_check
    check (access_model in ('legacy_device_pass','identity_bound')),
  add constraint broker_introductions_identity_recipient_check
    check (access_model <> 'identity_bound' or (
      recipient_broker_client_id is not null and recipient_portfolio_version_id is not null
    )),
  add constraint broker_introductions_distinct_participants_check
    check (recipient_broker_client_id is null or recipient_broker_client_id <> broker_client_id),
  add constraint broker_introductions_source_response_check
    check ((source_response is null and source_responded_at is null)
      or (source_response is not null and source_responded_at is not null and status = 'responded'));

create index broker_introductions_recipient_idx
  on app_private.broker_introductions
    (organization_id, recipient_broker_client_id, created_at desc)
  where recipient_broker_client_id is not null;

create unique index broker_introductions_one_active_pair_per_agency_idx
  on app_private.broker_introductions (
    organization_id,
    least(broker_client_id,recipient_broker_client_id),
    greatest(broker_client_id,recipient_broker_client_id)
  )
  where access_model='identity_bound'
    and revoked_at is null
    and status in ('created','shared','responded');

-- A bearer credential cannot be safely converted into identity-bound authority.
-- Preserve history, but close every live legacy route and scrub its credentials.
with revoked as (
  update app_private.broker_introductions
  set status = case when status = 'responded' then 'responded' else 'revoked' end,
      revoked_at = coalesce(revoked_at, pg_catalog.now()),
      row_version = row_version + 1,
      updated_at = pg_catalog.now()
  where access_model = 'legacy_device_pass'
    and status in ('created','shared','responded')
    and revoked_at is null
  returning id, organization_id
)
insert into app_private.broker_introduction_events (
  organization_id, introduction_id, event_type, actor_kind, safe_details
)
select organization_id, id, 'revoked', 'system',
  '{"reason":"identity_bound_access_migration"}'::jsonb
from revoked;

update app_private.broker_introduction_passes
set revoked_at = coalesce(revoked_at, pg_catalog.now()),
    claim_token_hash = null,
    session_token_hash = null,
    claimed_at = null,
    last_seen_at = null
where claim_token_hash is not null
   or session_token_hash is not null
   or claimed_at is not null
   or last_seen_at is not null
   or revoked_at is null;

create or replace function app_private.candidate_is_introduction_ready(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.portfolios portfolio
    where portfolio.candidate_id = p_candidate_id
      and portfolio.is_published = true
      and portfolio.published_data is not null
      and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
      and exists (
        select 1 from app_private.current_identity_verification(p_candidate_id)
      )
  )
$$;

revoke all on function app_private.candidate_is_introduction_ready(uuid)
  from public, anon, authenticated;

create or replace function public.resolve_broker_introduction_recipients(
  p_workspace_ref text,
  p_source_relationship_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); organization_record public.organizations%rowtype;
  source_record public.broker_clients%rowtype;
  source_owner_id uuid;
begin
  perform app_private.require_current_session();
  select organization.* into organization_record
  from public.organizations organization
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency'
    and organization.status = 'active'
    and app_private.brokerdesk_entitlement_enabled(organization.id);
  select relationship.* into source_record
  from public.broker_clients relationship
  where relationship.organization_id = organization_record.id
    and relationship.relationship_ref = p_source_relationship_ref;
  select candidate.primary_owner_user_id into source_owner_id
  from public.candidates candidate
  where candidate.id = source_record.candidate_id;
  if organization_record.id is null or source_record.id is null
    or source_owner_id is null
    or source_record.relationship_status <> 'active'
    or not app_private.candidate_is_introduction_ready(source_record.candidate_id)
    or not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.create',p_source_relationship_ref
    )
    or not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.send',p_source_relationship_ref
    )
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,p_source_relationship_ref,'introductions.create'
    )
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,p_source_relationship_ref,'introductions.send'
    )
  then return '{"available":false}'::jsonb; end if;

  return pg_catalog.jsonb_build_object(
    'available',true,
    'recipients',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'relationshipRef',target.relationship_ref,
        'displayName',coalesce(nullif(pg_catalog.btrim(portfolio.published_data #>> '{personal,name}'),''),'Customer'),
        'gender',portfolio.published_data #>> '{personal,gender}',
        'location',portfolio.published_data #>> '{personal,current_location}'
      ) order by portfolio.published_data #>> '{personal,name}')
      from public.broker_clients target
      join public.candidates target_candidate on target_candidate.id = target.candidate_id
      join public.portfolios portfolio on portfolio.candidate_id = target.candidate_id
      where target.organization_id = organization_record.id
        and target.id <> source_record.id
        and target.candidate_id <> source_record.candidate_id
        and target_candidate.primary_owner_user_id is not null
        and target_candidate.primary_owner_user_id <> source_owner_id
        and target.relationship_status = 'active'
        and app_private.candidate_is_introduction_ready(target.candidate_id)
        and app_private.member_has_brokerdesk_capability(
          actor_id,p_workspace_ref,'customers.read',target.relationship_ref
        )
        and app_private.relationship_has_active_mandate(
          p_workspace_ref,target.relationship_ref,'customers.read'
        )
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.create_identity_bound_broker_introduction(
  p_workspace_ref text,
  p_source_relationship_ref text,
  p_recipient_relationship_ref text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); organization_record public.organizations%rowtype;
  source_record public.broker_clients%rowtype; recipient_record public.broker_clients%rowtype;
  source_owner_id uuid; recipient_owner_id uuid;
  version_record record; introduction app_private.broker_introductions%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text; result jsonb;
begin
  perform app_private.require_current_session();
  if p_source_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_recipient_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_source_relationship_ref = p_recipient_relationship_ref
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then raise exception 'introduction unavailable' using errcode='22023'; end if;

  select organization.* into organization_record from public.organizations organization
  where organization.workspace_ref=p_workspace_ref
    and organization.type='matchmaker_agency' and organization.status='active';
  select relationship.* into source_record from public.broker_clients relationship
  where relationship.organization_id=organization_record.id
    and relationship.relationship_ref=p_source_relationship_ref;
  select relationship.* into recipient_record from public.broker_clients relationship
  where relationship.organization_id=organization_record.id
    and relationship.relationship_ref=p_recipient_relationship_ref;
  select candidate.primary_owner_user_id into source_owner_id
  from public.candidates candidate where candidate.id=source_record.candidate_id;
  select candidate.primary_owner_user_id into recipient_owner_id
  from public.candidates candidate where candidate.id=recipient_record.candidate_id;
  if organization_record.id is null or source_record.id is null or recipient_record.id is null
    or source_record.candidate_id=recipient_record.candidate_id
    or source_owner_id is null or recipient_owner_id is null
    or source_owner_id=recipient_owner_id
    or source_record.relationship_status<>'active' or recipient_record.relationship_status<>'active'
    or not app_private.brokerdesk_entitlement_enabled(organization_record.id)
    or not app_private.candidate_is_introduction_ready(source_record.candidate_id)
    or not app_private.candidate_is_introduction_ready(recipient_record.candidate_id)
    or not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.create',source_record.relationship_ref)
    or not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.send',source_record.relationship_ref)
    or not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'customers.read',recipient_record.relationship_ref)
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,source_record.relationship_ref,'introductions.create')
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,source_record.relationship_ref,'introductions.send')
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,recipient_record.relationship_ref,'customers.read')
  then return '{"available":false}'::jsonb; end if;

  perform pg_catalog.pg_advisory_xact_lock(least(
    pg_catalog.hashtextextended('broker-relationship:'||source_record.id::text,0),
    pg_catalog.hashtextextended('broker-relationship:'||recipient_record.id::text,0)));
  perform pg_catalog.pg_advisory_xact_lock(greatest(
    pg_catalog.hashtextextended('broker-relationship:'||source_record.id::text,0),
    pg_catalog.hashtextextended('broker-relationship:'||recipient_record.id::text,0)));

  -- Candidate ownership determines which person may view and answer each side.
  -- Lock both rows in a stable order so ownership cannot change between this
  -- validation and the Introduction insert.
  perform 1
  from public.candidates candidate
  where candidate.id in (source_record.candidate_id,recipient_record.candidate_id)
  order by candidate.id
  for update;
  select candidate.primary_owner_user_id into source_owner_id
  from public.candidates candidate where candidate.id=source_record.candidate_id;
  select candidate.primary_owner_user_id into recipient_owner_id
  from public.candidates candidate where candidate.id=recipient_record.candidate_id;

  if source_owner_id is null or recipient_owner_id is null
    or source_owner_id=recipient_owner_id
    or not app_private.candidate_is_introduction_ready(source_record.candidate_id)
    or not app_private.candidate_is_introduction_ready(recipient_record.candidate_id)
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,source_record.relationship_ref,'introductions.send')
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,recipient_record.relationship_ref,'customers.read')
  then return '{"available":false}'::jsonb; end if;

  select version.id,version.version_ref,version.version_number,
    version.complete_data #>> '{personal,name}' source_name,
    recipient_version.id recipient_version_id,
    recipient_version.version_ref recipient_version_ref,
    recipient_version.version_number recipient_version_number,
    recipient_version.complete_data #>> '{personal,name}' recipient_name
  into version_record
  from public.portfolios source_portfolio
  join app_private.portfolio_disclosure_versions version
    on version.portfolio_id=source_portfolio.id
  join public.portfolios recipient_portfolio
    on recipient_portfolio.candidate_id=recipient_record.candidate_id
  join app_private.portfolio_disclosure_versions recipient_version
    on recipient_version.portfolio_id=recipient_portfolio.id
  where source_portfolio.candidate_id=source_record.candidate_id
    and source_portfolio.is_published=true
    and recipient_portfolio.is_published=true
    and recipient_version.version_number=(
      select pg_catalog.max(latest.version_number)
      from app_private.portfolio_disclosure_versions latest
      where latest.portfolio_id=recipient_portfolio.id
    )
  order by version.version_number desc limit 1;
  if version_record.id is null then return '{"available":false}'::jsonb; end if;

  request_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('workspaceRef',p_workspace_ref,
      'sourceRelationshipRef',p_source_relationship_ref,
      'recipientRelationshipRef',p_recipient_relationship_ref,
      'sourceVersionRef',version_record.version_ref,
      'recipientVersionRef',version_record.recipient_version_ref)::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text||':identity-bound-broker-introduction:'||p_idempotency_key,0));
  select * into existing from app_private.brokerdesk_command_idempotency
  where actor_user_id=actor_id and command_name='create_identity_bound_broker_introduction'
    and idempotency_key=p_idempotency_key and expires_at>pg_catalog.now();
  if found then
    if existing.request_hash<>request_hash then
      raise exception 'idempotency key was already used for a different request' using errcode='22023';
    end if;
    return existing.safe_result;
  end if;

  if exists (
    select 1 from app_private.broker_introductions pair
    where pair.organization_id=organization_record.id
      and pair.access_model='identity_bound'
      and pair.revoked_at is null
      and pair.status in ('created','shared','responded')
      and least(pair.broker_client_id,pair.recipient_broker_client_id)
        =least(source_record.id,recipient_record.id)
      and greatest(pair.broker_client_id,pair.recipient_broker_client_id)
        =greatest(source_record.id,recipient_record.id)
  ) then return '{"available":false}'::jsonb; end if;

  if (select pg_catalog.count(*) from app_private.broker_introductions candidate_intro
      where candidate_intro.organization_id=organization_record.id
        and candidate_intro.created_at>pg_catalog.now()-interval '24 hours')>=100
  then raise exception 'workspace introduction quota exceeded' using errcode='42501'; end if;

  insert into app_private.broker_introductions(
    organization_id,broker_client_id,recipient_broker_client_id,portfolio_version_id,
    recipient_portfolio_version_id,
    detailed_snapshot,recipient_label,status,created_by,expires_at,access_model
  ) values (
    organization_record.id,source_record.id,recipient_record.id,version_record.id,
    version_record.recipient_version_id,
    '{}'::jsonb,coalesce(nullif(pg_catalog.btrim(version_record.recipient_name),''),'Customer'),
    'created',actor_id,pg_catalog.now()+interval '15 days','identity_bound'
  ) returning * into introduction;
  insert into app_private.broker_introduction_events(
    organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
  ) values (
    organization_record.id,introduction.id,'created','broker',actor_id,
    pg_catalog.jsonb_build_object(
      'sourceVersionRef',version_record.version_ref,
      'recipientVersionRef',version_record.recipient_version_ref
    )
  );
  result:=pg_catalog.jsonb_build_object(
    'status','created','introductionRef',introduction.introduction_ref,
    'sourceName',coalesce(nullif(pg_catalog.btrim(version_record.source_name),''),'Customer'),
    'recipientLabel',introduction.recipient_label,'recipientEmailHint',null,
    'expiresAt',introduction.expires_at,'versionNumber',version_record.version_number,
    'rowVersion',introduction.row_version
  );
  insert into app_private.brokerdesk_command_idempotency(
    actor_user_id,command_name,idempotency_key,request_hash,organization_id,safe_result
  ) values (actor_id,'create_identity_bound_broker_introduction',p_idempotency_key,
    request_hash,organization_record.id,result);
  return result;
end;
$$;

create or replace function public.mark_broker_introduction_shared(
  p_workspace_ref text, p_introduction_ref text, p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); introduction app_private.broker_introductions%rowtype;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  select item.* into introduction
  from app_private.broker_introductions item
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients source on source.id=item.broker_client_id
    and source.organization_id=item.organization_id
  join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id
    and recipient.organization_id=item.organization_id
  join public.candidates source_candidate on source_candidate.id=source.candidate_id
  join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
  where organization.workspace_ref=p_workspace_ref
    and item.introduction_ref=p_introduction_ref
    and item.access_model='identity_bound'
    and source.relationship_status='active' and recipient.relationship_status='active'
    and source_candidate.primary_owner_user_id is not null
    and recipient_candidate.primary_owner_user_id is not null
    and source_candidate.primary_owner_user_id<>recipient_candidate.primary_owner_user_id
    and app_private.candidate_is_introduction_ready(source.candidate_id)
    and app_private.candidate_is_introduction_ready(recipient.candidate_id)
    and app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.send',source.relationship_ref)
    and app_private.relationship_has_active_mandate(
      p_workspace_ref,source.relationship_ref,'introductions.send')
    and app_private.relationship_has_active_mandate(
      p_workspace_ref,recipient.relationship_ref,'customers.read')
  for update of item;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if introduction.status in ('shared','responded') then
    return pg_catalog.jsonb_build_object(
      'available',true,'status',introduction.status,'rowVersion',introduction.row_version);
  end if;
  if introduction.status<>'created' or introduction.row_version<>p_expected_version
  then return '{"available":false}'::jsonb; end if;
  update app_private.broker_introductions
  set status='shared',shared_at=pg_catalog.now(),row_version=row_version+1,
    updated_at=pg_catalog.now()
  where id=introduction.id returning * into introduction;
  insert into app_private.broker_introduction_events(
    organization_id,introduction_id,event_type,actor_kind,actor_user_id
  ) values (introduction.organization_id,introduction.id,'shared','broker',actor_id);
  return pg_catalog.jsonb_build_object(
    'available',true,'status','shared','rowVersion',introduction.row_version);
end;
$$;

create or replace function public.resolve_broker_introduction(
  p_introduction_ref text,
  p_session_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); introduction record;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  select item.*,
    case when source_candidate.primary_owner_user_id=actor_id then 'source' else 'recipient' end actor_side,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.broker_standard_data else source_version.broker_standard_data end broker_standard_data,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.complete_media else source_version.complete_media end complete_media,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.horoscope else source_version.horoscope end horoscope,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.template_id else source_version.template_id end template_id,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.theme_color else source_version.theme_color end theme_color,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.sun_sign else source_version.sun_sign end sun_sign,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.version_number else source_version.version_number end visible_version_number,
    case when source_candidate.primary_owner_user_id=actor_id
      then recipient_version.complete_data #>> '{personal,name}'
      else source_version.complete_data #>> '{personal,name}' end opposite_name,
    case when source_candidate.primary_owner_user_id=actor_id
      then item.source_response else item.response end viewer_response,
    case when source_candidate.primary_owner_user_id=actor_id
      then item.source_response_comment else item.response_comment end viewer_response_comment,
    case when source_candidate.primary_owner_user_id=actor_id
      then item.source_responded_at else item.responded_at end viewer_responded_at
  into introduction
  from app_private.broker_introductions item
  join app_private.portfolio_disclosure_versions source_version on source_version.id=item.portfolio_version_id
  join app_private.portfolio_disclosure_versions recipient_version on recipient_version.id=item.recipient_portfolio_version_id
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients source on source.id=item.broker_client_id
    and source.organization_id=item.organization_id
  join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id
    and recipient.organization_id=item.organization_id
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
      organization.workspace_ref,recipient.relationship_ref,'customers.read');
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  return pg_catalog.jsonb_build_object(
    'available',true,'introductionRef',introduction.introduction_ref,
    'participantSide',introduction.actor_side,
    'accessMode','complete','data',introduction.broker_standard_data,
    'media',introduction.complete_media,'horoscope',introduction.horoscope,
    'templateId',introduction.template_id,'themeColor',introduction.theme_color,
    'sunSign',introduction.sun_sign,'expiresAt',introduction.expires_at,
    'recipientLabel',coalesce(nullif(pg_catalog.btrim(introduction.opposite_name),''),'Customer'),
    'response',introduction.viewer_response,
    'responseComment',introduction.viewer_response_comment,
    'respondedAt',introduction.viewer_responded_at,
    'versionNumber',introduction.visible_version_number
  );
end;
$$;

create or replace function public.respond_to_broker_introduction(
  p_introduction_ref text,
  p_session_token_hash text,
  p_response text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); introduction record;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  if p_response not in ('accepted','declined') or pg_catalog.length(coalesce(p_comment,''))>1000
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
    return case when introduction.source_response=p_response
      and coalesce(introduction.source_response_comment,'')=coalesce(nullif(pg_catalog.btrim(p_comment),''),'')
      then pg_catalog.jsonb_build_object('available',true,'status','responded','response',introduction.source_response)
      else '{"available":false}'::jsonb end;
  elsif introduction.actor_side='recipient' and introduction.response is not null then
    return case when introduction.response=p_response
      and coalesce(introduction.response_comment,'')=coalesce(nullif(pg_catalog.btrim(p_comment),''),'')
      then pg_catalog.jsonb_build_object('available',true,'status','responded','response',introduction.response)
      else '{"available":false}'::jsonb end;
  end if;
  if introduction.actor_side='source' then
    update app_private.broker_introductions
    set status='responded',source_response=p_response,
      source_response_comment=nullif(pg_catalog.btrim(p_comment),''),source_responded_at=pg_catalog.now(),
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id;
  else
    update app_private.broker_introductions
    set status='responded',response=p_response,
      response_comment=nullif(pg_catalog.btrim(p_comment),''),responded_at=pg_catalog.now(),
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id;
  end if;
  insert into app_private.broker_introduction_events(
    organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
  ) values (introduction.organization_id,introduction.id,'response_submitted','recipient',actor_id,
    pg_catalog.jsonb_build_object('response',p_response,'participantSide',introduction.actor_side));
  return pg_catalog.jsonb_build_object('available',true,'status','responded','response',p_response);
end;
$$;

create or replace function public.resolve_received_broker_introductions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid();
begin
  perform app_private.require_current_session();
  return pg_catalog.jsonb_build_object('available',true,'introductions',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'introductionRef',item.introduction_ref,
      'sourceName',coalesce(nullif(pg_catalog.btrim(case
        when source_candidate.primary_owner_user_id=actor_id
          then recipient_version.complete_data #>> '{personal,name}'
        else source_version.complete_data #>> '{personal,name}' end),''),'Customer'),
      'brokerName',organization.name,'status',item.status,
      'response',case when source_candidate.primary_owner_user_id=actor_id
        then item.source_response else item.response end,
      'expiresAt',item.expires_at,'createdAt',item.created_at
    ) order by item.created_at desc)
    from app_private.broker_introductions item
    join app_private.portfolio_disclosure_versions source_version on source_version.id=item.portfolio_version_id
    join app_private.portfolio_disclosure_versions recipient_version on recipient_version.id=item.recipient_portfolio_version_id
    join public.organizations organization on organization.id=item.organization_id
    join public.broker_clients source on source.id=item.broker_client_id
    join public.broker_clients recipient on recipient.id=item.recipient_broker_client_id
    join public.candidates source_candidate on source_candidate.id=source.candidate_id
    join public.candidates recipient_candidate on recipient_candidate.id=recipient.candidate_id
    where item.access_model='identity_bound' and item.status in ('shared','responded')
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
  ),'[]'::jsonb));
end;
$$;

create or replace function public.resolve_broker_introductions(
  p_workspace_ref text, p_relationship_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); result jsonb;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  if not app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'customers.read',p_relationship_ref)
    or not app_private.relationship_has_active_mandate(
      p_workspace_ref,p_relationship_ref,'customers.read')
  then return '{"available":false}'::jsonb; end if;
  select pg_catalog.jsonb_build_object(
    'available',true,
    'introductions',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'introductionRef',item.introduction_ref,'recipientLabel',item.recipient_label,
      'recipientEmailHint',item.recipient_email_hint,'status',item.status,
      'response',item.response,'responseComment',item.response_comment,
      'respondedAt',item.responded_at,
      'sourceResponse',item.source_response,
      'sourceResponseComment',item.source_response_comment,
      'sourceRespondedAt',item.source_responded_at,
      'recipientResponse',item.response,
      'recipientResponseComment',item.response_comment,
      'recipientRespondedAt',item.responded_at,
      'expiresAt',item.expires_at,'versionNumber',version.version_number,
      'rowVersion',item.row_version,'createdAt',item.created_at
    ) order by item.created_at desc) filter (where item.id is not null),'[]'::jsonb)
  ) into result
  from public.organizations organization
  join public.broker_clients relationship on relationship.organization_id=organization.id
    and relationship.relationship_ref=p_relationship_ref
  left join app_private.broker_introductions item on item.organization_id=organization.id
    and item.broker_client_id=relationship.id
  left join app_private.portfolio_disclosure_versions version on version.id=item.portfolio_version_id
  where organization.workspace_ref=p_workspace_ref;
  return coalesce(result,'{"available":false}'::jsonb);
end;
$$;

create or replace function app_private.revoke_recipient_relationship_introductions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.relationship_status in ('paused','expired','terminated')
    and new.relationship_status is distinct from old.relationship_status
  then
    with revoked as (
      update app_private.broker_introductions
    set status=case when status='responded' then 'responded' else 'revoked' end,
      revoked_at=coalesce(revoked_at,pg_catalog.now()),row_version=row_version+1,
      updated_at=pg_catalog.now()
    where recipient_broker_client_id=new.id and revoked_at is null
        and status in ('created','shared','responded')
      returning id,organization_id
    )
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,safe_details
    ) select organization_id,id,'revoked','system',
      '{"reason":"recipient_relationship_inactive"}'::jsonb from revoked;
  end if;
  return new;
end;
$$;

drop trigger if exists revoke_recipient_relationship_introductions on public.broker_clients;
create trigger revoke_recipient_relationship_introductions
  after update of relationship_status on public.broker_clients
  for each row execute function app_private.revoke_recipient_relationship_introductions();

revoke all on function public.resolve_broker_introduction_recipients(text,text) from public,anon,authenticated;
revoke all on function public.create_identity_bound_broker_introduction(text,text,text,text) from public,anon,authenticated;
revoke all on function public.resolve_broker_introduction(text,text) from public,anon,authenticated;
revoke all on function public.respond_to_broker_introduction(text,text,text,text) from public,anon,authenticated;
revoke all on function public.resolve_received_broker_introductions() from public,anon,authenticated;
revoke all on function public.claim_broker_introduction_pass(text,text,text) from public,anon,authenticated;
revoke all on function public.prepare_broker_introduction(text,text) from public,anon,authenticated;
revoke all on function public.create_broker_introduction(text,text,text,jsonb,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.mark_broker_introduction_shared(text,text,bigint) from public,anon,authenticated;
grant execute on function public.resolve_broker_introduction_recipients(text,text) to authenticated;
grant execute on function public.create_identity_bound_broker_introduction(text,text,text,text) to authenticated;
grant execute on function public.resolve_broker_introduction(text,text) to authenticated;
grant execute on function public.respond_to_broker_introduction(text,text,text,text) to authenticated;
grant execute on function public.resolve_received_broker_introductions() to authenticated;
grant execute on function public.mark_broker_introduction_shared(text,text,bigint) to authenticated;
grant execute on function public.resolve_broker_introductions(text,text) to authenticated;

comment on function public.create_identity_bound_broker_introduction(text,text,text,text) is
  'Creates a version-pinned Broker Standard Introduction between two eligible customers in one agency.';
comment on function public.resolve_broker_introduction(text,text) is
  'Returns Broker Standard only to the authenticated owner of the intended recipient candidate; URL possession grants nothing.';
