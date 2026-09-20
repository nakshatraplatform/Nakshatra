-- Registered VivIntro viewers reuse their owned portfolio identity. Their phone
-- remains optional because the verified account email is the identity anchor.

create or replace function app_private.submit_public_interest(
  p_share_token text,
  p_name text,
  p_profile_for text,
  p_phone text,
  p_email text,
  p_location text default null,
  p_family_context text default null,
  p_message text default null,
  p_portfolio_url text default null,
  p_country text default null,
  p_state text default null,
  p_city text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := auth.uid();
  target_portfolio_id uuid;
  target_candidate_id uuid;
  owner_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_phone text := pg_catalog.regexp_replace(coalesce(p_phone, ''::text), '\D', '', 'g');
  verified_email text;
  verified_at timestamptz;
  requester_has_portfolio boolean := false;
  prospect_hash text;
  request_id uuid;
begin
  if requester_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select pg_catalog.lower(account.email), account.email_confirmed_at
    into verified_email, verified_at
  from auth.users account
  where account.id = requester_id;

  select exists(
    select 1 from public.portfolios owned_portfolio
    where owned_portfolio.user_id = requester_id
  ) into requester_has_portfolio;

  if verified_email is null or verified_at is null or normalized_email <> verified_email then
    raise exception 'verified email required' using errcode = '42501';
  end if;

  if p_share_token is null
    or pg_catalog.length(p_share_token) not between 8 and 160
    or p_share_token !~ '^[A-Za-z0-9_-]+$'
    or p_name is null
    or pg_catalog.length(pg_catalog.btrim(p_name)) not between 2 and 180
    or p_profile_for is null
    or p_profile_for not in ('self', 'son', 'daughter', 'sibling', 'relative')
    or (normalized_phone = '' and not requester_has_portfolio)
    or (normalized_phone <> '' and pg_catalog.length(normalized_phone) not between 7 and 20)
    or p_email is null
    or pg_catalog.length(normalized_email) not between 3 and 180
    or (p_location is not null and pg_catalog.length(pg_catalog.btrim(p_location)) > 180)
    or (p_family_context is not null and pg_catalog.length(pg_catalog.btrim(p_family_context)) > 600)
    or (p_message is not null and pg_catalog.length(pg_catalog.btrim(p_message)) > 600)
    or (p_portfolio_url is not null and (
      pg_catalog.length(pg_catalog.btrim(p_portfolio_url)) > 500
      or pg_catalog.btrim(p_portfolio_url) !~ '^https://'
    ))
    or (p_country is not null and pg_catalog.length(pg_catalog.btrim(p_country)) > 100)
    or (p_state is not null and pg_catalog.length(pg_catalog.btrim(p_state)) > 120)
    or (p_city is not null and pg_catalog.length(pg_catalog.btrim(p_city)) > 120)
  then
    raise exception 'invalid interest request' using errcode = '22023';
  end if;

  select snapshot.portfolio_id, portfolio.candidate_id, portfolio.user_id
    into target_portfolio_id, target_candidate_id, owner_id
  from public.public_portfolio_snapshots snapshot
  join public.portfolios portfolio on portfolio.id = snapshot.portfolio_id
  where snapshot.share_token = p_share_token
    and snapshot.is_active = true
    and (snapshot.expires_at is null or snapshot.expires_at > pg_catalog.now())
    and portfolio.share_token = snapshot.share_token
    and portfolio.is_published = true
    and (portfolio.expires_at is null or portfolio.expires_at > pg_catalog.now())
  limit 1;

  if target_portfolio_id is null then return false; end if;
  if owner_id = requester_id then
    raise exception 'portfolio owner cannot request own portfolio' using errcode = '22023';
  end if;

  perform 1 from public.portfolios where id = target_portfolio_id for update;

  select request_record.id into request_id
  from public.interest_requests request_record
  where request_record.portfolio_id = target_portfolio_id
    and request_record.requester_user_id = requester_id
    and request_record.status in ('new', 'pending_review', 'approved', 'revealed', 'rejected')
  order by request_record.created_at desc
  limit 1;

  if request_id is not null then
    update public.interest_requests
    set viewer_email = verified_email,
        email_verified_at = verified_at,
        verification_channel = 'email',
        updated_at = pg_catalog.now()
    where id = request_id;
    return true;
  end if;

  prospect_hash := pg_catalog.encode(
    extensions.digest(
      verified_email || '|' || coalesce(nullif(normalized_phone, ''::text), 'registered:'::text || requester_id::text),
      'sha256'
    ),
    'hex'
  );

  insert into public.interest_requests (
    portfolio_id, candidate_id, requester_user_id, viewer_name, viewer_phone,
    viewer_email, email_verified_at, verification_channel,
    viewer_family_context, message, request_reason, requested_sections,
    prospect_key_hash, status, attribution_status, metadata
  ) values (
    target_portfolio_id, target_candidate_id, requester_id, pg_catalog.btrim(p_name),
    nullif(pg_catalog.btrim(p_phone), ''::text), verified_email, verified_at, 'email',
    nullif(pg_catalog.btrim(p_family_context), ''::text),
    nullif(pg_catalog.btrim(p_message), ''::text),
    nullif(pg_catalog.btrim(p_message), ''::text), array['full']::text[],
    prospect_hash, 'new', 'unattributed',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'profile_for', p_profile_for,
      'country', nullif(pg_catalog.btrim(p_country), ''::text),
      'state', nullif(pg_catalog.btrim(p_state), ''::text),
      'city', nullif(pg_catalog.btrim(p_city), ''::text),
      'location', nullif(pg_catalog.btrim(p_location), ''::text),
      'portfolio_url', nullif(pg_catalog.btrim(p_portfolio_url), ''::text)
    ))
  ) returning id into request_id;

  insert into public.access_audit_events (
    portfolio_id, interest_request_id, actor_user_id, subject_user_id,
    event_type, metadata
  ) values (
    target_portfolio_id, request_id, requester_id, requester_id,
    'request_submitted', pg_catalog.jsonb_build_object(
      'verification_channel', 'email',
      'profile_source', case when requester_has_portfolio then 'vivintro_portfolio' else 'viewer_form' end
    )
  );
  return true;
end;
$$;

revoke all on function app_private.submit_public_interest(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

comment on function public.submit_public_interest(
  text, text, text, text, text, text, text, text, text, text, text, text
) is 'Verified-email interest submission; registered portfolio owners may reuse their profile without providing an additional phone number.';
