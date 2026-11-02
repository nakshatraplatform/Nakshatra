-- Accountless viewing proofs are deliberately separate from Auth sessions.
-- Install before the matching app. Existing contact approvals are not changed.
create table app_private.guest_portfolio_grant_recipients (
  grant_id uuid primary key references public.reveal_grants(id) on delete cascade,
  recipient_email text not null check(length(recipient_email) between 3 and 180),
  created_at timestamptz not null default now()
);
create table app_private.guest_portfolio_proofs (
  proof_hash text primary key check(proof_hash ~ '^[a-f0-9]{64}$'),
  interest_request_id uuid not null references public.interest_requests(id) on delete cascade,
  recipient_email text not null check(length(recipient_email) between 3 and 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 days',
  check(expires_at>created_at and expires_at<=created_at+interval '15 days')
);
create index guest_portfolio_proofs_expiry on app_private.guest_portfolio_proofs(expires_at);
create table app_private.guest_portfolio_access_challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  interest_request_id uuid not null references public.interest_requests(id) on delete cascade,
  recipient_email text not null check(length(recipient_email) between 3 and 180),
  code_digest text not null check(code_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '10 minutes',
  attempts integer not null default 0 check(attempts between 0 and 5),
  consumed_at timestamptz,
  check(expires_at>created_at and expires_at<=created_at+interval '10 minutes')
);
alter table app_private.guest_portfolio_grant_recipients enable row level security;
alter table app_private.guest_portfolio_proofs enable row level security;
alter table app_private.guest_portfolio_access_challenges enable row level security;
revoke all on app_private.guest_portfolio_grant_recipients,app_private.guest_portfolio_proofs,
  app_private.guest_portfolio_access_challenges from public,anon,authenticated,service_role;

-- The existing durable queue also carries approval notifications containing
-- only a grant reference, original link and expiry, never portfolio contents.
do $$ declare c record; begin
  for c in select conname from pg_catalog.pg_constraint
    where conrelid='app_private.guest_interest_mail_outbox'::regclass
      and contype='c' and pg_catalog.pg_get_constraintdef(oid) ~ '\mkind\M'
  loop execute pg_catalog.format('alter table app_private.guest_interest_mail_outbox drop constraint %I',c.conname); end loop;
end $$;
alter table app_private.guest_interest_mail_outbox
  add constraint guest_mail_kind check(kind in ('receipt','approved_contact','approved_access','declined')),
  add constraint guest_mail_review check((kind in ('approved_contact','approved_access'))=(published_revision is not null)),
  add constraint guest_mail_payload check(kind in ('approved_contact','approved_access') or contact_payload='{}'::jsonb);

-- A valid code may recover an existing request after an uncertain response.
-- The code consumption, request creation and remembered proof share a transaction.
create function public.complete_guest_interest_and_remember(
  p_id uuid,p_code_digest text,p_network_subject_hash text,p_proof_hash text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c app_private.guest_interest_challenges%rowtype; outcome text; r_id uuid; token text;
begin
  perform app_private.require_email_operator();
  if p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid viewing proof' using errcode='22023'; end if;
  select * into c from app_private.guest_interest_challenges where id=p_id for update;
  token:=c.details->>'portfolioToken';
  outcome:=public.complete_guest_interest_verification(p_id,p_code_digest,p_network_subject_hash);
  if outcome='existing_request' then
    -- A newly verified email must not remain stranded behind an old unverified
    -- pending submission. Retain that history closed; insert the validated new
    -- form under the portfolio lock already acquired by the submission helper.
    begin
    update public.interest_requests r set status='closed',updated_at=now()
      from public.portfolios p where p.id=r.portfolio_id and p.share_token=token
        and lower(r.viewer_email)=c.email and r.status in ('new','pending_review')
        and (r.email_verified_at is null or r.verification_channel is distinct from 'email');
    if found then
      outcome:=app_private.submit_verified_guest_interest(c.details,c.email,p_network_subject_hash);
      if outcome<>'submitted' then raise exception 'recovery could not submit' using errcode='P0409'; end if;
    end if;
    exception when sqlstate 'P0409' then
      -- Restore the prior request if quota or availability prevented replacement.
      return jsonb_build_object('status',outcome);
    end;
  end if;
  if outcome not in ('submitted','existing_request') then
    return jsonb_build_object('status',outcome); end if;
  select r.id into r_id from public.interest_requests r join public.portfolios p on p.id=r.portfolio_id
    where p.share_token=token and lower(r.viewer_email)=c.email
      and r.email_verified_at is not null and r.verification_channel='email'
      and r.status in ('new','pending_review','approved','revealed','rejected')
    order by r.created_at desc,r.id limit 1;
  if r_id is null then return jsonb_build_object('status','existing_request'); end if;
  insert into app_private.guest_portfolio_proofs(proof_hash,interest_request_id,recipient_email)
    values(p_proof_hash,r_id,c.email);
  return jsonb_build_object('status','submitted','shareToken',token);
end $$;
revoke all on function public.complete_guest_interest_and_remember(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_guest_interest_and_remember(uuid,text,text,text) to service_role;

-- A single canonical predicate covers both email dispatch and private reads.
create function app_private.guest_portfolio_grant_current(p_grant_id uuid,p_email text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.reveal_grants g
    join app_private.guest_portfolio_grant_recipients b on b.grant_id=g.id
    join public.interest_requests r on r.id=g.interest_request_id and r.portfolio_id=g.portfolio_id
    join public.portfolios p on p.id=g.portfolio_id
    where g.id=p_grant_id and b.recipient_email=p_email and lower(r.viewer_email)=p_email
      and r.email_verified_at is not null and r.verification_channel='email'
      and r.status in ('approved','revealed') and g.access_level='full'
      and g.revoked_at is null and g.expires_at>now()
      and public.is_published_portfolio(p.id)
      and app_private.pilot_public_portfolio_allowed(p.share_token))
$$;
revoke all on function app_private.guest_portfolio_grant_current(uuid,text) from public,anon,authenticated,service_role;

create function public.decide_interest_portfolio_reviewed(p_interest_request_id uuid,p_revision text)
returns text language plpgsql volatile security definer set search_path='' as $$
declare p_id uuid; r public.interest_requests%rowtype; review jsonb; g_id uuid; token text; expiry timestamptz:=now()+interval '15 days';
begin
  perform app_private.require_current_session();
  select portfolio_id into p_id from public.interest_requests
    where id=p_interest_request_id and public.can_manage_portfolio(portfolio_id);
  if p_id is null then return 'not_found'; end if;
  select share_token into token from public.portfolios where id=p_id and user_id=auth.uid() for update;
  if not found then return 'unauthorized'; end if;
  select * into r from public.interest_requests where id=p_interest_request_id and portfolio_id=p_id for update;
  if r.id is null then return 'not_found'; end if;
  if r.email_verified_at is null or r.verification_channel<>'email' or r.viewer_email is null then return 'verification_required'; end if;
  if exists(select 1 from public.reveal_grants g
    where g.interest_request_id=r.id and g.revoked_at is null and g.expires_at>now()) then return 'already_approved'; end if;
  if exists(select 1 from public.reveal_grants g
    where g.interest_request_id=r.id and g.revoked_at is null) then return 'invalid_transition'; end if;
  -- Prior contact-only approvals require this explicit fresh full-disclosure review.
  if r.status not in ('new','pending_review','approved','revealed') then return 'invalid_transition'; end if;
  review:=public.get_owner_relationship_page()->'disclosure';
  if p_revision is null or p_revision !~ '^[a-f0-9]{32}$' or review is null or review='null'::jsonb
    or review->>'revision' is distinct from p_revision or not public.is_published_portfolio(p_id)
    or not app_private.pilot_public_portfolio_allowed(token) then return 'review_changed'; end if;
  update public.interest_requests set status='approved',decided_at=now(),decided_by=auth.uid(),updated_at=now() where id=r.id;
  insert into public.reveal_grants(interest_request_id,portfolio_id,viewer_user_id,access_level,granted_sections,granted_by,expires_at)
    values(r.id,p_id,r.requester_user_id,'full',array['full']::text[],auth.uid(),expiry) returning id into g_id;
  insert into app_private.guest_portfolio_grant_recipients(grant_id,recipient_email) values(g_id,lower(r.viewer_email));
  insert into public.access_audit_events(portfolio_id,interest_request_id,grant_id,actor_user_id,event_type,metadata)
    values(p_id,r.id,g_id,auth.uid(),'grant_created',jsonb_build_object('duration_days',15,'published_revision',p_revision,'viewer_type','verified_guest'));
  insert into app_private.guest_interest_mail_outbox(interest_request_id,kind,recipient_email,contact_payload,published_revision)
    values(r.id,'approved_access',lower(r.viewer_email),jsonb_build_object('grantId',g_id,'shareToken',token,'expiresAt',expiry),p_revision);
  return 'approved';
end $$;
revoke all on function public.decide_interest_portfolio_reviewed(uuid,text) from public,anon;
grant execute on function public.decide_interest_portfolio_reviewed(uuid,text) to authenticated;

-- Generic start response: an unknown email gets a random challenge reference
-- but no message. The application never exposes recipient/approval existence.
create function public.begin_guest_portfolio_access_verification(
  p_share_token text,p_email text,p_code_digest text,p_email_subject_hash text,p_network_subject_hash text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r_id uuid; c_id uuid:=extensions.gen_random_uuid(); quota jsonb; email text:=lower(btrim(p_email));
begin
  perform app_private.require_email_operator();
  if p_share_token is null or p_share_token !~ '^[A-Za-z0-9_-]{8,160}$'
    or email is null or length(email) not between 3 and 180 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_code_digest is null or p_code_digest !~ '^[a-f0-9]{64}$'
    or p_email_subject_hash is null or p_email_subject_hash !~ '^[a-f0-9]{64}$'
    or p_network_subject_hash is null or p_network_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid viewing verification' using errcode='22023'; end if;
  quota:=public.consume_api_rate_limit('auth_email',p_email_subject_hash);
  if not (quota->>'allowed')::boolean then raise exception 'verification quota exceeded' using errcode='P0429'; end if;
  quota:=public.consume_api_rate_limit('auth_email',p_network_subject_hash);
  if not (quota->>'allowed')::boolean then raise exception 'verification quota exceeded' using errcode='P0429'; end if;
  perform pg_advisory_xact_lock(hashtextextended(email||'|'||p_share_token,917622));
  select r.id into r_id from public.interest_requests r join public.portfolios p on p.id=r.portfolio_id
    join public.reveal_grants g on g.interest_request_id=r.id
    where p.share_token=p_share_token and app_private.guest_portfolio_grant_current(g.id,email)
    order by g.created_at desc,g.id limit 1;
  if r_id is null then return jsonb_build_object('challengeId',c_id,'eligible',false); end if;
  update app_private.guest_portfolio_access_challenges set consumed_at=now()
    where interest_request_id=r_id and consumed_at is null;
  insert into app_private.guest_portfolio_access_challenges(id,interest_request_id,recipient_email,code_digest)
    values(c_id,r_id,email,p_code_digest);
  return jsonb_build_object('challengeId',c_id,'eligible',true);
end $$;
revoke all on function public.begin_guest_portfolio_access_verification(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_guest_portfolio_access_verification(text,text,text,text,text) to service_role;

create function public.complete_guest_portfolio_access_verification(p_id uuid,p_code_digest text,p_proof_hash text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c app_private.guest_portfolio_access_challenges%rowtype; token text;
begin
  perform app_private.require_email_operator();
  if p_id is null or p_code_digest is null or p_code_digest !~ '^[a-f0-9]{64}$'
    or p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid viewing proof' using errcode='22023'; end if;
  select * into c from app_private.guest_portfolio_access_challenges where id=p_id for update;
  if c.id is null or c.consumed_at is not null or c.expires_at<=now() or c.attempts>=5 then return '{"status":"expired"}'::jsonb; end if;
  if c.code_digest<>p_code_digest then
    update app_private.guest_portfolio_access_challenges set attempts=attempts+1 where id=c.id;
    return '{"status":"invalid_code"}'::jsonb;
  end if;
  select p.share_token into token from public.interest_requests r join public.portfolios p on p.id=r.portfolio_id
    join public.reveal_grants g on g.interest_request_id=r.id
    where r.id=c.interest_request_id and app_private.guest_portfolio_grant_current(g.id,c.recipient_email)
    order by g.created_at desc,g.id limit 1;
  update app_private.guest_portfolio_access_challenges set consumed_at=now() where id=c.id;
  if token is null then return '{"status":"expired"}'::jsonb; end if;
  insert into app_private.guest_portfolio_proofs(proof_hash,interest_request_id,recipient_email)
    values(p_proof_hash,c.interest_request_id,c.recipient_email);
  return jsonb_build_object('status','verified','shareToken',token);
end $$;
revoke all on function public.complete_guest_portfolio_access_verification(uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_guest_portfolio_access_verification(uuid,text,text) to service_role;

create function public.resolve_guest_approved_portfolio(p_share_token text,p_proof_hash text,p_horoscope boolean default false)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare g public.reveal_grants%rowtype; result jsonb;
begin
  perform app_private.require_email_operator();
  if p_share_token is null or p_share_token !~ '^[A-Za-z0-9_-]{8,160}$'
    or p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$' or p_horoscope is null then return null; end if;
  select grant_row.* into g from app_private.guest_portfolio_proofs proof
    join public.interest_requests r on r.id=proof.interest_request_id
    join public.portfolios p on p.id=r.portfolio_id
    join public.reveal_grants grant_row on grant_row.interest_request_id=r.id
    where proof.proof_hash=p_proof_hash and proof.expires_at>now() and p.share_token=p_share_token
      and app_private.guest_portfolio_grant_current(grant_row.id,proof.recipient_email)
    order by grant_row.created_at desc,grant_row.id limit 1;
  if g.id is null then return null; end if;
  if p_horoscope then
    select jsonb_build_object('accessPath',h.storage_path,'mimeType',h.mime_type,'fileExtension',h.file_extension,
      'languageLabel',h.language_label,'pageCount',h.page_count,'profileName',a.data#>>'{personal,name}','accessExpiresAt',g.expires_at)
      into result from public.approved_portfolio_snapshots a join public.portfolio_horoscopes h on h.portfolio_id=a.portfolio_id
      where a.portfolio_id=g.portfolio_id and h.published_at is not null and h.file_extension='webp';
  else
    select jsonb_build_object('data',a.data,'templateId',a.template_id,'themeColor',a.theme_color,'sunSign',a.sun_sign,
      'accessExpiresAt',g.expires_at,'horoscope',(select jsonb_strip_nulls(jsonb_build_object('fileExtension',h.file_extension,
        'languageLabel',h.language_label,'pageCount',h.page_count)) from public.portfolio_horoscopes h
        where h.portfolio_id=a.portfolio_id and h.published_at is not null and h.file_extension='webp'),
      'media',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'key',substr(md5(m.storage_path),1,24),'accessPath',m.storage_path,'altText',m.alt_text,'mediaType',m.media_type::text,
        'sortOrder',m.sort_order,'width',m.metadata->'width','height',m.metadata->'height','aspectRatio',m.metadata->'aspectRatio',
        'orientation',m.metadata->>'orientation','presentation','clear')) order by (m.media_type='hero') desc,m.sort_order,m.storage_path)
        from public.portfolio_media m where m.portfolio_id=a.portfolio_id and m.media_type in ('hero','gallery')
          and m.visibility in ('public','blurred','interest_required','approved_only')),'[]'::jsonb)) into result
      from public.approved_portfolio_snapshots a where a.portfolio_id=g.portfolio_id;
  end if;
  if result is null then return null; end if;
  update public.reveal_grants set last_accessed_at=now() where id=g.id;
  if not exists(select 1 from public.access_audit_events where grant_id=g.id and event_type='grant_accessed' and created_at>now()-interval '1 hour') then
    insert into public.access_audit_events(portfolio_id,interest_request_id,grant_id,event_type)
      values(g.portfolio_id,g.interest_request_id,g.id,'grant_accessed');
  end if;
  return result;
end $$;
revoke all on function public.resolve_guest_approved_portfolio(text,text,boolean) from public,anon,authenticated;
grant execute on function public.resolve_guest_approved_portfolio(text,text,boolean) to service_role;

-- Preserve all previous queue semantics and add the canonical eligibility gate.
alter function public.guest_interest_mail_is_current(uuid,uuid) rename to guest_interest_mail_is_current_before_viewing;
alter function public.guest_interest_mail_is_current_before_viewing(uuid,uuid) set schema app_private;
revoke all on function app_private.guest_interest_mail_is_current_before_viewing(uuid,uuid) from public,anon,authenticated,service_role;
create function public.guest_interest_mail_is_current(p_id uuid,p_lease_token uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare job app_private.guest_interest_mail_outbox%rowtype; token text;
begin
  perform app_private.require_email_operator();
  select * into job from app_private.guest_interest_mail_outbox where id=p_id and lease_token=p_lease_token
    and status='processing' and lease_expires_at>now() and created_at>now()-interval '24 hours';
  if job.id is null then return false; end if;
  select p.share_token into token from public.interest_requests r join public.portfolios p on p.id=r.portfolio_id where r.id=job.interest_request_id;
  if job.kind in ('approved_contact','approved_access') and (token is null or not app_private.pilot_public_portfolio_allowed(token)) then return false; end if;
  if job.kind='approved_access' then
    return job.contact_payload->>'shareToken'=token and exists(select 1 from public.reveal_grants g
      where g.id::text=job.contact_payload->>'grantId' and g.interest_request_id=job.interest_request_id
        and app_private.guest_portfolio_grant_current(g.id,job.recipient_email));
  end if;
  return app_private.guest_interest_mail_is_current_before_viewing(p_id,p_lease_token);
end $$;
revoke all on function public.guest_interest_mail_is_current(uuid,uuid) from public,anon,authenticated;
grant execute on function public.guest_interest_mail_is_current(uuid,uuid) to service_role;

alter function public.purge_guest_interest_ephemera(integer) rename to purge_guest_interest_ephemera_before_viewing;
alter function public.purge_guest_interest_ephemera_before_viewing(integer) set schema app_private;
revoke all on function app_private.purge_guest_interest_ephemera_before_viewing(integer) from public,anon,authenticated,service_role;
create function public.purge_guest_interest_ephemera(p_limit integer default 100)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare affected integer; total integer;
begin
  perform app_private.require_email_operator();
  total:=app_private.purge_guest_interest_ephemera_before_viewing(p_limit);
  delete from app_private.guest_portfolio_proofs where proof_hash in (
    select proof_hash from app_private.guest_portfolio_proofs where expires_at<now() order by expires_at limit p_limit);
  get diagnostics affected=row_count; total:=total+affected;
  delete from app_private.guest_portfolio_access_challenges where id in (
    select id from app_private.guest_portfolio_access_challenges where expires_at<now()-interval '1 day' order by expires_at limit p_limit);
  get diagnostics affected=row_count;
  return total+affected;
end $$;
revoke all on function public.purge_guest_interest_ephemera(integer) from public,anon,authenticated;
grant execute on function public.purge_guest_interest_ephemera(integer) to service_role;

create function public.guest_portfolio_delivery_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare overdue integer; terminal integer;
begin
  perform app_private.require_email_operator();
  select count(*) filter(where status in ('queued','failed','processing') and created_at<now()-interval '10 minutes'),
    count(*) filter(where status='suppressed' and last_error_code not in ('GUEST_MAIL_STALE','SHARING_ENDED'))
    into overdue,terminal from app_private.guest_interest_mail_outbox;
  return jsonb_build_object('healthy',overdue=0 and terminal=0,'overdueQueued',overdue,'terminalFailures',terminal);
end $$;
revoke all on function public.guest_portfolio_delivery_health() from public,anon,authenticated;
grant execute on function public.guest_portfolio_delivery_health() to service_role;
