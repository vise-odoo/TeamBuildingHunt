-- Puzzle hunt - Supabase schema

create table if not exists teams (
  id text primary key,
  name text not null
);

create table if not exists team_progress (
  team_id text primary key references teams(id),
  current_index int not null default 1,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id text primary key,
  title text not null,
  riddle_text text not null,
  location_hint text,
  location_name text,
  image_url text -- optional photo clue (link to an externally hosted image)
);

create table if not exists team_routes (
  team_id text references teams(id),
  location_id text references locations(id),
  order_index int not null,
  code text not null,
  primary key (team_id, location_id),
  unique (team_id, order_index)
);

-- Table permissions (open read access)
-- Only team_progress is writable by the app.
alter table teams enable row level security;
alter table locations enable row level security;
alter table team_routes enable row level security;
alter table team_progress enable row level security;

create policy "teams_public_read" on teams
  for select using (true);

create policy "locations_public_read" on locations
  for select using (true);

create policy "routes_public_read" on team_routes
  for select using (true);

create policy "progress_public_read" on team_progress
  for select using (true);

create policy "progress_public_update" on team_progress
  for update using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select on teams to anon, authenticated;
grant select on locations to anon, authenticated;
grant select on team_routes to anon, authenticated;
grant select, update on team_progress to anon, authenticated;

-- Enables realtime tracking of team_progress
alter publication supabase_realtime add table team_progress;
