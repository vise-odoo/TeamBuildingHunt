-- Seed data: teams + starting progress.
--
-- Puzzle content (locations) and each team's route + codes are filled in
-- separately, via CSV import into the `locations` and `team_routes`
-- tables — see locations_template.csv and routes_template.csv.

insert into teams (id, name) values
  ('team1', 'Team 1'),
  ('team2', 'Team 2'),
  ('team3', 'Team 3')
on conflict (id) do nothing;

insert into team_progress (team_id, current_index) values
  ('team1', 1),
  ('team2', 1),
  ('team3', 1)
on conflict (team_id) do nothing;
