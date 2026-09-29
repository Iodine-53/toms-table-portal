#!/usr/bin/env node
// Build-time transform: raw Airtable JSON -> denormalized portal-data.json
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL("..", import.meta.url));
const raw = join(root, "..", "data", "raw");
const read = (n) => JSON.parse(readFileSync(join(raw, `${n}.json`), "utf8"));

const meals = read("meals");
const ingredients = read("ingredients");
const customers = read("customers");
const menus = read("weekly_menus");
const orders = read("orders");
const items = read("order_items");
const subs = read("subscriptions");
const profiles = read("dietary_profiles");

const byId = (recs) => Object.fromEntries(recs.map((r) => [r.id, r.fields]));
const mF = byId(meals), iF = byId(ingredients), cF = byId(customers);
const oF = byId(orders), itF = byId(items), sF = byId(subs), pF = byId(profiles);

const menu = menus.map((r) => r.fields).find((f) => f.Status === "Published");
const menuMealIds = new Set(menu?.Meals ?? []);

// --- meals on this week's menu ---
const menuMeals = (menu?.Meals ?? [])
  .map((id) => mF[id])
  .filter(Boolean)
  .filter((f) => f.Active)
  .map((f) => ({
    name: f.Name,
    description: f.Description ?? "",
    price: f["Base price"] ?? 0,
    category: f.Category ?? "",
    tags: f["Dietary tags"] ?? [],
    prepTime: f["Prep Time (mins)"] ?? null,
    ingredients: (f.Ingredients ?? []).map((id) => iF[id]?.Name).filter(Boolean),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// --- customers ---
const subByCustomer = {};
Object.values(sF).forEach((f) => {
  const cid = f.Customer?.[0];
  if (cid) subByCustomer[cid] = f;
});
const profileByCustomer = {};
Object.values(pF).forEach((f) => {
  const cid = f.Customer?.[0];
  if (cid) profileByCustomer[cid] = f;
});
const customerList = customers
  .map((r) => ({ id: r.id, f: r.fields }))
  .map(({ id, f }) => {
    const sub = subByCustomer[id];
    const prof = profileByCustomer[id];
    return {
      name: f.Name,
      email: f.Email ?? "",
      status: f.Status ?? "",
      address: f["Delivery address"] ?? "",
      plan: sub?.Plan ?? null,
      subStatus: sub?.Status ?? null,
      allergies: prof?.Allergies ?? null,
      dietNotes: prof?.Notes ?? null,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const activeCustomers = customerList.filter((c) => c.status === "Active");

// --- orders ---
const orderList = orders
  .map((r) => ({ id: r.id, f: r.fields }))
  .map(({ f }) => {
    const cust = cF[f.Customer?.[0]];
    const orderItems = (f["Order Items"] ?? [])
      .map((id) => itF[id])
      .filter(Boolean)
      .map((it) => {
        const meal = mF[it.Meal?.[0]];
        return {
          mealName: meal?.Name ?? "Unknown meal",
          qty: it.Quantity ?? 1,
          portion: it.Portion ?? "Regular",
          lineTotal: it["Line total"] ?? 0,
        };
      });
    return {
      ref: f.Id,
      customerName: cust?.Name ?? "Unknown",
      status: f.Status ?? "",
      paymentStatus: f["Payment status"] ?? "",
      total: f["Order total"] ?? 0,
      deliveryDate: f["Delivery date"] ?? "",
      items: orderItems,
    };
  })
  .sort((a, b) => a.ref - b.ref);

// --- stats ---
const statusCounts = {};
orderList.forEach((o) => {
  statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
});
const revenue = orderList.reduce((s, o) => s + o.total, 0);
const activeSubs = Object.values(sF).filter((f) => f.Status === "Active").length;

// --- fulfillment: aggregate ingredient portions across all order items ---
// portions(ingredient) = sum of item quantities for meals containing it
const mealIngredients = {};
meals.forEach((r) => {
  mealIngredients[r.fields.Name] = new Set(
    (r.fields.Ingredients ?? []).map((id) => iF[id]?.Name).filter(Boolean)
  );
});
const ingAgg = {};
orderList.forEach((o) => {
  o.items.forEach((it) => {
    const ings = mealIngredients[it.mealName] ?? new Set();
    ings.forEach((name) => {
      if (!ingAgg[name]) ingAgg[name] = { portions: 0, meals: new Set() };
      ingAgg[name].portions += it.qty;
      ingAgg[name].meals.add(it.mealName);
    });
  });
});
const ingredientByName = {};
ingredients.forEach((r) => {
  ingredientByName[r.fields.Name] = r.fields;
});
const fulfillment = Object.entries(ingAgg)
  .map(([name, v]) => ({
    name,
    portions: v.portions,
    unit: ingredientByName[name]?.Unit ?? "",
    inStock: ingredientByName[name]?.["In Stock"] ?? false,
    meals: [...v.meals].sort(),
  }))
  .sort((a, b) => b.portions - a.portions);

const allTags = [...new Set(menuMeals.flatMap((m) => m.tags))].sort();

const out = {
  generatedAt: new Date().toISOString(),
  demo: true,
  menu: {
    weekCommencing: menu?.["Week commencing"] ?? "",
    orderCutoff: menu?.["Order cutoff"] ?? "",
    notes: menu?.["Menu Notes"] ?? "",
    meals: menuMeals,
  },
  customers: customerList,
  activeCustomers,
  orders: orderList,
  statusCounts,
  stats: {
    revenue: Math.round(revenue * 100) / 100,
    activeSubscribers: activeSubs,
    mealsOnMenu: menuMeals.length,
    totalOrders: orderList.length,
  },
  fulfillment,
  allTags,
};

const libDir = join(root, "lib");
mkdirSync(libDir, { recursive: true });
writeFileSync(join(libDir, "portal-data.json"), JSON.stringify(out, null, 1));
console.log(
  `portal-data.json: ${menuMeals.length} meals, ${customerList.length} customers, ${orderList.length} orders, revenue $${out.stats.revenue}`
);
