-- Add bounded, private multi-select answers without discarding existing feedback.
alter table app_private.creator_onboarding_feedback
  add column hardest_steps text[] not null default '{}'::text[],
  add column liked_aspects text[] not null default '{}'::text[];

update app_private.creator_onboarding_feedback
set hardest_steps = array[hardest_step];

alter table app_private.creator_onboarding_feedback
  add constraint creator_feedback_hardest_steps_valid check (
    pg_catalog.cardinality(hardest_steps) between 1 and 6
    and pg_catalog.array_position(hardest_steps, null) is null
    and hardest_steps <@ array['none', 'details', 'photos', 'verification', 'publishing', 'other']::text[]
    and (pg_catalog.cardinality(hardest_steps) = 1 or not ('none' = any(hardest_steps)))
  ),
  add constraint creator_feedback_liked_aspects_valid check (
    pg_catalog.cardinality(liked_aspects) <= 6
    and pg_catalog.array_position(liked_aspects, null) is null
    and liked_aspects <@ array['guidance', 'photos', 'preview', 'design', 'privacy', 'other']::text[]
  );

-- Keep the original RPC callable while older application instances drain, but
-- make both old and new submissions first-write-wins.
create or replace function public.submit_creator_onboarding_feedback(
  p_ease_rating integer, p_hardest_step text, p_comment text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare portfolio_record public.portfolios%rowtype;
  clean_comment text := nullif(pg_catalog.btrim(p_comment), '');
begin
  perform app_private.require_current_session();
  if p_ease_rating not between 1 and 5
     or p_ease_rating is null
     or p_hardest_step not in ('none', 'details', 'photos', 'verification', 'publishing', 'other')
     or p_hardest_step is null
     or pg_catalog.length(clean_comment) > 1000 then
    raise exception 'invalid onboarding feedback' using errcode = '22023';
  end if;
  select * into portfolio_record from public.portfolios where user_id = auth.uid() for update;
  if portfolio_record.id is null or pg_catalog.cardinality(
    app_private.portfolio_missing_required_details(portfolio_record.id, portfolio_record.draft_data)
  ) > 0 then
    raise exception 'completed portfolio required' using errcode = '42501';
  end if;
  insert into app_private.creator_onboarding_feedback
    (portfolio_id, owner_user_id, ease_rating, hardest_step, hardest_steps, comment)
    values (portfolio_record.id, auth.uid(), p_ease_rating, p_hardest_step, array[p_hardest_step], clean_comment)
    on conflict (portfolio_id) do nothing;
  if not found then
    raise exception 'feedback already submitted' using errcode = '23505';
  end if;
  return '{"status":"saved"}'::jsonb;
end;
$$;

create function public.submit_creator_onboarding_feedback_v2(
  p_ease_rating integer, p_hardest_steps text[], p_liked_aspects text[], p_comment text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_current_session();
  if p_hardest_steps is null
    or p_liked_aspects is null
    or pg_catalog.cardinality(p_hardest_steps) not between 1 and 6
    or pg_catalog.cardinality(p_liked_aspects) > 6
    or pg_catalog.array_position(p_hardest_steps, null) is not null
    or pg_catalog.array_position(p_liked_aspects, null) is not null
    or not (p_hardest_steps <@ array['none', 'details', 'photos', 'verification', 'publishing', 'other']::text[])
    or not (p_liked_aspects <@ array['guidance', 'photos', 'preview', 'design', 'privacy', 'other']::text[])
    or (pg_catalog.cardinality(p_hardest_steps) > 1 and 'none' = any(p_hardest_steps))
    or (select count(distinct choice) from pg_catalog.unnest(p_hardest_steps) as choices(choice)) <> pg_catalog.cardinality(p_hardest_steps)
    or (select count(distinct choice) from pg_catalog.unnest(p_liked_aspects) as choices(choice)) <> pg_catalog.cardinality(p_liked_aspects)
  then
    raise exception 'invalid onboarding feedback' using errcode = '22023';
  end if;

  -- The existing RPC owns the completed-portfolio check and serializes owner updates.
  perform public.submit_creator_onboarding_feedback(p_ease_rating, p_hardest_steps[1], p_comment);
  update app_private.creator_onboarding_feedback
  set hardest_steps = p_hardest_steps,
      liked_aspects = p_liked_aspects
  where owner_user_id = auth.uid();
  return '{"status":"saved"}'::jsonb;
end;
$$;

revoke all on function public.submit_creator_onboarding_feedback_v2(integer, text[], text[], text) from public, anon, authenticated;
grant execute on function public.submit_creator_onboarding_feedback_v2(integer, text[], text[], text) to authenticated;

create or replace function public.get_creator_onboarding_feedback()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare feedback app_private.creator_onboarding_feedback%rowtype;
begin
  perform app_private.require_current_session();
  select * into feedback from app_private.creator_onboarding_feedback
    where owner_user_id = auth.uid() limit 1;
  if not found then return null; end if;
  return pg_catalog.jsonb_build_object(
    'easeRating', feedback.ease_rating,
    'hardestStep', feedback.hardest_step,
    'hardestSteps', feedback.hardest_steps,
    'likedAspects', feedback.liked_aspects,
    'comment', feedback.comment,
    'submittedAt', feedback.submitted_at
  );
end;
$$;

create or replace function public.list_creator_onboarding_feedback(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  if not app_private.actor_is_pilot_administrator(auth.uid()) then
    raise exception 'pilot administrator required' using errcode = '42501';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'easeRating', feedback.ease_rating,
    'hardestStep', feedback.hardest_step,
    'hardestSteps', feedback.hardest_steps,
    'likedAspects', feedback.liked_aspects,
    'comment', feedback.comment,
    'submittedAt', feedback.submitted_at
  ) order by feedback.submitted_at desc), '[]'::jsonb) into result
  from (select * from app_private.creator_onboarding_feedback
    order by submitted_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100)) feedback;
  return result;
end;
$$;
