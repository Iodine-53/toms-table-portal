// POST /api/orders — real order submission, server-side only.
// Body: { customerId, weekId, deliveryDate, items: [{ mealId, quantity, portion?, note? }] }
// The API key never leaves the server: read from env (no NEXT_PUBLIC_ prefix),
// sent only to api.airtable.com in the Authorization header, never logged.
import { validateOrder, buildOrderRecords } from "../../../lib/order-logic.js";

const TABLES = {
  customers: "tblOOsLkjpOcKMUGl",
  weeks: "tblilk5uGpCR5PSjO",
  meals: "tblN7jPVQ5QzfFCPA",
  orders: "tbl8Yl9GMhEZWMz0J",
  items: "tblKFlvkIwbDtfoeR",
};

async function atFetch(key, baseId, path, options = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

async function fetchAll(key, baseId, tableId) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`airtable ${tableId} -> ${res.status}`);
    const json = await res.json();
    records.push(...(json.records ?? []));
    offset = json.offset;
  } while (offset);
  return records;
}

const bad = (message) => Response.json({ error: message }, { status: 400 });
const failed = () => Response.json({ error: "Your order could not be saved. Please try again." }, { status: 502 });

export async function POST(req) {
  const key = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!key || !baseId) return failed();

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Order is empty.");
  }

  try {
    // Fresh lookups so validation + pricing use current data, not the client's.
    const [customers, weeks, meals] = await Promise.all([
      fetchAll(key, baseId, TABLES.customers),
      fetchAll(key, baseId, TABLES.weeks),
      fetchAll(key, baseId, TABLES.meals),
    ]);
    const lookup = {
      customers: new Map(
        customers.map((r) => [r.id, { active: r.fields.Status === "Active" }])
      ),
      weeks: new Map(
        weeks.map((r) => [r.id, { published: r.fields.Status === "Published" }])
      ),
      meals: new Map(
        meals.map((r) => [
          r.id,
          {
            name: r.fields.Name,
            price: r.fields["Base price"] ?? 0,
            active: !!r.fields.Active,
          },
        ])
      ),
    };

    const error = validateOrder(body, lookup);
    if (error) return bad(error);

    const { orderFields, itemFields, total } = buildOrderRecords(body, lookup);

    // 1. Create the order.
    const createRes = await atFetch(key, baseId, TABLES.orders, {
      method: "POST",
      body: JSON.stringify({ fields: orderFields }),
    });
    if (!createRes.ok) return failed();
    const created = await createRes.json();
    const orderRecordId = created.id;

    // 2. Create the order items (Airtable caps batches at 10).
    const payloads = itemFields(orderRecordId);
    for (let i = 0; i < payloads.length; i += 10) {
      const chunk = payloads.slice(i, i + 10);
      const itemRes = await atFetch(key, baseId, TABLES.items, {
        method: "POST",
        body: JSON.stringify({ records: chunk.map((f) => ({ fields: f })) }),
      });
      if (!itemRes.ok) return failed();
    }

    // 3. Read back the autonumber reference for the confirmation.
    const readRes = await atFetch(key, baseId, `${TABLES.orders}/${orderRecordId}`);
    const ref = readRes.ok ? (await readRes.json()).fields?.Id ?? null : null;

    return Response.json({ orderId: orderRecordId, ref, total }, { status: 201 });
  } catch {
    // Never leak details (or the key).
    return failed();
  }
}
