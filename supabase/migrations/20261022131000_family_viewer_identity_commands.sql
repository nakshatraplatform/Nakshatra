-- NAK-201: guarded Family Viewer proposal, approval, invitation, activation,
-- primary-selection, revocation, and candidate-owned roster commands.

create function public.propose_candidate_family_viewer(
  p_workspace_ref text,
  p_relationship_ref text,
  p_email_hash text,
  p_email_hint text,
  p_display_name text,
  p_relationship_kind text,
  p_relationship_label text,
  p_preferred_locale text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  organization_id uuid;
  selected_candidate_id uuid;
  viewer app_private.candidate_family_viewers%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  normalized_name text;
  normalized_label text;
  normalized_locale text := nullif(pg_catalog.btrim(p_preferred_locale), '');
  candidate_owner_email_hash text;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  normalized_name := app_private.clean_brokerdesk_text(
    p_display_name, 'display name', 1, 120, true
  );
  normalized_label := app_private.clean_brokerdesk_text(
    p_relationship_label, 'relationship label', 1, 40, false
  );

  if actor_id is null
    or p_workspace_ref is null or p_workspace_ref !~ '^wrk_[0-9a-f]{32}$'
    or p_relationship_ref is null or p_relationship_ref !~ '^bcr_[0-9a-f]{32}$'
    or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$'
    or not app_private.is_safe_email_hint(p_email_hint)
    or p_relationship_kind is null
    or p_relationship_kind not in (
      'father', 'mother', 'parent', 'sibling', 'guardian', 'relative', 'other'
    )
    or (p_relationship_kind = 'other') <> (normalized_label is not null)
    or (normalized_locale is not null and (
      pg_catalog.length(normalized_locale) not between 2 and 35
      or normalized_locale !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ))
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer proposal unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':propose-family-viewer:' || p_idempotency_key, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'workspaceRef', p_workspace_ref,
      'relationshipRef', p_relationship_ref,
      'emailHash', p_email_hash,
      'emailHint', pg_catalog.btrim(p_email_hint),
      'displayName', normalized_name,
      'relationshipKind', p_relationship_kind,
      'relationshipLabel', normalized_label,
      'preferredLocale', normalized_locale
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'propose_candidate_family_viewer'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  select organization.id, relationship.candidate_id
  into organization_id, selected_candidate_id
  from public.organizations organization
  join public.broker_clients relationship
    on relationship.organization_id = organization.id
  join public.candidates candidate on candidate.id = relationship.candidate_id
  where organization.workspace_ref = p_workspace_ref
    and organization.type = 'matchmaker_agency'
    and organization.status = 'active'
    and app_private.brokerdesk_entitlement_enabled(organization.id)
    and relationship.relationship_ref = p_relationship_ref
    and relationship.relationship_status = 'active'
    and relationship.starts_at <= pg_catalog.now()
    and (relationship.ends_at is null or relationship.ends_at > pg_catalog.now())
    and candidate.primary_owner_user_id is not null
    and app_private.member_has_brokerdesk_capability(
      actor_id, p_workspace_ref, 'family_viewers.propose', p_relationship_ref
    )
    and app_private.relationship_has_active_mandate_version(
      p_workspace_ref, p_relationship_ref, 'broker-representation-v3'
    );

  if selected_candidate_id is null then
    return '{"available":false}'::jsonb;
  end if;

  perform 1 from public.candidates candidate
  where candidate.id = selected_candidate_id
  for update;

  select app_private.normalized_email_hash(account.email)
  into candidate_owner_email_hash
  from public.candidates candidate
  join auth.users account on account.id = candidate.primary_owner_user_id
  where candidate.id = selected_candidate_id
    and account.email_confirmed_at is not null;

  if not app_private.candidate_has_active_v3_relationship(selected_candidate_id)
    or candidate_owner_email_hash is null
  then
    return '{"available":false}'::jsonb;
  end if;

  -- A scoped broker always receives the same acknowledgement after authority
  -- is established. Candidate self-email, cross-agency duplicates, and a full
  -- bounded queue intentionally do not expose different result shapes.
  if candidate_owner_email_hash <> p_email_hash
    and (
      select pg_catalog.count(*)
      from app_private.candidate_family_viewers current_viewer
      where current_viewer.candidate_id = selected_candidate_id
        and current_viewer.proposed_by_organization_id = organization_id
        and current_viewer.status = 'pending_candidate_approval'
        and current_viewer.revoked_at is null
    ) < 5
    and (
      select pg_catalog.count(*)
      from app_private.candidate_family_viewers current_viewer
      where current_viewer.candidate_id = selected_candidate_id
        and current_viewer.status in (
          'pending_candidate_approval', 'pending_verification', 'active'
        )
        and current_viewer.revoked_at is null
    ) < 10
  then
    insert into app_private.candidate_family_viewers (
      candidate_id, intended_email_hash, intended_email_hint, display_name,
      relationship_kind, relationship_label, preferred_locale, status,
      proposed_by_organization_id, proposed_by_user_id
    ) values (
      selected_candidate_id, p_email_hash, pg_catalog.btrim(p_email_hint), normalized_name,
      p_relationship_kind, normalized_label, normalized_locale,
      'pending_candidate_approval', organization_id, actor_id
    ) on conflict do nothing
    returning * into viewer;
  end if;

  result := '{"accepted":true}'::jsonb;

  if viewer.id is not null then
    insert into app_private.brokerdesk_audit_events (
      organization_id, actor_user_id, event_name, resource_type, outcome,
      safe_details
    ) values (
      organization_id, actor_id, 'family_viewer.proposed', 'family_viewer',
      'succeeded',
      pg_catalog.jsonb_build_object(
        'viewerRef', viewer.viewer_ref,
        'relationshipRef', p_relationship_ref,
        'status', viewer.status,
        'actorClass', 'broker'
      )
    );
  end if;

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'propose_candidate_family_viewer', p_idempotency_key,
    request_hash, organization_id, result
  );

  return result;
