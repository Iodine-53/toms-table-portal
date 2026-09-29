"use client";

import { useState } from "react";
import Link from "next/link";
import data from "../../lib/portal-data.json";

const money = (n) => `$${n.toFixed(2)}`;

const STATUS_PILL = {
  Delivered: "pill-delivered",
  "Out for delivery": "pill-transit",
  Preparing: "pill-preparing",
  Submitted: "pill-submitted",
};
const STATUS_DOT = {
  Delivered: "dot-delivered",
  "Out for delivery": "dot-transit",
  Preparing: "dot-preparing",
  Submitted: "dot-submitted",
};
const PAY_PILL = { Paid: "pill-paid", Pending: "pill-pending", Failed: "pill-failed" };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function Admin() {
  const { stats, statusCounts, orders, fulfillment, menu } = data;
  const [expanded, setExpanded] = useState(null);

  const statCards = [
    { label: "Revenue this week", value: money(stats.revenue), sub: `${stats.totalOrders} orders on the menu`, accent: true },
    { label: "Active subscribers", value: stats.activeSubscribers, sub: "across weekly plans" },
    { label: "Meals on this week's menu", value: stats.mealsOnMenu, sub: `week of ${fmtDate(menu.weekCommencing)}` },
    { label: "Total orders", value: stats.totalOrders, sub: "all statuses, this week" },
  ];

  return (
    <>
      <div className="demo-banner">
        <strong>Demo mode</strong> — portfolio preview with fictional data. No real
        orders are placed.
      </div>

      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
              <circle cx="17" cy="17" r="16" fill="#1e332b" />
              <path d="M9 20.5h16" stroke="#d9a441" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M17 9.5c-4.6 0-8 3.4-8 8h16c0-4.6-3.4-8-8-8z" fill="#c4663b" />
              <circle cx="17" cy="7.4" r="1.6" fill="#d9a441" />
            </svg>
            <span className="brand-name">
              Tom&rsquo;s <em>Table</em>
            </span>
          </Link>
          <span className="week-pill">Kitchen admin</span>
          <div className="header-spacer" />
          <Link href="/" className="admin-link">
            ← Customer portal
          </Link>
        </div>
      </header>

      <main className="wrap">
        <div className="admin-head">
          <Link href="/" className="back-link">
            ← Back to customer portal
          </Link>
          <h1>Kitchen admin</h1>
          <p>
            Live view of this week&rsquo;s operation — orders, payments, and the
            prep list for the kitchen. Backed by the Tom&rsquo;s Table Airtable
            base.
          </p>
        </div>

        <div className="stat-grid">
          {statCards.map((s) => (
            <div key={s.label} className={`stat-card${s.accent ? " accent" : ""}`}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="status-strip" aria-label="Orders by status">
          {Object.entries(statusCounts).map(([st, n]) => (
            <span key={st} className="status-chip">
              <span className={`dot ${STATUS_DOT[st] ?? ""}`} />
              {st}: <strong>{n}</strong>
            </span>
          ))}
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Orders</h2>
            <p>Tap a row to see its items. Week of {fmtDate(menu.weekCommencing)}.</p>
          </div>
          <div className="table-scroll">
            <table className="orders">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <>
                    <tr
                      key={o.ref}
                      className="expandable"
                      onClick={() => setExpanded(expanded === o.ref ? null : o.ref)}
                    >
                      <td className="money">#{o.ref}</td>
                      <td>
                        <strong>{o.customerName}</strong>
                        <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                          {o.items.reduce((s, i) => s + i.qty, 0)} meals
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${STATUS_PILL[o.status] ?? ""}`}>{o.status}</span>
                      </td>
                      <td>
                        <span className={`pill ${PAY_PILL[o.paymentStatus] ?? ""}`}>
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td>{fmtDate(o.deliveryDate)}</td>
                      <td className="money" style={{ textAlign: "right" }}>
                        {money(o.total)}
                      </td>
                    </tr>
                    {expanded === o.ref && (
                      <tr key={`${o.ref}-items`}>
                        <td colSpan={6} style={{ background: "#fdf9f0" }}>
                          {o.items.map((it, i) => (
                            <div key={i} className="item-line">
                              <strong>
                                {it.qty}× {it.mealName}
                              </strong>{" "}
                              ({it.portion}) — {money(it.lineTotal)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Weekly fulfillment</h2>
            <p>
              What the kitchen cooks and shops for. Portions = meal portions
              ordered this week containing each ingredient.
            </p>
          </div>
          <div className="fulfill-grid">
            <div className="fulfill-col">
              <h3>Kitchen prep list</h3>
              {fulfillment.map((f) => (
                <div key={f.name} className="kitchen-row">
                  <span
                    className={`stock-dot ${f.inStock ? "stock-ok" : "stock-low"}`}
                    title={f.inStock ? "In stock" : "Out of stock"}
                  />
                  <span className="ing-name">{f.name}</span>
                  <span className="ing-meta">
                    {f.portions} portion{f.portions === 1 ? "" : "s"}
                    {f.unit ? ` · ${f.unit}` : ""}
                  </span>
                </div>
              ))}
            </div>
            <div className="fulfill-col">
              <h3>Per-order breakdown</h3>
              {orders.map((o) => (
                <div key={o.ref} className="per-order-block">
                  <div className="per-order-title">
                    #{o.ref} — {o.customerName}{" "}
                    <span>
                      · {o.status} · {fmtDate(o.deliveryDate)}
                    </span>
                  </div>
                  {o.items.map((it, i) => (
                    <div key={i} className="item-line">
                      {it.qty}× {it.mealName} ({it.portion})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="site-footer" style={{ borderTop: "none" }}>
          <div className="footer-inner">
            <span>
              <strong>Tom&rsquo;s Table</strong> — portfolio demo. All people,
              orders, and menus shown are fictional.
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
