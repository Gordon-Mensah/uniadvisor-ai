-- ═══════════════════════════════════════════════════════════════
-- UniAdvisor AI — Supabase row-level security
-- ═══════════════════════════════════════════════════════════════
-- Goal: the public anon key (shipped in the frontend bundle) can ONLY read
-- currently active announcements. Everything else goes through the FastAPI
-- backend, which uses the service-role key (service_role bypasses RLS).
--
-- ORDER MATTERS:
--   1. Set SUPABASE_SERVICE_ROLE_KEY on the backend (Render) and redeploy.
--   2. Deploy the frontend that no longer writes to Supabase directly.
--   3. Run this script in the Supabase SQL editor.
-- Running it before step 1 cuts the backend off from the database.
--
-- Enabling RLS with no policy = deny all for anon/authenticated.
-- The REVOKEs are defence in depth in case a permissive policy is added later.

begin;

-- ── Every table the app uses ──────────────────────────────────
alter table if exists public.users               enable row level security;
alter table if exists public.auth_tokens         enable row level security;
alter table if exists public.announcements       enable row level security;
alter table if exists public.announcement_reads  enable row level security;
alter table if exists public.chat_logs           enable row level security;
alter table if exists public.office_analytics    enable row level security;
alter table if exists public.feedback            enable row level security;
alter table if exists public.escalations         enable row level security;
alter table if exists public.progress_tasks      enable row level security;
alter table if exists public.campus_events       enable row level security;
alter table if exists public.audit_log           enable row level security;
alter table if exists public.document_chunks     enable row level security;
alter table if exists public.staff_messages      enable row level security;
alter table if exists public.survey_responses    enable row level security;

-- ── Remove any existing policies on these tables ──────────────
-- (old permissive policies would otherwise stay in force)
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'users','auth_tokens','announcements','announcement_reads','chat_logs',
      'office_analytics','feedback','escalations','progress_tasks','campus_events',
      'audit_log','document_chunks','staff_messages','survey_responses')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ── Table privileges: anon/authenticated get nothing... ───────
revoke all on public.users, public.auth_tokens, public.announcement_reads,
              public.chat_logs, public.office_analytics, public.feedback,
              public.escalations, public.progress_tasks, public.campus_events,
              public.audit_log, public.document_chunks, public.staff_messages,
              public.survey_responses
  from anon, authenticated;

-- ── ...except SELECT on announcements ─────────────────────────
revoke all on public.announcements from anon, authenticated;
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
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
-- select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';
