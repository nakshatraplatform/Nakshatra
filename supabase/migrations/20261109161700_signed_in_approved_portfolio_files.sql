-- Bind an existing guest approval to a live account with the same confirmed email.
-- Account-bound requests still use their user ID, even if that address changes.
create function app_private.resolve_signed_in_guest_approval(p_share_token text, p_horoscope boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  grant_row public.reveal_grants%rowtype;
  recipient text;
  result jsonb;
begin
  perform app_private.require_current_session();
  select lower(btrim(u.email)) into recipient
    from auth.users u
    where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
  if recipient is null then return null; end if;

  select g.* into grant_row
    from app_private.guest_portfolio_grant_recipients b
    join public.reveal_grants g on g.id=b.grant_id
    join public.portfolios p on p.id=g.portfolio_id
    join public.interest_requests r on r.id=g.interest_request_id and r.portfolio_id=p.id
    where b.recipient_email=recipient and p.share_token=p_share_token
      and g.viewer_user_id is null and r.requester_user_id is null
      and app_private.guest_portfolio_grant_current(g.id,recipient)
    order by g.created_at desc,g.id limit 1;
  if grant_row.id is null then return null; end if;

  result:=app_private.approved_view_payload(grant_row.portfolio_id,grant_row.expires_at,p_horoscope);
  if result is null then return null; end if;
  if p_horoscope and not exists(
    select 1 from public.portfolios p where p.id=grant_row.portfolio_id
      and split_part(result->>'accessPath','/',1)=p.user_id::text
      and split_part(result->>'accessPath','/',2)=p.id::text
      and app_private.storage_path_is_canonical(result->>'accessPath')
  ) then return null; end if;

  update public.reveal_grants set last_accessed_at=now() where id=grant_row.id;
  if not exists(select 1 from public.access_audit_events where grant_id=grant_row.id
    and event_type='grant_accessed' and created_at>now()-interval '1 hour') then
    insert into public.access_audit_events(portfolio_id,interest_request_id,grant_id,actor_user_id,event_type)
      values(grant_row.portfolio_id,grant_row.interest_request_id,grant_row.id,auth.uid(),'grant_accessed');
  end if;
  return result;
end $$;
revoke all on function app_private.resolve_signed_in_guest_approval(text,boolean)
  from public,anon,authenticated,service_role;

create or replace function public.resolve_approved_portfolio(p_share_token text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return coalesce(
    app_private.resolve_approved_portfolio_before_member_sharing(p_share_token),
    app_private.resolve_member_shared_portfolio(p_share_token,false),
    app_private.resolve_signed_in_guest_approval(p_share_token,false)
  );
end $$;

create or replace function public.resolve_approved_horoscope(p_share_token text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_current_session();
  return coalesce(
    app_private.resolve_approved_horoscope_before_member_sharing(p_share_token),
    app_private.resolve_member_shared_portfolio(p_share_token,true),
    app_private.resolve_signed_in_guest_approval(p_share_token,true)
  );
end $$;
