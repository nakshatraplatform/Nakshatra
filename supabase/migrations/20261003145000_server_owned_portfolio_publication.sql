-- The public and approved projections are produced in the authenticated
-- server route. Browser credentials must not be able to replace those values
-- through the Data API or the former authenticated publication RPC.
revoke insert, update, delete on public.public_portfolio_snapshots
  from public, anon, authenticated;
revoke insert, update, delete on public.approved_portfolio_snapshots
  from public, anon, authenticated;

create function public.service_publish_portfolio_transaction(
  p_actor_user_id uuid,
  p_actor_session_id uuid,
  p_portfolio_id uuid,
  p_draft_data jsonb,
  p_public_data jsonb,
  p_approved_data jsonb,
  p_share_token text,
  p_expires_at timestamptz,
  p_template_id integer,
  p_theme_color text,
  p_sun_sign text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_claims text := pg_catalog.current_setting('request.jwt.claims', true);
  publication_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service publication role required' using errcode = '42501';
  end if;
  if p_actor_user_id is null or p_actor_session_id is null or not exists (
    select 1 from auth.sessions session_record
    where session_record.id = p_actor_session_id
      and session_record.user_id = p_actor_user_id
  ) then
    raise exception 'publication actor session is no longer active' using errcode = '42501';
  end if;

  -- The existing transaction and its triggers expect a live authenticated
  -- actor. Only the service role can bind the already-verified route actor to
  -- that exact Supabase Auth session for this single atomic call.
  perform pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
    'sub', p_actor_user_id::text,
    'role', 'authenticated',
    'session_id', p_actor_session_id::text,
    'aal', 'aal1'
  )::text, true);

  publication_result := public.publish_portfolio_transaction(
    p_portfolio_id, p_draft_data, p_public_data, p_approved_data,
    p_share_token, p_expires_at, p_template_id, p_theme_color, p_sun_sign
  );
  perform pg_catalog.set_config('request.jwt.claims', coalesce(original_claims, '{}'), true);
  return publication_result;
exception when others then
  perform pg_catalog.set_config('request.jwt.claims', coalesce(original_claims, '{}'), true);
  raise;
end;
$$;

revoke all on function public.publish_portfolio_transaction(
  uuid, jsonb, jsonb, jsonb, text, timestamptz, integer, text, text
) from public, anon, authenticated;
revoke all on function public.service_publish_portfolio_transaction(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz, integer, text, text
) from public, anon, authenticated;
grant execute on function public.service_publish_portfolio_transaction(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz, integer, text, text
) to service_role;

comment on function public.service_publish_portfolio_transaction(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, text, timestamptz, integer, text, text
) is 'Service-only atomic publication of server-derived public and approved projections for a verified live owner session.';
