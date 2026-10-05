-- Open self-service portfolio drafting to confirmed account owners.
-- Publication remains subject to the existing self-ownership, content,
-- disclosure, and live-photo verification checks.
create or replace function app_private.actor_can_create_portfolio(p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_id is not null and exists (
    select 1 from auth.users account
    where account.id = p_actor_id
      and account.email_confirmed_at is not null
  )
$$;

comment on function app_private.actor_can_create_portfolio(uuid) is
  'A confirmed account can create its own private portfolio; publication has separate verification and consent gates.';

-- Historical waitlist and creator invitations remain as audit records, but
-- neither can grant or revoke creator capability in the open flow.
revoke execute on function public.submit_pilot_access_request(text, text, text, text) from authenticated;
revoke execute on function public.admin_manage_b2c_creator_invite(text, text, text) from authenticated;
revoke execute on function public.accept_b2c_creator_invite(text) from authenticated;
