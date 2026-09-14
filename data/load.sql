-- Idempotent load of locations + team_routes from the decrypted working CSVs.
-- Usage: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f data/load.sql

begin;

create temporary table tmp_locations (
  id text,
  title text,
  riddle_text text,
  location_hint text,
  location_name text,
  image_url text
) on commit drop;

\copy tmp_locations from '/tmp/locations.csv' with (format csv, header true)

insert into locations (id, title, riddle_text, location_hint, location_name, image_url)
select id, title, riddle_text, nullif(location_hint, ''), nullif(location_name, ''), nullif(image_url, '')
from tmp_locations
on conflict (id) do update set
  title = excluded.title,
  riddle_text = excluded.riddle_text,
  location_hint = excluded.location_hint,
  location_name = excluded.location_name,
  image_url = excluded.image_url;

create temporary table tmp_routes (
  team_id text,
  location_id text,
  order_index int,
  code text,
  fragment text,
  fragment_for text
) on commit drop;

\copy tmp_routes from '/tmp/routes.csv' with (format csv, header true)

insert into team_routes (team_id, location_id, order_index, code, fragment, fragment_for)
select team_id, location_id, order_index, code, nullif(fragment, ''), nullif(fragment_for, '')
from tmp_routes
on conflict (team_id, location_id) do update set
  order_index = excluded.order_index,
  code = excluded.code,
  fragment = excluded.fragment,
  fragment_for = excluded.fragment_for;

commit;
