-- A named, revocable test-account exception for personal-link publication only.
-- This never creates a Didit proof or makes the candidate broker-eligible.
create table app_private.pilot_test_publication_exemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default pg_catalog.now(),
  revoked_at timestamptz
);
revoke all on app_private.pilot_test_publication_exemptions from public, anon, authenticated;

create function app_private.pilot_test_publication_exempt(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    join public.candidates candidate on candidate.id = portfolio.candidate_id
    join auth.users account on account.id = portfolio.user_id
    join app_private.pilot_test_publication_exemptions exemption on exemption.user_id = account.id
    where portfolio.candidate_id = p_candidate_id
      and portfolio.user_id = candidate.primary_owner_user_id
      and candidate.created_by = portfolio.user_id
      and pg_catalog.lower(pg_catalog.btrim(account.email)) = 'rahulgollapalliranganatha@gmail.com'
      and account.email_confirmed_at is not null
      and exemption.revoked_at is null
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
  )
$$;
revoke all on function app_private.pilot_test_publication_exempt(uuid) from public, anon, authenticated;

create function app_private.personal_publication_verification_satisfied(p_candidate_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from app_private.current_identity_verification(p_candidate_id))
    or app_private.pilot_test_publication_exempt(p_candidate_id)
$$;
revoke all on function app_private.personal_publication_verification_satisfied(uuid) from public, anon, authenticated;

create or replace function app_private.pilot_public_portfolio_allowed(p_share_token text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portfolios portfolio
    where portfolio.share_token = p_share_token
      and portfolio.is_published = true
      and portfolio.published_data #>> '{personal,profile_for}' = 'self'
      and app_private.pilot_self_portfolio_eligible(portfolio.id)
      and app_private.personal_publication_verification_satisfied(portfolio.candidate_id)
  )
$$;

create or replace function app_private.owner_publication_readiness()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
  missing text[];
  verification_status text;
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
  verification_status:=case
    when exists(select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)) then 'verified'
    when app_private.pilot_test_publication_exempt(portfolio_record.candidate_id) then 'test_exempt'
    else 'required' end;
  pilot_publication_enabled:=app_private.actor_can_create_portfolio(auth.uid());
  disclosure_current:=progress_record.disclosure_confirmed_at is not null
    and progress_record.disclosure_version='publication-disclosure-v2'
    and progress_record.disclosure_fingerprint=app_private.portfolio_draft_fingerprint(portfolio_record.draft_data);
  return pg_catalog.jsonb_build_object(
    'portfolioExists',true,'lastEditorSection',progress_record.last_editor_section,
    'previewedAt',progress_record.previewed_at,'selectedPlanCode',progress_record.selected_plan_code,
    'verificationStatus',verification_status,
    'paymentStatus',coalesce(progress_record.payment_status,'none'),
    'paymentExpiresAt',progress_record.payment_expires_at,'paymentActive',pilot_publication_enabled,
    'disclosureConfirmed',disclosure_current,'published',portfolio_record.is_published,
    'missingRequired',to_jsonb(missing)
  );
end;
$$;

create or replace function public.update_portfolio_onboarding_progress(p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare portfolio_record public.portfolios%rowtype;
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
    if p_value<>'publication-disclosure-v2' then raise exception 'invalid disclosure version' using errcode='22023'; end if;
    if not app_private.personal_publication_verification_satisfied(portfolio_record.candidate_id) then
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

create or replace function app_private.enforce_identity_verification_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_published = true and (tg_op = 'INSERT' or old.is_published is distinct from true) then
    if not app_private.personal_publication_verification_satisfied(new.candidate_id) then
      raise exception 'first publication requires current candidate verification or approved test exemption' using errcode = '23514';
    end if;
  end if;
  return new;
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
    if not app_private.personal_publication_verification_satisfied(new.candidate_id) then
      raise exception 'publication_verification_required' using errcode='23514';
    end if;
    select progress.* into progress_record from app_private.portfolio_publication_progress progress
    where progress.portfolio_id=new.id;
    if progress_record.disclosure_confirmed_at is null
      or progress_record.disclosure_version<>'publication-disclosure-v2'
      or progress_record.disclosure_fingerprint<>app_private.portfolio_draft_fingerprint(new.draft_data) then
      raise exception 'publication_disclosure_required' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app_private.publish_portfolio_transaction(
  p_portfolio_id uuid, p_draft_data jsonb, p_public_data jsonb,
  p_approved_data jsonb, p_share_token text, p_expires_at timestamptz,
  p_template_id integer, p_theme_color text, p_sun_sign text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  portfolio_record public.portfolios%rowtype;
  effective_token text;
  published_time timestamptz := pg_catalog.now();
  result_action text;
begin
  if actor_id is null then return '{"status":"unauthorized"}'::jsonb; end if;
  if not app_private.actor_can_create_portfolio(actor_id) then
    return '{"status":"creator_entitlement_required"}'::jsonb;
  end if;
  select portfolio.* into portfolio_record from public.portfolios portfolio
  where portfolio.id = p_portfolio_id and public.can_manage_portfolio(portfolio.id)
  for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  if not app_private.personal_publication_verification_satisfied(portfolio_record.candidate_id) then
    return '{"status":"verification_required"}'::jsonb;
  end if;
  effective_token := coalesce(portfolio_record.share_token, p_share_token);
  if effective_token is null or pg_catalog.length(effective_token) <> 21 or effective_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid publication lifecycle values' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.portfolio_media media
    where media.portfolio_id=portfolio_record.id and media.media_type='hero'
      and media.visibility in ('public','blurred','interest_required','approved_only')
  ) then return '{"status":"not_ready"}'::jsonb; end if;
  result_action := case when portfolio_record.is_published then 'updated' else 'created' end;
  update public.portfolios
  set draft_data=p_draft_data, published_data=p_draft_data, is_published=true,
      published_at=published_time, sun_sign=p_sun_sign, theme_color=p_theme_color,
      template_id=p_template_id, share_token=effective_token, expires_at=null
  where id=portfolio_record.id;
  insert into public.public_portfolio_snapshots (
    portfolio_id, share_token, data, template_id, theme_color, sun_sign,
    expires_at, published_at, is_active
  ) values (
    portfolio_record.id,effective_token,p_public_data,p_template_id,
    p_theme_color,p_sun_sign,null,published_time,true
  ) on conflict (portfolio_id) do update set
    share_token=excluded.share_token,data=excluded.data,template_id=excluded.template_id,
    theme_color=excluded.theme_color,sun_sign=excluded.sun_sign,expires_at=null,
    published_at=excluded.published_at,is_active=true;
  insert into public.approved_portfolio_snapshots (
    portfolio_id,data,template_id,theme_color,sun_sign,published_at
  ) values (
    portfolio_record.id,p_approved_data,p_template_id,p_theme_color,p_sun_sign,published_time
  ) on conflict (portfolio_id) do update set
    data=excluded.data,template_id=excluded.template_id,theme_color=excluded.theme_color,
    sun_sign=excluded.sun_sign,published_at=excluded.published_at;
  update public.portfolio_horoscopes set published_at=published_time
  where portfolio_id=portfolio_record.id;
  return pg_catalog.jsonb_build_object(
    'status','ok','action',result_action,'shareToken',effective_token,'expiresAt',null
  );
end;
$$;

comment on function app_private.pilot_test_publication_exempt(uuid) is
  'Exact confirmed Rahul test account only; never represents Didit identity verification or broker eligibility.';
comment on function app_private.personal_publication_verification_satisfied(uuid) is
  'Personal-link publication gate: current Didit proof or exact-account test grant. Broker checks retain real Didit proof.';
