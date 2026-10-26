-- NAK-201: candidate-owned Family Viewer identity and invitation schema.
--
-- These rows are authorization state, not broker-owned CRM contacts. A broker
-- may provide proposal provenance, but only the candidate can approve a viewer
-- and only the exact invited Google account can activate it.

create or replace function app_private.generate_public_reference(p_prefix text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_prefix is null or p_prefix <> all(
    array[
      'wrk', 'bcr', 'bir', 'bpn', 'pvr', 'inc', 'tsk', 'imp', 'inv', 'mbr',
      'fvw', 'fvi'
    ]::text[]
  ) then
    raise exception 'unsupported public reference type' using errcode = '22023';
  end if;

  return p_prefix || '_' || pg_catalog.encode(extensions.gen_random_bytes(16), 'hex');
end;
$$;

revoke all on function app_private.generate_public_reference(text)
  from public, anon, authenticated;

create function app_private.is_safe_email_hint(p_email_hint text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_email_hint is not null
    and pg_catalog.length(pg_catalog.btrim(p_email_hint)) between 8 and 254
    and pg_catalog.btrim(p_email_hint) = pg_catalog.lower(pg_catalog.btrim(p_email_hint))
    and pg_catalog.btrim(p_email_hint)
      ~ '^[^@*[:space:]][^@*[:space:]]?[*]{3}@[a-z0-9.-]+[.][a-z]{2,63}$';
$$;

revoke all on function app_private.is_safe_email_hint(text)
  from public, anon, authenticated;

create table app_private.candidate_family_viewers (
  id uuid primary key default extensions.gen_random_uuid(),
  viewer_ref text not null unique default app_private.generate_public_reference('fvw'),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  intended_email_hash text not null check (intended_email_hash ~ '^[a-f0-9]{64}$'),
  intended_email_hint text not null check (
    intended_email_hint = 'Removed'
    or app_private.is_safe_email_hint(intended_email_hint)
  ),
  verified_user_id uuid references auth.users(id) on delete restrict,
  display_name text not null check (
    pg_catalog.length(pg_catalog.btrim(display_name)) between 1 and 120
  ),
  relationship_kind text not null check (
    relationship_kind in (
      'father', 'mother', 'parent', 'sibling', 'guardian', 'relative', 'other'
    )
  ),
  relationship_label text check (
    relationship_label is null
    or pg_catalog.length(pg_catalog.btrim(relationship_label)) between 1 and 40
  ),
  preferred_locale text check (
    preferred_locale is null
    or (
      pg_catalog.length(preferred_locale) between 2 and 35
      and preferred_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    )
  ),
  role text not null default 'viewer' check (role in ('viewer', 'primary')),
  status text not null check (
    status in (
      'pending_candidate_approval', 'pending_verification', 'active',
      'rejected', 'revoked'
    )
  ),
  proposed_by_organization_id uuid references public.organizations(id) on delete restrict,
  proposed_by_user_id uuid references auth.users(id) on delete set null,
  candidate_approved_by uuid references auth.users(id) on delete set null,
  candidate_approved_at timestamptz,
  verified_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (viewer_ref ~ '^fvw_[0-9a-f]{32}$'),
  check (
    (relationship_kind = 'other' and relationship_label is not null)
    or (relationship_kind <> 'other' and relationship_label is null)
  ),
  check (proposed_by_organization_id is not null or proposed_by_user_id is null),
  check (
    (status = 'pending_candidate_approval'
      and candidate_approved_by is null
      and candidate_approved_at is null
      and verified_user_id is null
      and verified_at is null
      and revoked_at is null)
    or (status = 'pending_verification'
      and candidate_approved_by is not null
      and candidate_approved_at is not null
      and verified_user_id is null
      and verified_at is null
      and revoked_at is null)
    or (status = 'active'
      and candidate_approved_by is not null
      and candidate_approved_at is not null
      and verified_user_id is not null
      and verified_at is not null
      and revoked_at is null)
    or (status = 'rejected'
      and candidate_approved_by is null
      and candidate_approved_at is null
      and verified_user_id is null
      and verified_at is null
      and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  check (role = 'viewer' or status = 'active')
);

create table app_private.candidate_family_viewer_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  invitation_ref text not null unique default app_private.generate_public_reference('fvi'),
  family_viewer_id uuid not null
    references app_private.candidate_family_viewers(id) on delete cascade,
  token_hash text unique check (token_hash is null or token_hash ~ '^[a-f0-9]{64}$'),
  intended_email_hash text not null check (intended_email_hash ~ '^[a-f0-9]{64}$'),
  intended_email_hint text not null check (
    intended_email_hint = 'Removed'
    or app_private.is_safe_email_hint(intended_email_hint)
  ),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (invitation_ref ~ '^fvi_[0-9a-f]{32}$'),
  check (expires_at > created_at),
  check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and token_hash is null)
  ),
  check (accepted_at is null or revoked_at is null),
  check (revoked_at is null or token_hash is null)
);

alter table app_private.candidate_family_viewers enable row level security;
alter table app_private.candidate_family_viewer_invitations enable row level security;

revoke all on table app_private.candidate_family_viewers
  from public, anon, authenticated;
revoke all on table app_private.candidate_family_viewer_invitations
  from public, anon, authenticated;
grant select, insert, update, delete on table app_private.candidate_family_viewers
  to service_role;
grant select, insert, update, delete on table app_private.candidate_family_viewer_invitations
  to service_role;

create unique index candidate_family_viewers_one_primary_idx
  on app_private.candidate_family_viewers (candidate_id)
  where status = 'active' and role = 'primary' and revoked_at is null;

create unique index candidate_family_viewers_live_email_idx
  on app_private.candidate_family_viewers (candidate_id, intended_email_hash)
  where status in (
    'pending_candidate_approval', 'pending_verification', 'active'
  ) and revoked_at is null;

create unique index candidate_family_viewers_active_identity_idx
  on app_private.candidate_family_viewers (candidate_id, verified_user_id)
  where status = 'active' and verified_user_id is not null and revoked_at is null;

create index candidate_family_viewers_identity_candidates_idx
  on app_private.candidate_family_viewers (
    verified_user_id, candidate_id, created_at, id
  )
  where status = 'active' and revoked_at is null;

create index candidate_family_viewers_candidate_roster_idx
  on app_private.candidate_family_viewers (
    candidate_id, status, created_at, id
  );

create index candidate_family_viewers_broker_proposal_idx
  on app_private.candidate_family_viewers (
    proposed_by_organization_id, candidate_id, status, created_at desc
  )
  where proposed_by_organization_id is not null;

create unique index candidate_family_viewer_invitations_live_viewer_idx
  on app_private.candidate_family_viewer_invitations (family_viewer_id)
  where token_hash is not null and accepted_at is null and revoked_at is null;

create index candidate_family_viewer_invitations_expiry_idx
  on app_private.candidate_family_viewer_invitations (expires_at, id)
  where token_hash is not null and accepted_at is null and revoked_at is null;

create index if not exists broker_clients_candidate_organization_idx
  on public.broker_clients (candidate_id, organization_id, id);

create function app_private.prevent_family_viewer_reference_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'candidate_family_viewers'
    and new.viewer_ref is distinct from old.viewer_ref
  then
    raise exception 'family viewer reference is immutable' using errcode = '22023';
  elsif tg_table_name = 'candidate_family_viewer_invitations'
    and new.invitation_ref is distinct from old.invitation_ref
  then
    raise exception 'family invitation reference is immutable' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function app_private.prevent_family_viewer_reference_change()
  from public, anon, authenticated;

create trigger prevent_candidate_family_viewer_reference_change
  before update of viewer_ref on app_private.candidate_family_viewers
  for each row execute function app_private.prevent_family_viewer_reference_change();

create trigger prevent_candidate_family_invitation_reference_change
  before update of invitation_ref on app_private.candidate_family_viewer_invitations
  for each row execute function app_private.prevent_family_viewer_reference_change();

create function app_private.candidate_has_active_v3_relationship(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.broker_clients relationship
    join public.organizations organization
      on organization.id = relationship.organization_id
    join app_private.broker_client_mandates mandate
      on mandate.organization_id = relationship.organization_id
     and mandate.broker_client_id = relationship.id
     and mandate.consent_version = 'broker-representation-v3'
     and mandate.starts_at <= pg_catalog.now()
     and mandate.ends_at > pg_catalog.now()
     and mandate.revoked_at is null
    where relationship.candidate_id = p_candidate_id
      and relationship.relationship_status = 'active'
      and relationship.starts_at <= pg_catalog.now()
      and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now())
      and organization.type = 'matchmaker_agency'
      and organization.status = 'active'
      and app_private.brokerdesk_entitlement_enabled(organization.id)
  );
