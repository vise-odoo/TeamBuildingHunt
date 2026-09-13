-- Seed data

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

-- Steps specific to each team
insert into puzzles (team_id, order_index, title, riddle_text, location_hint, code, unlock_text)
select t.id, s.order_index, 'Step ' || s.order_index,
       '[Puzzle text TBD]', '[Location TBD]',
       'CODE' || s.order_index || '-' || t.id,
       'Nice, now head towards the next step!'
from teams t
cross join (values (1),(2),(3),(5),(6),(8),(10)) as s(order_index);

-- Crossover steps
insert into puzzles (team_id, order_index, title, riddle_text, location_hint, code, unlock_text)
values
  (null, 4, 'Step 4 - Crossover', '[Puzzle text TBD]', '[Location TBD]', 'CROSSOVER-4', 'Nice, now head towards the next step!'),
  (null, 7, 'Step 7 - Crossover', '[Puzzle text TBD]', '[Location TBD]', 'CROSSOVER-7', 'Nice, now head towards the next step!'),
  (null, 9, 'Step 9 - Crossover', '[Puzzle text TBD]', '[Location TBD]', 'CROSSOVER-9', 'Nice, now head towards the next step!');

-- Final step (10): dinner!
update puzzles set unlock_text = 'Nice, the rest of the team is waiting for you for dinner!'
where order_index = 10;
