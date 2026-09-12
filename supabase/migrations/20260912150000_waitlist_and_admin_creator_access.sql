-- Reframe pre-launch applications as a non-entitling waitlist and make
-- Nakshatra application administrators full product operators.

create or replace function app_private.actor_can_create_portfolio(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id is not null and (
    app_private.actor_is_pilot_administrator(p_actor_id)
    or exists (
      select 1
      from auth.users account
      join app_private.b2c_creator_entitlements entitlement
        on entitlement.email_hash = app_private.normalized_email_hash(account.email)
      where account.id = p_actor_id
        and account.email_confirmed_at is not null
        and entitlement.revoked_at is null
    )
    or app_private.actor_has_broker_customer_path(p_actor_id)
  )
$$;

-- Public waitlist entries are informational only. Disable the former approval
-- command so neither a stale client nor a direct RPC call can grant access.
revoke execute on function public.review_pilot_access_request(text, text, text, text)
  from authenticated;

comment on table app_private.pilot_access_requests is
  'Verified-email B2C launch waitlist. Entries do not grant portfolio creator access.';

comment on function public.submit_pilot_access_request(text, text, text, text) is
  'Adds or updates the current verified account on the launch waitlist; never grants creator access.';

comment on function app_private.actor_can_create_portfolio(uuid) is
  'True for active Nakshatra administrators, explicitly entitled B2C creators, or valid broker-customer paths.';
