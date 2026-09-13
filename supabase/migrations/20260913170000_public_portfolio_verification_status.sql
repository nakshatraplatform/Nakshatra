-- Expose one non-identifying trust signal for an exact, active public link.
-- Missing, expired, rotated, and unverified portfolios all return false.
create function public.resolve_public_portfolio_identity_verified(p_share_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.public_portfolio_snapshots snapshot
    join public.portfolios portfolio on portfolio.id = snapshot.portfolio_id
    where p_share_token is not null
      and pg_catalog.length(p_share_token) between 8 and 160
      and p_share_token ~ '^[A-Za-z0-9_-]+$'
      and snapshot.share_token = p_share_token
      and snapshot.is_active = true
      and (snapshot.expires_at is null or snapshot.expires_at > pg_catalog.now())
      and portfolio.share_token = snapshot.share_token
      and portfolio.is_published = true
      and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
      and snapshot.identity_verification_badge = 'identity_verified'
      and snapshot.identity_verified_until > pg_catalog.now()
  )
$$;

revoke all on function public.resolve_public_portfolio_identity_verified(text) from public;
grant execute on function public.resolve_public_portfolio_identity_verified(text) to anon, authenticated;

comment on function public.resolve_public_portfolio_identity_verified(text) is
  'Returns only a boolean current-verification signal for an exact active public portfolio; unavailable and unverified links are indistinguishable.';
