-- ═══════════════════════════════════════════════════════════════
-- UniAdvisor AI — Supabase row-level security
-- ═══════════════════════════════════════════════════════════════
-- Goal: the public anon key (shipped in the frontend bundle) can ONLY read
-- currently active announcements. Everything else goes through the FastAPI
-- backend, which uses SUPABASE_SERVICE_ROLE_KEY (service_role bypasses RLS).
--
-- The only direct Supabase access left in the frontend:
--   src/App.jsx          AnnouncementBanner  SELECT announcements (active, scheduled)
--   src/StaffPortal.jsx  loadAnnouncements   SELECT announcements (active, scheduled)
--
-- ORDER MATTERS:
--   1. Set SUPABASE_SERVICE_ROLE_KEY and JWT_SECRET on the backend (Render) and redeploy.
--   2. Deploy the frontend that no longer reads/writes other tables directly.
--   3. Run this script in the Supabase SQL editor.
--
-- This covers EVERY table in the public schema, not a fixed list, so tables
-- created outside this codebase are locked down too. RLS enabled with no
-- policy = deny all for anon/authenticated.

begin;

do $$
declare
  t record;
  p record;
begin
  -- 1. Enable RLS on every table in public
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;

  -- 2. Drop every existing policy (old permissive ones would stay in force)
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3. Tables created later get no anon/authenticated access by default
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 4. The single exception: read currently active announcements
grant select on public.announcements to anon, authenticated;

create policy "Public can read active announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (
    active = true
    and scheduled_at <= now()
    and (expires_at is null or expires_at > now())
  );

commit;

-- ── Check the result ──────────────────────────────────────────
-- Every row should show rowsecurity = true:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- Only one policy should be listed:
--   select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';
--
-- New tables: RLS is NOT enabled automatically. Re-run this script, or run
--   alter table public.<name> enable row level security;
