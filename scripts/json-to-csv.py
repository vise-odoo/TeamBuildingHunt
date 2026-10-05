#!/usr/bin/env python3
"""Converts data/locations.json and data/routes.json back to matching .csv
files - the format scripts/encrypt-data.sh and data/load.sql expect.

Runs automatically at the start of encrypt-data.sh and sync-image-urls.py,
so edits made in the .json files always make it into the encrypted/deployed
.csv. Rows are matched to CSV columns by key name (not position), so this is
safe even if a row in the JSON is missing a key or has its keys reordered.

Usage: ./scripts/json-to-csv.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def main():
    for name in ["locations", "routes"]:
        json_path = os.path.join(DATA_DIR, f"{name}.json")
        if not os.path.isfile(json_path):
            print(f"Skipping {json_path} (not found).")
            continue

        with open(json_path, encoding="utf-8") as jsonfile:
            rows = json.load(jsonfile)

        fieldnames = list(rows[0].keys()) if rows else []
        csv_path = os.path.join(DATA_DIR, f"{name}.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Converted {json_path} -> {csv_path}")


if __name__ == "__main__":
    main()
