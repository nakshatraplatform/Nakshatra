-- Remember each owner preview for the exact saved draft and attachment revision.
-- Preview markers are UX evidence, not verification or publication consent.
alter table app_private.portfolio_publication_progress
  add column public_preview_fingerprint text,
  add column complete_preview_fingerprint text;

create function app_private.portfolio_review_fingerprint(p_portfolio_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select app_private.portfolio_draft_fingerprint(pg_catalog.jsonb_build_object(
    'draft', p.draft_data,
    'photos', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',m.id,'storage_path',m.storage_path,'media_type',m.media_type,
      'visibility',m.visibility,'sort_order',m.sort_order,'alt_text',m.alt_text) order by m.id)
      from public.portfolio_media m where m.portfolio_id=p.id), '[]'::jsonb),
    'horoscope', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',h.id,'storage_path',h.storage_path,'language_label',h.language_label,
      'mime_type',h.mime_type,'page_count',h.page_count,'byte_size',h.byte_size) order by h.id)
      from public.portfolio_horoscopes h where h.portfolio_id=p.id), '[]'::jsonb)
  )) from public.portfolios p where p.id=p_portfolio_id
$$;
revoke all on function app_private.portfolio_review_fingerprint(uuid) from public, anon, authenticated;

create or replace function app_private.owner_publication_readiness()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  portfolio_record public.portfolios%rowtype;
  progress_record app_private.portfolio_publication_progress%rowtype;
  fingerprint text;
begin
  select p.* into portfolio_record from public.portfolios p where p.user_id=auth.uid() limit 1;
  if portfolio_record.id is null then
    return '{"portfolioExists":false,"lastEditorSection":null,"previewedAt":null,"reviewFingerprint":null,"publicPreviewReviewed":false,"completePreviewReviewed":false,"selectedPlanCode":null,"verificationStatus":"required","paymentStatus":"none","paymentExpiresAt":null,"paymentActive":false,"disclosureConfirmed":false,"published":false,"missingRequired":[]}'::jsonb;
  end if;
  select g.* into progress_record from app_private.portfolio_publication_progress g where g.portfolio_id=portfolio_record.id;
  fingerprint:=app_private.portfolio_review_fingerprint(portfolio_record.id);
  return pg_catalog.jsonb_build_object(
    'portfolioExists',true,'lastEditorSection',progress_record.last_editor_section,
    'previewedAt',progress_record.previewed_at,'reviewFingerprint',fingerprint,
    'publicPreviewReviewed',coalesce(progress_record.public_preview_fingerprint=fingerprint,false),
    'completePreviewReviewed',coalesce(progress_record.complete_preview_fingerprint=fingerprint,false),
    'selectedPlanCode',progress_record.selected_plan_code,
    'verificationStatus',case
      when exists(select 1 from app_private.current_identity_verification(portfolio_record.candidate_id)) then 'verified'
      when app_private.pilot_test_publication_exempt(portfolio_record.candidate_id) then 'test_exempt'
      else 'required' end,
    'paymentStatus',coalesce(progress_record.payment_status,'none'),
    'paymentExpiresAt',progress_record.payment_expires_at,
    'paymentActive',app_private.actor_can_create_portfolio(auth.uid()),
    'disclosureConfirmed',coalesce(progress_record.disclosure_confirmed_at is not null
      and progress_record.disclosure_version='publication-disclosure-v2'
      and progress_record.disclosure_fingerprint=app_private.portfolio_draft_fingerprint(portfolio_record.draft_data),false),
    'published',portfolio_record.is_published,
    'missingRequired',to_jsonb(app_private.portfolio_missing_required_details(portfolio_record.id,portfolio_record.draft_data))
  );
end;
$$;

create or replace function public.update_portfolio_onboarding_progress(p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare portfolio_record public.portfolios%rowtype;
begin
  perform app_private.require_current_session();
  if not app_private.actor_can_create_portfolio(auth.uid()) then return '{"status":"creator_entitlement_required"}'::jsonb; end if;
  select p.* into portfolio_record from public.portfolios p where p.user_id=auth.uid() for update;
  if portfolio_record.id is null then return '{"status":"not_found"}'::jsonb; end if;
  insert into app_private.portfolio_publication_progress(portfolio_id) values(portfolio_record.id) on conflict(portfolio_id) do nothing;
  if p_action='editor_section' then
    if p_value is null or p_value not in ('privacy','foundation','story','work','family','astrology','lifestyle','preferences','future') then
      raise exception 'invalid editor section' using errcode='22023';
    end if;
    update app_private.portfolio_publication_progress set last_editor_section=p_value,updated_at=pg_catalog.now() where portfolio_id=portfolio_record.id;
  elsif p_action in ('public_preview','complete_preview') then
    if p_value is null or p_value is distinct from app_private.portfolio_review_fingerprint(portfolio_record.id) then
      return '{"status":"review_changed"}'::jsonb;
    end if;
    update app_private.portfolio_publication_progress set
      public_preview_fingerprint=case when p_action='public_preview' then p_value else public_preview_fingerprint end,
      complete_preview_fingerprint=case when p_action='complete_preview' then p_value else complete_preview_fingerprint end,
      previewed_at=coalesce(previewed_at,pg_catalog.now()),updated_at=pg_catalog.now()
    where portfolio_id=portfolio_record.id;
  elsif p_action='previewed' then
    -- Older clients and early preview mark only preview-started, not both reviews.
    update app_private.portfolio_publication_progress set previewed_at=coalesce(previewed_at,pg_catalog.now()),updated_at=pg_catalog.now() where portfolio_id=portfolio_record.id;
  elsif p_action='select_plan' then
    raise exception 'plan selection is deferred during the private pilot' using errcode='22023';
  elsif p_action='confirm_disclosure' then
    if p_value is distinct from 'publication-disclosure-v2' then raise exception 'invalid disclosure version' using errcode='22023'; end if;
    if not app_private.personal_publication_verification_satisfied(portfolio_record.candidate_id) then return '{"status":"verification_required"}'::jsonb; end if;
    if pg_catalog.cardinality(app_private.portfolio_missing_required_details(portfolio_record.id,portfolio_record.draft_data))>0 then return '{"status":"content_required"}'::jsonb; end if;
    update app_private.portfolio_publication_progress set disclosure_version=p_value,
      disclosure_fingerprint=app_private.portfolio_draft_fingerprint(portfolio_record.draft_data),
      disclosure_confirmed_at=pg_catalog.now(),updated_at=pg_catalog.now() where portfolio_id=portfolio_record.id;
  else raise exception 'invalid onboarding action' using errcode='22023';
  end if;
  return pg_catalog.jsonb_build_object('status','ok','readiness',app_private.owner_publication_readiness());
end;
$$;
