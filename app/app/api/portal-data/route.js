// GET /api/portal-data — live portal data, server-side only.
// Reads Airtable at request time (cached 60s) and returns the exact same
// JSON shape as the baked lib/portal-data.json fallback.
// The API key never leaves the server: it is read from env (no NEXT_PUBLIC_
// prefix) and only ever sent to api.airtable.com in the Authorization header.
import { denormalize } from "../../../lib/portal-transform.js";

export const revalidate = 60;

const TABLES = {
  ingredients: "tblfUfuCvlGfTqD1Y",
  meals: "tblN7jPVQ5QzfFCPA",
  profiles: "tblWTkuigcopwador",
  customers: "tblOOsLkjpOcKMUGl",
  subs: "tbllwl17sDi1OFJ9V",
  menus: "tblilk5uGpCR5PSjO",
  orders: "tbl8Yl9GMhEZWMz0J",
  items: "tblKFlvkIwbDtfoeR",
};

async function fetchTable(baseId, key, tableId, name) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`airtable ${name} -> ${res.status}`);
    const json = await res.json();
    records.push(...(json.records ?? []));
    offset = json.offset;
  } while (offset);
  return records;
}

export async function GET() {
  const key = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!key || !baseId) {
    return Response.json({ error: "live data unavailable" }, { status: 500 });
  }
  try {
    const entries = await Promise.all(
      Object.entries(TABLES).map(async ([name, tableId]) => [
        name,
        await fetchTable(baseId, key, tableId, name),
      ])
    );
    return Response.json(denormalize(Object.fromEntries(entries)));
  } catch {
    // Never leak details (or the key) — the frontend falls back to baked data.
    return Response.json({ error: "live data unavailable" }, { status: 502 });
  }
}
