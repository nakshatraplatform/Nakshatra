-- The B2C pilot permits only a candidate to create and publish their own
-- portfolio. Keep legacy representative drafts intact, but do not let their
-- public or approved projections remain accessible through an old token.

create function app_private.pilot_self_portfolio_eligible(p_portfolio_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    join public.candidates candidate on candidate.id = portfolio.candidate_id
    join public.candidate_personal_details details on details.candidate_id = candidate.id
    where portfolio.id = p_portfolio_id
      and portfolio.user_id = candidate.primary_owner_user_id
      and candidate.created_by = portfolio.user_id
      and details.profile_for = 'self'
      and portfolio.draft_data #>> '{personal,profile_for}' = 'self'
  )
$$;

create function app_private.pilot_public_portfolio_allowed(p_share_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    where portfolio.share_token = p_share_token
      and portfolio.is_published = true
      and portfolio.published_data #>> '{personal,profile_for}' = 'self'
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
      and exists (select 1 from app_private.current_identity_verification(portfolio.candidate_id))
  )
$$;

revoke all on function app_private.pilot_self_portfolio_eligible(uuid) from public, anon, authenticated;
revoke all on function app_private.pilot_public_portfolio_allowed(text) from public, anon, authenticated;

-- Existing approved-snapshot and original-media RLS policies use this shared
-- predicate. Keep their active-snapshot checks, but close old grants when a
-- representative portfolio or its verification is no longer pilot-eligible.
create or replace function public.is_published_portfolio(p_portfolio_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    join public.public_portfolio_snapshots snapshot on snapshot.portfolio_id = portfolio.id
    where portfolio.id = p_portfolio_id
      and portfolio.is_published = true
      and portfolio.share_token is not null
      and portfolio.share_token = snapshot.share_token
      and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
      and snapshot.is_active = true
      and (snapshot.expires_at is null or snapshot.expires_at > pg_catalog.now())
      and app_private.pilot_public_portfolio_allowed(portfolio.share_token)
  )
$$;

-- Anonymous Storage reads do not pass through resolve_public_portfolio. This
-- is the predicate used by both public-photo and protected-preview policies.
-- Preserve the current media selection rules while applying the same pilot
-- publication gate to every candidate object path.
create or replace function public.is_public_portfolio_media_path(
  p_bucket_id text, p_object_name text
)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket_id = 'photos' and exists (
    select 1
    from public.portfolio_media media
    join public.public_portfolio_snapshots snapshot on snapshot.portfolio_id = media.portfolio_id
    join public.portfolios portfolio on portfolio.id = media.portfolio_id
    where (
      (
        media.storage_path = p_object_name
        and media.visibility = 'public'
        and media.media_type in ('hero', 'gallery')
        and (
          snapshot.data ->> 'privacy_mode' <> 'private'
          or media.media_type = 'hero'
          or media.id = (
            select first_gallery.id from public.portfolio_media first_gallery
            where first_gallery.portfolio_id = media.portfolio_id
              and first_gallery.media_type = 'gallery'
              and first_gallery.visibility = 'public'
            order by first_gallery.sort_order, first_gallery.created_at, first_gallery.id
            limit 1
          )
        )
      )
      or (
        media.metadata ->> 'blurPath' = p_object_name
        and media.media_type in ('hero', 'gallery')
      )
    )
      and snapshot.is_active = true
      and (snapshot.expires_at is null or snapshot.expires_at > pg_catalog.now())
      and portfolio.share_token = snapshot.share_token
      and portfolio.is_published = true
      and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
      and public.is_published_portfolio(media.portfolio_id)
  )
$$;