end;
$$;

create function public.create_candidate_family_viewer(
  p_email_hash text,
  p_email_hint text,
  p_display_name text,
  p_relationship_kind text,
  p_relationship_label text,
  p_preferred_locale text,
  p_token_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_candidate_id uuid;
  viewer app_private.candidate_family_viewers%rowtype;
  invitation app_private.candidate_family_viewer_invitations%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  normalized_name text;
  normalized_label text;
  normalized_locale text := nullif(pg_catalog.btrim(p_preferred_locale), '');
  actor_email_hash text;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  normalized_name := app_private.clean_brokerdesk_text(
    p_display_name, 'display name', 1, 120, true
  );
  normalized_label := app_private.clean_brokerdesk_text(
    p_relationship_label, 'relationship label', 1, 40, false
  );

  if actor_id is null
    or p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$'
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or not app_private.is_safe_email_hint(p_email_hint)
    or p_relationship_kind is null
    or p_relationship_kind not in (
      'father', 'mother', 'parent', 'sibling', 'guardian', 'relative', 'other'
    )
    or (p_relationship_kind = 'other') <> (normalized_label is not null)
    or (normalized_locale is not null and (
      pg_catalog.length(normalized_locale) not between 2 and 35
      or normalized_locale !~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ))
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer invitation unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':create-family-viewer:' || p_idempotency_key, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'emailHash', p_email_hash,
      'emailHint', pg_catalog.btrim(p_email_hint),
      'displayName', normalized_name,
      'relationshipKind', p_relationship_kind,
      'relationshipLabel', normalized_label,
      'preferredLocale', normalized_locale,
      'tokenHash', p_token_hash
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'create_candidate_family_viewer'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  selected_candidate_id := app_private.current_owned_family_candidate(actor_id);
  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  perform 1 from public.candidates candidate
  where candidate.id = selected_candidate_id and candidate.primary_owner_user_id = actor_id
  for update;

  if not found or not app_private.candidate_has_active_v3_relationship(selected_candidate_id)
  then
    return '{"available":false}'::jsonb;
  end if;

  select app_private.normalized_email_hash(account.email)
  into actor_email_hash
  from auth.users account
  where account.id = actor_id and account.email_confirmed_at is not null;

  if actor_email_hash is null
    or actor_email_hash = p_email_hash
    or (
      select pg_catalog.count(*)
      from app_private.candidate_family_viewers current_viewer
      where current_viewer.candidate_id = selected_candidate_id
        and current_viewer.status in (
          'pending_candidate_approval', 'pending_verification', 'active'
        )
        and current_viewer.revoked_at is null
    ) >= 10
    or exists (
      select 1 from app_private.candidate_family_viewers current_viewer
      where current_viewer.candidate_id = selected_candidate_id
        and current_viewer.intended_email_hash = p_email_hash
        and current_viewer.status in (
          'pending_candidate_approval', 'pending_verification', 'active'
        )
        and current_viewer.revoked_at is null
    )
  then
    return '{"available":false}'::jsonb;
  end if;

  insert into app_private.candidate_family_viewers (
    candidate_id, intended_email_hash, intended_email_hint, display_name,
    relationship_kind, relationship_label, preferred_locale, status,
    candidate_approved_by, candidate_approved_at
  ) values (
    selected_candidate_id, p_email_hash, pg_catalog.btrim(p_email_hint), normalized_name,
    p_relationship_kind, normalized_label, normalized_locale,
    'pending_verification', actor_id, pg_catalog.now()
  ) returning * into viewer;

  invitation := app_private.issue_family_viewer_invitation(
    viewer.id, viewer.intended_email_hash, viewer.intended_email_hint,
    actor_id, p_token_hash
  );

  result := pg_catalog.jsonb_build_object(
    'available', true,
    'viewerRef', viewer.viewer_ref,
    'invitationRef', invitation.invitation_ref,
    'status', viewer.status,
    'expiresAt', invitation.expires_at,
    'rowVersion', viewer.row_version
  );

  insert into app_private.brokerdesk_audit_events (
    actor_user_id, event_name, resource_type, outcome, safe_details
  ) values (
    actor_id, 'family_viewer.invitation_created', 'family_viewer', 'succeeded',
    pg_catalog.jsonb_build_object(
      'viewerRef', viewer.viewer_ref,
      'invitationRef', invitation.invitation_ref,
      'status', viewer.status,
      'actorClass', 'candidate'
    )
  );

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'create_candidate_family_viewer', p_idempotency_key,
    request_hash, null, result
  );

  return result;
