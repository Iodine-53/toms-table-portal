#!/usr/bin/env python3
"""Tom's Table demo reset — one command to restore the demo base to its clean baseline.

Usage:
  python3 demo-reset.py --init      Snapshot current Orders + Order Items as the
                                   "demo-clean" baseline (run once, after the base
                                   looks the way you want every pitch to start).
  python3 demo-reset.py             Delete every Order / Order Item NOT in the
                                   baseline (i.e. all test + prospect demo orders),
                                   restoring the base to demo-clean.
  python3 demo-reset.py --dry-run   Show what would be deleted, delete nothing.

Safety:
  - Refuses to run without a baseline snapshot (--init first).
  - Only touches the Orders and Order Items tables. Menu, Customers,
    Subscriptions, etc. are never modified.
  - Only deletes records absent from the baseline snapshot.
  - Deletes in batches of 10 (Airtable limit); prints every deletion.

Auth: uses the stored custom.airtable credential via the skill helper.
"""
import sys, json, os, urllib.request, urllib.parse

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE_URL = "https://api.airtable.com/v0"
HOST = "api.airtable.com"
CRED = "custom.airtable"
BASE_ID = "appekb4SGVOMUeN8T"
TABLES = {"Orders": "tbl8Yl9GMhEZWMz0J", "Order Items": "tblKFlvkIwbDtfoeR"}
BASELINE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo-baseline.json")


def req(method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    add_surrogate_to_request(r, CRED, allowed_hosts=[HOST])
    with urllib.request.urlopen(r, timeout=90) as resp:
        return read_json_response(resp)


def fetch_all(table_id, fields=()):
    recs, offset = [], None
    while True:
        url = f"{BASE_URL}/{BASE_ID}/{table_id}?pageSize=100"
        for f in fields:
            url += "&fields%5B%5D=" + urllib.parse.quote(f, safe="")
        if offset:
            url += "&offset=" + offset
        d = req("GET", url)
        recs += d["records"]
        offset = d.get("offset")
        if not offset:
            return recs


def cmd_init():
    baseline = {}
    for name, tid in TABLES.items():
        recs = fetch_all(tid)
        baseline[name] = sorted(r["id"] for r in recs)
        print(f"  {name}: {len(recs)} records snapshotted")
    with open(BASELINE_FILE, "w") as f:
        json.dump(baseline, f, indent=1)
    print(f"Baseline saved to {BASELINE_FILE}")
    print("Demo-clean = whatever the base looks like right now.")


def cmd_reset(dry_run):
    if not os.path.exists(BASELINE_FILE):
        print("No baseline snapshot found. Run `python3 demo-reset.py --init` first,")
        print("when the base looks the way you want every pitch to start.")
        sys.exit(2)
    with open(BASELINE_FILE) as f:
        baseline = json.load(f)

    total_deleted = 0
    for name, tid in TABLES.items():
        keep = set(baseline.get(name, []))
        recs = fetch_all(tid, ["Id"] if name == "Orders" else [])
        junk = [r for r in recs if r["id"] not in keep]
        if not junk:
            print(f"  {name}: nothing to delete ({len(recs)} baseline records intact)")
            continue
        ids = [r["id"] for r in junk]
        label = ", ".join(
            f"#{r['fields'].get('Id', '?')}" for r in junk
        ) if name == "Orders" else f"{len(ids)} records"
        print(f"  {name}: {'WOULD DELETE' if dry_run else 'DELETING'} {label}")
        if not dry_run:
            for i in range(0, len(ids), 10):
                batch = ids[i:i + 10]
                q = "&".join("records%5B%5D=" + b for b in batch)
                req("DELETE", f"{BASE_URL}/{BASE_ID}/{tid}?{q}")
            total_deleted += len(ids)
    if dry_run:
        print("Dry run — nothing deleted.")
    else:
        print(f"Done. Deleted {total_deleted} non-baseline record(s). Base is demo-clean.")


if __name__ == "__main__":
    if "--init" in sys.argv:
        cmd_init()
    else:
        cmd_reset(dry_run="--dry-run" in sys.argv)
