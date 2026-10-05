-- Optional owner feedback is private product research, never portfolio content.
create table app_private.creator_onboarding_feedback (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ease_rating smallint not null check (ease_rating between 1 and 5),
  hardest_step text not null check (hardest_step in ('none', 'details', 'photos', 'verification', 'publishing', 'other')),
  comment text check (comment is null or pg_catalog.length(comment) <= 1000),
  submitted_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index creator_onboarding_feedback_recent_idx
  on app_private.creator_onboarding_feedback(submitted_at desc);
alter table app_private.creator_onboarding_feedback enable row level security;
revoke all on table app_private.creator_onboarding_feedback from public, anon, authenticated;
grant select, insert, update on table app_private.creator_onboarding_feedback to service_role;

create function public.get_creator_onboarding_feedback()
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
    'comment', feedback.comment,
    'submittedAt', feedback.submitted_at
  );
end;
$$;

create function public.submit_creator_onboarding_feedback(
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
    (portfolio_id, owner_user_id, ease_rating, hardest_step, comment)
    values (portfolio_record.id, auth.uid(), p_ease_rating, p_hardest_step, clean_comment)
    on conflict (portfolio_id) do update set
      ease_rating = excluded.ease_rating,
      hardest_step = excluded.hardest_step,
      comment = excluded.comment,
      updated_at = pg_catalog.now();
  return '{"status":"saved"}'::jsonb;
end;
$$;

create function public.list_creator_onboarding_feedback(p_limit integer default 50)
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
    'comment', feedback.comment,
    'submittedAt', feedback.submitted_at
  ) order by feedback.submitted_at desc), '[]'::jsonb) into result
  from (select * from app_private.creator_onboarding_feedback
    order by submitted_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100)) feedback;
  return result;
end;
$$;

revoke all on function public.get_creator_onboarding_feedback() from public, anon, authenticated;
revoke all on function public.submit_creator_onboarding_feedback(integer, text, text) from public, anon, authenticated;
revoke all on function public.list_creator_onboarding_feedback(integer) from public, anon, authenticated;
grant execute on function public.get_creator_onboarding_feedback() to authenticated;
grant execute on function public.submit_creator_onboarding_feedback(integer, text, text) to authenticated;
grant execute on function public.list_creator_onboarding_feedback(integer) to authenticated;

-- Optional feedback is personal data and belongs in the owner's account export.
create or replace function public.export_my_account_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare export_payload jsonb;
begin
  perform app_private.require_current_session();
  export_payload := app_private.export_my_account_data();
  return export_payload || pg_catalog.jsonb_build_object(
    'onboardingFeedback', (
      select pg_catalog.to_jsonb(feedback) - 'owner_user_id'
      from app_private.creator_onboarding_feedback feedback
      where feedback.owner_user_id = auth.uid() limit 1
    )
  );
end;
$$;
