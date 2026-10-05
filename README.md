# Team Building Hunt

A Mobile-running puzzle hunt for out Tech-Support Team Building day in HK.
Teams have to solve riddles, leading them to physical locations around the city.

Answer codes are validated server-side (`check_step_code` in `schema.sql`) and
are never sent to the browser or readable through the public API — only the
riddle text, hints, and images are.

## One-time project setup

1. Create a Supabase project.
2. In the GitHub repo settings, there are Actions secrets:
   - `SUPABASE_DB_URL`: the project's direct Postgres connection string
     (Project Settings → Database → Connection string).
   - `DATA_KEY`: a passphrase used to encrypt/decrypt the real location and
     route data (pick anything, keep it out of git — e.g. a password manager).
3. Locally, copy `config_template.ini` to `config.ini` and fill in:
   - `DATA_KEY`: the same passphrase as the GitHub secret above.
   - `SUPABASE_SERVICE_ROLE_KEY`: the project's service_role key (Project
     Settings → API → service_role), used for syncing photos (below).

## Updating locations & routes

The real data lives in `data/locations.csv` and `data/routes.csv`, which are
**gitignored** — only their encrypted form (`data/*.csv.enc`) is committed, so
the public repo never contains plaintext answer codes.

1. `./scripts/decrypt-data.sh` to decrypt the CSVs, then auto-convert them to
   `data/locations.json` / `data/routes.json` (or start from
   `locations_template.csv` / `routes_template.csv`, which document the
   column layout with codes left blank).
2. Edit `data/locations.json` / `data/routes.json` — JSON is much easier to
   hand-edit than CSV (no comma/quote escaping in riddle text). **Don't edit
   the `.csv` files directly**: both scripts below regenerate them from the
   JSON every time, so direct CSV edits get silently overwritten.
3. To update photo clues: drop/replace files in `puzzle-images/`, named
   `L<id>-description.jpg`, then run `./scripts/sync-image-urls.py`. It
   converts your JSON edits to CSV, uploads the photos, fills in `image_url`,
   and reflects the result back into the JSON — safe to re-run.
4. `./scripts/encrypt-data.sh` to convert the JSON back to CSV and regenerate
   the `.enc` files.

## Real-time updates

Pushing to `main` with changes under `schema.sql`, `seed.sql` or `data/**`
triggers `.github/workflows/deploy-db.yml`, which decrypts the data and
applies the schema, re-runs `seed.sql`, and upserts locations/routes into
Supabase automatically — all three files are safe to re-run repeatedly.
