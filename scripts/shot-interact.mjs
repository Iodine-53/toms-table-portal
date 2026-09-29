#!/usr/bin/env node
// Interaction QA: box flow on desktop + mobile overflow check. Chrome already running on :9223.
import { mkdirSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const WebSocket = require("/home/hatch/workspace/n8n/node_modules/ws");
const OUT = "/home/hatch/workspace/toms-table-portal/screenshots";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const tabs = await (await fetch("http://127.0.0.1:9223/json")).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.on("open", r));
  let id = 1;
  const pending = new Map();
  ws.on("message", (buf) => {
    const msg = JSON.parse(buf.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const cur = id++;
      pending.set(cur, { resolve, reject });
      ws.send(JSON.stringify({ id: cur, method, params }));
      setTimeout(() => pending.has(cur) && (pending.delete(cur), reject(new Error("cdp timeout " + method))), 30000);
    });
  const shot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const p = `${OUT}/${name}.png`;
    writeFileSync(p, Buffer.from(data, "base64"));
    console.log("saved", p);
  };
  const click = (sel) =>
    send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(sel)}).click()`, awaitPromise: false });

  // --- desktop: box flow ---
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://127.0.0.1:8901/" });
  await sleep(4000);
  await click(".meal-card .btn-add");
  await sleep(1200);
  await shot("flow-box-fab");
  await click(".box-fab");
  await sleep(1200);
  await shot("flow-box-drawer");
  await click(".drawer-foot .btn-primary");
  await sleep(1200);
  await shot("flow-order-success");
  // meal modal
  await send("Page.navigate", { url: "http://127.0.0.1:8901/" });
  await sleep(4000);
  await click(".meal-card .btn-outline");
  await sleep(1200);
  await shot("flow-meal-modal");

  // --- mobile overflow check ---
  for (const url of ["http://127.0.0.1:8901/", "http://127.0.0.1:8901/admin/"]) {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url });
    await sleep(3500);
    const { result } = await send("Runtime.evaluate", {
      expression: "({sw: document.documentElement.scrollWidth, iw: window.innerWidth})",
      returnByValue: true,
    });
    console.log(url, "scrollWidth:", result.value.sw, "innerWidth:", result.value.iw,
      result.value.sw > result.value.iw ? "OVERFLOW!" : "ok");
  }
  ws.close();
  console.log("DONE");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
