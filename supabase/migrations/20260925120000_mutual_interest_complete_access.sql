-- NAK-79: mutual interest releases each participant's pinned Complete
-- Portfolio, including Protected Contact, for 30 days. The Introduction remains
-- the authority; personal B2C reveal grants are intentionally not repurposed.

alter table app_private.broker_introductions
  add column source_complete_access_confirmed_at timestamptz,
  add column recipient_complete_access_confirmed_at timestamptz,
  add column mutual_interest_confirmed_at timestamptz,
  add column complete_access_expires_at timestamptz;

alter table app_private.broker_introductions
  add constraint broker_introductions_complete_access_confirmation_check
  check (
    (source_complete_access_confirmed_at is null or source_response='accepted')
    and (recipient_complete_access_confirmed_at is null or response='accepted')
  ),
  add constraint broker_introductions_complete_access_state_check
  check (
    (mutual_interest_confirmed_at is null and complete_access_expires_at is null)
    or (
      mutual_interest_confirmed_at is not null
      and complete_access_expires_at = mutual_interest_confirmed_at + interval '30 days'
      and source_response = 'accepted'
      and response = 'accepted'
      and source_complete_access_confirmed_at is not null
      and recipient_complete_access_confirmed_at is not null
    )
  );

create index broker_introductions_complete_access_expiry_idx
  on app_private.broker_introductions (complete_access_expires_at)
  where complete_access_expires_at is not null and revoked_at is null;

alter table app_private.broker_introduction_events
  drop constraint broker_introduction_events_event_type_check;
alter table app_private.broker_introduction_events
  add constraint broker_introduction_events_event_type_check
  check (event_type in (
    'created','shared','claimed','response_submitted','complete_access_confirmed','mutual_access_granted',
    'revoked','expired'
  ));

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
    case when item.complete_access_expires_at>pg_catalog.now()
      then 'complete' else 'broker_standard' end disclosure_level,
    case when source_candidate.primary_owner_user_id=actor_id
      then case when item.complete_access_expires_at>pg_catalog.now()
        then recipient_version.complete_data else recipient_version.broker_standard_data end
      else case when item.complete_access_expires_at>pg_catalog.now()
        then source_version.complete_data else source_version.broker_standard_data end end visible_data,
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
    ,case when source_candidate.primary_owner_user_id=actor_id
      then item.source_complete_access_confirmed_at is not null
      else item.recipient_complete_access_confirmed_at is not null end viewer_complete_access_confirmed
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
    and item.revoked_at is null
    and (item.expires_at>pg_catalog.now() or item.complete_access_expires_at>pg_catalog.now())
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
    'accessMode','complete','disclosureLevel',introduction.disclosure_level,
    'data',introduction.visible_data,
    'media',introduction.complete_media,'horoscope',introduction.horoscope,
    'templateId',introduction.template_id,'themeColor',introduction.theme_color,
    'sunSign',introduction.sun_sign,
    'expiresAt',case when introduction.disclosure_level='complete'
      then introduction.complete_access_expires_at else introduction.expires_at end,
    'responseExpiresAt',introduction.expires_at,
    'completeAccessExpiresAt',introduction.complete_access_expires_at,
    'mutualInterestConfirmedAt',introduction.mutual_interest_confirmed_at,
    'recipientLabel',coalesce(nullif(pg_catalog.btrim(introduction.opposite_name),''),'Customer'),
    'response',introduction.viewer_response,
    'responseComment',introduction.viewer_response_comment,
    'respondedAt',introduction.viewer_responded_at,
    'completeAccessConfirmed',introduction.viewer_complete_access_confirmed,
    'versionNumber',introduction.visible_version_number
  );
