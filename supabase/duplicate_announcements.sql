-- Find and clean up duplicate announcements (same text and type posted more than once).
-- The student banner already shows each distinct announcement once; this removes the
-- extra copies from the data so staff/admin lists and read receipts are clean too.
-- Run in the Supabase SQL editor, step by step.

-- 1. Which active announcements are duplicated, and how often?
select type, trim(text) as text, count(*) as copies, min(id) as keep_id, array_agg(id order by id) as ids,
       array_agg(created_by order by id) as created_by, array_agg(created_at order by id) as created_at
from public.announcements
where active = true
group by type, trim(text)
having count(*) > 1
order by copies desc;

-- 2. Deactivate every copy except the oldest (lowest id). Soft delete, like the app's
--    own "delete": rows stay in the table with active = false.
update public.announcements a
set active = false
where a.active = true
  and exists (
    select 1 from public.announcements b
    where b.active = true
      and b.type = a.type
      and trim(b.text) = trim(a.text)
      and b.id < a.id
  );

-- 3. Check: should return no rows.
select type, trim(text), count(*) from public.announcements
where active = true group by type, trim(text) having count(*) > 1;
