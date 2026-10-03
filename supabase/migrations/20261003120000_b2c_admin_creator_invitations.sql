-- Single-use, exact-verified-email B2C creator invitations.
create table app_private.b2c_creator_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^[a-f0-9]{64}$'),
  email text not null check (pg_catalog.length(email) between 3 and 180),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check ((accepted_at is null) = (accepted_by is null))
);
create unique index b2c_creator_invites_one_pending_email
  on app_private.b2c_creator_invites(email_hash)
  where accepted_at is null and revoked_at is null;
create index b2c_creator_invites_recent on app_private.b2c_creator_invites(invited_at desc);
alter table app_private.b2c_creator_invites enable row level security;
revoke all on table app_private.b2c_creator_invites from public, anon, authenticated;
grant select, insert, update on table app_private.b2c_creator_invites to service_role;

create function public.admin_manage_b2c_creator_invite(
  p_email text, p_action text, p_token_hash text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  selected_hash text := app_private.normalized_email_hash(p_email);
begin
  perform app_private.require_current_session();
  if not app_private.actor_is_pilot_administrator(actor_id) then
    raise exception 'pilot administrator required' using errcode = '42501';
  end if;
  if p_action not in ('grant', 'revoke')
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or selected_hash is null
    or (p_action = 'grant' and (p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$')) then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  if p_action = 'grant' then
    update app_private.b2c_creator_invites set revoked_at = pg_catalog.now()
      where email_hash = selected_hash and accepted_at is null and revoked_at is null;
    insert into app_private.b2c_creator_invites(email_hash, email, token_hash, invited_by)
      values (selected_hash, normalized_email, p_token_hash, actor_id);
  else
    update app_private.b2c_creator_invites set revoked_at = pg_catalog.now()
      where email_hash = selected_hash and revoked_at is null;
    update app_private.b2c_creator_entitlements set
      revoked_at = pg_catalog.now(), revoked_by = actor_id, updated_at = pg_catalog.now()
      where email_hash = selected_hash and revoked_at is null;
  end if;
  insert into app_private.pilot_access_audit_events(actor_user_id, event_name, outcome, safe_details)
    values (actor_id, 'pilot.creator_invite.' || p_action, 'succeeded',
      pg_catalog.jsonb_build_object('emailHash', selected_hash));
  return pg_catalog.jsonb_build_object('status', case when p_action = 'grant' then 'invited' else 'revoked' end);
end;
$$;

create function public.list_b2c_creator_invites(p_limit integer default 50)
returns table(email text, invited_at timestamptz, expires_at timestamptz,
  accepted_at timestamptz, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not app_private.actor_is_pilot_administrator(auth.uid())
    or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'pilot administrator required' using errcode = '42501';
  end if;
  return query select invite.email, invite.invited_at, invite.expires_at,
      invite.accepted_at, invite.revoked_at
    from app_private.b2c_creator_invites invite
    order by invite.invited_at desc limit p_limit;
end;
$$;

-- Unauthenticated password signup checks its claimed email and opaque token
-- through the server only. This function must never be granted to anon.
create function public.service_b2c_invite_matches(p_email text, p_token_hash text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  return exists (select 1 from app_private.b2c_creator_invites invite
    where invite.email_hash = app_private.normalized_email_hash(p_email)
      and invite.token_hash = p_token_hash and invite.accepted_at is null
      and invite.revoked_at is null and invite.expires_at > pg_catalog.now());
end;
$$;

create function public.accept_b2c_creator_invite(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  account auth.users%rowtype;
  invite app_private.b2c_creator_invites%rowtype;
begin
  perform app_private.require_current_session();
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid invitation' using errcode = '22023';
  end if;
  select * into account from auth.users where id = actor_id;
  if account.id is null or account.email_confirmed_at is null then
    raise exception 'verified email required' using errcode = '42501';
  end if;
  select * into invite from app_private.b2c_creator_invites
    where token_hash = p_token_hash for update;
  if invite.id is null or invite.revoked_at is not null
    or invite.expires_at <= pg_catalog.now()
    or invite.email_hash <> app_private.normalized_email_hash(account.email)
    or (invite.accepted_at is not null and invite.accepted_by <> actor_id) then
    raise exception 'invitation unavailable' using errcode = '42501';
  end if;
  if invite.accepted_at is null then
    update app_private.b2c_creator_invites set accepted_by = actor_id,
      accepted_at = pg_catalog.now() where id = invite.id;
    insert into app_private.b2c_creator_entitlements(email_hash, granted_at, granted_by)
      values (invite.email_hash, pg_catalog.now(), invite.invited_by)
      on conflict (email_hash) do update set
        granted_at = pg_catalog.now(), granted_by = invite.invited_by,
        revoked_at = null, revoked_by = null, updated_at = pg_catalog.now();
    insert into app_private.pilot_access_audit_events(actor_user_id, event_name, outcome, safe_details)
      values (actor_id, 'pilot.creator_invite.accepted', 'succeeded',
        pg_catalog.jsonb_build_object('emailHash', invite.email_hash));
  end if;
  return '{"status":"accepted"}'::jsonb;
end;
$$;

revoke all on function public.admin_manage_b2c_creator_invite(text, text, text) from public, anon;
grant execute on function public.admin_manage_b2c_creator_invite(text, text, text) to authenticated;
revoke all on function public.list_b2c_creator_invites(integer) from public, anon;
grant execute on function public.list_b2c_creator_invites(integer) to authenticated;
revoke all on function public.service_b2c_invite_matches(text, text) from public, anon, authenticated;
grant execute on function public.service_b2c_invite_matches(text, text) to service_role;
revoke all on function public.accept_b2c_creator_invite(text) from public, anon;
grant execute on function public.accept_b2c_creator_invite(text) to authenticated;
