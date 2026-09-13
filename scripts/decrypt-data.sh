#!/usr/bin/env bash
# Decrypts data/locations.csv.enc and data/routes.csv.enc back into
# data/locations.csv and data/routes.csv (gitignored) for local editing.
#
# Usage: DATA_KEY="the same passphrase as the GitHub secret" ./scripts/decrypt-data.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATA_KEY:-}" ]; then
  echo "Set DATA_KEY (same passphrase as the GitHub Actions 'DATA_KEY' secret) before running this script." >&2
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
