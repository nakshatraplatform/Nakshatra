-- NAK-201: make account deletion revoke Family Viewer authority and scrub
-- user-linked provenance before the Auth user is removed.

create or replace function app_private.prepare_account_deletion(
  p_request_id uuid,
  p_user_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_candidates integer := 0;
  deleted_organizations integer := 0;
  anonymized_requests integer := 0;
  revoked_family_viewers integer := 0;
  scrubbed_family_invitations integer := 0;
  scrubbed_family_proposal_organizations integer := 0;
  deleting_email_hash text;
begin
  perform app_private.require_deletion_worker();

  if not exists (
    select 1
    from public.account_deletion_requests deletion_request
    where deletion_request.id = p_request_id
      and deletion_request.user_id = p_user_id
      and deletion_request.status = 'processing'
      and deletion_request.processing_stage = 'initial_storage_cleaned'
      and deletion_request.lease_token = p_claim_token
      and deletion_request.lease_expires_at > pg_catalog.now()
  ) then
    raise exception 'deletion request claim is invalid' using errcode = '22023';
  end if;

  select app_private.normalized_email_hash(account.email)
  into deleting_email_hash
  from auth.users account
  where account.id = p_user_id;

  update public.interest_requests request_record
  set viewer_name = null,
      viewer_phone = null,
      viewer_email = null,
      viewer_family_context = null,
      message = null,
      requester_user_id = null,
      prospect_key_hash = null,
      metadata = '{}'::jsonb,
      updated_at = pg_catalog.now()
  where request_record.requester_user_id = p_user_id;
  get diagnostics anonymized_requests = row_count;

  -- Clear pending invitation authority and personal actor references first.
  -- Accepted invitations remain historical but no longer identify the deleted
  -- account; pending tokens are always destroyed.
  update app_private.candidate_family_viewer_invitations invitation
  set token_hash = case when invitation.accepted_at is null then null
                        else invitation.token_hash end,
      revoked_at = case when invitation.accepted_at is null
                        then coalesce(invitation.revoked_at, pg_catalog.now())
                        else invitation.revoked_at end,
      invited_by = case when invitation.invited_by = p_user_id
                        then null else invitation.invited_by end,
      accepted_by = case when invitation.accepted_by = p_user_id
                         then null else invitation.accepted_by end,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed'
  where invitation.invited_by = p_user_id
    or invitation.accepted_by = p_user_id
    or (
      deleting_email_hash is not null
      and invitation.intended_email_hash = deleting_email_hash
    )
    or exists (
      select 1
      from app_private.candidate_family_viewers viewer
      join public.candidates candidate on candidate.id = viewer.candidate_id
      where viewer.id = invitation.family_viewer_id
        and (
          viewer.verified_user_id = p_user_id
          or viewer.candidate_approved_by = p_user_id
          or candidate.primary_owner_user_id = p_user_id
        )
    );
  get diagnostics scrubbed_family_invitations = row_count;

  update app_private.candidate_family_viewers viewer
  set status = 'revoked',
      role = 'viewer',
      verified_user_id = null,
      verified_at = null,
      candidate_approved_by = null,
      candidate_approved_at = null,
      proposed_by_user_id = case when viewer.proposed_by_user_id = p_user_id
                                 then null else viewer.proposed_by_user_id end,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed',
      display_name = 'Removed family viewer',
      relationship_kind = 'relative',
      relationship_label = null,
      preferred_locale = null,
      revoked_at = coalesce(viewer.revoked_at, pg_catalog.now()),
      revoked_by = null,
      row_version = viewer.row_version + 1,
      updated_at = pg_catalog.now()
  where viewer.verified_user_id = p_user_id
    or viewer.candidate_approved_by = p_user_id
    or (
      deleting_email_hash is not null
      and viewer.intended_email_hash = deleting_email_hash
    )
    or exists (
      select 1
      from public.candidates candidate
      where candidate.id = viewer.candidate_id
        and candidate.primary_owner_user_id = p_user_id
    );
  get diagnostics revoked_family_viewers = row_count;

  update app_private.candidate_family_viewers viewer
  set proposed_by_user_id = null,
      updated_at = pg_catalog.now()
  where viewer.proposed_by_user_id = p_user_id;

  -- Organization provenance is normally retained after an individual broker
  -- leaves. A sole-owner account deletion removes the organization itself, so
  -- scrub both provenance fields before the restrictive organization FK is
  -- reached. The same sole-owner predicate is used by the delete below.
  update app_private.candidate_family_viewers viewer
  set proposed_by_organization_id = null,
      proposed_by_user_id = null,
      updated_at = pg_catalog.now()
  where viewer.proposed_by_organization_id in (
    select organization_record.id
    from public.organizations organization_record
    where exists (
      select 1
      from public.organization_members actor_membership
      where actor_membership.organization_id = organization_record.id
        and actor_membership.user_id = p_user_id
        and actor_membership.role = 'owner'
        and actor_membership.status = 'active'
    )
    and not exists (
      select 1
      from public.organization_members other_member
      where other_member.organization_id = organization_record.id
        and other_member.user_id <> p_user_id
        and other_member.status = 'active'
    )
  );
  get diagnostics scrubbed_family_proposal_organizations = row_count;

  delete from public.candidates candidate
  where candidate.current_organization_id is null
    and (candidate.primary_owner_user_id = p_user_id or candidate.created_by = p_user_id);
  get diagnostics deleted_candidates = row_count;

  delete from public.organizations organization_record
  where exists (
    select 1
    from public.organization_members actor_membership
    where actor_membership.organization_id = organization_record.id
      and actor_membership.user_id = p_user_id
      and actor_membership.role = 'owner'
      and actor_membership.status = 'active'
  )
  and not exists (
    select 1
    from public.organization_members other_member
    where other_member.organization_id = organization_record.id
      and other_member.user_id <> p_user_id
      and other_member.status = 'active'
  );
  get diagnostics deleted_organizations = row_count;

  update public.account_deletion_requests deletion_request
  set processing_stage = 'database_prepared', updated_at = pg_catalog.now()
  where deletion_request.id = p_request_id
    and deletion_request.status = 'processing'
    and deletion_request.processing_stage = 'initial_storage_cleaned'
    and deletion_request.lease_token = p_claim_token
    and deletion_request.lease_expires_at > pg_catalog.now();

  if not found then
    raise exception 'deletion request claim was lost' using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'candidatesDeleted', deleted_candidates,
    'organizationsDeleted', deleted_organizations,
    'requestsAnonymized', anonymized_requests,
    'familyViewersRevoked', revoked_family_viewers,
    'familyInvitationsScrubbed', scrubbed_family_invitations,
    'familyProposalOrganizationsScrubbed',
      scrubbed_family_proposal_organizations
  );
end;
$$;

revoke all on function app_private.prepare_account_deletion(uuid, uuid, uuid)
  from public, anon, authenticated;
