#!/usr/bin/env bash
# Decrypts data/locations.csv.enc and data/routes.csv.enc back into
# data/locations.csv and data/routes.csv (gitignored) for local editing.
#
# DATA_KEY is read from the DATA_KEY env var if set, else from config.ini's
# [secrets] section (gitignored local file - copy config_template.ini to get
# started).
#
# Usage: ./scripts/decrypt-data.sh   (or DATA_KEY=... ./scripts/decrypt-data.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

export DATA_KEY="${DATA_KEY:-$(./scripts/read-config.py DATA_KEY)}"
if [ -z "${DATA_KEY:-}" ]; then
  echo "Set DATA_KEY (env var) or fill it into config.ini before running this script." >&2
  exit 1
fi

for name in locations routes; do
  src="data/$name.csv.enc"
  if [ ! -f "$src" ]; then
    echo "Skipping $src (not found)." >&2
    continue
  fi
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -pass env:DATA_KEY -in "$src" -out "data/$name.csv"
  echo "Decrypted $src -> data/$name.csv"
done

# Edit the .json files, not the .csv - see scripts/csv-to-json.py.
./scripts/csv-to-json.py
