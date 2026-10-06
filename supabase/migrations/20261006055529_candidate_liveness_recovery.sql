-- Candidate recovery is owner/session authorized. Hosted URLs remain provider-owned.
alter table app_private.identity_verification_attempts
  add column resume_deadline timestamptz,
  add column recovery_sequence bigint generated always as identity,
  add column recovery_reason text,
  add column provider_cleanup_outcome text check (provider_cleanup_outcome in ('deleted','absent'));

create function app_private.set_candidate_liveness_deadline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.verification_method='candidate_liveness_only' then
    new.resume_deadline:=new.created_at+interval '30 minutes';
  end if;
  return new;
end; $$;
revoke all on function app_private.set_candidate_liveness_deadline() from public,anon,authenticated,service_role;
create trigger candidate_liveness_deadline before insert on app_private.identity_verification_attempts
for each row execute function app_private.set_candidate_liveness_deadline();
update app_private.identity_verification_attempts set resume_deadline=created_at+interval '30 minutes'
where verification_method='candidate_liveness_only' and status in ('created','invited','in_progress');
create index candidate_liveness_deadline_work on app_private.identity_verification_attempts(resume_deadline)
where verification_method='candidate_liveness_only' and status in ('created','invited','in_progress');

-- Match begin's candidate -> subject -> attempt order before taking worker locks.
create function app_private.lock_candidate_liveness_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype;
begin
  select * into a from app_private.identity_verification_attempts where id=p_attempt_id;
  if a.verification_method='candidate_liveness_only' then
    perform 1 from public.candidates where id=a.candidate_id for update;
    perform 1 from app_private.identity_verification_subjects where id=a.subject_id for update;
    perform 1 from app_private.identity_verification_attempts where id=p_attempt_id for update;
  end if;
end; $$;
revoke all on function app_private.lock_candidate_liveness_attempt(uuid) from public,anon,authenticated,service_role;

