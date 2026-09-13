#!/usr/bin/env bash
# Encrypts data/locations.csv and data/routes.csv (real answer codes, gitignored)
# into data/locations.csv.enc and data/routes.csv.enc, which are safe to commit.
#
# Usage: DATA_KEY="the same passphrase as the GitHub secret" ./scripts/encrypt-data.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATA_KEY:-}" ]; then
  echo "Set DATA_KEY (same passphrase as the GitHub Actions 'DATA_KEY' secret) before running this script." >&2
  exit 1
fi

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
