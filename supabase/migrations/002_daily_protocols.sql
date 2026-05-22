-- AI-generated daily gameplans (SAD §3.3)
create table if not exists public.daily_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  protocol_date date not null default (timezone('utc', now()))::date,
  blocks jsonb not null default '[]'::jsonb,
  source text not null default 'ai',
  generated_at timestamptz not null default now(),
  unique (user_id, protocol_date)
);

alter table public.daily_protocols enable row level security;

create policy "daily_protocols_select_own" on public.daily_protocols
  for select using (auth.uid() = user_id);

create policy "daily_protocols_insert_own" on public.daily_protocols
  for insert with check (auth.uid() = user_id);

create policy "daily_protocols_update_own" on public.daily_protocols
  for update using (auth.uid() = user_id);
