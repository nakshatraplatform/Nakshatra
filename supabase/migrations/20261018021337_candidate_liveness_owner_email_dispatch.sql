-- Reuse one leased outbox for scheduled and owner-triggered delivery.
create function app_private.claim_candidate_liveness_email_batch(p_limit integer, p_attempt_id uuid default null)
returns table(delivery_id uuid,claim_token uuid,recipient_email text)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_identity_verification_worker();
  if p_limit is null or p_limit not between 1 and 10 then raise exception 'invalid email batch' using errcode='22023'; end if;
  -- Never retry an uncertain external send beyond Resend's 24-hour window.
  update app_private.candidate_liveness_email_outbox set status='failed',last_error_code='EMAIL_RETRY_WINDOW_EXPIRED',updated_at=now()
  where (p_attempt_id is null or attempt_id=p_attempt_id) and status in ('queued','processing') and (lease_expires_at is null or lease_expires_at<=now())
    and (attempts>=5 or first_attempt_at<=now()-interval '23 hours');
  update app_private.candidate_liveness_email_outbox e set status='skipped',updated_at=now()
  where (p_attempt_id is null or e.attempt_id=p_attempt_id) and e.status in ('queued','processing') and (e.lease_expires_at is null or e.lease_expires_at<=now())
    and not exists(select 1 from app_private.identity_verification_subjects s
      join public.candidates c on c.id=s.candidate_id
      join auth.users u on u.id=c.primary_owner_user_id
      where s.candidate_id=e.candidate_id and s.current_proof_attempt_id=e.attempt_id
        and exists(select 1 from app_private.current_identity_verification(e.candidate_id))
        and c.primary_owner_user_id=e.recipient_user_id and u.email=e.recipient_email
        and u.email_confirmed_at is not null);
  return query with selected as (
    select e.id from app_private.candidate_liveness_email_outbox e
    where (p_attempt_id is null or e.attempt_id=p_attempt_id) and e.run_after<=now() and e.attempts<5
      and (e.first_attempt_at is null or e.first_attempt_at>now()-interval '23 hours')
      and (e.status='queued' or (e.status='processing' and e.lease_expires_at<=now()))
    order by e.run_after,e.id for update skip locked limit p_limit
  ) update app_private.candidate_liveness_email_outbox e
    set status='processing',attempts=e.attempts+1,claim_token=gen_random_uuid(),
      first_attempt_at=coalesce(e.first_attempt_at,now()),lease_expires_at=now()+interval '5 minutes',updated_at=now()
    from selected where e.id=selected.id returning e.id,e.claim_token,e.recipient_email;
end; $$;


revoke all on function app_private.claim_candidate_liveness_email_batch(integer,uuid) from public,anon,authenticated,service_role;

-- Preserve the existing scheduled worker API and its batch limits.
create or replace function public.claim_candidate_liveness_emails(p_limit integer default 5)
returns table(delivery_id uuid,claim_token uuid,recipient_email text)
language sql security definer set search_path='' as $$
  select * from app_private.claim_candidate_liveness_email_batch(p_limit,null);
$$;

-- Only a trusted server may request one currently verified owner's email.
-- The browser cannot select another recipient, reset retries or claim a batch.
create function public.claim_owner_candidate_liveness_email(
  p_candidate_id uuid,p_attempt_id uuid,p_owner_user_id uuid,p_owner_session_id uuid
) returns table(delivery_id uuid,claim_token uuid,recipient_email text)
language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_identity_verification_worker();
  perform 1 from public.candidates c where c.id=p_candidate_id
    and c.primary_owner_user_id=p_owner_user_id for share;
  if not found or not exists(select 1 from auth.sessions ses
    where ses.id=p_owner_session_id and ses.user_id=p_owner_user_id
      and (ses.not_after is null or ses.not_after>now())) then
    raise exception 'email access unavailable' using errcode='42501';
  end if;
  if not exists(select 1 from app_private.identity_verification_subjects s
    where s.candidate_id=p_candidate_id and s.status='verified'
      and s.current_proof_method='candidate_liveness_only'
      and s.current_proof_attempt_id=p_attempt_id
      and exists(select 1 from app_private.current_identity_verification(p_candidate_id))) then
    return;
  end if;
  return query select * from app_private.claim_candidate_liveness_email_batch(1,p_attempt_id);
end; $$;
revoke all on function public.claim_owner_candidate_liveness_email(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_owner_candidate_liveness_email(uuid,uuid,uuid,uuid) to service_role;
