-- ═══════════════════════════════════════════════════════════════
-- UniAdvisor AI — database schema (Supabase / PostgreSQL)
-- ═══════════════════════════════════════════════════════════════
-- Creates every table the backend (main.py, rag.py) reads or writes, with the
-- columns the code uses. Generated from the code; safe to re-run (IF NOT EXISTS).
--
-- Order for a fresh Supabase project:
--   1. Run this file in the Supabase SQL editor.
--   2. Run supabase/rls_policies.sql (row-level security: the public anon key can
--      only read active announcements; everything else goes through the backend,
--      which uses the service-role key).
--   3. Create an admin user (see "First admin account" at the end of this file).
--
-- The other files in supabase/ are migrations for databases created before these
-- columns existed; a database created from this file does not need them.

-- ── Users and sessions ──────────────────────────────────────────
create table if not exists public.users (
  id               bigint generated always as identity primary key,
  email            text unique not null,          -- stored lower-case
  password_hash    text not null,                 -- bcrypt (see hash_passwords.py)
  full_name        text,
  role             text not null default 'student' check (role in ('student', 'staff', 'admin')),
  major            text,
  year_of_study    text,
  nationality      text,
  student_id       text,
  department       text,                          -- staff: office id or name from rag.py OFFICES
  language_pref    text not null default 'en',    -- 'en' or 'hu'
  active           boolean not null default true,
  onboarding_done  boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.auth_tokens (
  id          bigint generated always as identity primary key,
  user_id     bigint references public.users (id) on delete cascade,
  token       text not null,
  expires_at  timestamptz not null,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists auth_tokens_token_idx on public.auth_tokens (token);

create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  actor_email  text,
  actor_role   text,
  action       text not null,                     -- e.g. UPLOAD_DOCUMENT, DELETE_DOCUMENT, REPLY_ESCALATION
  target       text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ── Knowledge base ──────────────────────────────────────────────
create table if not exists public.document_chunks (
  id           bigint generated always as identity primary key,
  text         text not null,
  source       text not null,                     -- document name; one document = many chunks
  office       text not null default 'general',   -- office id from rag.py OFFICES
  page         int,
  uploaded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists document_chunks_source_idx on public.document_chunks (source);
create index if not exists document_chunks_office_idx on public.document_chunks (office);

-- ── Chat logging and analytics (anonymous) ──────────────────────
create table if not exists public.chat_logs (
  id             bigint generated always as identity primary key,
  question       text,
  answer         text,
  student_name   text,                            -- no longer written (anonymous logs)
  major          text,
  year_of_study  text,
  nationality    text,                            -- no longer written (anonymous logs)
  office_routed  text,
  session_id     text,
  asked_at       timestamptz not null default now()
);

create table if not exists public.office_analytics (
  id           bigint generated always as identity primary key,
  office_id    text,
  office_name  text,
  question     text,
  rating       text,                              -- 'up' / 'down' when written from feedback
  asked_at     timestamptz not null default now()
);

create table if not exists public.feedback (
  id             bigint generated always as identity primary key,
  student_email  text,
  question       text,
  answer         text,
  rating         text,                            -- 'up' or 'down'
  office         text,
  created_at     timestamptz not null default now()
);

-- ── Staff features ──────────────────────────────────────────────
create table if not exists public.announcements (
  id            bigint generated always as identity primary key,
  text          text not null,
  type          text not null default 'info',     -- 'info', 'warning', 'urgent'
  active        boolean not null default true,
  scheduled_at  timestamptz not null default now(),
  expires_at    timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);

create table if not exists public.announcement_reads (
  announcement_id  bigint not null references public.announcements (id) on delete cascade,
  student_email    text not null,
  action           text not null default 'read',  -- 'read' or 'dismissed'
  created_at       timestamptz not null default now(),
  primary key (announcement_id, student_email)    -- the backend upserts on this pair
);

create table if not exists public.staff_messages (
  id          bigint generated always as identity primary key,
  from_email  text not null,
  from_name   text,
  to_target   text not null,                      -- a student email, or a group such as 'all' / 'year 1'
  type        text not null default 'info',
  text        text not null,
  is_group    boolean not null default false,
  sent_at     timestamptz not null default now()
);

create table if not exists public.escalations (
  id             bigint generated always as identity primary key,
  student_email  text,
  student_name   text,
  subject        text,
  message        text,
  office         text not null default 'general', -- office id from rag.py OFFICES
  status         text not null default 'open',    -- 'open' or 'replied'
  admin_reply    text,
  replied_by     text,
  replied_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists escalations_office_idx on public.escalations (office);

create table if not exists public.campus_events (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text,
  location     text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  category     text not null default 'academic',
  created_by   text,
  created_at   timestamptz not null default now()
);

-- ── Student features ────────────────────────────────────────────
create table if not exists public.progress_tasks (
  id             bigint generated always as identity primary key,
  student_email  text not null,
  task_key       text not null,
  label          text,
  done           boolean not null default false,
  done_at        timestamptz,
  unique (student_email, task_key)                -- the backend upserts on this pair
);

create table if not exists public.survey_responses (
  id                     bigint generated always as identity primary key,
  student_email          text,                    -- 'anonymous' for the public survey page
  student_name           text,
  student_nationality    text,
  student_major          text,
  student_year           text,
  arrival_confusion      text,                    -- comma-separated choices
  info_source            text,
  hardest_topic          text,
  info_quality           int,                     -- 1–5
  uniadvisor_usefulness  int,                     -- 1–5
  missing_feature        text,
  open_feedback          text,
  submitted_at           timestamptz not null default now()
);

-- ── First admin account ─────────────────────────────────────────
-- 1. python hash_passwords.py "your-admin-password"   (prints a bcrypt hash)
-- 2. insert into public.users (email, password_hash, full_name, role, onboarding_done)
--    values ('admin@example.com', '<hash from step 1>', 'Administrator', 'admin', true);