end;
$$;

create function public.decide_family_viewer_proposal(
  p_viewer_ref text,
  p_decision text,
  p_email_hash text,
  p_token_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_candidate_id uuid;
  viewer app_private.candidate_family_viewers%rowtype;
  invitation app_private.candidate_family_viewer_invitations%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  candidate_owner_email_hash text;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_viewer_ref is null or p_viewer_ref !~ '^fvw_[0-9a-f]{32}$'
    or p_decision is null or p_decision not in ('approve', 'reject')
    or (p_decision = 'approve' and (
      p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$'
      or
      p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    ))
    or (p_decision = 'reject' and (
      p_email_hash is not null or p_token_hash is not null
    ))
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer decision unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':decide-family-viewer:' || p_idempotency_key, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'viewerRef', p_viewer_ref, 'decision', p_decision,
      'emailHash', p_email_hash,
      'tokenHash', p_token_hash
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'decide_family_viewer_proposal'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  select current_viewer.candidate_id into selected_candidate_id
  from app_private.candidate_family_viewers current_viewer
  join public.candidates candidate on candidate.id = current_viewer.candidate_id
  where current_viewer.viewer_ref = p_viewer_ref
    and candidate.primary_owner_user_id = actor_id;

  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  perform 1 from public.candidates candidate
  where candidate.id = selected_candidate_id and candidate.primary_owner_user_id = actor_id
  for update;

  select current_viewer.* into viewer
  from app_private.candidate_family_viewers current_viewer
  where current_viewer.viewer_ref = p_viewer_ref
    and current_viewer.candidate_id = selected_candidate_id
  for update;

  select app_private.normalized_email_hash(account.email)
  into candidate_owner_email_hash
  from auth.users account
  where account.id = actor_id and account.email_confirmed_at is not null;

  if viewer.id is null
    or viewer.status <> 'pending_candidate_approval'
    or viewer.proposed_by_organization_id is null
    or candidate_owner_email_hash is null
    or candidate_owner_email_hash = viewer.intended_email_hash
    or (p_decision = 'approve'
      and p_email_hash is distinct from viewer.intended_email_hash)
    or not app_private.candidate_has_active_v3_relationship(selected_candidate_id)
  then
    return '{"available":false}'::jsonb;
  end if;

  if p_decision = 'reject' then
    update app_private.candidate_family_viewers
    set status = 'rejected',
        intended_email_hash = repeat('0', 64),
        intended_email_hint = 'Removed',
        display_name = 'Removed family viewer',
        relationship_kind = 'relative', relationship_label = null,
        preferred_locale = null, proposed_by_user_id = null,
        row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = viewer.id
    returning * into viewer;

    result := pg_catalog.jsonb_build_object(
      'available', true, 'viewerRef', viewer.viewer_ref,
      'status', viewer.status, 'rowVersion', viewer.row_version
    );
  else
    update app_private.candidate_family_viewers
    set status = 'pending_verification', candidate_approved_by = actor_id,
        candidate_approved_at = pg_catalog.now(), row_version = row_version + 1,
        updated_at = pg_catalog.now()
    where id = viewer.id
    returning * into viewer;

    invitation := app_private.issue_family_viewer_invitation(
      viewer.id, viewer.intended_email_hash, viewer.intended_email_hint,
      actor_id, p_token_hash
    );

    result := pg_catalog.jsonb_build_object(
      'available', true, 'viewerRef', viewer.viewer_ref,
      'invitationRef', invitation.invitation_ref,
      'status', viewer.status, 'expiresAt', invitation.expires_at,
      'rowVersion', viewer.row_version
    );
  end if;

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome,
    safe_details
  ) values (
    viewer.proposed_by_organization_id, actor_id,
    case when p_decision = 'approve'
      then 'family_viewer.approved' else 'family_viewer.rejected' end,
    'family_viewer', 'succeeded',
    pg_catalog.jsonb_build_object(
      'viewerRef', viewer.viewer_ref,
      'status', viewer.status,
      'actorClass', 'candidate'
    )
  );

  if p_decision = 'approve' then
    insert into app_private.brokerdesk_audit_events (
      organization_id, actor_user_id, event_name, resource_type, outcome,
      safe_details
    ) values (
      viewer.proposed_by_organization_id, actor_id,
      'family_viewer.invitation_created', 'family_viewer', 'succeeded',
      pg_catalog.jsonb_build_object(
        'viewerRef', viewer.viewer_ref,
        'invitationRef', invitation.invitation_ref,
        'status', viewer.status,
        'actorClass', 'candidate'
      )
    );
  end if;

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'decide_family_viewer_proposal', p_idempotency_key,
    request_hash, viewer.proposed_by_organization_id, result
  );

  return result;
