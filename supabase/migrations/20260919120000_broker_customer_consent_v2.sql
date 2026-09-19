-- A broker may never create or edit a customer's portfolio. The customer owns
-- the canonical portfolio and explicitly grants a time-bounded mandate for the
-- inviting broker to review the published Complete Portfolio and share it in
-- broker-mediated introductions. The v2 consent intentionally has no
-- per-introduction approval gate.

alter table app_private.broker_client_intakes
  drop constraint if exists broker_client_intakes_consent_version_check;

alter table app_private.broker_client_intakes
  alter column consent_version set default 'broker-representation-v2',
  add constraint broker_client_intakes_consent_version_check check (
    consent_version in ('broker-representation-v1', 'broker-representation-v2')
  );

create or replace function public.claim_brokerdesk_customer_invitation(
  p_token_hash text,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email_hash text;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_consent_version <> 'broker-representation-v2' then
    return '{"available":false}'::jsonb;
  end if;

  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.lower(pg_catalog.btrim(account.email)), 'UTF8'
  ), 'sha256'), 'hex')
  into actor_email_hash
  from auth.users account
  where account.id = actor_id and account.email_confirmed_at is not null;

  if actor_email_hash is null then return '{"available":false}'::jsonb; end if;

  update app_private.broker_client_intakes intake
  set consent_version = p_consent_version, updated_at = pg_catalog.now()
  where intake.token_hash = p_token_hash
    and intake.email_hash = actor_email_hash
    and intake.claimed_at is null
    and intake.revoked_at is null
    and intake.expires_at > pg_catalog.now();

  if not found then return '{"available":false}'::jsonb; end if;
  return public.claim_brokerdesk_customer_invitation(p_token_hash);
end;
$$;

revoke all on function public.claim_brokerdesk_customer_invitation(text) from public, anon, authenticated;
revoke all on function public.claim_brokerdesk_customer_invitation(text, text) from public, anon, authenticated;
grant execute on function public.claim_brokerdesk_customer_invitation(text, text) to authenticated;

comment on function public.claim_brokerdesk_customer_invitation(text, text) is
  'Claims an exact-email invitation under broker-representation-v2; the customer keeps ownership while granting the inviting broker review and introduction-sharing authority without per-introduction approval.';

