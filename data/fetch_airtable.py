#!/usr/bin/env python3
"""Fetch all tables from the Tom's Table base and cache as local JSON."""
import json, os, sys, urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

HOST = "api.airtable.com"
BASE = "https://api.airtable.com/v0"
BASE_ID = "appekb4SGVOMUeN8T"
CRED = "custom.airtable"
OUT = os.path.expanduser("~/workspace/toms-table-portal/data/raw")
os.makedirs(OUT, exist_ok=True)

TABLES = {
    "customers": "tblOOsLkjpOcKMUGl",
    "meals": "tblN7jPVQ5QzfFCPA",
    "ingredients": "tblfUfuCvlGfTqD1Y",
    "weekly_menus": "tblilk5uGpCR5PSjO",
    "subscriptions": "tbllwl17sDi1OFJ9V",
    "orders": "tbl8Yl9GMhEZWMz0J",
    "order_items": "tblKFlvkIwbDtfoeR",
    "dietary_profiles": "tblWTkuigcopwador",
}

def fetch_all(table_id):
    records, offset = [], None
    while True:
        url = f"{BASE}/{BASE_ID}/{table_id}?pageSize=100"
        if offset:
            url += f"&offset={offset}"
        r = urllib.request.Request(url, method="GET")
        add_surrogate_to_request(r, CRED, allowed_hosts=[HOST])
        with urllib.request.urlopen(r, timeout=90) as resp:
            out = read_json_response(resp)
        records.extend(out.get("records", []))
        offset = out.get("offset")
        if not offset:
            break
    return records

summary = {}
for name, tid in TABLES.items():
    try:
        recs = fetch_all(tid)
    except Exception as e:
        print(f"ERROR {name}: {e}", flush=True)
        continue
    with open(f"{OUT}/{name}.json", "w") as f:
        json.dump(recs, f, indent=1)
    summary[name] = len(recs)
    print(f"{name}: {len(recs)} records", flush=True)

with open(f"{OUT}/_summary.json", "w") as f:
    json.dump(summary, f, indent=1)
print("DONE", flush=True)
