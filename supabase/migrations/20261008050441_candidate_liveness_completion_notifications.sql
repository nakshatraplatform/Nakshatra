-- A proof and its notification become durable in the same transaction. No
-- camera evidence, hosted URLs or bearer management tokens enter this outbox.
create table app_private.candidate_liveness_email_outbox (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references app_private.identity_verification_attempts(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'queued' check(status in ('queued','processing','accepted','failed','skipped')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  claim_token uuid,
  lease_expires_at timestamptz,
  first_attempt_at timestamptz,
  run_after timestamptz not null default now(),
  provider_message_id uuid,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_private.candidate_liveness_email_outbox enable row level security;
revoke all on app_private.candidate_liveness_email_outbox from public,anon,authenticated,service_role;
create index candidate_liveness_email_due on app_private.candidate_liveness_email_outbox(run_after)
  where status in ('queued','processing');

-- Owner-requested result checks use the same worker lease and reconciliation
-- code as scheduled work. They cannot create a provider session or skip backoff.
create function public.claim_candidate_liveness_result(
  p_candidate_id uuid,p_attempt_id uuid,p_owner_user_id uuid,p_owner_session_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype;
  w app_private.identity_verification_worker_state%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  perform 1 from public.candidates c where c.id=p_candidate_id
    and c.primary_owner_user_id=p_owner_user_id for update;
  if not found or not exists(select 1 from auth.sessions ses
    where ses.id=p_owner_session_id and ses.user_id=p_owner_user_id) then
    raise exception 'result access unavailable' using errcode='42501'; end if;
  perform 1 from app_private.identity_verification_subjects where candidate_id=p_candidate_id for update;
  select * into a from app_private.identity_verification_attempts where candidate_id=p_candidate_id
    order by created_at desc,recovery_sequence desc limit 1 for update;
  if a.id is distinct from p_attempt_id or a.verification_method<>'candidate_liveness_only'
    or a.status<>'in_progress' or a.provider_session_ref is null then return null; end if;
  if a.resume_deadline+interval '5 minutes'<=clock_timestamp() then
    perform app_private.end_candidate_liveness_attempt(a.id,'expired'); return null; end if;
  select * into w from app_private.identity_verification_worker_state
    where attempt_id=a.id and task_type='reconcile' and completed_at is null
      and (attempts=0 or run_after<=now())
      and (lease_expires_at is null or lease_expires_at<=now()) for update skip locked;
  if not found then return null; end if;
  update app_private.identity_verification_worker_state set claim_token=gen_random_uuid(),
    claimed_at=now(),lease_expires_at=now()+interval '2 minutes',attempts=attempts+1,updated_at=now()
    where subject_id=w.subject_id and task_type='reconcile' returning * into w;
  return jsonb_build_object('subject_id',a.subject_id,'candidate_id',p_candidate_id,
    'subject_type','candidate','task_type','reconcile','claim_token',w.claim_token,
    'attempt_id',a.id,'provider_session_ref',a.provider_session_ref,
    'verification_method',a.verification_method,'provider_workflow_id',a.provider_workflow_id,
    'provider_workflow_version',a.provider_workflow_version,'provider_vendor_data',a.provider_vendor_data,
    'work_attempts',w.attempts);
end; $$;
revoke all on function public.claim_candidate_liveness_result(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_candidate_liveness_result(uuid,uuid,uuid,uuid) to service_role;

create function app_private.enqueue_candidate_liveness_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.subject_type='candidate' and new.status='verified'
    and new.current_proof_method='candidate_liveness_only'
    and new.current_proof_attempt_id is not null
    and (old.status is distinct from new.status
      or old.current_proof_attempt_id is distinct from new.current_proof_attempt_id) then
    insert into app_private.candidate_liveness_email_outbox(attempt_id,candidate_id,recipient_user_id,recipient_email)
    select new.current_proof_attempt_id,c.id,u.id,u.email
    from public.candidates c join auth.users u on u.id=c.primary_owner_user_id
    where c.id=new.candidate_id and u.email is not null and u.email_confirmed_at is not null
    on conflict(attempt_id) do nothing;
  end if;
  return new;
end; $$;
revoke all on function app_private.enqueue_candidate_liveness_email() from public,anon,authenticated,service_role;
create trigger enqueue_candidate_liveness_email after update on app_private.identity_verification_subjects
for each row execute function app_private.enqueue_candidate_liveness_email();

create function public.claim_candidate_liveness_emails(p_limit integer default 5)
returns table(delivery_id uuid,claim_token uuid,recipient_email text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 10 then raise exception 'invalid email batch' using errcode='22023'; end if;
  -- Never retry an uncertain external send beyond Resend's 24-hour window.
  update app_private.candidate_liveness_email_outbox set status='failed',last_error_code='EMAIL_RETRY_WINDOW_EXPIRED',updated_at=now()
  where status in ('queued','processing') and (lease_expires_at is null or lease_expires_at<=now())
    and (attempts>=5 or first_attempt_at<=now()-interval '23 hours');
  update app_private.candidate_liveness_email_outbox e set status='skipped',updated_at=now()
  where e.status in ('queued','processing') and (e.lease_expires_at is null or e.lease_expires_at<=now())
    and not exists(select 1 from app_private.identity_verification_subjects s
      join public.candidates c on c.id=s.candidate_id
      join auth.users u on u.id=c.primary_owner_user_id
      where s.candidate_id=e.candidate_id and s.current_proof_attempt_id=e.attempt_id
        and exists(select 1 from app_private.current_identity_verification(e.candidate_id))
        and c.primary_owner_user_id=e.recipient_user_id and u.email=e.recipient_email
        and u.email_confirmed_at is not null);
  return query with selected as (
    select e.id from app_private.candidate_liveness_email_outbox e
    where e.run_after<=now() and e.attempts<5
      and (e.first_attempt_at is null or e.first_attempt_at>now()-interval '23 hours')
      and (e.status='queued' or (e.status='processing' and e.lease_expires_at<=now()))
    order by e.run_after,e.id for update skip locked limit p_limit
  ) update app_private.candidate_liveness_email_outbox e
    set status='processing',attempts=e.attempts+1,claim_token=gen_random_uuid(),
      first_attempt_at=coalesce(e.first_attempt_at,now()),lease_expires_at=now()+interval '5 minutes',updated_at=now()
    from selected where e.id=selected.id returning e.id,e.claim_token,e.recipient_email;
end; $$;

create function public.complete_candidate_liveness_email(
  p_delivery_id uuid,p_claim_token uuid,p_provider_message_id uuid default null,
  p_error_code text default null,p_retryable boolean default false
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  perform app_private.require_identity_verification_worker();
  if p_retryable is null or (p_provider_message_id is null)=(p_error_code is null)
    or (p_provider_message_id is not null and p_retryable)
    or (p_error_code is not null and p_error_code!~'^[A-Z0-9_]{3,80}$') then
    raise exception 'invalid email completion' using errcode='22023'; end if;
  update app_private.candidate_liveness_email_outbox e set
    status=case when p_provider_message_id is not null then 'accepted'
      when p_retryable and e.attempts<5 and e.first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end,
    provider_message_id=p_provider_message_id,last_error_code=p_error_code,
    run_after=now()+interval '5 minutes'*greatest(e.attempts,1),
    claim_token=null,lease_expires_at=null,updated_at=now()
  where e.id=p_delivery_id and e.claim_token=p_claim_token and e.status='processing' and e.lease_expires_at>now();
  get diagnostics affected=row_count;
  return affected=1;
end; $$;
revoke all on function public.claim_candidate_liveness_emails(integer),
  public.complete_candidate_liveness_email(uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.claim_candidate_liveness_emails(integer),
  public.complete_candidate_liveness_email(uuid,uuid,uuid,text,boolean) to service_role;

-- Preserve the owner/session authorization and expose only actionable categories.
create or replace function public.get_current_candidate_liveness_verification(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype; s app_private.identity_verification_subjects%rowtype;
  v_state text; v_cleanup boolean; v_work app_private.identity_verification_worker_state%rowtype; v_email text; v_now timestamptz:=clock_timestamp();
begin
  perform app_private.require_current_session();
  perform app_private.require_candidate_liveness_owner(p_candidate_id);
  select * into s from app_private.identity_verification_subjects where candidate_id=p_candidate_id;
  select * into a from app_private.identity_verification_attempts where subject_id=s.id
  order by created_at desc,recovery_sequence desc limit 1;
  v_cleanup:=coalesce(app_private.candidate_verification_cleanup_pending(s.id),false);
  v_state:=case
    when exists(select 1 from app_private.current_identity_verification(p_candidate_id)) then 'verified'
    when v_cleanup and a.status not in ('created','invited','in_progress') then 'cleanup_pending'
    when a.id is null then 'not_started'
    when a.status in ('created','invited','in_progress') and a.resume_deadline<=v_now then
      case when a.resume_deadline+interval '5 minutes'<=v_now then 'expired' else 'awaiting_result' end
    when a.recovery_reason='awaiting_result' and a.status='in_progress' then 'awaiting_result'
    when a.status in ('created','invited') then 'creating'
    when a.status='in_progress' then 'active'
    when a.recovery_reason='cancelled' then 'cancelled'
    when a.status='revoked' then 'cancelled'
    when a.status='redacted' then 'failed'
    else a.status::text end;
  select * into v_work from app_private.identity_verification_worker_state
    where attempt_id=a.id and completed_at is null order by updated_at desc limit 1;
  select e.status into v_email from app_private.candidate_liveness_email_outbox e
    where e.attempt_id=s.current_proof_attempt_id;
  return jsonb_build_object('processingIssue',case
      when v_state='verified' then null
      when v_work.last_error_code like 'DIDIT_DECISION_%' then 'policy_error'
      when v_work.last_error_code is not null then 'retrying'
      when v_work.attempt_id is not null and v_work.run_after<v_now-interval '10 minutes' then 'delayed'
      else null end,
    'nextRetryAt',v_work.run_after,'emailStatus',v_email,'state',v_state,'attemptId',a.id,'deadline',a.resume_deadline,
    'cleanupPending',v_cleanup,
    'canStart',v_state in ('not_started','failed','declined','expired','cancelled') and not v_cleanup
      and (a.id is null or a.status not in ('created','invited','in_progress')),
    'canResume',v_state='active' and not v_cleanup,
    'canCancel',coalesce(a.verification_method='candidate_liveness_only' and a.status in ('created','invited','in_progress'),false),
    'providerSessionRef',a.provider_session_ref,'workflowId',a.provider_workflow_id,
    'workflowVersion',a.provider_workflow_version,'vendorData',a.provider_vendor_data);
end; $$;