end;
$$;

create function public.accept_family_viewer_invitation(
  p_token_hash text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_email_hash text;
  selected_candidate_id uuid;
  candidate_owner_id uuid;
  active_count integer;
  viewer app_private.candidate_family_viewers%rowtype;
  invitation app_private.candidate_family_viewer_invitations%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer invitation unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':accept-family-viewer:' || p_idempotency_key, 0
  ));

  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('tokenHash', p_token_hash)::text, 'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'accept_family_viewer_invitation'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();

  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  select app_private.normalized_email_hash(account.email)
  into actor_email_hash
  from auth.users account
  where account.id = actor_id
    and account.email is not null
    and account.email_confirmed_at is not null;

  if actor_email_hash is null
    or not app_private.user_has_google_identity(actor_id, actor_email_hash)
  then
    return '{"available":false}'::jsonb;
  end if;

  select current_viewer.candidate_id into selected_candidate_id
  from app_private.candidate_family_viewer_invitations pending_invitation
  join app_private.candidate_family_viewers current_viewer
    on current_viewer.id = pending_invitation.family_viewer_id
  where pending_invitation.token_hash = p_token_hash
    and pending_invitation.accepted_at is null
    and pending_invitation.revoked_at is null
    and pending_invitation.expires_at > pg_catalog.now()
    and current_viewer.status = 'pending_verification';

  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  select candidate.primary_owner_user_id into candidate_owner_id
  from public.candidates candidate
  where candidate.id = selected_candidate_id
  for update;

  select pending_invitation.* into invitation
  from app_private.candidate_family_viewer_invitations pending_invitation
  join app_private.candidate_family_viewers current_viewer
    on current_viewer.id = pending_invitation.family_viewer_id
  where pending_invitation.token_hash = p_token_hash
    and pending_invitation.intended_email_hash = actor_email_hash
    and pending_invitation.accepted_at is null
    and pending_invitation.revoked_at is null
    and pending_invitation.expires_at > pg_catalog.now()
    and current_viewer.candidate_id = selected_candidate_id
    and current_viewer.status = 'pending_verification'
    and current_viewer.intended_email_hash = actor_email_hash
    and current_viewer.candidate_approved_by = candidate_owner_id
  for update of pending_invitation;

  if invitation.id is not null then
    select current_viewer.* into viewer
    from app_private.candidate_family_viewers current_viewer
    where current_viewer.id = invitation.family_viewer_id
      and current_viewer.candidate_id = selected_candidate_id
      and current_viewer.status = 'pending_verification'
      and current_viewer.intended_email_hash = actor_email_hash
      and current_viewer.candidate_approved_by = candidate_owner_id
    for update;
  end if;

  if invitation.id is null
    or viewer.id is null
    or candidate_owner_id is null
    or candidate_owner_id = actor_id
    or not app_private.candidate_has_active_v3_relationship(selected_candidate_id)
  then
    return '{"available":false}'::jsonb;
  end if;

  select pg_catalog.count(*)::integer into active_count
  from app_private.candidate_family_viewers active_viewer
  where active_viewer.candidate_id = selected_candidate_id
    and active_viewer.status = 'active'
    and active_viewer.revoked_at is null;

  if active_count >= 3
    or exists (
      select 1 from app_private.candidate_family_viewers active_viewer
      where active_viewer.candidate_id = selected_candidate_id
        and active_viewer.verified_user_id = actor_id
        and active_viewer.status = 'active'
        and active_viewer.revoked_at is null
    )
  then
    return '{"available":false}'::jsonb;
  end if;

  update app_private.candidate_family_viewers as current_viewer
  set verified_user_id = actor_id, verified_at = pg_catalog.now(),
      status = 'active', row_version = row_version + 1,
      updated_at = pg_catalog.now()
  where id = viewer.id
  returning * into viewer;

  update app_private.candidate_family_viewer_invitations
  set accepted_by = actor_id, accepted_at = pg_catalog.now(), token_hash = null,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed', invited_by = null
  where id = invitation.id
  returning * into invitation;

  result := pg_catalog.jsonb_build_object(
    'available', true, 'viewerRef', viewer.viewer_ref,
    'status', viewer.status, 'rowVersion', viewer.row_version
  );

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome,
    safe_details
  ) values (
    viewer.proposed_by_organization_id, actor_id,
    'family_viewer.activated', 'family_viewer', 'succeeded',
    pg_catalog.jsonb_build_object(
      'viewerRef', viewer.viewer_ref,
      'status', viewer.status,
      'actorClass', 'family_viewer'
    )
  );

  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'accept_family_viewer_invitation', p_idempotency_key,
    request_hash, null, result
  );

  return result;
