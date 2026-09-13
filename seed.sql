-- Seed data: teams + starting progress.
--

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
