-- Approved viewers resolve descriptors with their own session, but only the
-- trusted server signs protected originals. SELECT also permits arbitrary-TTL
-- Storage signing, so an application-only TTL cap is insufficient.
drop policy if exists "Approved viewers can read approved photo originals" on storage.objects;
drop policy if exists "Approved viewers can read horoscope files" on storage.objects;

-- Keep object names unchanged by URL parsing; encoded separators, dot segments,
-- query/fragment delimiters and backslashes are not generated upload paths.
create function app_private.storage_path_is_canonical(p_path text) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_path ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$'
    and p_path !~ '(^|/)\.{1,2}(/|$)',false)
$$;
revoke all on function app_private.storage_path_is_canonical(text) from public,anon,authenticated,service_role;
create function app_private.enforce_media_storage_canonical_path() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not app_private.storage_path_is_canonical(new.storage_path)
    or (new.thumbnail_path is not null and not app_private.storage_path_is_canonical(new.thumbnail_path))
    or (new.metadata->>'blurPath' is not null and not app_private.storage_path_is_canonical(new.metadata->>'blurPath')) then
    raise exception 'media_storage_path_invalid' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function app_private.enforce_media_storage_canonical_path() from public,anon,authenticated,service_role;
create trigger enforce_media_storage_canonical_path before insert or update of storage_path,thumbnail_path,metadata on public.portfolio_media
for each row execute function app_private.enforce_media_storage_canonical_path();

-- Descriptor authorization is insufficient if an owner can point their row at
-- another tenant's file. Photos already enforce this; enforce it for horoscopes.
create function app_private.enforce_horoscope_storage_namespace() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.portfolios where id=new.portfolio_id;
  if owner_id is null or split_part(new.storage_path,'/',1)<>owner_id::text
    or split_part(new.storage_path,'/',2)<>new.portfolio_id::text
    or not app_private.storage_path_is_canonical(new.storage_path) then
    raise exception 'horoscope_storage_namespace_invalid' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function app_private.enforce_horoscope_storage_namespace() from public,anon,authenticated,service_role;
create trigger enforce_horoscope_storage_namespace before insert or update on public.portfolio_horoscopes
for each row execute function app_private.enforce_horoscope_storage_namespace();

create or replace function public.resolve_approved_horoscope(p_share_token text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.require_current_session();
  if not app_private.pilot_public_portfolio_allowed(p_share_token) then return null; end if;
  result:=app_private.resolve_approved_horoscope(p_share_token);
  -- Existing invalid rows must also fail closed; adding a write guard alone
  -- cannot make historical owner-controlled descriptors safe for trusted signing.
  if result is null or not exists(
    select 1 from public.portfolios p where p.share_token=p_share_token
      and split_part(result->>'accessPath','/',1)=p.user_id::text
      and split_part(result->>'accessPath','/',2)=p.id::text
      and app_private.storage_path_is_canonical(result->>'accessPath')
  ) then return null; end if;
  return result;
end; $$;