end;
$$;

create function public.set_primary_family_viewer(
  p_viewer_ref text,
  p_expected_row_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_candidate_id uuid;
  viewer app_private.candidate_family_viewers%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_viewer_ref is null or p_viewer_ref !~ '^fvw_[0-9a-f]{32}$'
    or p_expected_row_version is null or p_expected_row_version < 1
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer primary action unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':primary-family-viewer:' || p_idempotency_key, 0
  ));
  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'viewerRef', p_viewer_ref, 'expectedRowVersion', p_expected_row_version
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'set_primary_family_viewer'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();
  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  select current_viewer.candidate_id into selected_candidate_id
  from app_private.candidate_family_viewers current_viewer
  join public.candidates candidate on candidate.id = current_viewer.candidate_id
  where current_viewer.viewer_ref = p_viewer_ref
    and candidate.primary_owner_user_id = actor_id;
  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  perform 1 from public.candidates candidate
  where candidate.id = selected_candidate_id
    and candidate.primary_owner_user_id = actor_id
  for update;

  select current_viewer.* into viewer
  from app_private.candidate_family_viewers current_viewer
  where current_viewer.viewer_ref = p_viewer_ref
    and current_viewer.candidate_id = selected_candidate_id
    and current_viewer.status = 'active'
    and current_viewer.revoked_at is null
    and current_viewer.row_version = p_expected_row_version
  for update;

  if viewer.id is null then return '{"available":false}'::jsonb; end if;

  update app_private.candidate_family_viewers as current_viewer
  set role = 'viewer', row_version = current_viewer.row_version + 1,
      updated_at = pg_catalog.now()
  where current_viewer.candidate_id = selected_candidate_id
    and current_viewer.status = 'active'
    and current_viewer.role = 'primary'
    and current_viewer.revoked_at is null
    and current_viewer.id <> viewer.id;

  update app_private.candidate_family_viewers
  set role = 'primary', row_version = row_version + 1,
      updated_at = pg_catalog.now()
  where id = viewer.id
  returning * into viewer;

  result := pg_catalog.jsonb_build_object(
    'available', true, 'viewerRef', viewer.viewer_ref,
    'status', viewer.status, 'role', viewer.role,
    'rowVersion', viewer.row_version
  );

  insert into app_private.brokerdesk_audit_events (
    actor_user_id, event_name, resource_type, outcome, safe_details
  ) values (
    actor_id, 'family_viewer.primary_changed', 'family_viewer', 'succeeded',
    pg_catalog.jsonb_build_object(
      'viewerRef', viewer.viewer_ref, 'status', viewer.status,
      'role', viewer.role, 'actorClass', 'candidate'
    )
  );
  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'set_primary_family_viewer', p_idempotency_key,
    request_hash, null, result
  );
  return result;
