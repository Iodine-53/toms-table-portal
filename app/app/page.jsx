"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import MealArt from "../components/MealArt";
import LiveBadge from "../components/LiveBadge";
import { usePortalData } from "../components/use-portal-data";

const money = (n) => `$${n.toFixed(2)}`;
const LARGE_MULT = 1.4;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtCutoff(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="16" fill="#1e332b" />
      <path d="M9 20.5h16" stroke="#d9a441" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 9.5c-4.6 0-8 3.4-8 8h16c0-4.6-3.4-8-8-8z" fill="#c4663b" />
      <circle cx="17" cy="7.4" r="1.6" fill="#d9a441" />
    </svg>
  );
}

export default function Portal() {
  const { data, live, syncing } = usePortalData();
  const { menu, activeCustomers, allTags } = data;
  const [filter, setFilter] = useState("All");
  const [customerName, setCustomerName] = useState(activeCustomers[0]?.name ?? "");
  const [modalMeal, setModalMeal] = useState(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [box, setBox] = useState([]); // [{id, name, qty, portion}]
  const [placed, setPlaced] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    // Default: the Saturday of the menu week.
    const d = new Date(menu.weekCommencing + "T12:00:00");
    if (!Number.isNaN(d.getTime())) d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });

  const customer = activeCustomers.find((c) => c.name === customerName);
  const mealById = useMemo(
    () => Object.fromEntries(menu.meals.map((m) => [m.id, m])),
    [menu.meals]
  );
  const priceOf = (id) => mealById[id]?.price ?? 0;

  const meals = useMemo(
    () =>
      filter === "All"
        ? menu.meals
        : menu.meals.filter((m) => m.tags.includes(filter)),
    [filter, menu.meals]
  );

  const addToBox = (meal) => {
    setBox((prev) => {
      const line = prev.find((l) => l.id === meal.id && l.portion === "Regular");
      if (line)
        return prev.map((l) =>
          l === line ? { ...l, qty: l.qty + 1 } : l
        );
      return [...prev, { id: meal.id, name: meal.name, qty: 1, portion: "Regular" }];
    });
  };
  const setQty = (idx, qty) =>
    setBox((prev) =>
      qty <= 0 ? prev.filter((_, i) => i !== idx) : prev.map((l, i) => (i === idx ? { ...l, qty } : l))
    );
  const setPortion = (idx, portion) =>
    setBox((prev) => prev.map((l, i) => (i === idx ? { ...l, portion } : l)));
  const lineTotal = (l) => l.qty * priceOf(l.id) * (l.portion === "Large" ? LARGE_MULT : 1);
  const subtotal = box.reduce((s, l) => s + lineTotal(l), 0);
  const boxCount = box.reduce((s, l) => s + l.qty, 0);
  const todayISO = new Date().toISOString().slice(0, 10);

  const placeOrder = async () => {
    if (submitting || !customer) return;
    setSubmitting(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          weekId: menu.id,
          deliveryDate,
          items: box.map((l) => ({
            mealId: l.id,
            quantity: l.qty,
            portion: l.portion,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Your order could not be saved.");
      setPlaced({
        ref: json.ref,
        count: boxCount,
        total: json.total,
        customer: customerName,
        deliveryDate,
      });
      setBox([]);
    } catch (e) {
      setOrderError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="demo-banner">
        <strong>Live ordering</strong> — portfolio demo with fictional data. Orders
        you place are submitted to the demo kitchen for real.
      </div>

      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <Logo />
            <span className="brand-name">
              Tom&rsquo;s <em>Table</em>
            </span>
          </Link>
          <span className="week-pill">Week of {fmtDate(menu.weekCommencing)}</span>
          <LiveBadge live={live} syncing={syncing} />
          <div className="header-spacer" />
          <div className="customer-switch">
            <label htmlFor="cust">Ordering as</label>
            <select
              id="cust"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            >
              {activeCustomers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Link href="/admin/" className="admin-link">
            Kitchen admin
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <span className="hero-kicker">Weekly meal subscription</span>
            <h1>
              Dinner, <em>decided.</em>
            </h1>
            <p className="hero-sub">
              {menu.notes} Ten chef-built meals this week — pick your box by{" "}
              {fmtCutoff(menu.orderCutoff).split(" at ")[0]}, and we handle the
              cooking, packing, and delivery.
            </p>
            <div className="hero-cta">
              <a href="#menu" className="btn btn-primary">
                Browse this week&rsquo;s menu
              </a>
              <span className="cutoff-note">
                Order cutoff: <strong>{fmtCutoff(menu.orderCutoff)}</strong>
              </span>
            </div>
          </div>
        </section>

        <div className="filters" id="menu">
          <div className="chips" role="tablist" aria-label="Filter by dietary preference">
            {["All", ...allTags].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={filter === t}
                className={`chip${filter === t ? " active" : ""}`}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <section className="menu-section">
          <div className="wrap">
            <div className="section-head">
              <h2>This week&rsquo;s menu</h2>
              <span className="result-count">
                {meals.length} meal{meals.length === 1 ? "" : "s"}
                {filter !== "All" ? ` · ${filter}` : ""}
              </span>
            </div>
            <div className="meal-grid">
              {meals.map((m) => (
                <article key={m.name} className="meal-card">
                  <MealArt name={m.name} className="meal-art" />
                  <div className="meal-body">
                    <div className="meal-top">
                      <h3 className="meal-name">{m.name}</h3>
                      <span className="meal-price">{money(m.price)}</span>
                    </div>
                    <p className="meal-desc">{m.description}</p>
                    <div className="meal-meta">
                      <span className="meta-pill">{m.category}</span>
                      {m.prepTime && <span className="meta-pill">{m.prepTime} min</span>}
                      {m.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="meal-actions">
                      <button className="btn btn-outline btn-small" onClick={() => setModalMeal(m)}>
                        Details
                      </button>
                      <button className="btn btn-add btn-small" onClick={() => addToBox(m)}>
                        Add to box
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>
            <strong>Tom&rsquo;s Table</strong> — portfolio demo. All people, orders,
            and menus shown are fictional.
          </span>
          <Link href="/admin/" className="back-link">
            View the kitchen admin dashboard →
          </Link>
        </div>
      </footer>

      {modalMeal && (
        <div className="modal-backdrop" onClick={() => setModalMeal(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={modalMeal.name} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalMeal(null)} aria-label="Close">
              ×
            </button>
            <MealArt name={modalMeal.name} className="meal-art" />
            <div className="modal-body">
              <h3>{modalMeal.name}</h3>
              <div className="modal-price">{money(modalMeal.price)}</div>
              <p style={{ marginTop: 10, color: "var(--ink-soft)" }}>{modalMeal.description}</p>
              <div className="detail-row">
                <span>
                  <strong>{modalMeal.category}</strong>
                </span>
                {modalMeal.prepTime && (
                  <span>
                    Ready in <strong>{modalMeal.prepTime} min</strong>
                  </span>
                )}
              </div>
              <div className="meal-meta" style={{ marginBottom: 6 }}>
                {modalMeal.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
              <div className="ing-list">
                <h4>What&rsquo;s inside</h4>
                <div className="ing-chips">
                  {modalMeal.ingredients.map((ing) => (
                    <span key={ing} className="ing-chip">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                onClick={() => {
                  addToBox(modalMeal);
                  setModalMeal(null);
                  setBoxOpen(true);
                }}
              >
                Add to my box — {money(modalMeal.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {boxCount > 0 && !boxOpen && (
        <button className="box-fab" onClick={() => setBoxOpen(true)} aria-label="Open my box">
          My box <span className="box-count">{boxCount}</span>
        </button>
      )}

      {boxOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setBoxOpen(false)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="My box">
            <div className="drawer-head">
              <h3>My box</h3>
              <button className="modal-close" style={{ position: "static" }} onClick={() => setBoxOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="drawer-body">
              {placed ? (
                <div className="order-success">
                  <span className="big-check">✓</span>
                  <h3>Order received</h3>
                  <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>
                    Reference <strong>#{placed.ref}</strong> — {placed.count} meal
                    {placed.count === 1 ? "" : "s"} for {placed.customer},{" "}
                    {money(placed.total)}, delivering {fmtDate(placed.deliveryDate)}.
                  </p>
                  <div className="demo-note" style={{ textAlign: "left", marginTop: 16 }}>
                    <strong>Live order:</strong> this order was created in the
                    demo base — no payment was taken. In production it would also
                    fire the kitchen prep automation.
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 18 }}
                    onClick={() => {
                      setPlaced(null);
                      setBoxOpen(false);
                    }}
                  >
                    Back to the menu
                  </button>
                </div>
              ) : box.length === 0 ? (
                <div className="empty-box">
                  Your box is empty.
                  <br />
                  Add a few meals from this week&rsquo;s menu to get started.
                </div>
              ) : (
                box.map((l, i) => (
                  <div key={i} className="box-item">
                    <div className="box-item-top">
                      <span className="box-item-name">{l.name}</span>
                      <span className="money">{money(lineTotal(l))}</span>
                    </div>
                    <div className="box-item-controls">
                      <button className="qty-btn" onClick={() => setQty(i, l.qty - 1)} aria-label="Decrease quantity">
                        −
                      </button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{l.qty}</span>
                      <button className="qty-btn" onClick={() => setQty(i, l.qty + 1)} aria-label="Increase quantity">
                        +
                      </button>
                      <select
                        className="portion-select"
                        value={l.portion}
                        onChange={(e) => setPortion(i, e.target.value)}
                        aria-label="Portion size"
                      >
                        <option value="Regular">Regular</option>
                        <option value="Large">Large (+40%)</option>
                      </select>
                      <button className="remove-link" onClick={() => setQty(i, 0)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!placed && box.length > 0 && (
              <div className="drawer-foot">
                <div className="subtotal-row">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
                  Ordering as <strong>{customerName}</strong>
                  {customer?.plan ? ` · ${customer.plan} plan` : ""}
                  {customer?.allergies && customer.allergies !== "None"
                    ? ` · allergies: ${customer.allergies}`
                    : ""}
                </div>
                <label
                  htmlFor="delivery-date"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
                >
                  Delivery date
                </label>
                <input
                  id="delivery-date"
                  type="date"
                  className="date-input"
                  value={deliveryDate}
                  min={todayISO}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  style={{ width: "100%", marginBottom: 12 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={placeOrder}
                  disabled={submitting}
                >
                  {submitting ? "Placing your order…" : "Place order"}
                </button>
                {orderError && (
                  <div
                    className="order-error"
                    role="alert"
                    style={{ marginTop: 10, color: "#a33327", fontSize: 14 }}
                  >
                    {orderError}
                  </div>
                )}
                <div className="demo-note">
                  <strong>Live ordering</strong> — your order is created in the
                  demo base. No payment is taken.
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
