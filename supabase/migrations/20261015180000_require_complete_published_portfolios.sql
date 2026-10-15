-- Read-time enforcement for legacy personal links. The owner-only canonical
-- published snapshot is authoritative; private drafts and reduced projections
-- are not. Reuse the same checklist as publication without rewriting data.
create function app_private.published_portfolio_complete(p_portfolio_id uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  published jsonb;
begin
  select portfolio.published_data into published
  from public.portfolios portfolio where portfolio.id = p_portfolio_id;
  if published is null or pg_catalog.jsonb_typeof(published) <> 'object' then
    return false;
  end if;
  return coalesce(pg_catalog.cardinality(
    app_private.portfolio_missing_required_details(p_portfolio_id, published)
  ) = 0, false) and exists (
    -- Current owner UI permits these two hero visibility choices. Historical
    -- aliases remain readable elsewhere but cannot unlock a current publication.
    select 1 from public.portfolio_media media
    where media.portfolio_id = p_portfolio_id and media.media_type = 'hero'
      and media.visibility in ('public', 'interest_required')
  );
exception
  -- The canonical checklist parses birth dates. Malformed legacy dates must
  -- make an old link unavailable, not turn public reads into server errors.
  when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;
revoke all on function app_private.published_portfolio_complete(uuid)
  from public, anon, authenticated;

create or replace function app_private.pilot_public_portfolio_allowed(p_share_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    where portfolio.share_token = p_share_token
      and portfolio.is_published = true
      and portfolio.published_data #>> '{personal,profile_for}' = 'self'
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
      and app_private.personal_publication_verification_satisfied(portfolio.candidate_id)
      and app_private.published_portfolio_complete(portfolio.id)
  )
$$;
revoke all on function app_private.pilot_public_portfolio_allowed(text)
  from public, anon, authenticated;

comment on function app_private.published_portfolio_complete(uuid) is
  'Checks the canonical published snapshot against the current publication checklist; does not inspect private draft completeness or disclose owner answers.';

-- This narrow badge RPC is queried alongside the public projection. Do not
-- reveal a verification bit for a link whose published snapshot is blocked.
create or replace function public.resolve_public_portfolio_identity_verified(p_share_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    where p_share_token is not null
      and pg_catalog.length(p_share_token) between 8 and 160
      and p_share_token ~ '^[A-Za-z0-9_-]+$'
      and portfolio.share_token = p_share_token
      and public.is_published_portfolio(portfolio.id)
      and exists (select 1 from app_private.current_identity_verification(portfolio.candidate_id))
  )
$$;

-- An old approval email must not advertise an active destination when the
-- public and approved projections are unavailable. Preserve viewer binding and
-- the existing revoked/expired statuses; this does not revoke the grant itself.
create or replace function public.resolve_complete_portfolio_access(p_grant_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  grant_record public.reveal_grants%rowtype;
  portfolio_record public.portfolios%rowtype;
begin
  perform app_private.require_current_session();
  if auth.uid() is null then return '{"status":"signin_required"}'::jsonb; end if;
  select grant_row.* into grant_record from public.reveal_grants grant_row
  where grant_row.id = p_grant_id and grant_row.viewer_user_id = auth.uid();
  if grant_record.id is null then return '{"status":"unavailable"}'::jsonb; end if;
  if grant_record.revoked_at is not null then return '{"status":"revoked"}'::jsonb; end if;
  if grant_record.expires_at <= pg_catalog.now() then return '{"status":"expired"}'::jsonb; end if;
  select portfolio_row.* into portfolio_record from public.portfolios portfolio_row
  where portfolio_row.id = grant_record.portfolio_id
    and public.is_published_portfolio(portfolio_row.id);
  if portfolio_record.id is null then return '{"status":"unavailable"}'::jsonb; end if;
  return pg_catalog.jsonb_build_object('status', 'active',
    'shareToken', portfolio_record.share_token, 'expiresAt', grant_record.expires_at);
end;
$$;
-- CREATE OR REPLACE retains the existing EXECUTE grants: the badge RPC is
-- public, while the approval-email resolver remains authenticated-only.