end;
$$;

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
  access_started boolean:=false;
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

  if updated_introduction.source_response='accepted'
    and updated_introduction.response='accepted'
    and updated_introduction.source_complete_access_confirmed_at is not null
    and updated_introduction.recipient_complete_access_confirmed_at is not null
    and updated_introduction.mutual_interest_confirmed_at is null
  then
    update app_private.broker_introductions
    set mutual_interest_confirmed_at=pg_catalog.now(),
      complete_access_expires_at=pg_catalog.now()+interval '30 days',
      row_version=row_version+1,updated_at=pg_catalog.now()
    where id=introduction.id returning * into updated_introduction;
    access_started:=true;
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
  if access_started then
    insert into app_private.broker_introduction_events(
      organization_id,introduction_id,event_type,actor_kind,actor_user_id,safe_details
    ) values (introduction.organization_id,introduction.id,'mutual_access_granted','recipient',actor_id,
      pg_catalog.jsonb_build_object('expiresAt',updated_introduction.complete_access_expires_at));
  end if;

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
      'disclosureLevel',case when item.complete_access_expires_at>pg_catalog.now()
        then 'complete' else 'broker_standard' end,
      'completeAccessExpiresAt',item.complete_access_expires_at,
      'expiresAt',case when item.complete_access_expires_at>pg_catalog.now()
        then item.complete_access_expires_at else item.expires_at end,
      'createdAt',item.created_at
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
      and item.revoked_at is null
      and (item.expires_at>pg_catalog.now() or item.complete_access_expires_at>pg_catalog.now())
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
      'recipientEmailHint',item.recipient_email_hint,
      'status',case when item.revoked_at is not null then 'revoked' else item.status end,
      'response',item.response,'responseComment',item.response_comment,
      'respondedAt',item.responded_at,
      'sourceResponse',item.source_response,
      'sourceResponseComment',item.source_response_comment,
      'sourceRespondedAt',item.source_responded_at,
      'recipientResponse',item.response,
      'recipientResponseComment',item.response_comment,
      'recipientRespondedAt',item.responded_at,
      'mutualInterestConfirmedAt',case when item.revoked_at is null
        then item.mutual_interest_confirmed_at else null end,
      'completeAccessExpiresAt',case when item.revoked_at is null
        then item.complete_access_expires_at else null end,
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

-- A responded row must retain status=responded to satisfy the immutable
-- response-state constraints. Revocation authority is represented by revoked_at
-- and is still returned to the broker as the public transition status.
create or replace function public.revoke_broker_introduction(
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
  select item.* into introduction
  from app_private.broker_introductions item
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients relationship on relationship.id=item.broker_client_id
  where organization.workspace_ref=p_workspace_ref and item.introduction_ref=p_introduction_ref
    and app_private.member_has_brokerdesk_capability(
      actor_id,p_workspace_ref,'introductions.close',relationship.relationship_ref)
  for update of item;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if introduction.revoked_at is not null or introduction.status='revoked' then
    return pg_catalog.jsonb_build_object(
      'available',true,'status','revoked','rowVersion',introduction.row_version);
  end if;
  if introduction.status='expired' or introduction.row_version<>p_expected_version
  then return '{"available":false}'::jsonb; end if;
  update app_private.broker_introductions
  set status=case when status='responded' then 'responded' else 'revoked' end,
    revoked_at=pg_catalog.now(),row_version=row_version+1,updated_at=pg_catalog.now()
  where id=introduction.id returning * into introduction;
  update app_private.broker_introduction_passes
  set revoked_at=coalesce(revoked_at,pg_catalog.now())
  where introduction_id=introduction.id;
  insert into app_private.broker_introduction_events
    (organization_id,introduction_id,event_type,actor_kind,actor_user_id)
  values (introduction.organization_id,introduction.id,'revoked','broker',actor_id);
  return pg_catalog.jsonb_build_object(
    'available',true,'status','revoked','rowVersion',introduction.row_version);
end;
$$;

revoke all on function public.respond_to_broker_introduction(text,text,text,text) from public,anon,authenticated;
drop function public.respond_to_broker_introduction(text,text,text,text);
revoke all on function public.respond_to_broker_introduction(text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.respond_to_broker_introduction(text,text,text,text,boolean) to authenticated;

comment on column app_private.broker_introductions.complete_access_expires_at is
  'Exclusive end of reciprocal Complete Portfolio access; exactly 30 days after confirmed mutual interest.';
comment on table app_private.broker_introduction_events is
  'Minimal Introduction audit history, including the single mutual-access grant created by the second confirmed acceptance.';
comment on function public.respond_to_broker_introduction(text,text,text,text,boolean) is
  'Records one immutable participant response and atomically starts 30-day reciprocal pinned Complete access after the second confirmed acceptance.';