$$;

create function app_private.current_owned_family_candidate(p_actor_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_count integer;
  selected_candidate_id uuid;
begin
  select pg_catalog.count(*)::integer,
         (pg_catalog.array_agg(candidate.id order by candidate.id))[1]
  into candidate_count, selected_candidate_id
  from public.candidates candidate
  where candidate.primary_owner_user_id = p_actor_user_id
    and app_private.candidate_has_active_v3_relationship(candidate.id);

  if candidate_count <> 1 then
    return null;
  end if;
  return selected_candidate_id;
end;
$$;

create function app_private.user_has_google_identity(
  p_actor_user_id uuid,
  p_expected_email_hash text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.identities identity_record
    where identity_record.user_id = p_actor_user_id
      and identity_record.provider = 'google'
      and identity_record.identity_data ->> 'email_verified' = 'true'
      and app_private.normalized_email_hash(
        identity_record.identity_data ->> 'email'
      ) = p_expected_email_hash
  );
$$;

create function app_private.issue_family_viewer_invitation(
  p_family_viewer_id uuid,
  p_email_hash text,
  p_email_hint text,
  p_invited_by uuid,
  p_token_hash text
)
returns app_private.candidate_family_viewer_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership app_private.candidate_family_viewers%rowtype;
  invitation app_private.candidate_family_viewer_invitations%rowtype;
begin
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$'
    or not app_private.is_safe_email_hint(p_email_hint)
    or p_invited_by is null
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception 'family viewer invitation unavailable' using errcode = '22023';
  end if;

  select viewer.* into membership
  from app_private.candidate_family_viewers viewer
  where viewer.id = p_family_viewer_id
  for update;

  if membership.id is null
    or membership.status <> 'pending_verification'
    or membership.candidate_approved_by is null
    or membership.intended_email_hash <> p_email_hash
    or membership.intended_email_hint <> p_email_hint
  then
    raise exception 'family viewer invitation unavailable' using errcode = '22023';
  end if;

  update app_private.candidate_family_viewer_invitations
  set revoked_at = pg_catalog.now(), token_hash = null,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed',
      invited_by = null, accepted_by = null
  where family_viewer_id = p_family_viewer_id
    and accepted_at is null
    and revoked_at is null;

  insert into app_private.candidate_family_viewer_invitations (
    family_viewer_id, token_hash, intended_email_hash, intended_email_hint,
    invited_by, expires_at
  ) values (
    p_family_viewer_id, p_token_hash, p_email_hash, p_email_hint,
    p_invited_by, pg_catalog.now() + interval '7 days'
  ) returning * into invitation;

  return invitation;
end;
$$;

revoke all on function app_private.candidate_has_active_v3_relationship(uuid)
  from public, anon, authenticated;
revoke all on function app_private.current_owned_family_candidate(uuid)
  from public, anon, authenticated;
revoke all on function app_private.user_has_google_identity(uuid, text)
  from public, anon, authenticated;
revoke all on function app_private.issue_family_viewer_invitation(
  uuid, text, text, uuid, text
) from public, anon, authenticated;

comment on table app_private.candidate_family_viewers is
  'Candidate-owned Family Viewer authorization lifecycle. Broker provenance never grants access.';
comment on table app_private.candidate_family_viewer_invitations is
  'One-time exact-email Google activation invitations. Raw tokens are never stored.';
