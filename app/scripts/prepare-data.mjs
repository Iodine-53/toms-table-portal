#!/usr/bin/env node
// Build-time transform: raw Airtable JSON -> denormalized portal-data.json
// (baked fallback used when the live /api/portal-data route is unreachable)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { denormalize } from "../lib/portal-transform.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const raw = join(root, "..", "data", "raw");
const read = (n) => JSON.parse(readFileSync(join(raw, `${n}.json`), "utf8"));

const out = denormalize({
  meals: read("meals"),
  ingredients: read("ingredients"),
  customers: read("customers"),
  menus: read("weekly_menus"),
  orders: read("orders"),
  items: read("order_items"),
  subs: read("subscriptions"),
  profiles: read("dietary_profiles"),
});

const libDir = join(root, "lib");
mkdirSync(libDir, { recursive: true });
writeFileSync(join(libDir, "portal-data.json"), JSON.stringify(out, null, 1));
console.log(
  `portal-data.json: ${out.menu.meals.length} meals, ${out.customers.length} customers, ${out.orders.length} orders, revenue $${out.stats.revenue}`
);
