#!/usr/bin/env node
// Headless-Chrome CDP screenshots for the Tom's Table portal.
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const WebSocket = require("/home/hatch/workspace/n8n/node_modules/ws");

const CHROME = "/home/hatch/workspace/.tools/chrome-linux64/chrome";
const SHOTS = [
  { name: "portal-desktop", url: "http://127.0.0.1:8901/", w: 1280, h: 900 },
  { name: "portal-mobile", url: "http://127.0.0.1:8901/", w: 390, h: 844, mobile: true },
  { name: "admin-desktop", url: "http://127.0.0.1:8901/admin/", w: 1280, h: 900 },
  { name: "admin-mobile", url: "http://127.0.0.1:8901/admin/", w: 390, h: 844, mobile: true },
];
const OUT = "/home/hatch/workspace/toms-table-portal/screenshots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Chrome is started separately (persistent background session); just connect.

  const tabs = await (await fetch("http://127.0.0.1:9223/json")).json();
  const wsUrl = tabs[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
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

  for (const s of SHOTS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: s.w, height: s.h, deviceScaleFactor: s.mobile ? 2 : 1,
      mobile: !!s.mobile,
    });
    await send("Page.navigate", { url: s.url });
    await sleep(4500); // let fonts + hydration settle
    const { data } = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: true,
    });
    const buf = Buffer.from(data, "base64");
    const path = `${OUT}/${s.name}.png`;
    require("fs").writeFileSync(path, buf);
    console.log(`saved ${path} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  ws.close();
  console.log("DONE");
}

main().catch((e) => { console.error("SHOT FAIL:", e.message); process.exit(1); });
