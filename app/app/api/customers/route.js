// POST /api/customers — customer self-signup (demo-simple, no login), server-side only.
// Body: { name, email, plan?, allergies? }
// The API key never leaves the server: read from env (no NEXT_PUBLIC_ prefix),
// sent only to api.airtable.com in the Authorization header, never logged.

const TABLES = {
  customers: "tblOOsLkjpOcKMUGl",
  subs: "tbllwl17sDi1OFJ9V",
  profiles: "tblWTkuigcopwador",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLANS = new Set(["4", "8", "12 meals per week"]);

async function fetchAll(key, baseId, tableId, filterByFormula) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`airtable ${tableId} -> ${res.status}`);
    const json = await res.json();
    records.push(...(json.records ?? []));
    offset = json.offset;
  } while (offset);
  return records;
}

async function create(key, baseId, tableId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`airtable create ${tableId} -> ${res.status}`);
  return res.json();
}

const bad = (message) => Response.json({ error: message }, { status: 400 });
const conflict = (message) => Response.json({ error: message }, { status: 409 });
const failed = () => Response.json({ error: "We could not create your profile. Please try again." }, { status: 502 });

export async function POST(req) {
  const key = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!key || !baseId) return failed();

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Please fill in your name and email.");
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const plan = String(body?.plan ?? "").trim();
  const allergies = String(body?.allergies ?? "").trim();

  if (!name) return bad("Please enter your name.");
  if (!email) return bad("Please enter your email.");
  if (!EMAIL_RE.test(email)) return bad("That email doesn't look right.");
  if (plan && !PLANS.has(plan)) return bad("Please pick a valid plan.");

  try {
    // Duplicate check is case-insensitive; escape single quotes for the formula.
    const safeEmail = email.replace(/'/g, "\\'");
    const existing = await fetchAll(key, baseId, TABLES.customers, `LOWER({Email})='${safeEmail.toLowerCase()}'`);
    if (existing.length > 0) return conflict("That email is already registered. Pick your name from the list instead.");

    const customer = await create(key, baseId, TABLES.customers, {
      Name: name,
      Email: email,
      Status: "Active",
    });
    const id = customer.id;

    // Optional extras, best-effort: never fail the signup over them.
    if (plan) {
      const today = new Date().toISOString().slice(0, 10);
      await create(key, baseId, TABLES.subs, {
        Customer: [id],
        Plan: plan,
        Status: "Active",
        "Start date": today,
        "Auto-renew": true,
      }).catch(() => {});
    }
    if (allergies && allergies.toLowerCase() !== "none") {
      await create(key, baseId, TABLES.profiles, {
        Customer: [id],
        Allergies: allergies,
        "Severity Level": "Low",
      }).catch(() => {});
    }

    return Response.json({ id, name, email }, { status: 201 });
  } catch {
    return failed();
  }
}
