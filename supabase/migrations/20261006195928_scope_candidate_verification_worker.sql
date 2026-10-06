-- Filter before leasing: a candidate-only worker must not lock or consume
-- representative work. Preserve the existing all-subject RPC for compatibility.
create function app_private.claim_identity_verification_work(p_limit integer, p_subject_type text)
returns table(
  subject_id uuid,candidate_id uuid,subject_type text,task_type text,claim_token uuid,
  attempt_id uuid,provider_session_ref text,legal_name text,birth_date date,birth_date_hash text,
  verification_method text,provider_workflow_id uuid,provider_workflow_version integer,
  provider_vendor_data text,work_attempts integer
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'invalid work claim limit' using errcode='22023';
  end if;
  if p_subject_type is not null and p_subject_type <> 'candidate' then
    raise exception 'invalid work subject filter' using errcode='22023';
  end if;
  return query with eligible as (
    select state.subject_id,state.task_type
    from app_private.identity_verification_worker_state state
    where state.attempt_id is not null and state.completed_at is null
      and state.run_after<=pg_catalog.now()
      and (state.lease_expires_at is null or state.lease_expires_at<=pg_catalog.now())
      and (p_subject_type is null or exists (
        select 1 from app_private.identity_verification_subjects scoped_subject
        where scoped_subject.id=state.subject_id and scoped_subject.subject_type=p_subject_type
      ))
    order by case when state.task_type='reconcile' and exists (
      select 1 from app_private.identity_verification_attempts deadline_attempt
      where deadline_attempt.id=state.attempt_id
        and deadline_attempt.verification_method='candidate_liveness_only'
        and deadline_attempt.resume_deadline<=clock_timestamp()
    ) then 0 else 1 end,state.run_after,state.subject_id,state.task_type
    for update skip locked limit p_limit
  ), claimed as (
    update app_private.identity_verification_worker_state state
    set claim_token=extensions.gen_random_uuid(),claimed_at=pg_catalog.now(),
      lease_expires_at=pg_catalog.now()+interval '10 minutes',
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
revoke all on function app_private.claim_identity_verification_work(integer,text)
  from public,anon,authenticated,service_role;

create or replace function app_private.claim_identity_verification_work(p_limit integer)
returns table(
  subject_id uuid,candidate_id uuid,subject_type text,task_type text,claim_token uuid,
  attempt_id uuid,provider_session_ref text,legal_name text,birth_date date,birth_date_hash text,
  verification_method text,provider_workflow_id uuid,provider_workflow_version integer,
  provider_vendor_data text,work_attempts integer
)
language sql volatile security definer set search_path = '' as $$
  select * from app_private.claim_identity_verification_work(p_limit,null::text);
$$;

create function public.claim_candidate_identity_verification_work(p_limit integer default 10)
returns table(
  subject_id uuid,candidate_id uuid,subject_type text,task_type text,claim_token uuid,
  attempt_id uuid,provider_session_ref text,legal_name text,birth_date date,birth_date_hash text,
  verification_method text,provider_workflow_id uuid,provider_workflow_version integer,
  provider_vendor_data text,work_attempts integer
)
language sql volatile security definer set search_path = '' as $$
  select * from app_private.claim_identity_verification_work(p_limit,'candidate'::text);
$$;
revoke all on function public.claim_candidate_identity_verification_work(integer) from public,anon,authenticated;
grant execute on function public.claim_candidate_identity_verification_work(integer) to service_role;