create function app_private.end_candidate_liveness_attempt(p_attempt_id uuid,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype;
begin
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  select * into a from app_private.identity_verification_attempts where id=p_attempt_id;
  if a.verification_method<>'candidate_liveness_only' or a.status not in ('created','invited','in_progress') then return; end if;
  update app_private.identity_verification_attempts set
    status=case when p_reason='cancelled' then 'revoked' else 'expired' end,
    recovery_reason=p_reason,completed_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=p_attempt_id;
  update app_private.identity_verification_worker_state set completed_at=clock_timestamp(),claim_token=null,
    claimed_at=null,lease_expires_at=null where attempt_id=p_attempt_id and task_type='reconcile';
  if a.provider_session_ref is not null then
    perform app_private.enqueue_identity_verification_work(a.subject_id,a.id,'provider_redaction');
  elsif a.provider_create_registered_at is not null then
    perform app_private.enqueue_identity_verification_work(a.subject_id,a.id,'provider_recovery');
  end if;
end; $$;
revoke all on function app_private.end_candidate_liveness_attempt(uuid,text) from public,anon,authenticated,service_role;

create function public.get_current_candidate_liveness_verification(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype; s app_private.identity_verification_subjects%rowtype;
  v_state text; v_cleanup boolean; v_now timestamptz:=clock_timestamp();
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
  return jsonb_build_object('state',v_state,'attemptId',a.id,'deadline',a.resume_deadline,
    'cleanupPending',v_cleanup,
    'canStart',v_state in ('not_started','failed','declined','expired','cancelled') and not v_cleanup
      and (a.id is null or a.status not in ('created','invited','in_progress')),
    'canResume',v_state='active' and not v_cleanup,
    'canCancel',coalesce(a.verification_method='candidate_liveness_only' and a.status in ('created','invited','in_progress'),false),
    'providerSessionRef',a.provider_session_ref,'workflowId',a.provider_workflow_id,
    'workflowVersion',a.provider_workflow_version,'vendorData',a.provider_vendor_data);
end; $$;

create function public.cancel_candidate_liveness_verification(p_candidate_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype;
begin
  perform app_private.require_current_session();
  perform app_private.require_candidate_liveness_owner(p_candidate_id);
  perform 1 from public.candidates where id=p_candidate_id for update;
  perform 1 from app_private.identity_verification_subjects where candidate_id=p_candidate_id for update;
  select * into a from app_private.identity_verification_attempts where candidate_id=p_candidate_id
    order by created_at desc,recovery_sequence desc limit 1 for update;
  if a.id is distinct from p_attempt_id or a.verification_method<>'candidate_liveness_only' then
    raise exception 'verification state changed' using errcode='IV002';
  end if;
  if a.status='revoked' and a.recovery_reason='cancelled' then
    return public.get_current_candidate_liveness_verification(p_candidate_id);
  end if;
  if a.status not in ('created','invited','in_progress') then raise exception 'verification state changed' using errcode='IV002'; end if;
  perform app_private.end_candidate_liveness_attempt(a.id,'cancelled');
  return public.get_current_candidate_liveness_verification(p_candidate_id);
end; $$;

create function public.request_candidate_liveness_reconciliation(p_candidate_id uuid,p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype; snapshot jsonb;
begin
  perform app_private.require_current_session();
  perform app_private.require_candidate_liveness_owner(p_candidate_id);
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  snapshot:=public.get_current_candidate_liveness_verification(p_candidate_id);
  if snapshot->>'attemptId' is distinct from p_attempt_id::text then raise exception 'verification state changed' using errcode='IV002'; end if;
  select * into a from app_private.identity_verification_attempts where id=p_attempt_id;
  if a.verification_method<>'candidate_liveness_only' or a.status<>'in_progress'
    or a.resume_deadline+interval '5 minutes'<=clock_timestamp() then raise exception 'verification state changed' using errcode='IV002'; end if;
  update app_private.identity_verification_attempts set recovery_reason='awaiting_result' where id=a.id;
  perform app_private.enqueue_identity_verification_work(a.subject_id,a.id,'reconcile');
end; $$;

create function public.expire_candidate_liveness_attempts(p_limit integer default 10)
returns integer language plpgsql security definer set search_path = '' as $$
declare a record; n integer:=0;
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid expiry bound' using errcode='22023'; end if;
  for a in select attempt.id,attempt.candidate_id from app_private.identity_verification_attempts attempt
    where attempt.verification_method='candidate_liveness_only' and attempt.status in ('created','invited','in_progress')
      and attempt.resume_deadline+interval '5 minutes'<=clock_timestamp()
    order by attempt.resume_deadline limit p_limit
  loop
    -- Skip contention rather than reversing the foreground lock order.
    perform 1 from public.candidates where id=a.candidate_id for update skip locked;
    if not found then continue; end if;
    perform app_private.end_candidate_liveness_attempt(a.id,'expired'); n:=n+1;
  end loop;
  return n;
end; $$;

revoke all on function public.get_current_candidate_liveness_verification(uuid),
  public.cancel_candidate_liveness_verification(uuid,uuid),
  public.request_candidate_liveness_reconciliation(uuid,uuid),public.expire_candidate_liveness_attempts(integer)
from public,anon,authenticated,service_role;
grant execute on function public.get_current_candidate_liveness_verification(uuid),
  public.cancel_candidate_liveness_verification(uuid,uuid),public.request_candidate_liveness_reconciliation(uuid,uuid) to authenticated;
grant execute on function public.expire_candidate_liveness_attempts(integer) to service_role;

-- A 404 establishes absence, not affirmative biometric-purge confirmation.
create function public.complete_identity_verification_provider_absence(p_attempt_id uuid,p_claim_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a app_private.identity_verification_attempts%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  select * into a from app_private.identity_verification_attempts where id=p_attempt_id;
  if a.provider_session_ref is null then return false; end if;
  if not public.complete_identity_verification_provider_redaction(p_attempt_id,p_claim_token) then return false; end if;
  update app_private.identity_verification_attempts set provider_cleanup_outcome='absent',
    provider_redacted_at=a.provider_redacted_at where id=p_attempt_id;
  return true;
end; $$;
revoke all on function public.complete_identity_verification_provider_absence(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.complete_identity_verification_provider_absence(uuid,uuid) to service_role;

do $$ declare a record; begin
  for a in select id from app_private.identity_verification_attempts
    where verification_method='candidate_liveness_only' and status in ('created','invited','in_progress')
      and resume_deadline+interval '5 minutes'<=clock_timestamp()
  loop perform app_private.end_candidate_liveness_attempt(a.id,'expired'); end loop;
end; $$;

create or replace function public.consume_api_rate_limit(p_action text, p_subject_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare action_limit integer; window_seconds integer; effective_subject text;
  limit_record app_private.api_rate_limits%rowtype; v_now timestamptz:=pg_catalog.now();
begin
  select configured.limit_value,configured.window_value into action_limit,window_seconds from (values
    ('auth_google',10,900),('auth_email',5,900),('interest_submit',5,3600),('interest_decision',30,60),
    ('grant_manage',30,60),('dashboard_save',30,300),('photo_upload',12,3600),('photo_mutation',30,300),
    ('horoscope_upload',6,3600),('horoscope_delete',10,300),('portfolio_publish',6,3600),
    ('portfolio_renew',6,3600),('portfolio_rotate',6,3600),('portfolio_unpublish',6,3600),
    ('horoscope_view',30,300),('location_search',120,60),('account_export',3,3600),
    ('account_delete',3,86400),('account_delete_reauth',3,3600),('session_manage',10,3600),
    ('candidate_liveness_create',5,3600),('candidate_liveness_interaction',30,60),('identity_verification_invitation',5,3600),('identity_verification_start',5,3600),
    ('identity_verification_status',30,300),('identity_verification_retry',5,3600),
    ('pilot_access_submit',5,86400),('pilot_access_review',60,300),
    ('brokerdesk_bootstrap',60,60),('brokerdesk_workspace_create',3,3600),
    ('brokerdesk_onboarding_read',60,60),('brokerdesk_onboarding_write',30,300),
    ('brokerdesk_privileged_reauth',5,3600),('brokerdesk_mfa_complete',10,900),
    ('brokerdesk_team_read',60,60),('brokerdesk_team_invite',20,3600),
    ('brokerdesk_team_invitation_exchange',20,3600),('brokerdesk_team_invitation_accept',10,3600),
    ('brokerdesk_customer_read',60,60),('brokerdesk_customer_invite',100,3600),
    ('brokerdesk_customer_invitation_exchange',20,3600),('brokerdesk_customer_invitation_claim',10,3600),
    ('customer_broker_relationships_read',60,60),('customer_broker_relationship_manage',10,3600),
    ('brokerdesk_introduction_create',30,3600),('brokerdesk_introduction_read',120,60),
    ('brokerdesk_introduction_update',60,300),('broker_introduction_claim',10,3600),
    ('broker_introduction_read',120,60),('broker_introduction_respond',10,3600)
  ) as configured(action_name,limit_value,window_value) where configured.action_name=p_action;
  if action_limit is null then raise exception 'unsupported rate limit action' using errcode='22023'; end if;
  if auth.uid() is not null then effective_subject:='user:'||auth.uid()::text;
  elsif p_subject_hash is not null and p_subject_hash~'^[a-f0-9]{64}$' then effective_subject:='anonymous:'||p_subject_hash;
  else return '{"allowed":false,"retryAfter":60}'::jsonb; end if;
  insert into app_private.api_rate_limits(action,subject_key,window_started_at,request_count,updated_at)
  values(p_action,effective_subject,v_now,1,v_now)
  on conflict(action,subject_key) do update set
    window_started_at=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then v_now else app_private.api_rate_limits.window_started_at end,
    request_count=case when app_private.api_rate_limits.window_started_at<=v_now-pg_catalog.make_interval(secs=>window_seconds) then 1 else app_private.api_rate_limits.request_count+1 end,
    updated_at=v_now returning * into limit_record;
  return pg_catalog.jsonb_build_object('allowed',limit_record.request_count<=action_limit,'retryAfter',
    case when limit_record.request_count<=action_limit then 0 else greatest(1,pg_catalog.ceil(extract(epoch from(
      limit_record.window_started_at+pg_catalog.make_interval(secs=>window_seconds)-v_now)))::integer) end);
end; $$;

create or replace function public.begin_candidate_liveness_verification(
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
  if exists(select 1 from app_private.current_identity_verification(p_candidate_id)) then
    raise exception 'verification already complete' using errcode='IV002';
  end if;
  selected_candidate_id:=p_candidate_id;
  select * into subject_record from app_private.identity_verification_subjects subject
  where subject.candidate_id=selected_candidate_id and subject.subject_type='candidate' for update;
  if subject_record.id is null then raise exception 'identity verification subject is missing' using errcode='23503'; end if;
  if app_private.candidate_verification_cleanup_pending(subject_record.id)
    or exists(select 1 from app_private.identity_verification_attempts
      where subject_id=subject_record.id and verification_method<>'candidate_liveness_only'
        and status in ('created','invited','in_progress') and provider_create_registered_at is not null) then
    raise exception 'previous verification cleanup is pending' using errcode='IV002';
  end if;
  -- Fresh explicit consent permits a new check after prior withdrawal.
  update app_private.identity_verification_subjects set status='pending',revoked_at=null,revocation_reason=null
  where id=subject_record.id and status='revoked';
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.subject_id=subject_record.id
    and attempt.verification_method='candidate_liveness_only'
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
      'candidate_liveness_only',
      '2026-10-05-liveness-only',pg_catalog.now(),
      'Check that a live person is present for this candidate session.',
      'Didit processes your live camera capture for liveness only. No identity document or portfolio-photo comparison is requested.',
      'VivIntro retains consent and normalized check results, not camera evidence. Provider evidence is scheduled for deletion.',
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
create or replace function public.register_candidate_liveness_provider_create(
  p_attempt_id uuid,p_management_token_hash text,p_workflow_id uuid,p_workflow_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  attempt_record app_private.identity_verification_attempts%rowtype;
  management_record app_private.identity_verification_management_tokens%rowtype;
  v_vendor_data text; quota jsonb;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_management_token_hash is null or p_management_token_hash !~ '^[a-f0-9]{64}$' or p_workflow_id is null or (p_workflow_version is not null and p_workflow_version<1) then
    raise exception 'verification provider configuration is invalid' using errcode='IV003';
  end if;
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if attempt_record.verification_method='candidate_liveness_ip' and p_workflow_version is null then
    raise exception 'verification provider configuration is invalid' using errcode='IV003';
  end if;
  if attempt_record.id is null or attempt_record.verification_method not in ('candidate_liveness_ip','candidate_liveness_only')
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
  if attempt_record.verification_method='candidate_liveness_only' then
    if attempt_record.resume_deadline<=clock_timestamp() then raise exception 'verification expired' using errcode='IV002'; end if;
    quota:=public.consume_api_rate_limit('candidate_liveness_create',null);
    if (quota->>'allowed')::boolean is not true then
      raise exception 'creation rate limited' using errcode='IV004',detail=quota->>'retryAfter';
    end if;
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
create or replace function public.attach_candidate_liveness_provider_session(
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
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  select * into attempt_record from app_private.identity_verification_attempts where id=p_attempt_id for update;
  if (attempt_record.verification_method='candidate_liveness_only' and attempt_record.resume_deadline<=clock_timestamp()) or attempt_record.id is null or attempt_record.verification_method not in ('candidate_liveness_ip','candidate_liveness_only')
    or attempt_record.status<>'created' or attempt_record.provider_session_ref is not null
    or attempt_record.provider_workflow_id is distinct from p_workflow_id
    or attempt_record.provider_create_registered_at is null
    or (attempt_record.provider_workflow_version is not null
      and attempt_record.provider_workflow_version is distinct from p_workflow_version) then
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
    provider_workflow_version=p_workflow_version,
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
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  select * into state_record from app_private.identity_verification_worker_state state
  where state.attempt_id=p_attempt_id and state.task_type='reconcile' and state.claim_token=p_claim_token
    and state.lease_expires_at>pg_catalog.now() and state.completed_at is null for update;
  if state_record.subject_id is null then return false; end if;
  select * into attempt_record from app_private.identity_verification_attempts attempt
  where attempt.id=p_attempt_id and attempt.subject_id=state_record.subject_id for update;
  if attempt_record.id is null then return false; end if;
  select * into subject_record from app_private.identity_verification_subjects subject
  where subject.id=state_record.subject_id for update;
  if attempt_record.verification_method='candidate_liveness_only' then
    if attempt_record.status not in ('created','invited','in_progress') then return false; end if;
    if attempt_record.resume_deadline+interval '5 minutes'<=clock_timestamp() then
      perform app_private.end_candidate_liveness_attempt(p_attempt_id,'expired'); return true;
    end if;
    if p_outcome='pending' and attempt_record.resume_deadline<=clock_timestamp() then p_outcome:='expired'; end if;
  end if;
  v_checks_pass:=case when attempt_record.verification_method='candidate_liveness_only' then
      subject_record.subject_type='candidate' and p_passive_liveness_verified and not p_ip_verified
      and not p_id_verified and not p_face_match_verified and not p_name_matches and not p_birth_date_matches
      and attempt_record.provider_workflow_id is not null and attempt_record.provider_workflow_version>0
    when attempt_record.verification_method='candidate_liveness_ip' then
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
    update app_private.identity_verification_worker_state set run_after=case when attempt_record.verification_method='candidate_liveness_only'
      then least(clock_timestamp()+interval '5 minutes',attempt_record.resume_deadline)
      else pg_catalog.now()+interval '5 minutes' end,
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
 create or replace function app_private.claim_identity_verification_work(p_limit integer)
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
     order by case when state.task_type='reconcile' and exists(select 1 from app_private.identity_verification_attempts deadline_attempt where deadline_attempt.id=state.attempt_id and deadline_attempt.verification_method='candidate_liveness_only' and deadline_attempt.resume_deadline<=clock_timestamp()) then 0 else 1 end,state.run_after,state.subject_id,state.task_type for update skip locked limit p_limit
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
create or replace function app_private.complete_identity_verification_provider_redaction(
  p_attempt_id uuid,p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state_record app_private.identity_verification_worker_state%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
  select * into state_record from app_private.identity_verification_worker_state state
  where state.attempt_id=p_attempt_id and state.task_type='provider_redaction' and state.claim_token=p_claim_token
    and state.lease_expires_at>pg_catalog.now() and state.completed_at is null for update;
  if state_record.subject_id is null then return false; end if;
  update app_private.identity_verification_attempts set status=case when verification_method not in ('candidate_liveness_ip','candidate_liveness_only') and status in ('verified','declined','failed','expired') then 'redacted' else status end,
    provider_redacted_at=coalesce(provider_redacted_at,pg_catalog.now()),updated_at=pg_catalog.now() where id=p_attempt_id;
  if not found then return false; end if;
  update app_private.identity_verification_worker_state set completed_at=pg_catalog.now(),claim_token=null,
    claimed_at=null,lease_expires_at=null,last_error_code=null,updated_at=pg_catalog.now()
  where subject_id=state_record.subject_id and task_type='provider_redaction';
  return true;
end;
$$;
create or replace function app_private.complete_identity_verification_provider_recovery(
  p_attempt_id uuid,p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state_record app_private.identity_verification_worker_state%rowtype;
begin
  perform app_private.require_identity_verification_worker();
  perform app_private.lock_candidate_liveness_attempt(p_attempt_id);
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
create or replace function public.retry_candidate_liveness_verification(p_token_hash text,p_management_token_hash text)
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
  perform 1 from public.candidates where id=management_record.candidate_id for update;
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
  if previous_attempt.id is null or previous_attempt.verification_method not in ('candidate_liveness_ip','candidate_liveness_only')
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
    'candidate_liveness_only',
    '2026-10-05-liveness-only',pg_catalog.now(),
    'Check that a live person is present for this candidate session.',
    'Didit processes your live camera capture for liveness only. No identity document or portfolio-photo comparison is requested.',
    'VivIntro retains consent and normalized check results, not camera evidence. Provider evidence is scheduled for deletion.',
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
create or replace function public.withdraw_identity_verification_consent(p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  management_record app_private.identity_verification_management_tokens%rowtype;
  subject_record app_private.identity_verification_subjects%rowtype;
begin
  if auth.uid() is not null then perform app_private.require_current_session(); end if;
  if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'verification management is unavailable' using errcode='22023'; end if;
  select * into management_record from app_private.identity_verification_management_tokens where token_hash=p_token_hash;
  if management_record.id is null or management_record.scope<>'withdraw_consent' or management_record.consumed_at is not null or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then raise exception 'verification management is unavailable' using errcode='22023'; end if;
  perform app_private.lock_candidate_liveness_attempt(coalesce(management_record.attempt_id,(select a.id from app_private.identity_verification_attempts a where a.subject_id=management_record.subject_id and a.verification_method='candidate_liveness_only' order by a.created_at desc,a.recovery_sequence desc limit 1)));
  select * into management_record from app_private.identity_verification_management_tokens where token_hash=p_token_hash for update;
  if management_record.id is null or management_record.scope<>'withdraw_consent' or management_record.consumed_at is not null
    or management_record.revoked_at is not null or management_record.expires_at<=pg_catalog.now() then
    raise exception 'verification management is unavailable' using errcode='22023';
  end if;
  select * into subject_record from app_private.identity_verification_subjects where id=management_record.subject_id for update;
  update app_private.identity_verification_management_tokens set consumed_at=pg_catalog.now() where id=management_record.id;
  update app_private.identity_verification_attempts set status='revoked',consent_withdrawn_at=pg_catalog.now(),
    completed_at=coalesce(completed_at,pg_catalog.now()),updated_at=pg_catalog.now()
  where subject_id=management_record.subject_id and status in ('created','invited','in_progress','verified');
  update app_private.identity_verification_subjects set status='revoked',revoked_at=pg_catalog.now(),
    revocation_reason='consent withdrawn',expected_birth_date_hash=null,updated_at=pg_catalog.now()
  where id=management_record.subject_id;
  if subject_record.subject_type='organization_representative' then
    update app_private.organization_verification_checks set status='needs_attention',verified_at=null,expires_at=null,
      attention_reason='The representative withdrew identity-verification consent.',updated_at=pg_catalog.now()
    where organization_id=subject_record.organization_id and verification_type='representative_identity';
    update app_private.organization_onboarding_states set status='needs_attention',next_stage='verification',updated_at=pg_catalog.now()
    where organization_id=subject_record.organization_id and status<>'approved';
    insert into app_private.brokerdesk_audit_events(organization_id,actor_user_id,event_name,resource_type,outcome,safe_details)
    values(subject_record.organization_id,subject_record.subject_user_id,'representative.identity_verification_withdrawn',
      'organization_verification','succeeded','{}'::jsonb);
  end if;
end;
$$;
