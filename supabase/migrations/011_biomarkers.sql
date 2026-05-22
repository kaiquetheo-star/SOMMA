-- Biomarker readings + lab document vault (SAD §5.8)
-- Run after 006_profiles_biological_passport.sql

-- ---------------------------------------------------------------------------
-- Lab uploads metadata (files live in Storage bucket biomarker-labs)
-- ---------------------------------------------------------------------------
create table if not exists public.biomarker_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists biomarker_documents_user_uploaded_idx
  on public.biomarker_documents (user_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Marker readings (manual entry or linked to a lab upload)
-- ---------------------------------------------------------------------------
create table if not exists public.biomarker_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  marker_id text not null,
  value numeric not null,
  unit text not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'manual'
    check (source in ('manual', 'lab_upload')),
  document_id uuid references public.biomarker_documents (id) on delete set null,
  notes text
);

create index if not exists biomarker_readings_user_marker_time_idx
  on public.biomarker_readings (user_id, marker_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.biomarker_documents enable row level security;
alter table public.biomarker_readings enable row level security;

drop policy if exists "biomarker_documents_select_own" on public.biomarker_documents;
drop policy if exists "biomarker_documents_insert_own" on public.biomarker_documents;
drop policy if exists "biomarker_documents_delete_own" on public.biomarker_documents;

create policy "biomarker_documents_select_own" on public.biomarker_documents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "biomarker_documents_insert_own" on public.biomarker_documents
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "biomarker_documents_delete_own" on public.biomarker_documents
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "biomarker_readings_select_own" on public.biomarker_readings;
drop policy if exists "biomarker_readings_insert_own" on public.biomarker_readings;

create policy "biomarker_readings_select_own" on public.biomarker_readings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "biomarker_readings_insert_own" on public.biomarker_readings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, delete on table public.biomarker_documents to authenticated;
grant select, insert on table public.biomarker_readings to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket: biomarker-labs (private, user-scoped paths)
-- Path convention: {user_id}/{document_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'biomarker-labs',
  'biomarker-labs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "biomarker_labs_select_own" on storage.objects;
drop policy if exists "biomarker_labs_insert_own" on storage.objects;
drop policy if exists "biomarker_labs_update_own" on storage.objects;
drop policy if exists "biomarker_labs_delete_own" on storage.objects;

create policy "biomarker_labs_select_own" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'biomarker-labs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "biomarker_labs_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'biomarker-labs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "biomarker_labs_update_own" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'biomarker-labs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'biomarker-labs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "biomarker_labs_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'biomarker-labs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
