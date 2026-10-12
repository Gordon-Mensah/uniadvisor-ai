-- Persistent document management: upload date per chunk + fast lookups by document.
-- Run in the Supabase SQL editor BEFORE deploying the backend that uses it.
-- (The backend still works without it, but then the documents list has no upload dates.)

-- 1. Upload date. Existing rows get the time this migration runs, because their real
--    upload date was never stored; re-upload a document to give it a correct date.
alter table public.document_chunks
  add column if not exists uploaded_at timestamptz not null default now();

-- 2. Re-upload and delete look up all chunks of one document by its name (source).
create index if not exists document_chunks_source_idx on public.document_chunks (source);

-- 3. Check: one row per document with chunk count and upload date.
select source, office, count(*) as chunks, max(uploaded_at) as uploaded_at
from public.document_chunks
group by source, office
order by source;