-- The public RPC remains the only entry to the large atomic draft writer.
create or replace function public.save_dashboard_draft_transaction(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing_candidate_id uuid;
begin
  perform app_private.require_current_session();
  if not app_private.actor_can_create_portfolio(auth.uid()) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  if p_payload -> 'candidate' is not null and p_payload -> 'candidate' <> 'null'::jsonb then
    if p_payload #>> '{portfolio,draft_data,personal,profile_for}' is distinct from 'self'
      or p_payload #>> '{details,personal,profile_for}' is distinct from 'self' then
      return '{"status":"self_portfolio_required"}'::jsonb;
    end if;
    select portfolio.candidate_id into existing_candidate_id
    from public.portfolios portfolio where portfolio.user_id = auth.uid();
    if existing_candidate_id is not null and not exists (
      select 1 from public.candidate_personal_details details
      where details.candidate_id = existing_candidate_id and details.profile_for = 'self'
    ) then
      return '{"status":"self_portfolio_required"}'::jsonb;
    end if;
  end if;
  return app_private.save_dashboard_draft_transaction(p_payload);
end;
$$;

create or replace function public.publish_portfolio_transaction(
  p_portfolio_id uuid, p_draft_data jsonb, p_public_data jsonb,
  p_approved_data jsonb, p_share_token text, p_expires_at timestamptz,
  p_template_id integer, p_theme_color text, p_sun_sign text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not app_private.actor_can_create_portfolio(auth.uid()) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  if not exists (
    select 1 from public.portfolios portfolio
    where portfolio.id = p_portfolio_id and portfolio.user_id = auth.uid()
  ) then
    return '{"status":"not_found"}'::jsonb;
  end if;
  if p_draft_data #>> '{personal,profile_for}' is distinct from 'self'
    or not app_private.pilot_self_portfolio_eligible(p_portfolio_id) then
    return '{"status":"self_portfolio_required"}'::jsonb;
  end if;
  return app_private.publish_portfolio_transaction(
    p_portfolio_id, p_draft_data, p_public_data, p_approved_data,
    p_share_token, p_expires_at, p_template_id, p_theme_color, p_sun_sign
  );
end;
$$;

-- The existing publication trigger also protects direct table updates.
create function app_private.enforce_pilot_self_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_published = true and (
    new.draft_data #>> '{personal,profile_for}' is distinct from 'self'
    or new.published_data #>> '{personal,profile_for}' is distinct from 'self'
    or not exists (
      select 1 from public.candidates candidate
      join public.candidate_personal_details details on details.candidate_id = candidate.id
      where candidate.id = new.candidate_id
        and candidate.primary_owner_user_id = new.user_id
        and candidate.created_by = new.user_id
        and details.profile_for = 'self'
    )
  ) then
    raise exception 'publication_self_portfolio_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Check the pilot ownership rule before the older publication gates so a
-- representative payload always fails with the self-only policy violation.
create trigger a_enforce_pilot_self_publication
  before insert or update of is_published, published_data on public.portfolios
  for each row execute function app_private.enforce_pilot_self_publication();
revoke all on function app_private.enforce_pilot_self_publication() from public, anon, authenticated;

-- Move the existing public projection behind a new fail-closed wrapper. The
-- moved function keeps its original implementation and is no longer callable
-- by anonymous or authenticated clients directly.
alter function public.resolve_public_portfolio(text) set schema app_private;
revoke all on function app_private.resolve_public_portfolio(text) from public, anon, authenticated;
create function public.resolve_public_portfolio(p_share_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when app_private.pilot_public_portfolio_allowed(p_share_token)
    then app_private.resolve_public_portfolio(p_share_token) else null end
$$;
revoke all on function public.resolve_public_portfolio(text) from public, anon, authenticated;
grant execute on function public.resolve_public_portfolio(text) to anon, authenticated;

alter function public.record_public_portfolio_view(text) set schema app_private;
revoke all on function app_private.record_public_portfolio_view(text) from public, anon, authenticated;
create function public.record_public_portfolio_view(p_share_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.pilot_public_portfolio_allowed(p_share_token) then return false; end if;
  return app_private.record_public_portfolio_view(p_share_token);
end;
$$;
revoke all on function public.record_public_portfolio_view(text) from public, anon, authenticated;
grant execute on function public.record_public_portfolio_view(text) to anon, authenticated;

create or replace function public.submit_public_interest(
  p_share_token text, p_name text, p_profile_for text, p_phone text, p_email text,
  p_location text default null, p_family_context text default null,
  p_message text default null, p_portfolio_url text default null,
  p_country text default null, p_state text default null, p_city text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not app_private.pilot_public_portfolio_allowed(p_share_token) then return false; end if;
  return app_private.submit_public_interest(
    p_share_token, p_name, p_profile_for, p_phone, p_email, p_location,
    p_family_context, p_message, p_portfolio_url, p_country, p_state, p_city
  );
end;
$$;

-- A stale accountless invitation must not start or retry a verification.
revoke execute on function public.create_identity_verification_invitation(uuid, text) from authenticated;
alter function public.begin_candidate_photo_verification(uuid, text, text) set schema app_private;
revoke all on function app_private.begin_candidate_photo_verification(uuid, text, text) from public, anon, authenticated;
create function public.begin_candidate_photo_verification(
  p_candidate_id uuid, p_invitation_token_hash text, p_management_token_hash text
)
returns table(attempt_id uuid, provider_subject_ref uuid, portfolio_id uuid,
  reference_media_id uuid, reference_storage_path text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if p_candidate_id is null or p_invitation_token_hash is not null
    or not exists (
      select 1 from public.portfolios portfolio
      where portfolio.candidate_id = p_candidate_id
        and portfolio.user_id = auth.uid()
        and app_private.pilot_self_portfolio_eligible(portfolio.id)
    ) then
    raise exception 'pilot self verification only' using errcode = '42501';
  end if;
  return query select * from app_private.begin_candidate_photo_verification(
    p_candidate_id, null::text, p_management_token_hash
  );
end;
$$;
revoke all on function public.begin_candidate_photo_verification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.begin_candidate_photo_verification(uuid, text, text) to authenticated;

alter function public.retry_candidate_photo_verification(text, text) set schema app_private;
revoke all on function app_private.retry_candidate_photo_verification(text, text) from public, anon, authenticated;
create function public.retry_candidate_photo_verification(p_token_hash text, p_management_token_hash text)
returns table(attempt_id uuid, provider_subject_ref uuid, portfolio_id uuid,
  reference_media_id uuid, reference_storage_path text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not exists (
    select 1 from app_private.identity_verification_management_tokens management
    join public.portfolios portfolio on portfolio.candidate_id = management.candidate_id
    where management.token_hash = p_token_hash and portfolio.user_id = auth.uid()
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
  ) then
    raise exception 'pilot self verification only' using errcode = '42501';
  end if;
  return query select * from app_private.retry_candidate_photo_verification(
    p_token_hash, p_management_token_hash
  );
end;
$$;
revoke all on function public.retry_candidate_photo_verification(text, text) from public, anon, authenticated;
grant execute on function public.retry_candidate_photo_verification(text, text) to authenticated;

-- Legacy lifecycle RPCs must not mint a replacement URL while the pilot gate
-- has paused public access. Unpublish remains available as a safety action.
create or replace function public.rotate_portfolio_transaction(p_share_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not exists (
    select 1 from public.portfolios portfolio
    where portfolio.user_id = auth.uid()
      and app_private.pilot_public_portfolio_allowed(portfolio.share_token)
  ) then return '{"status":"not_published"}'::jsonb; end if;
  return app_private.rotate_portfolio_transaction(p_share_token);
end;
$$;

create or replace function public.renew_portfolio_transaction(p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not exists (
    select 1 from public.portfolios portfolio
    where portfolio.user_id = auth.uid()
      and app_private.pilot_public_portfolio_allowed(portfolio.share_token)
  ) then return '{"status":"not_published"}'::jsonb; end if;
  return app_private.renew_portfolio_transaction(p_expires_at);
end;
$$;

create or replace function public.resolve_approved_portfolio(p_share_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not app_private.pilot_public_portfolio_allowed(p_share_token) then return null; end if;
  return app_private.resolve_approved_portfolio(p_share_token);
end;
$$;

create or replace function public.resolve_approved_horoscope(p_share_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not app_private.pilot_public_portfolio_allowed(p_share_token) then return null; end if;
  return app_private.resolve_approved_horoscope(p_share_token);
end;
$$;

create or replace function public.resolve_public_portfolio_status(p_share_token text)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_share_token is null or pg_catalog.length(p_share_token) not between 8 and 160
    or p_share_token !~ '^[A-Za-z0-9_-]+$' then 'unavailable'
  when exists (
    select 1 from public.public_portfolio_snapshots snapshot
    join public.portfolios portfolio on portfolio.id = snapshot.portfolio_id
    where snapshot.share_token = p_share_token and portfolio.share_token = p_share_token
      and snapshot.is_active = true and portfolio.is_published = true
      and app_private.pilot_public_portfolio_allowed(p_share_token)
      and (snapshot.expires_at <= pg_catalog.now() or portfolio.expires_at <= pg_catalog.now())
  ) then 'expired' else 'unavailable' end
$$;

comment on function public.resolve_public_portfolio(text) is
  'Returns a public portfolio only while its candidate-owned pilot declaration and current verification remain valid.';
