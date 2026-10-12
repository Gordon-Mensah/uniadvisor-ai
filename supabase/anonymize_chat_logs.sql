-- Anonymise existing chat logs: clear student_name and nationality.
-- The backend no longer writes these columns; this clears the old rows.
-- The columns themselves are kept. Run in the Supabase SQL editor.
-- Not reversible: take a backup first if you might need the old values.

-- 1. How many rows still hold personal data?
select count(*) as rows_to_clear
from public.chat_logs
where student_name is not null or nationality is not null;

-- 2. Clear them.
update public.chat_logs
set student_name = null,
    nationality  = null
where student_name is not null or nationality is not null;

-- 3. Check: should return 0.
select count(*) as remaining
from public.chat_logs
where student_name is not null or nationality is not null;
