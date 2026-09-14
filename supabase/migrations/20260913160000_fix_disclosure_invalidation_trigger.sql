-- A trigger record only exposes columns from its attached table. Keep the
-- portfolios path separate from media/horoscope paths so PostgreSQL never
-- resolves NEW.portfolio_id against public.portfolios (which uses id).
create or replace function app_private.invalidate_publication_disclosure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_portfolio_id uuid;
begin
  if tg_table_name = 'portfolios' then
    target_portfolio_id := new.id;
  elsif tg_op = 'DELETE' then
    target_portfolio_id := old.portfolio_id;
  else
    target_portfolio_id := new.portfolio_id;
  end if;

  update app_private.portfolio_publication_progress
  set disclosure_version = null,
      disclosure_fingerprint = null,
      disclosure_confirmed_at = null,
      updated_at = pg_catalog.now()
  where portfolio_id = target_portfolio_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app_private.invalidate_publication_disclosure()
  from public, anon, authenticated;

comment on function app_private.invalidate_publication_disclosure() is
  'Invalidates publication disclosure after draft, media, or horoscope changes without cross-table trigger record access.';
