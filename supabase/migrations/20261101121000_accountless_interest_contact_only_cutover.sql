-- Stop legacy full-portfolio approvals before the accountless app is released.
-- Keep the old implementation as an inaccessible internal fixture for existing
-- grants' rejection/revocation lifecycle; only the new reviewed contact command
-- may approve a request after this cutover.
alter function app_private.decide_interest_request(uuid,text)
  rename to decide_interest_request_pre_contact_cutover;

create function app_private.decide_interest_request(
  p_interest_request_id uuid, p_decision text
) returns text language plpgsql volatile security definer set search_path='' as $$
begin
  if p_decision='approved' then return 'contact_review_required'; end if;
  return app_private.decide_interest_request_pre_contact_cutover(
    p_interest_request_id,p_decision);
end;
$$;
revoke all on function app_private.decide_interest_request_pre_contact_cutover(uuid,text)
  from public,anon,authenticated;
revoke all on function app_private.decide_interest_request(uuid,text)
  from public,anon,authenticated;
comment on function public.decide_interest_request(uuid,text) is
  'Legacy owner reject/reopen command. Approval is disabled; use the current reviewed contact decision.';
comment on function public.decide_interest_request_reviewed(uuid,text) is
  'Legacy full-access approval is disabled. Use decide_interest_contact_reviewed for contact-only approval.';

-- Legacy grants remain readable until their original expiry and can be revoked.
-- A renewal would extend private access beyond the agreed transition window.
alter function app_private.manage_reveal_grant(uuid,text)
  rename to manage_reveal_grant_pre_contact_cutover;

create function app_private.manage_reveal_grant(
  p_grant_id uuid, p_action text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if p_action='renew' then
    return pg_catalog.jsonb_build_object('status','renewal_disabled');
  end if;
  return app_private.manage_reveal_grant_pre_contact_cutover(p_grant_id,p_action);
end;
$$;
revoke all on function app_private.manage_reveal_grant_pre_contact_cutover(uuid,text)
  from public,anon,authenticated;
revoke all on function app_private.manage_reveal_grant(uuid,text)
  from public,anon,authenticated;
comment on function public.manage_reveal_grant(uuid,text) is
  'Legacy owner grant command. Revocation remains available; renewal is disabled.';
