-- Broker-mediated introduction lifecycle (phases 4-8).
-- Trust boundary: an organization can introduce only a customer for whom it
-- holds an active mandate. The recipient is an introduction-local label and
-- optional email hash; no target broker, organization, candidate or customer
-- relationship is looked up or disclosed.

create table app_private.portfolio_disclosure_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  version_ref text not null unique default app_private.generate_public_reference('pvr'),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  version_number bigint not null,
  public_data jsonb not null,
  complete_data jsonb not null,
  public_media jsonb not null default '[]'::jsonb,
  complete_media jsonb not null default '[]'::jsonb,
  horoscope jsonb,
  template_id integer not null,
  theme_color text,
  sun_sign text,
  published_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (portfolio_id, version_number),
  unique (portfolio_id, published_at),
  check (version_ref ~ '^pvr_[0-9a-f]{32}$'),
  check (version_number > 0),
  check (pg_catalog.jsonb_typeof(public_data) = 'object'),
  check (pg_catalog.jsonb_typeof(complete_data) = 'object'),
  check (pg_catalog.jsonb_typeof(public_media) = 'array'),
  check (pg_catalog.jsonb_typeof(complete_media) = 'array')
);

create table app_private.broker_portfolio_update_notices (
  id uuid primary key default extensions.gen_random_uuid(),
  notice_ref text not null unique default app_private.generate_public_reference('bpn'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  broker_client_id uuid not null,
  version_id uuid not null references app_private.portfolio_disclosure_versions(id) on delete cascade,
  status text not null default 'unread' check (status in ('unread','acknowledged','clarification')),
  flagged_by uuid references auth.users(id) on delete set null,
  flagged_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (organization_id, broker_client_id)
    references public.broker_clients(organization_id, id) on delete cascade,
  unique (organization_id, broker_client_id, version_id),
  check (notice_ref ~ '^bpn_[0-9a-f]{32}$'),
  check ((status = 'clarification' and flagged_at is not null)
    or (status <> 'clarification' and flagged_at is null))
);

create table app_private.broker_introductions (
  id uuid primary key default extensions.gen_random_uuid(),
  introduction_ref text not null unique default app_private.generate_public_reference('bir'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  broker_client_id uuid not null,
  portfolio_version_id uuid not null references app_private.portfolio_disclosure_versions(id) on delete restrict,
  detailed_snapshot jsonb not null,
  recipient_label text not null,
  recipient_email_hash text,
  recipient_email_hint text,
  status text not null default 'created' check (status in ('created','shared','responded','revoked','expired')),
  response text check (response in ('accepted','declined')),
  response_comment text,
  responded_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  shared_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  row_version bigint not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (organization_id, broker_client_id)
    references public.broker_clients(organization_id, id) on delete restrict,
  check (introduction_ref ~ '^bir_[0-9a-f]{32}$'),
  check (pg_catalog.jsonb_typeof(detailed_snapshot) = 'object'),
  check (not app_private.public_snapshot_has_forbidden_key(detailed_snapshot)),
  check (not (detailed_snapshot ? 'contact')),
  check (pg_catalog.length(pg_catalog.btrim(recipient_label)) between 1 and 120),
  check (recipient_email_hash is null or recipient_email_hash ~ '^[a-f0-9]{64}$'),
  check ((recipient_email_hash is null) = (recipient_email_hint is null)),
  check (recipient_email_hint is null or pg_catalog.length(recipient_email_hint) between 5 and 254),
  check (expires_at > created_at and expires_at <= created_at + interval '31 days'),
  check (row_version > 0),
  check ((response is null and responded_at is null)
    or (response is not null and responded_at is not null and status = 'responded'))
);

create table app_private.broker_introduction_passes (
  id uuid primary key default extensions.gen_random_uuid(),
  introduction_id uuid not null unique references app_private.broker_introductions(id) on delete cascade,
  claim_token_hash text unique,
  session_token_hash text unique,
  claimed_at timestamptz,
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (claim_token_hash is null or claim_token_hash ~ '^[a-f0-9]{64}$'),
  check (session_token_hash is null or session_token_hash ~ '^[a-f0-9]{64}$'),
  check ((claimed_at is null and session_token_hash is null)
    or (claimed_at is not null and session_token_hash is not null)),
  check (expires_at > created_at)
);

create table app_private.broker_introduction_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  introduction_id uuid not null references app_private.broker_introductions(id) on delete cascade,
  event_type text not null check (event_type in (
    'created','shared','claimed','response_submitted','revoked','expired'
  )),
  actor_kind text not null check (actor_kind in ('broker','recipient','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  safe_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  check (pg_catalog.jsonb_typeof(safe_details) = 'object')
);

alter table app_private.portfolio_disclosure_versions enable row level security;
alter table app_private.broker_portfolio_update_notices enable row level security;
alter table app_private.broker_introductions enable row level security;
alter table app_private.broker_introduction_passes enable row level security;
alter table app_private.broker_introduction_events enable row level security;
revoke all on table app_private.portfolio_disclosure_versions from public, anon, authenticated;
revoke all on table app_private.broker_portfolio_update_notices from public, anon, authenticated;
revoke all on table app_private.broker_introductions from public, anon, authenticated;
revoke all on table app_private.broker_introduction_passes from public, anon, authenticated;
revoke all on table app_private.broker_introduction_events from public, anon, authenticated;

create index broker_introductions_relationship_idx
  on app_private.broker_introductions (organization_id, broker_client_id, created_at desc);
create index broker_introductions_expiry_idx
  on app_private.broker_introductions (expires_at)
  where status in ('created','shared');
create index broker_introduction_events_timeline_idx
  on app_private.broker_introduction_events (introduction_id, created_at, id);
create index broker_portfolio_notices_relationship_idx
  on app_private.broker_portfolio_update_notices (organization_id, broker_client_id, created_at desc);

create or replace function app_private.capture_portfolio_disclosure_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  portfolio_record public.portfolios%rowtype;
  public_record public.public_portfolio_snapshots%rowtype;
  created_version app_private.portfolio_disclosure_versions%rowtype;
  next_version bigint;
  public_media_manifest jsonb;
  complete_media_manifest jsonb;
  horoscope_manifest jsonb;
begin
  select * into portfolio_record from public.portfolios where id = new.portfolio_id;
  select * into public_record from public.public_portfolio_snapshots
  where portfolio_id = new.portfolio_id and is_active = true;
  if portfolio_record.candidate_id is null or public_record.portfolio_id is null then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'portfolio-version:' || new.portfolio_id::text, 0
  ));
  if exists (
    select 1 from app_private.portfolio_disclosure_versions version_record
    where version_record.portfolio_id = new.portfolio_id
      and version_record.published_at = new.published_at
  ) then return new; end if;

  select coalesce(pg_catalog.max(version_number), 0) + 1 into next_version
  from app_private.portfolio_disclosure_versions where portfolio_id = new.portfolio_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'key', media.id::text,
    'accessPath', case when media.visibility = 'blurred'
      then coalesce(media.metadata ->> 'blurPath', media.thumbnail_path, media.storage_path)
      else media.storage_path end,
    'altText', media.alt_text,
    'mediaType', media.media_type::text,
    'sortOrder', media.sort_order,
    'width', media.metadata -> 'width',
    'height', media.metadata -> 'height',
    'aspectRatio', media.metadata -> 'aspectRatio',
    'orientation', media.metadata -> 'orientation',
    'presentation', case when media.visibility = 'blurred' then 'blurred' else 'clear' end
  )) order by media.sort_order, media.id), '[]'::jsonb)
  into public_media_manifest
  from public.portfolio_media media
  where media.portfolio_id = new.portfolio_id
    and media.media_type in ('hero','gallery')
    and media.visibility in ('public','blurred');

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'key', media.id::text,
    'accessPath', media.storage_path,
    'altText', media.alt_text,
    'mediaType', media.media_type::text,
    'sortOrder', media.sort_order,
    'width', media.metadata -> 'width',
    'height', media.metadata -> 'height',
    'aspectRatio', media.metadata -> 'aspectRatio',
    'orientation', media.metadata -> 'orientation',
    'presentation', 'clear'
  )) order by media.sort_order, media.id), '[]'::jsonb)
  into complete_media_manifest
  from public.portfolio_media media
  where media.portfolio_id = new.portfolio_id
    and media.media_type in ('hero','gallery')
    and media.visibility in ('public','blurred','interest_required','approved_only');

  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'accessPath', horoscope.storage_path,
    'fileExtension', horoscope.file_extension,
    'languageLabel', horoscope.language_label,
    'pageCount', horoscope.page_count
  )) into horoscope_manifest
  from public.portfolio_horoscopes horoscope
  where horoscope.portfolio_id = new.portfolio_id and horoscope.published_at is not null;

  insert into app_private.portfolio_disclosure_versions (
    portfolio_id, candidate_id, version_number, public_data, complete_data,
    public_media, complete_media, horoscope, template_id, theme_color,
    sun_sign, published_at
  ) values (
    new.portfolio_id, portfolio_record.candidate_id, next_version,
    public_record.data, new.data, public_media_manifest, complete_media_manifest,
    horoscope_manifest, new.template_id, new.theme_color, new.sun_sign, new.published_at
  ) returning * into created_version;

  insert into app_private.broker_portfolio_update_notices (
    organization_id, broker_client_id, version_id
  )
  select relationship.organization_id, relationship.id, created_version.id
  from public.broker_clients relationship
  where relationship.candidate_id = portfolio_record.candidate_id
    and relationship.relationship_status = 'active'
    and relationship.starts_at <= pg_catalog.now()
    and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now())
    and exists (
      select 1 from app_private.broker_client_mandates mandate
      where mandate.organization_id = relationship.organization_id
        and mandate.broker_client_id = relationship.id
        and mandate.revoked_at is null
        and mandate.starts_at <= pg_catalog.now()
        and mandate.ends_at > pg_catalog.now()
        and 'portfolio.review' = any(mandate.permitted_capabilities)
    )
  on conflict (organization_id, broker_client_id, version_id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.capture_portfolio_disclosure_version() from public, anon, authenticated;
drop trigger if exists capture_portfolio_disclosure_version on public.approved_portfolio_snapshots;
create constraint trigger capture_portfolio_disclosure_version
  after insert or update on public.approved_portfolio_snapshots
  deferrable initially deferred
  for each row execute function app_private.capture_portfolio_disclosure_version();

-- Backfill one immutable baseline for portfolios published before this migration.
insert into app_private.portfolio_disclosure_versions (
  portfolio_id, candidate_id, version_number, public_data, complete_data,
  public_media, complete_media, horoscope, template_id, theme_color, sun_sign, published_at
)
select approved.portfolio_id, portfolio.candidate_id, 1, public_snapshot.data, approved.data,
  coalesce(media.public_media, '[]'::jsonb), coalesce(media.complete_media, '[]'::jsonb),
  horoscope.manifest, approved.template_id, approved.theme_color,
  approved.sun_sign, approved.published_at
from public.approved_portfolio_snapshots approved
join public.public_portfolio_snapshots public_snapshot on public_snapshot.portfolio_id = approved.portfolio_id
join public.portfolios portfolio on portfolio.id = approved.portfolio_id
left join lateral (
  select
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'key', item.id::text,
      'accessPath', case when item.visibility = 'blurred'
        then coalesce(item.metadata ->> 'blurPath', item.thumbnail_path, item.storage_path)
        else item.storage_path end,
      'altText', item.alt_text, 'mediaType', item.media_type::text,
      'sortOrder', item.sort_order, 'width', item.metadata -> 'width',
      'height', item.metadata -> 'height', 'aspectRatio', item.metadata -> 'aspectRatio',
      'orientation', item.metadata -> 'orientation',
      'presentation', case when item.visibility = 'blurred' then 'blurred' else 'clear' end
    )) order by item.sort_order, item.id) filter (where item.visibility in ('public','blurred')), '[]'::jsonb) public_media,
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'key', item.id::text, 'accessPath', item.storage_path,
      'altText', item.alt_text, 'mediaType', item.media_type::text,
      'sortOrder', item.sort_order, 'width', item.metadata -> 'width',
      'height', item.metadata -> 'height', 'aspectRatio', item.metadata -> 'aspectRatio',
      'orientation', item.metadata -> 'orientation', 'presentation', 'clear'
    )) order by item.sort_order, item.id), '[]'::jsonb) complete_media
  from public.portfolio_media item
  where item.portfolio_id = approved.portfolio_id and item.media_type in ('hero','gallery')
    and item.visibility in ('public','blurred','interest_required','approved_only')
) media on true
left join lateral (
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'accessPath', item.storage_path, 'fileExtension', item.file_extension,
    'languageLabel', item.language_label, 'pageCount', item.page_count
  )) manifest
  from public.portfolio_horoscopes item
  where item.portfolio_id = approved.portfolio_id and item.published_at is not null
) horoscope on true
where portfolio.candidate_id is not null
on conflict (portfolio_id, published_at) do nothing;

