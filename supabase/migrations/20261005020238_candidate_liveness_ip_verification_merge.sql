-- Candidate-only liveness + IP assurance. Existing proof is never relabelled.
-- Apply before deploying the new application and worker. No evidence/IP is retained.
alter table app_private.identity_verification_attempts
  drop constraint identity_verification_attempt_method_check,
  add constraint identity_verification_attempt_method_check check
    (verification_method in ('document_identity','portfolio_photo_liveness','candidate_liveness_ip')),
  drop constraint identity_verification_attempt_photo_domain_check,
  add constraint identity_verification_attempt_photo_domain_check check (
    (verification_method in ('document_identity','candidate_liveness_ip')
      and portfolio_id is null and reference_media_id is null
      and reference_storage_path is null and reference_sha256 is null
      and (verification_method <> 'candidate_liveness_ip' or candidate_id is not null))
    or (verification_method='portfolio_photo_liveness' and candidate_id is not null
      and portfolio_id is not null and reference_media_id is not null and reference_storage_path is not null)
  );
alter table app_private.identity_verification_subjects
  drop constraint identity_verification_subject_proof_method_check,
  add constraint identity_verification_subject_proof_method_check check
    (current_proof_method is null or current_proof_method in ('document_identity','portfolio_photo_liveness','candidate_liveness_ip')),
  add column current_liveness_verified boolean not null default false,
  add column current_ip_verified boolean not null default false;

-- Bind new management credentials to their exact attempt. Subject-only tokens
-- remain usable for withdrawal, but cannot attach/retry a different attempt.
alter table app_private.identity_verification_management_tokens
  add column attempt_id uuid references app_private.identity_verification_attempts(id) on delete cascade,
  add column retry_superseded_at timestamptz;

-- Jobs are keyed by subject/task. Finish evidence cleanup before another session
-- can take that slot; keep withdrawal credentials usable in the meantime.
create function app_private.candidate_verification_cleanup_pending(p_subject_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app_private.identity_verification_worker_state
    where subject_id=p_subject_id and task_type in ('provider_recovery','provider_redaction')
      and completed_at is null)
$$;
revoke all on function app_private.candidate_verification_cleanup_pending(uuid) from public,anon,authenticated;

