-- New publications use one public Introduction. Existing reduced-disclosure
-- snapshots are not rewritten; their links retain the previously published data.
create function app_private.require_current_public_introduction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published = true
    and (tg_op = 'INSERT' or old.is_published is distinct from true
      or old.published_data is distinct from new.published_data)
    and (new.draft_data ->> 'privacy_mode' is distinct from 'balanced'
      or new.published_data ->> 'privacy_mode' is distinct from 'balanced') then
    raise exception 'publication_current_introduction_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger a_require_current_public_introduction
before insert or update on public.portfolios
for each row execute function app_private.require_current_public_introduction();

revoke all on function app_private.require_current_public_introduction() from public, anon, authenticated;

comment on function app_private.require_current_public_introduction() is
  'Requires the current public Introduction for new publications without widening any existing published snapshot.';
