// Shared transform: raw Airtable records -> denormalized portal-data shape.
// Used by BOTH the build-time script (scripts/prepare-data.mjs) and the
// live API route (app/api/portal-data/route.js) so the shapes stay identical.
export function denormalize({ meals, ingredients, customers, menus, orders, items, subs, profiles }) {
  const byId = (recs) => Object.fromEntries(recs.map((r) => [r.id, r.fields]));
  const mF = byId(meals), iF = byId(ingredients), cF = byId(customers);
  const oF = byId(orders), itF = byId(items), sF = byId(subs), pF = byId(profiles);

  const menuRec = menus.find((r) => r.fields.Status === "Published");
  const menu = menuRec?.fields;

  // --- meals on this week's menu ---
  const mById = Object.fromEntries(meals.map((r) => [r.id, r]));
  const menuMeals = (menu?.Meals ?? [])
    .map((id) => mById[id])
    .filter(Boolean)
    .filter((r) => r.fields.Active)
    .map((r) => ({
      id: r.id,
      name: r.fields.Name,
      description: r.fields.Description ?? "",
      price: r.fields["Base price"] ?? 0,
      category: r.fields.Category ?? "",
      tags: r.fields["Dietary tags"] ?? [],
      prepTime: r.fields["Prep Time (mins)"] ?? null,
      photo: r.fields.Photo?.[0]?.url ?? null,
      ingredients: (r.fields.Ingredients ?? []).map((id) => iF[id]?.Name).filter(Boolean),
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
        id,
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

  return {
    generatedAt: new Date().toISOString(),
    demo: true,
    menu: {
      id: menuRec?.id ?? null,
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
}
