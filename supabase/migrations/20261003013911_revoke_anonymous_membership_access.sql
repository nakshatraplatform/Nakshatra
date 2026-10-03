-- Supabase installations can grant new public tables to anon by default.
-- Memberships have only authenticated RLS policies and guarded team RPCs;
-- signed-out callers have no direct table operations in this contract.
-- Preserve the explicit authenticated/service_role grants and all RLS policies.
revoke all privileges on table public.organization_members from public, anon;