end;
$$;

create function public.revoke_family_viewer(
  p_viewer_ref text,
  p_expected_row_version bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_candidate_id uuid;
  viewer app_private.candidate_family_viewers%rowtype;
  existing app_private.brokerdesk_command_idempotency%rowtype;
  request_hash text;
  result jsonb;
begin
  perform app_private.require_current_session();
  if actor_id is null
    or p_viewer_ref is null or p_viewer_ref !~ '^fvw_[0-9a-f]{32}$'
    or p_expected_row_version is null or p_expected_row_version < 1
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9_.:-]{16,128}$'
  then
    raise exception 'family viewer revocation unavailable' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    actor_id::text || ':revoke-family-viewer:' || p_idempotency_key, 0
  ));
  request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object(
      'viewerRef', p_viewer_ref, 'expectedRowVersion', p_expected_row_version
    )::text,
    'UTF8'
  ), 'sha256'), 'hex');

  select * into existing
  from app_private.brokerdesk_command_idempotency
  where actor_user_id = actor_id
    and command_name = 'revoke_family_viewer'
    and idempotency_key = p_idempotency_key
    and expires_at > pg_catalog.now();
  if found then
    if existing.request_hash <> request_hash then
      raise exception 'idempotency key was already used for a different request'
        using errcode = '22023';
    end if;
    return existing.safe_result;
  end if;

  select current_viewer.candidate_id into selected_candidate_id
  from app_private.candidate_family_viewers current_viewer
  join public.candidates candidate on candidate.id = current_viewer.candidate_id
  where current_viewer.viewer_ref = p_viewer_ref
    and candidate.primary_owner_user_id = actor_id;
  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  perform 1 from public.candidates candidate
  where candidate.id = selected_candidate_id and candidate.primary_owner_user_id = actor_id
  for update;

  select current_viewer.* into viewer
  from app_private.candidate_family_viewers current_viewer
  where current_viewer.viewer_ref = p_viewer_ref
    and current_viewer.candidate_id = selected_candidate_id
    and current_viewer.status in (
      'pending_candidate_approval', 'pending_verification', 'active'
    )
    and current_viewer.revoked_at is null
    and current_viewer.row_version = p_expected_row_version
  for update;

  if viewer.id is null then return '{"available":false}'::jsonb; end if;

  update app_private.candidate_family_viewer_invitations
  set revoked_at = pg_catalog.now(), token_hash = null,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed', invited_by = null, accepted_by = null
  where family_viewer_id = viewer.id
    and accepted_at is null and revoked_at is null;

  update app_private.candidate_family_viewers
  set status = 'revoked', role = 'viewer', revoked_at = pg_catalog.now(),
      revoked_by = actor_id, verified_user_id = null, verified_at = null,
      candidate_approved_by = null, candidate_approved_at = null,
      proposed_by_user_id = null,
      intended_email_hash = repeat('0', 64),
      intended_email_hint = 'Removed',
      display_name = 'Removed family viewer',
      relationship_kind = 'relative', relationship_label = null,
      preferred_locale = null, row_version = row_version + 1,
      updated_at = pg_catalog.now()
  where id = viewer.id
  returning * into viewer;

  result := pg_catalog.jsonb_build_object(
    'available', true, 'viewerRef', viewer.viewer_ref,
    'status', viewer.status, 'rowVersion', viewer.row_version
  );

  insert into app_private.brokerdesk_audit_events (
    organization_id, actor_user_id, event_name, resource_type, outcome,
    safe_details
  ) values (
    viewer.proposed_by_organization_id, actor_id,
    'family_viewer.revoked', 'family_viewer', 'succeeded',
    pg_catalog.jsonb_build_object(
      'viewerRef', viewer.viewer_ref, 'status', viewer.status,
      'actorClass', 'candidate'
    )
  );
  insert into app_private.brokerdesk_command_idempotency (
    actor_user_id, command_name, idempotency_key, request_hash,
    organization_id, safe_result
  ) values (
    actor_id, 'revoke_family_viewer', p_idempotency_key,
    request_hash, null, result
  );
  return result;
