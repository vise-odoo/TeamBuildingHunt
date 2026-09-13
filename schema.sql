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
  fragment text, -- clue fragment revealed to other teams once this team solves this step (shared checkpoints only)
  primary key (team_id, location_id),
  unique (team_id, order_index)
);

-- Table permissions (open read access)
-- team_progress and the answer codes are never writable/readable directly by, use check_code() instead!
alter table teams enable row level security;
alter table locations enable row level security;
alter table team_routes enable row level security;
alter table team_progress enable row level security;

drop policy if exists "teams_public_read" on teams;
create policy "teams_public_read" on teams
  for select using (true);

drop policy if exists "locations_public_read" on locations;
create policy "locations_public_read" on locations
  for select using (true);

drop policy if exists "routes_public_read" on team_routes;
create policy "routes_public_read" on team_routes
  for select using (true);

drop policy if exists "progress_public_read" on team_progress;
create policy "progress_public_read" on team_progress
  for select using (true);

drop policy if exists "progress_public_update" on team_progress;
revoke update on team_progress from anon, authenticated;
revoke select on team_routes from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on teams to anon, authenticated;
grant select on locations to anon, authenticated;
grant select (team_id, location_id, order_index, fragment) on team_routes to anon, authenticated;
grant select on team_progress to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_progress'
  ) then
    alter publication supabase_realtime add table team_progress;
  end if;
end $$;

create or replace function public.check_step_code(p_team_id text, p_order_index int, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current int;
  v_history jsonb;
  v_expected text;
begin
  select current_index, history into v_current, v_history
    from team_progress where team_id = p_team_id for update;

  if not found or v_current is distinct from p_order_index then
    return false;
  end if;

  select code into v_expected from team_routes
    where team_id = p_team_id and order_index = p_order_index;

  if v_expected is null or upper(trim(v_expected)) <> upper(trim(p_code)) then
    return false;
  end if;

  update team_progress
  set current_index = v_current + 1,
      history = v_history || jsonb_build_object('order_index', v_current, 'solved_at', now()),
      updated_at = now()
  where team_id = p_team_id;

  return true;
end;
$$;

revoke all on function public.check_step_code(text, int, text) from public;
grant execute on function public.check_step_code(text, int, text) to anon, authenticated;
