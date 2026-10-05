#!/usr/bin/env python3
"""Prints one key from config.ini's [secrets] section, or nothing if unset.
"""
import configparser
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "config.ini")


def main():
    if len(sys.argv) != 2:
        print("usage: read-config.py <KEY>", file=sys.stderr)
        raise SystemExit(1)

    parser = configparser.ConfigParser()
    if os.path.isfile(CONFIG_PATH):
        parser.read(CONFIG_PATH)
    print(parser.get("secrets", sys.argv[1], fallback=""))


if __name__ == "__main__":
    main()
