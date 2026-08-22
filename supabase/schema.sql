-- SommAI cloud sync schema
-- Run this once in the Supabase dashboard → SQL Editor → New query → paste → Run.

-- One row per household account. Palates, journal, and the default table
-- are stored as JSON documents — flexible while the product is young.
create table if not exists public.sommai_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  palates jsonb not null default '[]'::jsonb,
  journal jsonb not null default '[]'::jsonb,
  default_table jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sommai_state enable row level security;

-- Each signed-in account can only touch its own row.
drop policy if exists "own state select" on public.sommai_state;
create policy "own state select" on public.sommai_state
  for select using (auth.uid() = user_id);

drop policy if exists "own state insert" on public.sommai_state;
create policy "own state insert" on public.sommai_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "own state update" on public.sommai_state;
create policy "own state update" on public.sommai_state
  for update using (auth.uid() = user_id);
