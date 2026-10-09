-- Add an "office" column to escalations (Ask an advisor → routed to an office).
-- Values are the office ids from rag.py OFFICES:
--   study_office, iro, finance, it_helpdesk, library, student_union,
--   cs_dept, engineering, economics, general
-- Existing escalations get 'general'. Run in the Supabase SQL editor, before
-- deploying the backend that writes this column.

alter table public.escalations
  add column if not exists office text not null default 'general';

create index if not exists escalations_office_idx on public.escalations (office);

-- Staff see the escalations of the office matching users.department, compared
-- case-insensitively with the office id or name (e.g. 'Study Office' or 'study_office').
-- Check which staff accounts would not match any office:
--   select email, department from public.users
--   where role = 'staff'
--     and lower(coalesce(department, '')) not in (
--       'study_office','study office','iro','international relations office',
--       'finance','finance & fees office','it_helpdesk','it helpdesk','library',
--       'student_union','student union','cs_dept','computer science dept.',
--       'engineering','engineering dept.','economics','economics & business dept.',
--       'general','general / university-wide');
