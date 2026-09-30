// Pure order logic: validation + server-side totals + Airtable record shapes.
// Kept free of fetch/env so it can be unit-tested without secrets.
export const PORTIONS = ["Regular", "Medium", "Small", "Large"];
export const LARGE_MULT = 1.4;

export const round2 = (n) => Math.round(n * 100) / 100;

export function lineTotalFor(price, qty, portion) {
  return round2(price * qty * (portion === "Large" ? LARGE_MULT : 1));
}

// body: { customerId, weekId, deliveryDate, items: [{ mealId, quantity, portion?, note? }] }
// lookup: { customers: Map(id -> {active}), weeks: Map(id -> {published}), meals: Map(id -> {price, active}) }
// Returns null when valid, otherwise a plain-language error message.
export function validateOrder(body, lookup) {
  if (!body || typeof body !== "object") return "Order is empty.";
  const { customerId, weekId, deliveryDate, items } = body;
  if (!customerId || !lookup.customers.has(customerId))
    return "Unknown customer — please pick who you're ordering as.";
  if (!lookup.customers.get(customerId).active)
    return "That customer account isn't active.";
  if (!weekId || !lookup.weeks.has(weekId)) return "This week's menu isn't available.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate || ""))
    return "Pick a delivery date.";
  const d = new Date(deliveryDate + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime()) || d < today) return "Delivery date can't be in the past.";
  if (!Array.isArray(items) || items.length === 0) return "Your box is empty.";
  if (items.length > 50) return "Too many lines in one order.";
  for (const it of items) {
    if (!it || !lookup.meals.has(it.mealId)) return "One of the meals is no longer on the menu.";
    const meal = lookup.meals.get(it.mealId);
    if (!meal.active) return `"${meal.name}" is no longer available this week.`;
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 20)
      return "Quantities must be whole numbers between 1 and 20.";
    if (it.portion && !PORTIONS.includes(it.portion))
      return "Unknown portion size.";
    if (it.note && it.note.length > 500) return "A prep note is too long (500 chars max).";
  }
  return null;
}

// Builds the Airtable record payloads. Totals are computed server-side from
// current meal prices — a client-sent total is never trusted.
export function buildOrderRecords(body, lookup) {
  const lines = body.items.map((it) => {
    const meal = lookup.meals.get(it.mealId);
    const portion = it.portion || "Regular";
    const lineTotal = lineTotalFor(meal.price, it.quantity, portion);
    return {
      mealId: it.mealId,
      quantity: it.quantity,
      portion,
      note: (it.note || "").trim(),
      lineTotal,
    };
  });
  const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const orderFields = {
    Customer: [body.customerId],
    Week: [body.weekId],
    Status: "Submitted",
    "Payment status": "Pending",
    "Delivery date": body.deliveryDate,
    "Order total": total,
  };
  const itemFields = (orderRecordId) =>
    lines.map((l) => ({
      Order: [orderRecordId],
      Meal: [l.mealId],
      Quantity: l.quantity,
      Portion: l.portion,
      "Line total": l.lineTotal,
      ...(l.note ? { "Special Prep Notes": l.note } : {}),
    }));
  return { orderFields, itemFields, total, lines };
}
