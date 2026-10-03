-- Full name and Marital Status now appear in both public Introduction modes.
-- Prior v1 confirmations did not describe this exposure, so require a fresh,
-- draft-bound v2 confirmation before any new publication or content update.
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
    and progress_record.disclosure_version='publication-disclosure-v2'
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
      or progress_record.disclosure_version<>'publication-disclosure-v2'
      or progress_record.disclosure_fingerprint<>app_private.portfolio_draft_fingerprint(new.draft_data) then
      raise exception 'publication_disclosure_required' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

comment on function app_private.owner_publication_readiness() is
  'Pilot publication readiness; requires version-two public-disclosure consent for the current draft.';