create or replace function app_private.expire_broker_introductions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare expired_record record;
begin
  for expired_record in
    update app_private.broker_introductions
    set status = 'expired', row_version = row_version + 1, updated_at = pg_catalog.now()
    where status in ('created','shared') and expires_at <= pg_catalog.now()
    returning id, organization_id
  loop
    update app_private.broker_introduction_passes
    set revoked_at = coalesce(revoked_at, pg_catalog.now())
    where introduction_id = expired_record.id;
    insert into app_private.broker_introduction_events
      (organization_id, introduction_id, event_type, actor_kind)
    values (expired_record.organization_id, expired_record.id, 'expired', 'system');
  end loop;
end;
$$;
revoke all on function app_private.expire_broker_introductions() from public, anon, authenticated;

create or replace function public.prepare_broker_introduction(
  p_workspace_ref text,
  p_relationship_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); version_record record;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_workspace_ref !~ '^wrk_[0-9a-f]{32}$'
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'introductions.create', p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref, p_relationship_ref, 'introductions.create')
  then return '{"available":false}'::jsonb; end if;

  select version.version_ref, version.complete_data
  into version_record
  from public.organizations organization
  join public.broker_clients relationship on relationship.organization_id = organization.id
  join public.portfolios portfolio on portfolio.candidate_id = relationship.candidate_id
  join app_private.portfolio_disclosure_versions version on version.portfolio_id = portfolio.id
  where organization.workspace_ref = p_workspace_ref
    and relationship.relationship_ref = p_relationship_ref
    and relationship.relationship_status = 'active'
    and portfolio.is_published = true
    and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
  order by version.version_number desc limit 1;
  if version_record.version_ref is null then return '{"available":false}'::jsonb; end if;
  return pg_catalog.jsonb_build_object(
    'available', true, 'versionRef', version_record.version_ref,
    'completeData', version_record.complete_data
  );
