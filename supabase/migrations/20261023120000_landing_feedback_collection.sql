-- Private, bounded research feedback. Nothing here is eligible for public display.
create table app_private.landing_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('creator', 'viewer', 'family', 'other')),
  experience text not null check (pg_catalog.length(experience) between 10 and 800),
  improvement text check (improvement is null or pg_catalog.length(improvement) <= 800),
  credit_name text check (credit_name is null or pg_catalog.length(credit_name) <= 80),
  contact_email text check (contact_email is null or pg_catalog.length(contact_email) <= 254),
  contact_permission boolean not null default false,
  submitted_at timestamptz not null default pg_catalog.now(),
  check ((contact_permission and contact_email is not null) or (not contact_permission and contact_email is null and credit_name is null))
);
create index landing_feedback_submitted_idx on app_private.landing_feedback_submissions(submitted_at desc);
alter table app_private.landing_feedback_submissions enable row level security;
revoke all on app_private.landing_feedback_submissions from public, anon, authenticated;
grant select, insert, delete on app_private.landing_feedback_submissions to service_role;

create function public.submit_landing_feedback(
  p_audience text, p_experience text, p_improvement text,
  p_credit_name text, p_contact_email text, p_contact_permission boolean,
  p_subject_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare quota app_private.api_rate_limits%rowtype;
  now_at timestamptz := pg_catalog.now();
  clean_experience text := pg_catalog.btrim(p_experience);
  clean_improvement text := nullif(pg_catalog.btrim(p_improvement), '');
  clean_name text := nullif(pg_catalog.btrim(p_credit_name), '');
  clean_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_contact_email)), '');
begin
  if p_subject_hash is null or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid feedback subject' using errcode = '22023';
  end if;
  if p_audience is null or p_audience not in ('creator', 'viewer', 'family', 'other')
    or clean_experience is null or pg_catalog.length(clean_experience) not between 10 and 800
    or pg_catalog.length(clean_improvement) > 800
    or pg_catalog.length(clean_name) > 80
    or pg_catalog.length(clean_email) > 254
    or (clean_email is not null and clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or p_contact_permission is null or (p_contact_permission and clean_email is null) then
    raise exception 'invalid feedback' using errcode = '22023';
  end if;
  insert into app_private.api_rate_limits(action, subject_key, window_started_at, request_count, updated_at)
    values ('landing_feedback_submit', 'anonymous:' || p_subject_hash, now_at, 1, now_at)
    on conflict(action, subject_key) do update set
      window_started_at = case when app_private.api_rate_limits.window_started_at <= now_at - interval '1 day' then now_at else app_private.api_rate_limits.window_started_at end,
      request_count = case when app_private.api_rate_limits.window_started_at <= now_at - interval '1 day' then 1 else app_private.api_rate_limits.request_count + 1 end,
      updated_at = now_at
    where app_private.api_rate_limits.window_started_at <= now_at - interval '1 day'
       or app_private.api_rate_limits.request_count < 4
    returning * into quota;
  if quota.action is null or quota.request_count > 3 then
    return '{"status":"rate_limited"}'::jsonb;
  end if;
  insert into app_private.landing_feedback_submissions
    (audience, experience, improvement, credit_name, contact_email, contact_permission)
    values (p_audience, clean_experience, clean_improvement, clean_name, clean_email, p_contact_permission);
  return '{"status":"saved"}'::jsonb;
end;
$$;
revoke all on function public.submit_landing_feedback(text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_landing_feedback(text, text, text, text, text, boolean, text) to service_role;

create function public.purge_landing_feedback()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from app_private.landing_feedback_submissions where submitted_at < pg_catalog.now() - interval '180 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_landing_feedback() from public, anon, authenticated;
grant execute on function public.purge_landing_feedback() to service_role;
