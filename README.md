# Team Building Hunt

A Mobile-running puzzle hunt for out Tech-Support Team Building day in HK.
Teams have to solve riddles, leading them to physical locations around the city.

Answer codes are validated server-side (`check_step_code` in `schema.sql`) and
are never sent to the browser or readable through the public API — only the
riddle text, hints, and images are.

## One-time project setup

1. In the Supabase project's SQL Editor, run `schema.sql`, then `seed.sql`
   (creates the 3 teams and their starting progress).
2. In the GitHub repo settings, there are Actions secrets:
   - `SUPABASE_DB_URL`: the project's direct Postgres connection string
     (Project Settings → Database → Connection string).
   - `DATA_KEY`: a passphrase used to encrypt/decrypt the real location and
     route data (pick anything, keep it out of git — e.g. a password manager).

## Updating locations / routes (real answer codes)

The real data lives in `data/locations.csv` and `data/routes.csv`, which are
**gitignored** — only their encrypted form (`data/*.csv.enc`) is committed, so
the public repo never contains plaintext answer codes.

1. `DATA_KEY=... ./scripts/decrypt-data.sh` to get local, editable CSVs (or
   start from `locations_template.csv` / `routes_template.csv`, which document
   the column layout with codes left blank).
2. Edit `data/locations.csv` / `data/routes.csv`.
3. `DATA_KEY=... ./scripts/encrypt-data.sh` to regenerate the `.enc` files.
4. Commit and push the `.enc` files (never the plaintext `.csv` ones — they're
   gitignored on purpose).

Pushing to `main` with changes under `schema.sql`, `seed.sql` or `data/**`
triggers `.github/workflows/deploy-db.yml`, which decrypts the data and
applies the schema, re-runs `seed.sql`, and upserts locations/routes into
Supabase automatically — all three files are safe to re-run repeatedly.