end;
$$;

create or replace function public.create_broker_introduction(
  p_workspace_ref text,
  p_relationship_ref text,
  p_version_ref text,
  p_detailed_snapshot jsonb,
  p_recipient_label text,
  p_recipient_email_hash text,
  p_recipient_email_hint text,
  p_claim_token_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid(); organization_record public.organizations%rowtype;
  relationship_record public.broker_clients%rowtype; version_record record;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  introduction app_private.broker_introductions%rowtype; request_hash text; result jsonb;
begin
  perform app_private.require_current_session();
  if actor_id is null or p_workspace_ref !~ '^wrk_[0-9a-f]{32}$'
    or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_version_ref !~ '^pvr_[0-9a-f]{32}$'
    or p_claim_token_hash !~ '^[a-f0-9]{64}$'
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_recipient_label,''))) not between 1 and 120
    or (p_recipient_email_hash is not null and p_recipient_email_hash !~ '^[a-f0-9]{64}$')
    or ((p_recipient_email_hash is null) <> (p_recipient_email_hint is null))
    or pg_catalog.jsonb_typeof(p_detailed_snapshot) <> 'object'
    or p_detailed_snapshot ? 'contact'
    or app_private.public_snapshot_has_forbidden_key(p_detailed_snapshot)
  then raise exception 'introduction unavailable' using errcode = '22023'; end if;

  select * into organization_record from public.organizations organization
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency' and organization.status = 'active';
  select * into relationship_record from public.broker_clients relationship
  where relationship.organization_id = organization_record.id
    and relationship.relationship_ref = p_relationship_ref;
  if organization_record.id is null or relationship_record.id is null
    or not app_private.brokerdesk_entitlement_enabled(organization_record.id)
    or not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'introductions.create', p_relationship_ref)
    or not app_private.member_has_brokerdesk_capability(actor_id, p_workspace_ref, 'introductions.send', p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref, p_relationship_ref, 'introductions.create')
    or not app_private.relationship_has_active_mandate(p_workspace_ref, p_relationship_ref, 'introductions.send')
  then raise exception 'introduction unavailable' using errcode = '42501'; end if;

  select version.id, version.version_ref, version.version_number,
         version.complete_data #>> '{personal,name}' as source_name
  into version_record
  from app_private.portfolio_disclosure_versions version
  join public.portfolios portfolio on portfolio.id = version.portfolio_id
  where version.version_ref = p_version_ref
    and portfolio.candidate_id = relationship_record.candidate_id
    and portfolio.is_published = true
    and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
    and version.version_number = (
      select pg_catalog.max(latest.version_number)
      from app_private.portfolio_disclosure_versions latest
      where latest.portfolio_id = version.portfolio_id
    );
  if version_record.id is null then
    return '{"status":"version_changed"}'::jsonb;
  end if;

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'workspaceRef',p_workspace_ref,'relationshipRef',p_relationship_ref,
      'versionRef',p_version_ref,'recipientLabel',pg_catalog.btrim(p_recipient_label),
      'recipientEmailHash',p_recipient_email_hash,'claimTokenHash',p_claim_token_hash
    )::text,'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':broker-introduction:' || p_idempotency_key, 0
  ));
  select * into existing from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id and command_name = 'create_broker_introduction'
    and idempotency_key = p_idempotency_key and expires_at > pg_catalog.now();
  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request' using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  if (select pg_catalog.count(*) from app_private.broker_introductions candidate_intro
      where candidate_intro.organization_id = organization_record.id
        and candidate_intro.created_at > pg_catalog.now() - interval '24 hours') >= 100
  then raise exception 'workspace introduction quota exceeded' using errcode = '42501'; end if;

  insert into app_private.broker_introductions (
    organization_id, broker_client_id, portfolio_version_id, detailed_snapshot,
    recipient_label, recipient_email_hash, recipient_email_hint, created_by, expires_at
  ) values (
    organization_record.id, relationship_record.id, version_record.id, p_detailed_snapshot,
    pg_catalog.btrim(p_recipient_label), p_recipient_email_hash, p_recipient_email_hint,
    actor_id, pg_catalog.now() + interval '14 days'
  ) returning * into introduction;
  insert into app_private.broker_introduction_passes (
    introduction_id, claim_token_hash, expires_at
  ) values (introduction.id, p_claim_token_hash, introduction.expires_at);
  insert into app_private.broker_introduction_events (
    organization_id, introduction_id, event_type, actor_kind, actor_user_id,
    safe_details
  ) values (
    organization_record.id, introduction.id, 'created', 'broker', actor_id,
    pg_catalog.jsonb_build_object('versionRef',p_version_ref)
  );
  result := pg_catalog.jsonb_build_object(
    'status','created','introductionRef',introduction.introduction_ref,
    'sourceName',coalesce(nullif(pg_catalog.btrim(version_record.source_name),''),'Customer'),
    'recipientLabel',introduction.recipient_label,'recipientEmailHint',introduction.recipient_email_hint,
    'expiresAt',introduction.expires_at,'versionNumber',version_record.version_number,
    'rowVersion',introduction.row_version
  );
  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash, organization_id, safe_result
  ) values (
    actor_id, 'create_broker_introduction', p_idempotency_key, request_hash,
    organization_record.id, result
  );
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
declare actor_id uuid := auth.uid(); introduction app_private.broker_introductions%rowtype;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  select item.* into introduction
  from app_private.broker_introductions item
  join public.organizations organization on organization.id = item.organization_id
  join public.broker_clients relationship on relationship.id = item.broker_client_id
  where organization.workspace_ref = p_workspace_ref
    and item.introduction_ref = p_introduction_ref
    and app_private.member_has_brokerdesk_capability(actor_id,p_workspace_ref,'introductions.send',relationship.relationship_ref)
    and app_private.relationship_has_active_mandate(p_workspace_ref,relationship.relationship_ref,'introductions.send')
  for update of item;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if introduction.status = 'shared' or introduction.status = 'responded' then
    return pg_catalog.jsonb_build_object('available',true,'status',introduction.status,'rowVersion',introduction.row_version);
  end if;
  if introduction.status <> 'created' or introduction.row_version <> p_expected_version then
    return '{"available":false}'::jsonb;
  end if;
  update app_private.broker_introductions set status='shared', shared_at=pg_catalog.now(),
    row_version=row_version+1, updated_at=pg_catalog.now() where id=introduction.id returning * into introduction;
  insert into app_private.broker_introduction_events
    (organization_id,introduction_id,event_type,actor_kind,actor_user_id)
  values (introduction.organization_id,introduction.id,'shared','broker',actor_id);
  return pg_catalog.jsonb_build_object('available',true,'status','shared','rowVersion',introduction.row_version);
