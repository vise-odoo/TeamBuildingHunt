#!/usr/bin/env python3
"""Converts data/locations.csv and data/routes.csv to matching .json files,
so they can be edited as JSON instead of wrangling CSV's comma/quote escaping.

Runs automatically at the end of decrypt-data.sh and at the end of
sync-image-urls.py, so the .json files always reflect the latest .csv.

Usage: ./scripts/csv-to-json.py
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")


def main():
    for name in ["locations", "routes"]:
        csv_path = os.path.join(DATA_DIR, f"{name}.csv")
        if not os.path.isfile(csv_path):
            print(f"Skipping {csv_path} (not found).")
            continue

        with open(csv_path, newline="", encoding="utf-8") as csvfile:
            rows = list(csv.DictReader(csvfile))

        json_path = os.path.join(DATA_DIR, f"{name}.json")
        with open(json_path, "w", encoding="utf-8") as jsonfile:
            json.dump(rows, jsonfile, indent=4, ensure_ascii=False)
            jsonfile.write("\n")
        print(f"Converted {csv_path} -> {json_path}")


if __name__ == "__main__":
    main()