-- Preserve the self-created pilot policy introduced on main. A bearer token
-- authorizes withdrawal/status, but never substitutes for candidate ownership.
create function app_private.require_candidate_liveness_owner(p_candidate_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if not exists (
    select 1 from public.portfolios portfolio
    where portfolio.candidate_id=p_candidate_id and portfolio.user_id=auth.uid()
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
  ) then raise exception 'pilot self verification only' using errcode='42501'; end if;
end;
$$;
revoke all on function app_private.require_candidate_liveness_owner(uuid) from public,anon,authenticated;

create function public.begin_candidate_liveness_verification(
  p_candidate_id uuid,p_invitation_token_hash text,p_management_token_hash text
)
returns table(
  attempt_id uuid,provider_subject_ref uuid
)
language plpgsql security definer set search_path = '' as $$
declare
  subject_record app_private.identity_verification_subjects%rowtype;
  attempt_record app_private.identity_verification_attempts%rowtype;
  selected_candidate_id uuid;
begin
  perform app_private.require_current_session();
  perform app_private.require_candidate_liveness_owner(p_candidate_id);
  if p_invitation_token_hash is not null then
    raise exception 'pilot self verification only' using errcode='42501';
  end if;
  if p_management_token_hash is null or p_management_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid verification authorization' using errcode='22023';
  end if;
  perform 1 from public.candidates where id=p_candidate_id for update;
  selected_candidate_id:=p_candidate_id;
  select * into subject_record from app_private.identity_verification_subjects subject
  where subject.candidate_id=selected_candidate_id and subject.subject_type='candidate' for update;
  if subject_record.id is null then raise exception 'identity verification subject is missing' using errcode='23503'; end if;
  if app_private.candidate_verification_cleanup_pending(subject_record.id) then
    raise exception 'previous verification cleanup is pending' using errcode='IV002';
  end if;
  -- Fresh explicit consent permits a new check after prior withdrawal.
  update app_private.identity_verification_subjects set status='pending',revoked_at=null,revocation_reason=null
  where id=subject_record.id and status='revoked';
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.subject_id=subject_record.id
    and attempt.verification_method='candidate_liveness_ip'
    and attempt.status in ('created','invited','in_progress')
  order by attempt.created_at desc limit 1 for update;
  if attempt_record.id is not null and attempt_record.provider_create_registered_at is not null then
    raise exception 'verification already underway' using errcode='IV002';
  end if;
  if attempt_record.id is null then
    update app_private.identity_verification_attempts set status='revoked',
      completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
    where subject_id=subject_record.id and status in ('created','invited','in_progress');
    insert into app_private.identity_verification_attempts(
      subject_id,candidate_id,provider_subject_ref,status,verification_method,
      consent_version,consented_at,consent_purpose,consent_processing_details,
      consent_retention_details,consent_withdrawal_details
    ) values (
      subject_record.id,selected_candidate_id,subject_record.provider_subject_ref,'created',
      'candidate_liveness_ip',
      '2026-10-03-liveness-ip',pg_catalog.now(),
      'Check that a live person is present and assess network risk for this candidate session.',
      'Didit processes your live camera capture and IP/device information for liveness and IP analysis. No identity document or portfolio-photo comparison is requested.',
      'VivIntro retains consent and normalized check results, not camera evidence or IP reports. Provider evidence is scheduled for deletion.',
      'Use the private verification-management link to withdraw consent. This check does not establish identity, age, photo ownership or profile accuracy.'
    ) returning * into attempt_record;
  end if;
  update app_private.identity_verification_management_tokens management
  set retry_superseded_at=coalesce(management.retry_superseded_at,pg_catalog.now())
  where management.subject_id=subject_record.id and management.attempt_id is distinct from attempt_record.id;
  insert into app_private.identity_verification_management_tokens(subject_id,candidate_id,token_hash,scope,expires_at,attempt_id)
  values(subject_record.id,selected_candidate_id,p_management_token_hash,'withdraw_consent',pg_catalog.now()+interval '30 days',attempt_record.id);
  return query select attempt_record.id,attempt_record.provider_subject_ref;
end;
$$;

create function public.register_candidate_liveness_provider_create(
  p_attempt_id uuid,p_management_token_hash text,p_workflow_id uuid,p_workflow_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
  v_vendor_data text;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_management_token_hash is null or p_management_token_hash !~ '^[a-f0-9]{64}$' or p_workflow_id is null or p_workflow_version is null or p_workflow_version<1 then
    raise exception 'verification provider configuration is invalid' using errcode='IV003';
  end if;
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if attempt_record.id is null or attempt_record.verification_method<>'candidate_liveness_ip'
    or attempt_record.status<>'created' or attempt_record.provider_session_ref is not null
    or attempt_record.provider_create_registered_at is not null then
    raise exception 'verification session cannot be registered' using errcode='IV002';
  end if;
  perform app_private.require_candidate_liveness_owner(attempt_record.candidate_id);
  select * into management_record from app_private.identity_verification_management_tokens management
  where management.token_hash=p_management_token_hash and management.subject_id=attempt_record.subject_id
    and management.attempt_id=attempt_record.id for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification session cannot be registered' using errcode='IV002';
  end if;
  v_vendor_data:='iv:'||attempt_record.provider_subject_ref::text||':'||attempt_record.id::text;
  update app_private.identity_verification_attempts set
    provider_workflow_id=p_workflow_id,provider_workflow_version=p_workflow_version,
    provider_vendor_data=v_vendor_data,provider_create_registered_at=pg_catalog.now(),updated_at=pg_catalog.now()
  where id=attempt_record.id;
  perform app_private.enqueue_identity_verification_work(
    attempt_record.subject_id,attempt_record.id,'provider_recovery',pg_catalog.now()+interval '2 minutes'
  );
end;
$$;

create function public.attach_candidate_liveness_provider_session(
  p_attempt_id uuid,p_management_token_hash text,p_provider_session_ref text,
  p_workflow_id uuid,p_workflow_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_provider_session_ref is null or pg_catalog.char_length(p_provider_session_ref) not between 8 and 128
    or p_management_token_hash is null or p_management_token_hash !~ '^[a-f0-9]{64}$'
    or p_workflow_id is null or p_workflow_version is null or p_workflow_version<1 then
    raise exception 'invalid provider session reference' using errcode='IV002';
  end if;
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if attempt_record.id is null or attempt_record.verification_method<>'candidate_liveness_ip'
    or attempt_record.status<>'created' or attempt_record.provider_session_ref is not null
    or attempt_record.provider_workflow_id is distinct from p_workflow_id
    or attempt_record.provider_workflow_version is distinct from p_workflow_version then
    raise exception 'verification session cannot be attached' using errcode='IV002';
  end if;
  perform app_private.require_candidate_liveness_owner(attempt_record.candidate_id);
  select * into management_record from app_private.identity_verification_management_tokens management
  where management.token_hash=p_management_token_hash and management.subject_id=attempt_record.subject_id
    and management.attempt_id=attempt_record.id for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification session cannot be attached' using errcode='IV002';
  end if;
  update app_private.identity_verification_attempts set provider_session_ref=p_provider_session_ref,
    status='in_progress',started_at=coalesce(started_at,pg_catalog.now()),
    updated_at=pg_catalog.now() where id=attempt_record.id;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=attempt_record.subject_id and task_type='provider_recovery' and attempt_id=attempt_record.id;
  perform app_private.enqueue_identity_verification_work(
    attempt_record.subject_id,attempt_record.id,'reconcile',pg_catalog.now()+interval '5 minutes'
  );
end;
$$;

create function public.retry_candidate_liveness_verification(p_token_hash text,p_management_token_hash text)
returns table(
  attempt_id uuid,provider_subject_ref uuid
)
language plpgsql security definer set search_path = '' as $$
declare
  management_record app_private.identity_verification_management_tokens%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
  previous_attempt app_private.identity_verification_attempts%rowtype;
  replacement_attempt app_private.identity_verification_attempts%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_token_hash is null or p_management_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_management_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'verification retry is unavailable' using errcode='IV001';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens
  where token_hash=p_token_hash;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification retry is unavailable' using errcode='IV001';
  end if;
  perform app_private.require_candidate_liveness_owner(management_record.candidate_id);
  select * into subject_record from app_private.identity_verification_subjects where id=management_record.subject_id for update;
  if subject_record.subject_type<>'candidate' then raise exception 'verification retry is unavailable' using errcode='IV001'; end if;
  select * into previous_attempt from app_private.identity_verification_attempts attempt
  where attempt.subject_id=subject_record.id and attempt.id=management_record.attempt_id for update;
  -- Re-read after the subject/attempt locks: starts and retries serialize here.
  select * into management_record from app_private.identity_verification_management_tokens
  where token_hash=p_token_hash for update;
  if management_record.consumed_at is not null or management_record.revoked_at is not null
    or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification retry is unavailable' using errcode='IV001';
  end if;
  if management_record.retry_superseded_at is not null
    or app_private.candidate_verification_cleanup_pending(subject_record.id)
    or exists(select 1 from app_private.identity_verification_attempts
      where subject_id=subject_record.id and id<>previous_attempt.id and status in ('created','invited','in_progress')) then
    raise exception 'verification retry cannot continue in the current state' using errcode='IV002';
  end if;
  if previous_attempt.id is null or previous_attempt.verification_method<>'candidate_liveness_ip'
    or subject_record.status='revoked'
    or (previous_attempt.status='created' and previous_attempt.provider_create_registered_at is not null) or previous_attempt.status not in ('created','failed','expired','declined')
    or previous_attempt.consent_withdrawn_at is not null then raise exception 'verification retry is unavailable' using errcode='IV001'; end if;
  update app_private.identity_verification_attempts set status='revoked',updated_at=pg_catalog.now()
  where id=previous_attempt.id and status='created';
  insert into app_private.identity_verification_attempts(
    subject_id,candidate_id,provider_subject_ref,status,verification_method,consent_version,consented_at,consent_purpose,
    consent_processing_details,consent_retention_details,consent_withdrawal_details
  ) values (
    subject_record.id,subject_record.candidate_id,subject_record.provider_subject_ref,'created',
    'candidate_liveness_ip',
    '2026-10-03-liveness-ip',pg_catalog.now(),
    'Check that a live person is present and assess network risk for this candidate session.',
    'Didit processes your live camera capture and IP/device information for liveness and IP analysis. No identity document or portfolio-photo comparison is requested.',
    'VivIntro retains consent and normalized check results, not camera evidence or IP reports. Provider evidence is scheduled for deletion.',
    'Use the private verification-management link to withdraw consent. This check does not establish identity, age, photo ownership or profile accuracy.'
  ) returning * into replacement_attempt;
  update app_private.identity_verification_management_tokens
  set retry_superseded_at=coalesce(retry_superseded_at,pg_catalog.now())
  where subject_id=subject_record.id;
  update app_private.identity_verification_management_tokens set consumed_at=pg_catalog.now() where id=management_record.id;
  insert into app_private.identity_verification_management_tokens(subject_id,candidate_id,token_hash,scope,expires_at,attempt_id)
  values(subject_record.id,subject_record.candidate_id,p_management_token_hash,'withdraw_consent',pg_catalog.now()+interval '30 days',replacement_attempt.id);
  return query select replacement_attempt.id,replacement_attempt.provider_subject_ref;
end;
$$;

create or replace function app_private.complete_identity_verification_reconciliation(
  p_attempt_id uuid,p_claim_token uuid,p_outcome text,p_id_verified boolean,
  p_passive_liveness_verified boolean,p_face_match_verified boolean,
  p_name_matches boolean,p_birth_date_matches boolean,p_ip_verified boolean
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  state_record app_private.identity_verification_worker_state%rowtype;
  attempt_record app_private.identity_verification_attempts%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
  v_check_status app_private.organization_verification_status;
  v_checks_pass boolean;
begin
  perform app_private.require_identity_verification_worker();
  if p_outcome not in ('pending','verified','declined','expired') then raise exception 'invalid identity verification outcome' using errcode='22023'; end if;
  select * into state_record from app_private.identity_verification_worker_state state
  where state.attempt_id=p_attempt_id and state.task_type='reconcile' and state.claim_token=p_claim_token
    and state.lease_expires_at>pg_catalog.now() and state.completed_at is null for update;
  if state_record.subject_id is null then return false; end if;
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id and attempt.subject_id=state_record.subject_id for update;
  if attempt_record.id is null then return false; end if;
  select * into subject_record from app_private.identity_verification_subjects subject
  where subject.id=state_record.subject_id for update;
  v_checks_pass:=case when attempt_record.verification_method='candidate_liveness_ip' then
      subject_record.subject_type='candidate' and p_passive_liveness_verified and p_ip_verified
      and not p_id_verified and not p_face_match_verified and not p_name_matches and not p_birth_date_matches
      and attempt_record.provider_workflow_id is not null and attempt_record.provider_workflow_version>0
    when attempt_record.verification_method='portfolio_photo_liveness'
    then p_passive_liveness_verified and p_face_match_verified
      and not p_id_verified and not p_name_matches and not p_birth_date_matches
    else p_id_verified and p_passive_liveness_verified and p_face_match_verified
      and p_name_matches and p_birth_date_matches end;
  if p_outcome='verified' and v_checks_pass is not true then
    raise exception 'verified identity outcome requires the configured checks' using errcode='23514';
  end if;
  if attempt_record.status in ('redacted','revoked') or attempt_record.provider_redacted_at is not null then
    update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
      claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
    where subject_id=state_record.subject_id and task_type='reconcile';
    if attempt_record.status='revoked' and attempt_record.provider_session_ref is not null then
      perform app_private.enqueue_identity_verification_work(state_record.subject_id,attempt_record.id,'provider_redaction');
    end if;
    return true;
  end if;
  if p_outcome='pending' then
    update app_private.identity_verification_worker_state set run_after=pg_catalog.now()+interval '5 minutes',
      claim_token=null,claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
    where subject_id=state_record.subject_id and task_type='reconcile';
    return true;
  end if;
  if attempt_record.status<>'in_progress' then return false; end if;
  if attempt_record.verification_method='portfolio_photo_liveness' and not exists (
    select 1 from public.portfolio_media media where media.id=attempt_record.reference_media_id
      and media.portfolio_id=attempt_record.portfolio_id and media.candidate_id=attempt_record.candidate_id
      and media.media_type='hero' and media.storage_path=attempt_record.reference_storage_path
  ) then p_outcome:='declined'; end if;
  update app_private.identity_verification_attempts set status=p_outcome,
    completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now() where id=attempt_record.id;
  if p_outcome='verified' then
    update app_private.identity_verification_subjects set status='verified',verified_at=pg_catalog.now(),
      expires_at=pg_catalog.now()+interval '365 days',revoked_at=null,revocation_reason=null,
      current_liveness_verified=coalesce(p_passive_liveness_verified,false),
      current_ip_verified=coalesce(p_ip_verified,false),
      expected_birth_date_hash=null,current_proof_method=attempt_record.verification_method,
      current_proof_attempt_id=attempt_record.id,current_proof_portfolio_id=attempt_record.portfolio_id,
      current_proof_media_id=attempt_record.reference_media_id,current_proof_sha256=attempt_record.reference_sha256,
      current_proof_workflow_id=attempt_record.provider_workflow_id,
      current_proof_workflow_version=attempt_record.provider_workflow_version,updated_at=pg_catalog.now()
    where id=state_record.subject_id and status<>'revoked';
    if not found then raise exception 'identity verification has been revoked' using errcode='22023'; end if;
  else
    update app_private.identity_verification_subjects set status=case when p_outcome='expired' then 'expired' else 'failed' end,
      verified_at=null,expires_at=null,expected_birth_date_hash=null,current_proof_method=null,
      current_liveness_verified=false,current_ip_verified=false,
      current_proof_attempt_id=null,current_proof_portfolio_id=null,current_proof_media_id=null,
      current_proof_sha256=null,current_proof_workflow_id=null,current_proof_workflow_version=null,
      updated_at=pg_catalog.now() where id=state_record.subject_id and status<>'revoked';
  end if;
  if subject_record.subject_type='organization_representative' then
    v_check_status:=case when p_outcome='verified' then 'verified'::app_private.organization_verification_status
      when p_outcome='expired' then 'expired'::app_private.organization_verification_status
      else 'needs_attention'::app_private.organization_verification_status end;
    update app_private.organization_verification_checks set status=v_check_status,provider='didit',
      verified_at=case when p_outcome='verified' then pg_catalog.now() else null end,
      expires_at=case when p_outcome='verified' then pg_catalog.now()+interval '365 days' else null end,
      attention_reason=case when p_outcome='declined' then 'Identity verification needs another attempt.'
        when p_outcome='expired' then 'Identity verification expired before completion.' else null end,
      updated_at=pg_catalog.now() where organization_id=subject_record.organization_id
        and verification_type='representative_identity';
    update app_private.organization_onboarding_states set
      status=case when p_outcome='verified' then 'under_review'::app_private.brokerdesk_onboarding_status
        else 'needs_attention'::app_private.brokerdesk_onboarding_status end,
      next_stage='verification',updated_at=pg_catalog.now()
    where organization_id=subject_record.organization_id and status<>'approved';
    insert into app_private.brokerdesk_audit_events(
      organization_id,actor_user_id,event_name,resource_type,outcome,safe_details
    ) values (subject_record.organization_id,subject_record.subject_user_id,
      'representative.identity_verification_completed','organization_verification','succeeded',
      pg_catalog.jsonb_build_object('result',p_outcome));
  end if;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=state_record.subject_id and task_type='reconcile';
  return true;
end;
$$;

create or replace function app_private.complete_identity_verification_reconciliation(p_attempt_id uuid,p_claim_token uuid,p_outcome text,p_id_verified boolean,p_passive_liveness_verified boolean,p_face_match_verified boolean,p_name_matches boolean,p_birth_date_matches boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return app_private.complete_identity_verification_reconciliation(p_attempt_id,p_claim_token,p_outcome,p_id_verified,p_passive_liveness_verified,p_face_match_verified,p_name_matches,p_birth_date_matches,false);
end;
$$;

create or replace function public.complete_identity_verification_reconciliation(p_attempt_id uuid,p_claim_token uuid,p_outcome text,p_id_verified boolean,p_passive_liveness_verified boolean,p_face_match_verified boolean,p_name_matches boolean,p_birth_date_matches boolean,p_ip_verified boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return app_private.complete_identity_verification_reconciliation(p_attempt_id,p_claim_token,p_outcome,p_id_verified,p_passive_liveness_verified,p_face_match_verified,p_name_matches,p_birth_date_matches,p_ip_verified);
end;
$$;

create or replace function app_private.current_identity_verification(p_candidate_id uuid)
returns setof app_private.identity_verification_subjects
language sql stable security definer set search_path = '' as $$
  select subject_record from app_private.identity_verification_subjects subject_record
  where subject_record.candidate_id=p_candidate_id and subject_record.subject_type='candidate'
    and subject_record.status='verified' and subject_record.verified_at<=pg_catalog.now()
    and subject_record.expires_at>pg_catalog.now() and subject_record.revoked_at is null
    and subject_record.current_proof_method='candidate_liveness_ip'
    and subject_record.current_liveness_verified and subject_record.current_ip_verified
    and subject_record.current_proof_workflow_id is not null
    and subject_record.current_proof_workflow_version>0
$$;

-- Preserve historical photo cleanup, but photo changes cannot remove a liveness badge.
create or replace function app_private.invalidate_candidate_photo_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_candidate_id uuid; v_media_id uuid; v_portfolio_id uuid;
begin
  if tg_op='DELETE' then
    v_candidate_id:=old.candidate_id; v_media_id:=old.id; v_portfolio_id:=old.portfolio_id;
  else
    v_candidate_id:=new.candidate_id; v_media_id:=new.id; v_portfolio_id:=new.portfolio_id;
  end if;
  update app_private.identity_verification_attempts set status='revoked',
    completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
  where candidate_id=v_candidate_id and reference_media_id=v_media_id
    and verification_method='portfolio_photo_liveness' and status in ('created','invited','in_progress','verified');
  update app_private.identity_verification_subjects set status='expired',verified_at=null,expires_at=null,
    revoked_at=null,revocation_reason=null,
    current_proof_method=null,current_proof_attempt_id=null,current_proof_portfolio_id=null,
    current_proof_media_id=null,current_proof_sha256=null,current_proof_workflow_id=null,
    current_proof_workflow_version=null,updated_at=pg_catalog.now()
  where candidate_id=v_candidate_id and subject_type='candidate' and current_proof_media_id=v_media_id;
  update public.public_portfolio_snapshots set identity_verification_badge=null,
    identity_verified_until=null,identity_reverification_grace_until=null
  where portfolio_id=v_portfolio_id
    and not exists(select 1 from app_private.current_identity_verification(v_candidate_id));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function app_private.enqueue_identity_verification_redaction()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider_session_ref is not null and new.provider_redacted_at is null
    and new.status in ('verified', 'declined', 'failed', 'expired', 'revoked')
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    perform app_private.enqueue_identity_verification_work(new.subject_id, new.id, 'provider_redaction');
  end if;
  return new;
end;
$$;

-- Cleanup records deletion independently from the new normalized outcome, so
-- a declined/failed check remains retryable after its provider evidence is gone.
create or replace function app_private.complete_identity_verification_provider_redaction(
  p_attempt_id uuid,p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state_record app_private.identity_verification_worker_state%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  select * into state_record from app_private.identity_verification_worker_state state
  where state.attempt_id=p_attempt_id and state.task_type='provider_redaction' and state.claim_token=p_claim_token
    and state.lease_expires_at>pg_catalog.now() and state.completed_at is null for update;
  if state_record.subject_id is null then return false; end if;
  update app_private.identity_verification_attempts set status=case when verification_method<>'candidate_liveness_ip' and status in ('verified','declined','failed','expired') then 'redacted' else status end,
    provider_redacted_at=coalesce(provider_redacted_at,pg_catalog.now()),updated_at=pg_catalog.now() where id=p_attempt_id;
  if not found then return false; end if;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=state_record.subject_id and task_type='provider_redaction';
  return true;
end;
$$;

create or replace function public.get_identity_verification_link_status(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  invitation_record app_private.identity_verification_invitations%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
  attempt_status text;
  attempt_record app_private.identity_verification_attempts%rowtype;
  can_retry boolean;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'verification link is unavailable' using errcode='22023'; end if;
  select * into invitation_record from app_private.identity_verification_invitations where token_hash=p_token_hash;
  if invitation_record.id is not null then
    if invitation_record.consumed_at is null and invitation_record.revoked_at is null and invitation_record.expires_at>pg_catalog.now() then
      return '{"kind":"invitation","status":"ready"}'::jsonb;
    end if;
    raise exception 'verification link is unavailable' using errcode='22023';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens where token_hash=p_token_hash;
  if management_record.id is null or management_record.consumed_at is not null or management_record.revoked_at is not null
    or management_record.expires_at<=pg_catalog.now() then raise exception 'verification link is unavailable' using errcode='22023'; end if;
  select * into subject_record from app_private.identity_verification_subjects where id=management_record.subject_id;
  if management_record.attempt_id is not null then
    select * into attempt_record from app_private.identity_verification_attempts
    where id=management_record.attempt_id and subject_id=management_record.subject_id;
    attempt_status:=attempt_record.status;
    can_retry:=exists(select 1 from public.portfolios portfolio
        where portfolio.candidate_id=management_record.candidate_id and portfolio.user_id=auth.uid()
          and app_private.pilot_self_portfolio_eligible(portfolio.id))
      and subject_record.status<>'revoked'
      and attempt_record.verification_method='candidate_liveness_ip'
      and management_record.retry_superseded_at is null
      and attempt_record.consent_withdrawn_at is null
      and (attempt_record.status in ('failed','expired','declined')
        or (attempt_record.status='created' and attempt_record.provider_create_registered_at is null))
      and not app_private.candidate_verification_cleanup_pending(subject_record.id);
  else
    select attempt.status into attempt_status from app_private.identity_verification_attempts attempt
    where attempt.subject_id=management_record.subject_id order by attempt.created_at desc limit 1;
    -- Historical candidate tokens keep withdrawal, but need fresh consent/start.
    can_retry:=false;
  end if;
  return pg_catalog.jsonb_build_object('kind','management','status',coalesce(attempt_status,'pending'),
    'canRetry',coalesce(can_retry,false),
    'canWithdraw',management_record.scope='withdraw_consent');
end;
$$;

create or replace function public.attach_identity_verification_provider_session(
  p_attempt_id uuid,p_provider_session_ref text,p_management_token_hash text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_provider_session_ref is null or pg_catalog.char_length(p_provider_session_ref) not between 8 and 128
    or p_management_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid provider session reference' using errcode = '22023';
  end if;
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id for update;
  if attempt_record.id is null or attempt_record.status not in ('created','invited','in_progress')
    or (attempt_record.provider_session_ref is not null and attempt_record.provider_session_ref<>p_provider_session_ref) then
    raise exception 'verification session cannot be attached' using errcode = '22023';
  end if;
  -- Candidate entry points are retired; this shared legacy RPC is now only
  -- for the independent representative document workflow.
  select * into subject_record from app_private.identity_verification_subjects where id=attempt_record.subject_id;
  if subject_record.subject_type is distinct from 'organization_representative'
    or attempt_record.verification_method is distinct from 'document_identity'
    or attempt_record.candidate_id is not null then
    raise exception 'candidate verification requires the liveness workflow' using errcode='42501';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens management
  where management.token_hash=p_management_token_hash and management.subject_id=attempt_record.subject_id for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification session cannot be attached' using errcode = '22023';
  end if;
  update app_private.identity_verification_attempts set provider_session_ref=p_provider_session_ref,
    status='in_progress',started_at=coalesce(started_at,pg_catalog.now()),updated_at=pg_catalog.now()
  where id=p_attempt_id;
  perform app_private.enqueue_identity_verification_work(
    attempt_record.subject_id,attempt_record.id,'reconcile',pg_catalog.now()+interval '5 minutes'
  );
  if subject_record.subject_type='organization_representative' then
    update app_private.organization_verification_checks set status='under_review',provider='didit',
      attention_reason=null,updated_at=pg_catalog.now()
    where organization_id=subject_record.organization_id and verification_type='representative_identity';
    update app_private.organization_onboarding_states set status='under_review',next_stage='verification',
      updated_at=pg_catalog.now()
    where organization_id=subject_record.organization_id and status<>'approved';
    insert into app_private.brokerdesk_audit_events(organization_id,actor_user_id,event_name,resource_type,outcome,safe_details)
    values(subject_record.organization_id,subject_record.subject_user_id,'representative.identity_verification_started','organization_verification','succeeded','{}'::jsonb);
  end if;
end;
$$;

create or replace function app_private.record_identity_verification_webhook(
  p_provider_event_hash text,p_payload_digest text,p_attempt_id uuid,
  p_provider_session_ref text,p_provider_subject_ref uuid,p_workflow_id uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_record app_private.identity_verification_attempts%rowtype; event_record_id uuid;
begin
  perform app_private.require_identity_verification_worker();
  if p_provider_event_hash !~ '^[a-f0-9]{64}$' or p_payload_digest !~ '^[a-f0-9]{64}$'
    or p_provider_session_ref is null or pg_catalog.char_length(p_provider_session_ref) not between 8 and 128
    or p_workflow_id is null then raise exception 'invalid identity verification webhook envelope' using errcode='22023'; end if;
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id and attempt.provider_session_ref=p_provider_session_ref
    and attempt.provider_subject_ref=p_provider_subject_ref
    and (attempt.provider_workflow_id is null or attempt.provider_workflow_id=p_workflow_id) for update;
  if attempt_record.id is null then return false; end if;
  insert into app_private.identity_verification_webhook_events(provider_event_hash,attempt_id,payload_digest)
  values(p_provider_event_hash,attempt_record.id,p_payload_digest)
  on conflict(provider_event_hash) do nothing returning id into event_record_id;
  if event_record_id is null then return true; end if;
  -- Keep authenticated receipts/idempotency for delayed events, but never let
  -- a finished session replace the subject's newer reconciliation job.
  if attempt_record.status<>'in_progress' or attempt_record.provider_redacted_at is not null then
    return true;
  end if;
  perform app_private.enqueue_identity_verification_work(attempt_record.subject_id,attempt_record.id,'reconcile');
  return true;
end;
$$;

-- Old candidate attempts cannot race a new proof. The status trigger schedules redaction.
update app_private.identity_verification_attempts set status='revoked',
  completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
where candidate_id is not null and verification_method<>'candidate_liveness_ip'
  and status in ('created','invited','in_progress','verified');
-- Retire any stale decision polling left by old terminal-session webhooks.
-- Recovery and provider deletion remain queued independently.
update app_private.identity_verification_worker_state state
set completed_at=pg_catalog.now(),claim_token=null,claimed_at=null,
  lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
from app_private.identity_verification_attempts attempt
where state.attempt_id=attempt.id and state.task_type='reconcile' and state.completed_at is null
  and (attempt.status not in ('created','invited','in_progress') or attempt.provider_redacted_at is not null);
update public.public_portfolio_snapshots set identity_verification_badge=null,
  identity_verified_until=null,identity_reverification_grace_until=null;

revoke all on function public.begin_candidate_liveness_verification(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_candidate_liveness_verification(uuid,text,text) to authenticated;
revoke all on function public.register_candidate_liveness_provider_create(uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.register_candidate_liveness_provider_create(uuid,text,uuid,integer) to authenticated;
revoke all on function public.attach_candidate_liveness_provider_session(uuid,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.attach_candidate_liveness_provider_session(uuid,text,text,uuid,integer) to authenticated;
revoke all on function public.retry_candidate_liveness_verification(text,text) from public,anon,authenticated;
grant execute on function public.retry_candidate_liveness_verification(text,text) to authenticated;
revoke all on function public.begin_candidate_photo_verification(uuid,text,text) from public,anon,authenticated;
revoke all on function public.register_candidate_photo_provider_create(uuid,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.attach_candidate_photo_provider_session(uuid,text,text,text,uuid,integer) from public,anon,authenticated;
revoke all on function public.retry_candidate_photo_verification(text,text) from public,anon,authenticated;
revoke all on function public.complete_identity_verification_reconciliation(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function app_private.complete_identity_verification_reconciliation(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.complete_identity_verification_reconciliation(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,boolean) to service_role;

-- The original document-based candidate RPCs also predate the photo APIs.
-- Leaving them callable would bypass exact-attempt consent and cleanup gates.
revoke all on function public.begin_identity_verification(uuid,text,text) from public,anon,authenticated;
revoke all on function public.retry_identity_verification(text,text) from public,anon,authenticated;
