# Tom's Table — Live Demo Walkthrough (for prospect calls)

The money moment: the prospect watches an order placed on the website land in
Airtable in real time. Total demo time: ~5 minutes.

## Before the call (2 minutes)

1. Reset the base to demo-clean:
   ```bash
   python3 ~/workspace/toms-table-portal/scripts/demo-reset.py
   ```
   This deletes every order placed since the last reset (test orders, previous
   demo orders) and leaves the 8 seeded baseline orders untouched. Your own
   test order #26 was removed when this was set up.
2. Open two tabs:
   - Tab 1: the portal — https://toms-table-portal-iodine-53s-projects.vercel.app
   - Tab 2: the Airtable base, Orders table (Grid view, sorted newest first)
3. Confirm the green "Live" badge shows in the portal header (means the site is
   reading the base in real time, not cached data).

## The demo (say it while you do it)

**1. The customer side (Tab 1) — 2 min**
- "This is what your customers see." Scroll the weekly menu.
- Pick 2–3 meals, set quantities. "Your customer builds their week in under a minute."
- Go to checkout, pick the prospect's own name from the 'Ordering as' dropdown
  if they're comfortable — *their* order landing live is what sells it. Otherwise
  use a sample customer.
- Hit submit. Point at the confirmation with the real order reference.
- Talking point: "No phone calls, no WhatsApp messages to misread, no paper.
  The order is already in your system before they've put their phone down."

**2. The flip (Tab 2) — 1 min**
- Switch to Airtable. The new order is sitting at the top: status Submitted,
  correct total, linked customer, delivery date, line items.
- Talking point: "Nothing to copy across, nothing to retype. Your kitchen sees
  exactly what the customer ordered, priced exactly how you priced it — the
  website validates and prices everything before it ever touches your base."

**3. The kitchen side (Tab 1 → /admin) — 2 min**
- Open the portal's /admin dashboard. Show the order in the fulfillment queue
  with its items, quantities, and special instructions.
- Talking point: "This is your morning view: what to cook, how many portions,
  who it's for. One screen, no spreadsheets."

**4. Close**
- "Everything you just saw runs on Airtable — the same tool your team already
  knows. No new software to learn, no servers to maintain. I build the base,
  the customer site, and the kitchen view as one package, and it's yours."

## After the call

Run the reset again so the next prospect gets the same clean showroom:
```bash
python3 ~/workspace/toms-table-portal/scripts/demo-reset.py --dry-run  # preview
python3 ~/workspace/toms-table-portal/scripts/demo-reset.py            # reset
```

## If something goes wrong live

- Order doesn't appear in Airtable: check the "Live" badge in the portal header.
  If it's missing, the site fell back to cached data (env vars / network) — say
  "the live link needs a second," place the order again once it's back.
- Wrong data on screen: the base is yours to fix in seconds — it's Airtable, not
  code. That recoverability is itself a selling point.
