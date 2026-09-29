"use client";

import { useEffect, useState } from "react";
import baked from "../lib/portal-data.json";

// Loads live portal data at runtime; falls back to the baked JSON
// (generated at build time) so the page never goes blank.
export function usePortalData() {
  const [data, setData] = useState(baked);
  const [live, setLive] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j && j.menu && Array.isArray(j.menu.meals)) {
          setData(j);
          setLive(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, live, syncing };
}
