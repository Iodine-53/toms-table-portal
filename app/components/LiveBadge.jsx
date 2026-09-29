"use client";

// Small status pill: "Syncing…" while fetching, "Live" once Airtable data
// arrives, hidden when the baked fallback is in use.
export default function LiveBadge({ live, syncing }) {
  if (!live && !syncing) return null;
  return (
    <span
      className={`live-badge${live ? " is-live" : ""}`}
      title={live ? "Live data from Airtable" : "Syncing with Airtable…"}
    >
      <span className="live-dot" />
      {live ? "Live" : "Syncing…"}
    </span>
  );
}
