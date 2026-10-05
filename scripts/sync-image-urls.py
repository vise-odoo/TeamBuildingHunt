#!/usr/bin/env python3
"""Uploads puzzle-images/* to the "puzzle-images" Supabase Storage bucket and
fills in the image_url column of data/locations.csv by matching each file's
"L<id>-..." prefix to a location id.

Usage: ./scripts/sync-image-urls.py
       (or SUPABASE_SERVICE_ROLE_KEY="the project's service_role key" ./scripts/sync-image-urls.py)

SUPABASE_SERVICE_ROLE_KEY is read from the env var if set, else from
config.ini's [secrets] section (gitignored local file - copy
config_template.ini to get started). It's a secret (Supabase dashboard ->
Project Settings -> API): keep it local only, never commit it and never add
it as a GitHub Actions secret.
"""
import configparser
import csv
import mimetypes
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(ROOT, "puzzle-images")
LOCATIONS_CSV = os.path.join(ROOT, "data", "locations.csv")
CONFIG_PATH = os.path.join(ROOT, "config.ini")
BUCKET = "puzzle-images"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://dhcohqbbnlfkjpihoqop.supabase.co")
FILENAME_RE = re.compile(r"^(L\d+)-.+\.(jpe?g|png|webp)$", re.IGNORECASE)


def get_secret(key):
    value = os.environ.get(key)
    if value:
        return value
    parser = configparser.ConfigParser()
    if os.path.isfile(CONFIG_PATH):
        parser.read(CONFIG_PATH)
        value = parser.get("secrets", key, fallback="")
    return value or None


def find_images():
    """Returns {location_id: filename}, warning on ambiguous/unmatched files."""
    by_id = {}
    for filename in sorted(os.listdir(IMAGES_DIR)):
        match = FILENAME_RE.match(filename)
        if not match:
            if os.path.isfile(os.path.join(IMAGES_DIR, filename)):
                print(f"  skip (doesn't look like 'L<id>-...jpg/png/webp'): {filename}")
            continue
        loc_id = match.group(1)
        if loc_id in by_id:
            print(f"  warning: multiple images for {loc_id} ({by_id[loc_id]!r} and "
                  f"{filename!r}) - keeping {by_id[loc_id]!r}")
            continue
        by_id[loc_id] = filename
    return by_id


def upload(service_role_key, filename):
    path = os.path.join(IMAGES_DIR, filename)
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    quoted_name = urllib.parse.quote(filename)
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{quoted_name}"

    with open(path, "rb") as f:
        data = f.read()

    request = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {service_role_key}",
        "apikey": service_role_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    })
    try:
        urllib.request.urlopen(request)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Upload failed for {filename}: {e.code} {e.read().decode(errors='replace')}")

    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{quoted_name}"


def sync_csv(url_by_id):
    with open(LOCATIONS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    updated, missing = [], []
    for row in rows:
        url = url_by_id.get(row["id"])
        if url:
            row["image_url"] = url
            updated.append(row["id"])
        elif not row.get("image_url"):
            missing.append(row["id"])

    with open(LOCATIONS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return updated, missing


def main():
    service_role_key = get_secret("SUPABASE_SERVICE_ROLE_KEY")
    if not service_role_key:
        print("Set SUPABASE_SERVICE_ROLE_KEY (env var) or fill it into config.ini "
              "(Project Settings -> API -> service_role) before running this script.",
              file=sys.stderr)
        raise SystemExit(1)

    # Pull in whatever was last edited in data/locations.json before touching
    # the CSV.
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "json-to-csv.py")], check=True)

    if not os.path.isfile(LOCATIONS_CSV):
        print(f"{LOCATIONS_CSV} not found - run ./scripts/decrypt-data.sh first.", file=sys.stderr)
        raise SystemExit(1)

    print(f"Scanning {IMAGES_DIR}...")
    images_by_id = find_images()

    print(f"Uploading {len(images_by_id)} image(s) to the '{BUCKET}' bucket...")
    url_by_id = {}
    for loc_id, filename in sorted(images_by_id.items()):
        url_by_id[loc_id] = upload(service_role_key, filename)
        print(f"  {loc_id}: {filename} -> {url_by_id[loc_id]}")

    updated, missing = sync_csv(url_by_id)
    print(f"\nUpdated image_url for: {', '.join(updated) if updated else '(none)'}")
    if missing:
        print(f"Still no image for: {', '.join(missing)}")

    # Reflect the new image_url values back into data/locations.json.
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "csv-to-json.py")], check=True)


if __name__ == "__main__":
    main()
