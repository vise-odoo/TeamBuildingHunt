#!/usr/bin/env bash
# Encrypts data/locations.csv and data/routes.csv (real answer codes, gitignored)
# into data/locations.csv.enc and data/routes.csv.enc, which are safe to commit.
#
# DATA_KEY is read from the DATA_KEY env var if set, else from config.ini's
# [secrets] section (gitignored local file - copy config_template.ini to get
# started).
#
# Usage: ./scripts/encrypt-data.sh   (or DATA_KEY=... ./scripts/encrypt-data.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

export DATA_KEY="${DATA_KEY:-$(./scripts/read-config.py DATA_KEY)}"
if [ -z "${DATA_KEY:-}" ]; then
  echo "Set DATA_KEY (env var) or fill it into config.ini before running this script." >&2
  exit 1
fi

# Pull in whatever was last edited in the .json files before encrypting.
./scripts/json-to-csv.py

for name in locations routes; do
  src="data/$name.csv"
  if [ ! -f "$src" ]; then
    echo "Skipping $src (not found)." >&2
    continue
  fi
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass env:DATA_KEY -in "$src" -out "data/$name.csv.enc"
  echo "Encrypted $src -> data/$name.csv.enc"
done