end;
$$;

create or replace function public.revoke_broker_introduction(
  p_workspace_ref text, p_introduction_ref text, p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := auth.uid(); introduction app_private.broker_introductions%rowtype;
begin
  perform app_private.require_current_session();
  select item.* into introduction
  from app_private.broker_introductions item
  join public.organizations organization on organization.id=item.organization_id
  join public.broker_clients relationship on relationship.id=item.broker_client_id
  where organization.workspace_ref=p_workspace_ref and item.introduction_ref=p_introduction_ref
    and app_private.member_has_brokerdesk_capability(actor_id,p_workspace_ref,'introductions.close',relationship.relationship_ref)
  for update of item;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if introduction.status='revoked' then
    return pg_catalog.jsonb_build_object('available',true,'status','revoked','rowVersion',introduction.row_version);
  end if;
  if introduction.status='expired' or introduction.row_version<>p_expected_version then return '{"available":false}'::jsonb; end if;
  update app_private.broker_introductions set status='revoked',revoked_at=pg_catalog.now(),
    row_version=row_version+1,updated_at=pg_catalog.now() where id=introduction.id returning * into introduction;
  update app_private.broker_introduction_passes set revoked_at=coalesce(revoked_at,pg_catalog.now())
    where introduction_id=introduction.id;
  insert into app_private.broker_introduction_events
    (organization_id,introduction_id,event_type,actor_kind,actor_user_id)
  values (introduction.organization_id,introduction.id,'revoked','broker',actor_id);
  return pg_catalog.jsonb_build_object('available',true,'status','revoked','rowVersion',introduction.row_version);
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
declare actor_id uuid := auth.uid(); result jsonb;
begin
  perform app_private.require_current_session();
  perform app_private.expire_broker_introductions();
  if not app_private.member_has_brokerdesk_capability(actor_id,p_workspace_ref,'customers.read',p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref,p_relationship_ref,'customers.read')
  then return '{"available":false}'::jsonb; end if;
  select pg_catalog.jsonb_build_object(
    'available',true,
    'introductions',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'introductionRef',item.introduction_ref,'recipientLabel',item.recipient_label,
      'recipientEmailHint',item.recipient_email_hint,'status',item.status,
      'response',item.response,'responseComment',item.response_comment,
      'respondedAt',item.responded_at,'expiresAt',item.expires_at,
      'versionNumber',version.version_number,'rowVersion',item.row_version,
      'createdAt',item.created_at
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

create or replace function public.claim_broker_introduction_pass(
  p_introduction_ref text, p_claim_token_hash text, p_session_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare introduction app_private.broker_introductions%rowtype; access_pass app_private.broker_introduction_passes%rowtype;
begin
  perform app_private.expire_broker_introductions();
  if p_introduction_ref !~ '^bir_[0-9a-f]{32}$' or p_claim_token_hash !~ '^[a-f0-9]{64}$'
    or p_session_token_hash !~ '^[a-f0-9]{64}$' then return '{"available":false}'::jsonb; end if;
  select * into introduction from app_private.broker_introductions
  where introduction_ref=p_introduction_ref and status in ('shared','responded')
    and revoked_at is null and expires_at>pg_catalog.now();
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  select * into access_pass from app_private.broker_introduction_passes
  where introduction_id=introduction.id for update;
  if access_pass.id is null or access_pass.revoked_at is not null
    or access_pass.expires_at<=pg_catalog.now() then return '{"available":false}'::jsonb; end if;
  if access_pass.claimed_at is not null then
    return case when access_pass.session_token_hash=p_session_token_hash
      then pg_catalog.jsonb_build_object('available',true,'expiresAt',access_pass.expires_at)
      else '{"available":false}'::jsonb end;
  end if;
  if access_pass.claim_token_hash<>p_claim_token_hash then return '{"available":false}'::jsonb; end if;
  update app_private.broker_introduction_passes set claim_token_hash=null,
    session_token_hash=p_session_token_hash,claimed_at=pg_catalog.now(),last_seen_at=pg_catalog.now()
    where id=access_pass.id;
  insert into app_private.broker_introduction_events
    (organization_id,introduction_id,event_type,actor_kind)
  values (introduction.organization_id,introduction.id,'claimed','recipient');
  return pg_catalog.jsonb_build_object('available',true,'expiresAt',access_pass.expires_at);
end;
$$;

create or replace function public.resolve_broker_introduction(
  p_introduction_ref text, p_session_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare introduction record; complete_access boolean := false;
begin
  perform app_private.expire_broker_introductions();
  select item.*, version.complete_data,version.public_media,version.complete_media,
    version.horoscope,version.template_id,version.theme_color,version.sun_sign,
    version.version_number
  into introduction
  from app_private.broker_introductions item
  join app_private.portfolio_disclosure_versions version on version.id=item.portfolio_version_id
  where item.introduction_ref=p_introduction_ref and item.status in ('shared','responded')
    and item.revoked_at is null and item.expires_at>pg_catalog.now();
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if p_session_token_hash is not null and p_session_token_hash ~ '^[a-f0-9]{64}$' then
    select exists(select 1 from app_private.broker_introduction_passes access_pass
      where access_pass.introduction_id=introduction.id
        and access_pass.session_token_hash=p_session_token_hash
        and access_pass.claimed_at is not null and access_pass.revoked_at is null
        and access_pass.expires_at>pg_catalog.now()) into complete_access;
  end if;
  if complete_access then
    update app_private.broker_introduction_passes set last_seen_at=pg_catalog.now()
    where introduction_id=introduction.id;
  end if;
  return pg_catalog.jsonb_build_object(
    'available',true,'introductionRef',introduction.introduction_ref,
    'accessMode',case when complete_access then 'complete' else 'detailed' end,
    'data',case when complete_access then introduction.complete_data else introduction.detailed_snapshot end,
    'media',case when complete_access then introduction.complete_media else introduction.public_media end,
    'horoscope',case when complete_access then introduction.horoscope else null end,
    'templateId',introduction.template_id,'themeColor',introduction.theme_color,
    'sunSign',introduction.sun_sign,'expiresAt',introduction.expires_at,
    'recipientLabel',introduction.recipient_label,'response',introduction.response,
    'responseComment',introduction.response_comment,'respondedAt',introduction.responded_at,
    'versionNumber',introduction.version_number
  );
end;
$$;

create or replace function public.respond_to_broker_introduction(
  p_introduction_ref text, p_session_token_hash text, p_response text, p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare introduction app_private.broker_introductions%rowtype;
begin
  perform app_private.expire_broker_introductions();
  if p_response not in ('accepted','declined')
    or pg_catalog.length(coalesce(p_comment,''))>1000 then return '{"available":false}'::jsonb; end if;
  select item.* into introduction from app_private.broker_introductions item
  where item.introduction_ref=p_introduction_ref and item.status in ('shared','responded')
    and item.revoked_at is null and item.expires_at>pg_catalog.now()
    and exists(select 1 from app_private.broker_introduction_passes access_pass
      where access_pass.introduction_id=item.id and access_pass.session_token_hash=p_session_token_hash
        and access_pass.claimed_at is not null and access_pass.revoked_at is null
        and access_pass.expires_at>pg_catalog.now()) for update;
  if introduction.id is null then return '{"available":false}'::jsonb; end if;
  if introduction.response is not null then
    return case when introduction.response=p_response
      and coalesce(introduction.response_comment,'')=coalesce(nullif(pg_catalog.btrim(p_comment),''),'')
      then pg_catalog.jsonb_build_object('available',true,'status','responded','response',introduction.response)
      else '{"available":false}'::jsonb end;
  end if;
  update app_private.broker_introductions set status='responded',response=p_response,
    response_comment=nullif(pg_catalog.btrim(p_comment),''),responded_at=pg_catalog.now(),
    row_version=row_version+1,updated_at=pg_catalog.now() where id=introduction.id returning * into introduction;
  insert into app_private.broker_introduction_events
    (organization_id,introduction_id,event_type,actor_kind,safe_details)
  values (introduction.organization_id,introduction.id,'response_submitted','recipient',
    pg_catalog.jsonb_build_object('response',p_response));
  return pg_catalog.jsonb_build_object('available',true,'status','responded','response',introduction.response);
end;
$$;

create or replace function public.resolve_broker_portfolio_update_notices(
  p_workspace_ref text, p_relationship_ref text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); result jsonb;
begin
  perform app_private.require_current_session();
  if not app_private.member_has_brokerdesk_capability(actor_id,p_workspace_ref,'portfolio.review',p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref,p_relationship_ref,'portfolio.review')
  then return '{"available":false}'::jsonb; end if;
  select pg_catalog.jsonb_build_object('available',true,'notices',coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('noticeRef',notice.notice_ref,'status',notice.status,
      'versionNumber',version.version_number,'publishedAt',version.published_at,'createdAt',notice.created_at)
    order by notice.created_at desc) filter (where notice.id is not null),'[]'::jsonb)) into result
  from public.organizations organization
  join public.broker_clients relationship on relationship.organization_id=organization.id
    and relationship.relationship_ref=p_relationship_ref
  left join app_private.broker_portfolio_update_notices notice
    on notice.organization_id=organization.id and notice.broker_client_id=relationship.id
  left join app_private.portfolio_disclosure_versions version on version.id=notice.version_id
  where organization.workspace_ref=p_workspace_ref;
  return coalesce(result,'{"available":false}'::jsonb);
end;
$$;

create or replace function public.flag_broker_portfolio_update(
  p_workspace_ref text, p_relationship_ref text, p_notice_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); affected integer;
begin
  perform app_private.require_current_session();
  if not app_private.member_has_brokerdesk_capability(actor_id,p_workspace_ref,'portfolio.review',p_relationship_ref)
    or not app_private.relationship_has_active_mandate(p_workspace_ref,p_relationship_ref,'portfolio.review')
  then return '{"available":false}'::jsonb; end if;
  update app_private.broker_portfolio_update_notices notice set status='clarification',
    flagged_by=actor_id,flagged_at=coalesce(flagged_at,pg_catalog.now()),updated_at=pg_catalog.now()
  from public.organizations organization, public.broker_clients relationship
  where organization.workspace_ref=p_workspace_ref and relationship.organization_id=organization.id
    and relationship.relationship_ref=p_relationship_ref
    and notice.organization_id=organization.id and notice.broker_client_id=relationship.id
    and notice.notice_ref=p_notice_ref and notice.status in ('unread','clarification');
  get diagnostics affected=ROW_COUNT;
  return pg_catalog.jsonb_build_object('available',affected=1,'status',case when affected=1 then 'clarification' else null end);
end;
$$;

create or replace function public.resolve_my_broker_introduction_responses()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor_id uuid:=auth.uid(); result jsonb;
begin
  perform app_private.require_current_session();
  select pg_catalog.jsonb_build_object('available',true,'responses',coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('introductionRef',item.introduction_ref,
      'brokerName',organization.name,'recipientLabel',item.recipient_label,
      'response',item.response,'comment',item.response_comment,'respondedAt',item.responded_at)
    order by item.responded_at desc) filter (where item.id is not null),'[]'::jsonb)) into result
  from public.portfolios portfolio
  join app_private.portfolio_disclosure_versions version on version.portfolio_id=portfolio.id
  join app_private.broker_introductions item on item.portfolio_version_id=version.id and item.response is not null
  join public.organizations organization on organization.id=item.organization_id
  where portfolio.user_id=actor_id;
  return coalesce(result,'{"available":true,"responses":[]}'::jsonb);
end;
$$;

revoke all on function public.prepare_broker_introduction(text,text) from public,anon,authenticated;
revoke all on function public.create_broker_introduction(text,text,text,jsonb,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.mark_broker_introduction_shared(text,text,bigint) from public,anon,authenticated;
revoke all on function public.revoke_broker_introduction(text,text,bigint) from public,anon,authenticated;
revoke all on function public.resolve_broker_introductions(text,text) from public,anon,authenticated;
revoke all on function public.claim_broker_introduction_pass(text,text,text) from public,anon,authenticated;
revoke all on function public.resolve_broker_introduction(text,text) from public,anon,authenticated;
revoke all on function public.respond_to_broker_introduction(text,text,text,text) from public,anon,authenticated;
revoke all on function public.resolve_broker_portfolio_update_notices(text,text) from public,anon,authenticated;
revoke all on function public.flag_broker_portfolio_update(text,text,text) from public,anon,authenticated;
revoke all on function public.resolve_my_broker_introduction_responses() from public,anon,authenticated;
grant execute on function public.prepare_broker_introduction(text,text) to authenticated;
grant execute on function public.create_broker_introduction(text,text,text,jsonb,text,text,text,text,text) to authenticated;
grant execute on function public.mark_broker_introduction_shared(text,text,bigint) to authenticated;
grant execute on function public.revoke_broker_introduction(text,text,bigint) to authenticated;
grant execute on function public.resolve_broker_introductions(text,text) to authenticated;
grant execute on function public.claim_broker_introduction_pass(text,text,text) to anon,authenticated;
grant execute on function public.resolve_broker_introduction(text,text) to anon,authenticated;
grant execute on function public.respond_to_broker_introduction(text,text,text,text) to anon,authenticated;
grant execute on function public.resolve_broker_portfolio_update_notices(text,text) to authenticated;
grant execute on function public.flag_broker_portfolio_update(text,text,text) to authenticated;
grant execute on function public.resolve_my_broker_introduction_responses() to authenticated;

comment on function public.claim_broker_introduction_pass(text,text,text) is
  'Recipient capability endpoint guarded by an expiring single-use claim hash; intentionally does not require an Auth session.';
comment on function public.resolve_broker_introduction(text,text) is
  'Recipient capability endpoint that returns detailed or complete data according to an active hashed pass session.';
comment on function public.respond_to_broker_introduction(text,text,text,text) is
  'Recipient capability endpoint guarded by an active hashed pass session; intentionally does not require an Auth session.';

-- Keep application and database quotas in lockstep for the new endpoints.
create or replace function public.consume_api_rate_limit(p_action text, p_subject_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare action_limit integer; window_seconds integer; effective_subject text;
  limit_record app_private.api_rate_limits%rowtype; v_now timestamptz:=pg_catalog.now();
begin
  select configured.limit_value,configured.window_value into action_limit,window_seconds from (values
    ('auth_google',10,900),('auth_email',5,900),('interest_submit',5,3600),('interest_decision',30,60),
    ('grant_manage',30,60),('dashboard_save',30,300),('photo_upload',12,3600),('photo_mutation',30,300),
    ('horoscope_upload',6,3600),('horoscope_delete',10,300),('portfolio_publish',6,3600),
    ('portfolio_renew',6,3600),('portfolio_rotate',6,3600),('portfolio_unpublish',6,3600),
    ('horoscope_view',30,300),('location_search',120,60),('account_export',3,3600),
    ('account_delete',3,86400),('account_delete_reauth',3,3600),('session_manage',10,3600),
    ('identity_verification_invitation',5,3600),('identity_verification_start',5,3600),
    ('identity_verification_status',30,300),('identity_verification_retry',5,3600),
    ('pilot_access_submit',5,86400),('pilot_access_review',60,300),
    ('brokerdesk_bootstrap',60,60),('brokerdesk_workspace_create',3,3600),
    ('brokerdesk_onboarding_read',60,60),('brokerdesk_onboarding_write',30,300),
    ('brokerdesk_privileged_reauth',5,3600),('brokerdesk_mfa_complete',10,900),
    ('brokerdesk_team_read',60,60),('brokerdesk_team_invite',20,3600),
    ('brokerdesk_team_invitation_exchange',20,3600),('brokerdesk_team_invitation_accept',10,3600),
    ('brokerdesk_customer_read',60,60),('brokerdesk_customer_invite',100,3600),
    ('brokerdesk_customer_invitation_exchange',20,3600),('brokerdesk_customer_invitation_claim',10,3600),
    ('customer_broker_relationships_read',60,60),('brokerdesk_introduction_create',30,3600),
    ('brokerdesk_introduction_read',120,60),('brokerdesk_introduction_update',60,300),
    ('broker_introduction_claim',10,3600),('broker_introduction_read',120,60),
    ('broker_introduction_respond',10,3600)
  ) as configured(action_name,limit_value,window_value) where configured.action_name=p_action;
  if action_limit is null then raise exception 'unsupported rate limit action' using errcode='22023'; end if;
  if auth.uid() is not null then effective_subject:='user:'||auth.uid()::text;
  elsif p_subject_hash is not null and p_subject_hash~'^[a-f0-9]{64}$' then effective_subject:='anonymous:'||p_subject_hash;
  else return '{"allowed":false,"retryAfter":60}'::jsonb; end if;
  insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
  values(p_action,effective_subject,v_now,1,v_now)
  on conflict(action,subject_key) do update set
    window_started_at=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then v_now else app_private.api_rate_limits.window_started_at end,
    request_count=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then 1 else app_private.api_rate_limits.request_count+1 end,
    updated_at=v_now returning * into limit_record;
  return pg_catalog.jsonb_build_object('allowed',limit_record.request_count<=action_limit,'retryAfter',
    case when limit_record.request_count<=action_limit then 0 else greatest(1,pg_catalog.ceil(extract(epoch from(
      limit_record.window_started_at+pg_catalog.make_interval(secs=>window_seconds)-v_now)))::integer) end);
end; $$;
revoke all on function public.consume_api_rate_limit(text,text) from public,anon,authenticated;
grant execute on function public.consume_api_rate_limit(text,text) to anon,authenticated;

comment on table app_private.portfolio_disclosure_versions is
  'Immutable publication snapshots used to prove exactly what a broker recipient could see.';
comment on table app_private.broker_introductions is
  'Broker-mediated introduction pinned to one publication version; contains no target broker or target customer relationship.';
comment on table app_private.broker_introduction_events is
  'Minimal six-event audit history: created, shared, claimed, response_submitted, revoked, expired.';