end;
$$;

create function public.resolve_candidate_family_roster()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_candidate_id uuid;
begin
  perform app_private.require_current_session();
  selected_candidate_id := app_private.current_owned_family_candidate(actor_id);
  if selected_candidate_id is null then return '{"available":false}'::jsonb; end if;

  return pg_catalog.jsonb_build_object(
    'available', true,
    'activeCount', (
      select pg_catalog.count(*)::integer
      from app_private.candidate_family_viewers active_viewer
      where active_viewer.candidate_id = selected_candidate_id
        and active_viewer.status = 'active'
        and active_viewer.revoked_at is null
    ),
    'viewers', coalesce((
      select pg_catalog.jsonb_agg(
        projection.item order by projection.status_priority,
        projection.created_at, projection.id
      )
      from (
        select pg_catalog.jsonb_build_object(
          'viewerRef', viewer.viewer_ref,
          'displayName', viewer.display_name,
          'relationshipKind', viewer.relationship_kind,
          'relationshipLabel', viewer.relationship_label,
          'emailHint', viewer.intended_email_hint,
          'preferredLocale', viewer.preferred_locale,
          'role', viewer.role,
          'status', viewer.status,
          'rowVersion', viewer.row_version,
          'proposedByWorkspaceName', organization.name,
          'invitationStatus', case
            when invitation.accepted_at is not null then 'accepted'
            when invitation.revoked_at is not null then 'revoked'
            when invitation.expires_at <= pg_catalog.now() then 'expired'
            when invitation.id is not null then 'pending'
            else null
          end,
          'invitationExpiresAt', invitation.expires_at
        ) item,
        case viewer.status
          when 'active' then 1
          when 'pending_verification' then 2
          else 3
        end status_priority,
        viewer.created_at, viewer.id
        from app_private.candidate_family_viewers viewer
        left join public.organizations organization
          on organization.id = viewer.proposed_by_organization_id
        left join lateral (
          select family_invitation.*
          from app_private.candidate_family_viewer_invitations family_invitation
          where family_invitation.family_viewer_id = viewer.id
          order by family_invitation.created_at desc, family_invitation.id desc
          limit 1
        ) invitation on true
        where viewer.candidate_id = selected_candidate_id
          and viewer.status in (
            'pending_candidate_approval', 'pending_verification', 'active'
          )
          and viewer.revoked_at is null
        order by status_priority, viewer.created_at, viewer.id
        limit 10
      ) projection
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.propose_candidate_family_viewer(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.create_candidate_family_viewer(
  text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.decide_family_viewer_proposal(
  text, text, text, text, text
)
  from public, anon, authenticated;
revoke all on function public.accept_family_viewer_invitation(text, text)
  from public, anon, authenticated;
revoke all on function public.set_primary_family_viewer(text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.revoke_family_viewer(text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.resolve_candidate_family_roster()
  from public, anon, authenticated;

grant execute on function public.propose_candidate_family_viewer(
  text, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.create_candidate_family_viewer(
  text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.decide_family_viewer_proposal(
  text, text, text, text, text
)
  to authenticated;
grant execute on function public.accept_family_viewer_invitation(text, text)
  to authenticated;
grant execute on function public.set_primary_family_viewer(text, bigint, text)
  to authenticated;
grant execute on function public.revoke_family_viewer(text, bigint, text)
  to authenticated;
grant execute on function public.resolve_candidate_family_roster()
  to authenticated;

comment on function public.propose_candidate_family_viewer(
  text, text, text, text, text, text, text, text, text
) is 'Creates a candidate-owned proposal only after same-workspace V3 mandate and scoped broker RBAC checks.';
comment on function public.create_candidate_family_viewer(
  text, text, text, text, text, text, text, text
) is 'Candidate-owned direct Family Viewer invitation; raw invitation tokens remain outside the database.';
comment on function public.accept_family_viewer_invitation(text, text) is
  'Activates one Family Viewer only for the exact confirmed invited Google account under a serialized candidate roster lock.';
