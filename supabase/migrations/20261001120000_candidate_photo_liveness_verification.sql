-- Candidate verification now proves that a live person matches the portfolio's
-- current primary photo. BrokerDesk representative verification intentionally
-- keeps the existing document, name, and date-of-birth policy.

alter table app_private.identity_verification_attempts
  add column verification_method text not null default 'document_identity',
  add column portfolio_id uuid references public.portfolios(id) on delete cascade,
  add column reference_media_id uuid,
  add column reference_storage_path text,
  add column reference_sha256 text,
  add column provider_workflow_id uuid,
  add column provider_workflow_version integer,
  add column provider_vendor_data text,
  add column provider_create_registered_at timestamptz,
  add constraint identity_verification_attempt_method_check
    check (verification_method in ('document_identity','portfolio_photo_liveness')),
  add constraint identity_verification_attempt_reference_digest_check
    check (reference_sha256 is null or reference_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint identity_verification_attempt_workflow_version_check
    check (provider_workflow_version is null or provider_workflow_version > 0),
  add constraint identity_verification_attempt_photo_domain_check check (
    (verification_method = 'document_identity'
      and portfolio_id is null and reference_media_id is null
      and reference_storage_path is null and reference_sha256 is null)
    or
    (verification_method = 'portfolio_photo_liveness'
      and candidate_id is not null and portfolio_id is not null
      and reference_media_id is not null and reference_storage_path is not null)
  );

alter table app_private.identity_verification_subjects
  add column current_proof_method text,
  add column current_proof_attempt_id uuid,
  add column current_proof_portfolio_id uuid,
  add column current_proof_media_id uuid,
  add column current_proof_sha256 text,
  add column current_proof_workflow_id uuid,
  add column current_proof_workflow_version integer,
  add constraint identity_verification_subject_proof_method_check
    check (current_proof_method is null or current_proof_method in ('document_identity','portfolio_photo_liveness')),
  add constraint identity_verification_subject_proof_digest_check
    check (current_proof_sha256 is null or current_proof_sha256 ~ '^[a-f0-9]{64}$');

alter table app_private.identity_verification_worker_state
  drop constraint identity_verification_worker_state_task_type_check,
  add constraint identity_verification_worker_state_task_type_check
    check (task_type in ('reconcile','provider_redaction','provider_recovery','expiry'));

create index identity_verification_attempt_photo_reference_idx
  on app_private.identity_verification_attempts(reference_media_id)
  where verification_method = 'portfolio_photo_liveness';

create or replace function app_private.enqueue_identity_verification_work(
  p_candidate_id uuid,
  p_attempt_id uuid,
  p_task_type text,
  p_run_after timestamptz default pg_catalog.now()
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_candidate_id uuid;
begin
  if p_task_type not in ('reconcile','provider_redaction','provider_recovery') then
    raise exception 'invalid identity verification work type' using errcode='22023';
  end if;
  select attempt.candidate_id into v_candidate_id
  from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id and attempt.subject_id=p_candidate_id;
  if not found then raise exception 'identity verification attempt is unavailable' using errcode='22023'; end if;
  insert into app_private.identity_verification_worker_state(
    subject_id,candidate_id,attempt_id,task_type,run_after,claim_token,claimed_at,
    lease_expires_at,attempts,last_error_code,completed_at,updated_at
  ) values (
    p_candidate_id,v_candidate_id,p_attempt_id,p_task_type,p_run_after,null,null,
    null,0,null,null,pg_catalog.now()
  ) on conflict(subject_id,task_type) do update set
    candidate_id=excluded.candidate_id,
    attempt_id=case when app_private.identity_verification_worker_state.lease_expires_at>pg_catalog.now()
      then app_private.identity_verification_worker_state.attempt_id else excluded.attempt_id end,
    run_after=case when app_private.identity_verification_worker_state.lease_expires_at>pg_catalog.now()
      then app_private.identity_verification_worker_state.run_after else excluded.run_after end,
    claim_token=case when app_private.identity_verification_worker_state.lease_expires_at>pg_catalog.now()
      then app_private.identity_verification_worker_state.claim_token else null end,
    claimed_at=case when app_private.identity_verification_worker_state.lease_expires_at>pg_catalog.now()
      then app_private.identity_verification_worker_state.claimed_at else null end,
    lease_expires_at=case when app_private.identity_verification_worker_state.lease_expires_at>pg_catalog.now()
      then app_private.identity_verification_worker_state.lease_expires_at else null end,
    attempts=case when app_private.identity_verification_worker_state.attempt_id=excluded.attempt_id
      then app_private.identity_verification_worker_state.attempts else 0 end,
    last_error_code=null,completed_at=null,updated_at=pg_catalog.now();
end;
$$;

create function public.begin_candidate_photo_verification(
  p_candidate_id uuid,p_invitation_token_hash text,p_management_token_hash text
)
returns table(
  attempt_id uuid,provider_subject_ref uuid,portfolio_id uuid,
  reference_media_id uuid,reference_storage_path text
)
language plpgsql security definer set search_path = '' as $$
declare
  candidate_record public.candidates%rowtype;
  portfolio_record public.portfolios%rowtype;
  media_record public.portfolio_media%rowtype;
  invitation_record app_private.identity_verification_invitations%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
  attempt_record app_private.identity_verification_attempts%rowtype;
  selected_candidate_id uuid;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if (p_candidate_id is null)=(p_invitation_token_hash is null)
    or p_management_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid verification authorization' using errcode='22023';
  end if;
  if p_candidate_id is not null then
    select * into candidate_record from public.candidates candidate
    where candidate.id=p_candidate_id and candidate.primary_owner_user_id=auth.uid() for update;
    if candidate_record.id is null then raise exception 'self verification is unavailable' using errcode='42501'; end if;
    selected_candidate_id:=p_candidate_id;
  else
    if p_invitation_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid invitation token' using errcode='22023'; end if;
    select * into invitation_record from app_private.identity_verification_invitations invitation
    where invitation.token_hash=p_invitation_token_hash for update;
    if invitation_record.id is null or invitation_record.consumed_at is not null
      or invitation_record.revoked_at is not null or invitation_record.expires_at<=pg_catalog.now() then
      raise exception 'invitation is unavailable' using errcode='22023';
    end if;
    selected_candidate_id:=invitation_record.candidate_id;
    select * into candidate_record from public.candidates where id=selected_candidate_id for update;
  end if;
  select * into portfolio_record from public.portfolios portfolio
  where portfolio.candidate_id=selected_candidate_id order by portfolio.created_at limit 1 for update;
  select * into media_record from public.portfolio_media media
  where media.portfolio_id=portfolio_record.id and media.candidate_id=selected_candidate_id
    and media.media_type='hero' order by media.created_at desc limit 1;
  if portfolio_record.id is null or media_record.id is null or nullif(media_record.storage_path,'') is null then
    raise exception 'primary portfolio photo is required' using errcode='22023';
  end if;
  select * into subject_record from app_private.identity_verification_subjects subject
  where subject.candidate_id=selected_candidate_id and subject.subject_type='candidate' for update;
  if subject_record.id is null then raise exception 'identity verification subject is missing' using errcode='23503'; end if;
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.subject_id=subject_record.id
    and attempt.verification_method='portfolio_photo_liveness'
    and attempt.reference_media_id=media_record.id
    and attempt.reference_storage_path=media_record.storage_path
    and attempt.status in ('created','invited','in_progress')
  order by attempt.created_at desc limit 1 for update;
  if attempt_record.id is null then
    update app_private.identity_verification_attempts set status='revoked',
      completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
    where subject_id=subject_record.id and status in ('created','invited','in_progress');
    insert into app_private.identity_verification_attempts(
      subject_id,candidate_id,provider_subject_ref,status,verification_method,
      portfolio_id,reference_media_id,reference_storage_path,
      consent_version,consented_at,consent_purpose,consent_processing_details,
      consent_retention_details,consent_withdrawal_details
    ) values (
      subject_record.id,selected_candidate_id,subject_record.provider_subject_ref,'created',
      'portfolio_photo_liveness',portfolio_record.id,media_record.id,media_record.storage_path,
      '2026-10-01',pg_catalog.now(),
      'Confirm that a live person matches the primary photo selected for this VivIntro portfolio.',
      'VivIntro sends the current primary portfolio photo to Didit for a hosted passive-liveness and face-match check. No identity document is requested by this candidate workflow.',
      'VivIntro retains the verification result, workflow identifiers, and a one-way digest binding the result to the primary photo. Provider evidence is scheduled for deletion.',
      'Use the private verification-management link to withdraw consent. Changing the primary photo also revokes this verification.'
    ) returning * into attempt_record;
  end if;
  if invitation_record.id is not null then
    update app_private.identity_verification_invitations set consumed_at=pg_catalog.now() where id=invitation_record.id;
  end if;
  insert into app_private.identity_verification_management_tokens(subject_id,candidate_id,token_hash,scope,expires_at)
  values(subject_record.id,selected_candidate_id,p_management_token_hash,'withdraw_consent',pg_catalog.now()+interval '30 days');
  return query select attempt_record.id,attempt_record.provider_subject_ref,
    portfolio_record.id,media_record.id,media_record.storage_path;
end;
$$;

create function public.register_candidate_photo_provider_create(
  p_attempt_id uuid,p_management_token_hash text,p_workflow_id uuid,p_workflow_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
  v_vendor_data text;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_management_token_hash !~ '^[a-f0-9]{64}$' or p_workflow_id is null or p_workflow_version<1 then
    raise exception 'verification provider configuration is invalid' using errcode='22023';
  end if;
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if attempt_record.id is null or attempt_record.verification_method<>'portfolio_photo_liveness'
    or attempt_record.status<>'created' or attempt_record.provider_session_ref is not null
    or attempt_record.provider_create_registered_at is not null then
    raise exception 'verification session cannot be registered' using errcode='22023';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens management
  where management.token_hash=p_management_token_hash and management.subject_id=attempt_record.subject_id for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification session cannot be registered' using errcode='22023';
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

create function public.attach_candidate_photo_provider_session(
  p_attempt_id uuid,p_management_token_hash text,p_provider_session_ref text,
  p_reference_sha256 text,p_workflow_id uuid,p_workflow_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_provider_session_ref is null or pg_catalog.char_length(p_provider_session_ref) not between 8 and 128
    or p_management_token_hash !~ '^[a-f0-9]{64}$' or p_reference_sha256 !~ '^[a-f0-9]{64}$'
    or p_workflow_id is null or p_workflow_version<1 then
    raise exception 'invalid provider session reference' using errcode='22023';
  end if;
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if attempt_record.id is null or attempt_record.verification_method<>'portfolio_photo_liveness'
    or attempt_record.status<>'created' or attempt_record.provider_session_ref is not null
    or attempt_record.provider_workflow_id is distinct from p_workflow_id
    or attempt_record.provider_workflow_version is distinct from p_workflow_version then
    raise exception 'verification session cannot be attached' using errcode='22023';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens management
  where management.token_hash=p_management_token_hash and management.subject_id=attempt_record.subject_id for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification session cannot be attached' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.portfolio_media media where media.id=attempt_record.reference_media_id
      and media.portfolio_id=attempt_record.portfolio_id and media.candidate_id=attempt_record.candidate_id
      and media.media_type='hero' and media.storage_path=attempt_record.reference_storage_path
  ) then raise exception 'primary portfolio photo changed' using errcode='22023'; end if;
  update app_private.identity_verification_attempts set provider_session_ref=p_provider_session_ref,
    reference_sha256=p_reference_sha256,status='in_progress',started_at=coalesce(started_at,pg_catalog.now()),
    updated_at=pg_catalog.now() where id=attempt_record.id;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=attempt_record.subject_id and task_type='provider_recovery' and attempt_id=attempt_record.id;
  perform app_private.enqueue_identity_verification_work(
    attempt_record.subject_id,attempt_record.id,'reconcile',pg_catalog.now()+interval '5 minutes'
  );
end;
$$;

create function public.retry_candidate_photo_verification(p_token_hash text,p_management_token_hash text)
returns table(
  attempt_id uuid,provider_subject_ref uuid,portfolio_id uuid,
  reference_media_id uuid,reference_storage_path text
)
language plpgsql security definer set search_path = '' as $$
declare
  management_record app_private.identity_verification_management_tokens%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
  previous_attempt app_private.identity_verification_attempts%rowtype;
  replacement_attempt app_private.identity_verification_attempts%rowtype;
  portfolio_record public.portfolios%rowtype;
  media_record public.portfolio_media%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_management_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'verification retry is unavailable' using errcode='22023';
  end if;
  select * into management_record from app_private.identity_verification_management_tokens
  where token_hash=p_token_hash for update;
  if management_record.id is null or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification retry is unavailable' using errcode='22023';
  end if;
  select * into subject_record from app_private.identity_verification_subjects where id=management_record.subject_id for update;
  if subject_record.subject_type<>'candidate' then raise exception 'verification retry is unavailable' using errcode='22023'; end if;
  select * into previous_attempt from app_private.identity_verification_attempts attempt
  where attempt.subject_id=subject_record.id order by attempt.created_at desc limit 1 for update;
  if previous_attempt.id is null or previous_attempt.status not in ('created','failed','expired','declined')
    or previous_attempt.consent_withdrawn_at is not null then raise exception 'verification retry is unavailable' using errcode='22023'; end if;
  select * into portfolio_record from public.portfolios where candidate_id=subject_record.candidate_id order by created_at limit 1 for update;
  select * into media_record from public.portfolio_media media where media.portfolio_id=portfolio_record.id
    and media.candidate_id=subject_record.candidate_id and media.media_type='hero' order by media.created_at desc limit 1;
  if media_record.id is null then raise exception 'primary portfolio photo is required' using errcode='22023'; end if;
  insert into app_private.identity_verification_attempts(
    subject_id,candidate_id,provider_subject_ref,status,verification_method,portfolio_id,
    reference_media_id,reference_storage_path,consent_version,consented_at,consent_purpose,
    consent_processing_details,consent_retention_details,consent_withdrawal_details
  ) values (
    subject_record.id,subject_record.candidate_id,subject_record.provider_subject_ref,'created',
    'portfolio_photo_liveness',portfolio_record.id,media_record.id,media_record.storage_path,
    '2026-10-01',pg_catalog.now(),
    'Confirm that a live person matches the primary photo selected for this VivIntro portfolio.',
    'VivIntro sends the current primary portfolio photo to Didit for a hosted passive-liveness and face-match check. No identity document is requested by this candidate workflow.',
    'VivIntro retains the verification result, workflow identifiers, and a one-way digest binding the result to the primary photo. Provider evidence is scheduled for deletion.',
    'Use the private verification-management link to withdraw consent. Changing the primary photo also revokes this verification.'
  ) returning * into replacement_attempt;
  update app_private.identity_verification_management_tokens set consumed_at=pg_catalog.now() where id=management_record.id;
  insert into app_private.identity_verification_management_tokens(subject_id,candidate_id,token_hash,scope,expires_at)
  values(subject_record.id,subject_record.candidate_id,p_management_token_hash,'withdraw_consent',pg_catalog.now()+interval '30 days');
  return query select replacement_attempt.id,replacement_attempt.provider_subject_ref,
    portfolio_record.id,media_record.id,media_record.storage_path;
end;
$$;

drop function public.claim_identity_verification_work(integer);
drop function app_private.claim_identity_verification_work(integer);
create function app_private.claim_identity_verification_work(p_limit integer)
returns table(
  subject_id uuid,candidate_id uuid,subject_type text,task_type text,claim_token uuid,
  attempt_id uuid,provider_session_ref text,legal_name text,birth_date date,birth_date_hash text,
  verification_method text,provider_workflow_id uuid,provider_workflow_version integer,
  provider_vendor_data text,work_attempts integer
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid work claim limit' using errcode='22023'; end if;
  return query with eligible as (
    select state.subject_id,state.task_type from app_private.identity_verification_worker_state state
    where state.attempt_id is not null and state.completed_at is null and state.run_after<=pg_catalog.now()
      and (state.lease_expires_at is null or state.lease_expires_at<=pg_catalog.now())
    order by state.run_after,state.subject_id,state.task_type for update skip locked limit p_limit
  ), claimed as (
    update app_private.identity_verification_worker_state state set claim_token=extensions.gen_random_uuid(),
      claimed_at=pg_catalog.now(),lease_expires_at=pg_catalog.now()+interval '10 minutes',
      attempts=state.attempts+1,updated_at=pg_catalog.now()
    from eligible where state.subject_id=eligible.subject_id and state.task_type=eligible.task_type
    returning state.subject_id,state.candidate_id,state.task_type,state.claim_token,state.attempt_id,state.attempts
  )
  select claimed.subject_id,claimed.candidate_id,subject_record.subject_type,claimed.task_type,
    claimed.claim_token,claimed.attempt_id,attempt.provider_session_ref,
    case when subject_record.subject_type='candidate' then candidate.legal_name else profile.representative_full_name end,
    case when subject_record.subject_type='candidate' then candidate.birth_date else null end,
    subject_record.expected_birth_date_hash,attempt.verification_method,attempt.provider_workflow_id,
    attempt.provider_workflow_version,attempt.provider_vendor_data,claimed.attempts
  from claimed join app_private.identity_verification_attempts attempt on attempt.id=claimed.attempt_id
  join app_private.identity_verification_subjects subject_record on subject_record.id=claimed.subject_id
  left join public.candidates candidate on candidate.id=subject_record.candidate_id
  left join app_private.organization_business_profiles profile on profile.organization_id=subject_record.organization_id;
end;
$$;

create function public.claim_identity_verification_work(p_limit integer default 10)
returns table(
  subject_id uuid,candidate_id uuid,subject_type text,task_type text,claim_token uuid,
  attempt_id uuid,provider_session_ref text,legal_name text,birth_date date,birth_date_hash text,
  verification_method text,provider_workflow_id uuid,provider_workflow_version integer,
  provider_vendor_data text,work_attempts integer
)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return query select * from app_private.claim_identity_verification_work(p_limit);
end;
$$;

-- Provider-create recovery uses the same leased, database-bounded backoff as
-- reconciliation and redaction. Without this extension an expected empty
-- lookup would fail the deferral RPC and abort the whole worker batch.
create or replace function app_private.defer_identity_verification_work(
  p_attempt_id uuid,p_task_type text,p_claim_token uuid,p_error_code text,
  p_delay_seconds integer default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_task_type not in ('reconcile','provider_redaction','provider_recovery')
    or p_error_code !~ '^[A-Z_]{3,64}$'
    or (p_delay_seconds is not null and (p_delay_seconds<300 or p_delay_seconds>3600)) then
    raise exception 'invalid identity verification work deferral' using errcode='22023';
  end if;
  update app_private.identity_verification_worker_state state set
    run_after=pg_catalog.now()+pg_catalog.make_interval(secs=>coalesce(
      p_delay_seconds,least(3600,(300*pg_catalog.power(2,greatest(state.attempts-1,0)))::integer)
    )),claim_token=null,claimed_at=null,lease_expires_at=null,last_error_code=p_error_code,
    updated_at=pg_catalog.now()
  where state.attempt_id=p_attempt_id and state.task_type=p_task_type
    and state.claim_token=p_claim_token and state.lease_expires_at>pg_catalog.now()
    and state.completed_at is null;
  return found;
end;
$$;

create or replace function public.defer_identity_verification_work(
  p_attempt_id uuid,p_task_type text,p_claim_token uuid,p_error_code text,
  p_delay_seconds integer default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return app_private.defer_identity_verification_work(
    p_attempt_id,p_task_type,p_claim_token,p_error_code,p_delay_seconds
  );
end;
$$;

drop function app_private.record_identity_verification_webhook(text,text,uuid,text,uuid);
create function app_private.record_identity_verification_webhook(
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
  perform app_private.enqueue_identity_verification_work(attempt_record.subject_id,attempt_record.id,'reconcile');
  return true;
end;
$$;

drop function public.record_identity_verification_webhook(text,text,uuid,text,uuid);
create function public.record_identity_verification_webhook(
  p_provider_event_hash text,p_payload_digest text,p_attempt_id uuid,
  p_provider_session_ref text,p_provider_subject_ref uuid,p_workflow_id uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return app_private.record_identity_verification_webhook(
    p_provider_event_hash,p_payload_digest,p_attempt_id,p_provider_session_ref,
    p_provider_subject_ref,p_workflow_id
  );
end;
$$;

-- Rolling-deploy compatibility for the immediately previous application,
-- whose webhook adapter had already authenticated the legacy workflow but did
-- not pass it to the RPC. Keep this service-role-only overload until every
-- deployment uses the six-argument binding above.
create function public.record_identity_verification_webhook(
  p_provider_event_hash text,p_payload_digest text,p_attempt_id uuid,
  p_provider_session_ref text,p_provider_subject_ref uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_workflow_id uuid;
begin
  perform app_private.require_identity_verification_worker();
  select attempt.provider_workflow_id into v_workflow_id
  from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id and attempt.provider_session_ref=p_provider_session_ref
    and attempt.provider_subject_ref=p_provider_subject_ref;
  v_workflow_id:=coalesce(v_workflow_id,'00000000-0000-4000-8000-000000000000'::uuid);
  return app_private.record_identity_verification_webhook(
    p_provider_event_hash,p_payload_digest,p_attempt_id,p_provider_session_ref,
    p_provider_subject_ref,v_workflow_id
  );
end;
$$;

create or replace function app_private.complete_identity_verification_reconciliation(
  p_attempt_id uuid,p_claim_token uuid,p_outcome text,p_id_verified boolean,
  p_passive_liveness_verified boolean,p_face_match_verified boolean,
  p_name_matches boolean,p_birth_date_matches boolean
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
  v_checks_pass:=case when attempt_record.verification_method='portfolio_photo_liveness'
    then p_passive_liveness_verified and p_face_match_verified
      and not p_id_verified and not p_name_matches and not p_birth_date_matches
    else p_id_verified and p_passive_liveness_verified and p_face_match_verified
      and p_name_matches and p_birth_date_matches end;
  if p_outcome='verified' and not v_checks_pass then
    raise exception 'verified identity outcome requires the configured checks' using errcode='23514';
  end if;
  if attempt_record.status in ('redacted','revoked') then
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

create function app_private.complete_identity_verification_provider_recovery(
  p_attempt_id uuid,p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state_record app_private.identity_verification_worker_state%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  select * into state_record from app_private.identity_verification_worker_state state
  where state.attempt_id=p_attempt_id and state.task_type='provider_recovery'
    and state.claim_token=p_claim_token and state.lease_expires_at>pg_catalog.now()
    and state.completed_at is null for update;
  if state_record.subject_id is null then return false; end if;
  -- A recovery job only survives when the provider create did not attach to the
  -- local attempt. Once any orphan provider session has been removed (or the
  -- bounded lookup confirms none exists), close the local attempt so the
  -- management link can start a fresh, uniquely correlated retry.
  update app_private.identity_verification_attempts set
    status='failed',completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
  where id=p_attempt_id and subject_id=state_record.subject_id and status='created'
    and provider_session_ref is null;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=state_record.subject_id and task_type='provider_recovery';
  return true;
end;
$$;

create function public.complete_identity_verification_provider_recovery(
  p_attempt_id uuid,p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  return app_private.complete_identity_verification_provider_recovery(p_attempt_id,p_claim_token);
end;
$$;

create or replace function app_private.current_identity_verification(p_candidate_id uuid)
returns setof app_private.identity_verification_subjects
language sql stable security definer set search_path = '' as $$
  select subject_record from app_private.identity_verification_subjects subject_record
  where subject_record.candidate_id=p_candidate_id and subject_record.subject_type='candidate'
    and subject_record.status='verified' and subject_record.verified_at<=pg_catalog.now()
    and subject_record.expires_at>pg_catalog.now() and subject_record.revoked_at is null
    and subject_record.current_proof_method='portfolio_photo_liveness'
    and subject_record.current_proof_sha256 is not null
    and exists (
      select 1 from public.portfolio_media media
      where media.id=subject_record.current_proof_media_id
        and media.portfolio_id=subject_record.current_proof_portfolio_id
        and media.candidate_id=subject_record.candidate_id and media.media_type='hero'
    )
$$;

-- Original portfolio objects use UUID paths and are immutable through ordinary
-- authenticated Storage calls. Active attempt references also cannot be
-- deleted. The application deletes the media row first; that transaction
-- invalidates the attempt/proof, after which normal Storage cleanup is allowed.
create function public.is_current_identity_reference_storage_object(
  p_bucket_id text,p_name text
)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket_id='photos'
    and (storage.foldername(p_name))[1]=auth.uid()::text
    and exists (
    select 1 from app_private.identity_verification_attempts attempt
    where attempt.verification_method='portfolio_photo_liveness'
      and attempt.reference_storage_path=p_name
      and (
        attempt.status in ('created','invited','in_progress')
        or exists (
          select 1 from app_private.identity_verification_subjects subject_record
          where subject_record.current_proof_attempt_id=attempt.id
            and subject_record.subject_type='candidate' and subject_record.status='verified'
            and subject_record.verified_at<=pg_catalog.now()
            and subject_record.expires_at>pg_catalog.now() and subject_record.revoked_at is null
            and subject_record.current_proof_method='portfolio_photo_liveness'
        )
      )
  )
$$;

revoke all on function public.is_current_identity_reference_storage_object(text,text)
  from public,anon;
grant execute on function public.is_current_identity_reference_storage_object(text,text)
  to authenticated;

drop policy if exists "Users can update own photos" on storage.objects;
-- No replacement update policy: originals are uploaded once to unique paths.
-- Metadata changes happen in public.portfolio_media, never by overwriting bytes.

drop policy if exists "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id='photos'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
    and not public.is_current_identity_reference_storage_object(bucket_id,name)
  );

create function app_private.invalidate_candidate_photo_verification()
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
  where portfolio_id=v_portfolio_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create trigger invalidate_candidate_photo_verification_after_delete
after delete on public.portfolio_media
for each row when (old.media_type='hero')
execute function app_private.invalidate_candidate_photo_verification();

create trigger invalidate_candidate_photo_verification_after_update
after update of storage_path,media_type on public.portfolio_media
for each row when (old.media_type='hero' and (old.storage_path is distinct from new.storage_path or new.media_type<>'hero'))
execute function app_private.invalidate_candidate_photo_verification();

create or replace function public.resolve_public_portfolio_identity_verified(p_share_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.public_portfolio_snapshots snapshot
    join public.portfolios portfolio on portfolio.id=snapshot.portfolio_id
    where p_share_token is not null and pg_catalog.length(p_share_token) between 8 and 160
      and p_share_token~'^[A-Za-z0-9_-]+$' and snapshot.share_token=p_share_token
      and snapshot.is_active=true and (snapshot.expires_at is null or snapshot.expires_at>pg_catalog.now())
      and portfolio.share_token=snapshot.share_token and portfolio.is_published=true
      and (portfolio.expires_at is null or portfolio.expires_at>pg_catalog.now())
      and exists(select 1 from app_private.current_identity_verification(portfolio.candidate_id))
  )
$$;

revoke all on function app_private.enqueue_identity_verification_work(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function app_private.current_identity_verification(uuid) from public,anon,authenticated;
revoke all on function app_private.invalidate_candidate_photo_verification() from public,anon,authenticated;
revoke all on function app_private.defer_identity_verification_work(uuid,text,uuid,text,integer) from public,anon,authenticated;
revoke all on function app_private.record_identity_verification_webhook(text,text,uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.claim_identity_verification_work(integer) from public,anon,authenticated;
revoke all on function app_private.complete_identity_verification_reconciliation(uuid,uuid,text,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function app_private.complete_identity_verification_provider_recovery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_identity_verification_webhook(text,text,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_identity_verification_webhook(text,text,uuid,text,uuid,uuid) to service_role;
revoke all on function public.record_identity_verification_webhook(text,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.record_identity_verification_webhook(text,text,uuid,text,uuid) to service_role;
revoke all on function public.complete_identity_verification_provider_recovery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_identity_verification_provider_recovery(uuid,uuid) to service_role;
revoke all on function public.begin_candidate_photo_verification(uuid,text,text) from public,anon,authenticated;
grant execute on function public.begin_candidate_photo_verification(uuid,text,text) to anon,authenticated;
revoke all on function public.register_candidate_photo_provider_create(uuid,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.register_candidate_photo_provider_create(uuid,text,uuid,integer) to anon,authenticated;
revoke all on function public.attach_candidate_photo_provider_session(uuid,text,text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.attach_candidate_photo_provider_session(uuid,text,text,text,uuid,integer) to anon,authenticated;
revoke all on function public.retry_candidate_photo_verification(text,text) from public,anon,authenticated;
grant execute on function public.retry_candidate_photo_verification(text,text) to anon,authenticated;
revoke all on function public.claim_identity_verification_work(integer) from public,anon,authenticated;
grant execute on function public.claim_identity_verification_work(integer) to service_role;
revoke all on function public.defer_identity_verification_work(uuid,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.defer_identity_verification_work(uuid,text,uuid,text,integer) to service_role;
revoke all on function public.resolve_public_portfolio_identity_verified(text) from public;
grant execute on function public.resolve_public_portfolio_identity_verified(text) to anon,authenticated;

comment on function public.begin_candidate_photo_verification(uuid,text,text) is
  'Pins candidate verification to the current primary portfolio photo before any biometric provider request.';
comment on function app_private.current_identity_verification(uuid) is
  'Returns a current candidate verification only while its exact primary-photo proof remains bound and active.';

-- Pilot creators may exercise the complete publication flow without billing.
-- This is entitlement-scoped rather than a public payment bypass, and it does
-- not manufacture payment records that could be mistaken for future billing.
create or replace function app_private.owner_publication_readiness()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
  missing text[];
  verified boolean:=false;
  pilot_publication_enabled boolean:=false;
  disclosure_current boolean:=false;
begin
  select portfolio.* into portfolio_record from public.portfolios portfolio
  where portfolio.user_id=auth.uid() limit 1;
  if portfolio_record.id is null then
    return '{"portfolioExists":false,"lastEditorSection":null,"previewedAt":null,"selectedPlanCode":null,"verificationStatus":"required","paymentStatus":"none","paymentExpiresAt":null,"paymentActive":false,"disclosureConfirmed":false,"published":false,"missingRequired":[]}'::jsonb;
  end if;
  select progress.* into progress_record from app_private.portfolio_publication_progress progress
  where progress.portfolio_id=portfolio_record.id;
  missing:=app_private.portfolio_missing_required_details(portfolio_record.id,portfolio_record.draft_data);
  verified:=exists(select 1 from app_private.current_identity_verification(portfolio_record.candidate_id));
  pilot_publication_enabled:=app_private.actor_can_create_portfolio(auth.uid());
  disclosure_current:=progress_record.disclosure_confirmed_at is not null
    and progress_record.disclosure_fingerprint=app_private.portfolio_draft_fingerprint(portfolio_record.draft_data);
  return pg_catalog.jsonb_build_object(
    'portfolioExists',true,'lastEditorSection',progress_record.last_editor_section,
    'previewedAt',progress_record.previewed_at,'selectedPlanCode',progress_record.selected_plan_code,
    'verificationStatus',case when verified then 'verified' else 'required' end,
    'paymentStatus',coalesce(progress_record.payment_status,'none'),
    'paymentExpiresAt',progress_record.payment_expires_at,'paymentActive',pilot_publication_enabled,
    'disclosureConfirmed',disclosure_current,'published',portfolio_record.is_published,
    'missingRequired',to_jsonb(missing)
  );
end;
$$;

create or replace function public.update_portfolio_onboarding_progress(p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
begin
  perform app_private.require_current_session();
  if not app_private.actor_can_create_portfolio(auth.uid()) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  select portfolio.* into portfolio_record from public.portfolios portfolio
  where portfolio.user_id=auth.uid() for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  insert into app_private.portfolio_publication_progress(portfolio_id)
  values(portfolio_record.id) on conflict(portfolio_id) do nothing;
  if p_action='editor_section' then
    if p_value not in ('privacy','foundation','story','work','family','astrology','lifestyle','preferences','future') then
      raise exception 'invalid editor section' using errcode='22023';
    end if;
    update app_private.portfolio_publication_progress set last_editor_section=p_value,updated_at=pg_catalog.now()
    where portfolio_id=portfolio_record.id;
  elsif p_action='previewed' then
    update app_private.portfolio_publication_progress set previewed_at=coalesce(previewed_at,pg_catalog.now()),
      updated_at=pg_catalog.now() where portfolio_id=portfolio_record.id;
  elsif p_action='select_plan' then
    raise exception 'plan selection is deferred during the private pilot' using errcode='22023';
  elsif p_action='confirm_disclosure' then
    if p_value<>'publication-disclosure-v1' then raise exception 'invalid disclosure version' using errcode='22023'; end if;
    if not exists(select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)) then
      return '{"status":"verification_required"}'::jsonb;
    end if;
    if pg_catalog.cardinality(app_private.portfolio_missing_required_details(portfolio_record.id,portfolio_record.draft_data))>0 then
      return '{"status":"content_required"}'::jsonb;
    end if;
    update app_private.portfolio_publication_progress set disclosure_version=p_value,
      disclosure_fingerprint=app_private.portfolio_draft_fingerprint(portfolio_record.draft_data),
      disclosure_confirmed_at=pg_catalog.now(),updated_at=pg_catalog.now()
    where portfolio_id=portfolio_record.id;
  else
    raise exception 'invalid onboarding action' using errcode='22023';
  end if;
  return pg_catalog.jsonb_build_object('status','ok','readiness',app_private.owner_publication_readiness());
end;
$$;

create or replace function app_private.enforce_paid_disclosed_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare progress_record app_private.portfolio_publication_progress%rowtype;
begin
  if new.is_published=true and (
    tg_op='INSERT' or old.is_published is distinct from true
    or old.published_data is distinct from new.published_data
  ) then
    if not app_private.actor_can_create_portfolio(new.user_id) then
      raise exception 'publication_creator_entitlement_required' using errcode='23514';
    end if;
    if pg_catalog.cardinality(app_private.portfolio_missing_required_details(new.id,new.draft_data))>0 then
      raise exception 'publication_content_required' using errcode='23514';
    end if;
    if not exists(select 1 from app_private.current_identity_verification(new.candidate_id)) then
      raise exception 'publication_verification_required' using errcode='23514';
    end if;
    select progress.* into progress_record from app_private.portfolio_publication_progress progress
    where progress.portfolio_id=new.id;
    if progress_record.disclosure_confirmed_at is null
      or progress_record.disclosure_version<>'publication-disclosure-v1'
      or progress_record.disclosure_fingerprint<>app_private.portfolio_draft_fingerprint(new.draft_data) then
      raise exception 'publication_disclosure_required' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function app_private.owner_publication_readiness() is
  'Pilot publication readiness. Active creator entitlement temporarily satisfies the billing gate without creating payment data.';
