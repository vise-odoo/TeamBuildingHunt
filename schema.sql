-- Puzzle hunt - Supabase schema

create table if not exists teams (
  id text primary key,
  name text not null
);

create table if not exists puzzles (
  id uuid primary key default gen_random_uuid(),
  team_id text references teams(id), -- team_id = NULL means a shared/crossover step
  order_index int not null,
  title text not null,
  riddle_text text not null,
  location_hint text,
  code text not null,
  unlock_text text not null
);

create table if not exists team_progress (
  team_id text primary key references teams(id),
  current_index int not null default 1,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Table permissions (open read access)
-- Only team_progress is writable
alter table teams enable row level security;
alter table puzzles enable row level security;
alter table team_progress enable row level security;

create policy "teams_public_read" on teams
  for select using (true);

create policy "puzzles_public_read" on puzzles
  for select using (true);

create policy "progress_public_read" on team_progress
  for select using (true);

create policy "progress_public_update" on team_progress
  for update using (true) with check (true);

-- Enables realtime tracking of team_progress
alter publication supabase_realtime add table team_progress;
