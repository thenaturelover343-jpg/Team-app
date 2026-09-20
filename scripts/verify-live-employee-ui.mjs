#!/usr/bin/env node
/**
 * Post-deploy guard: fail if the LIVE Worker still serves a stale EmployeeView.
 * EmployeeView is lazy-loaded — scan HTML plus discovered JS chunks, not page.js alone.
 */
const LIVE =
  process.env.LIVE_BASE_URL ||
  "https://barlicious-team-app.thenaturelover343.workers.dev";

function fail(msg) {
  console.error(`[verify-live-employee-ui] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify-live-employee-ui] OK: ${msg}`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "cache-control": "no-cache",
      "user-agent": "Mozilla/5.0 BarliciousVerify/1.0",
    },
  });
  if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function chunkPaths(text) {
  return [...text.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9._-]+\.js/g)].map(m => m[0]);
}

async function main() {
  console.log(`[verify-live-employee-ui] probing ${LIVE}`);
  const html = await fetchText(`${LIVE}/`);
  const ver = (await fetchText(`${LIVE}/app-version.txt`)).trim();
  if (!ver) fail("empty live app-version.txt");
  ok(`app-version → ${ver}`);

  const queue = chunkPaths(html);
  if (!queue.some(p => /page-/.test(p))) fail("could not find page-*.js chunk in live HTML");
  const seen = new Set();
  const bodies = [];
  while (queue.length && bodies.length < 40) {
    const path = queue.shift();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const text = await fetchText(`${LIVE}${path}`);
    bodies.push(text);
    for (const extra of chunkPaths(text)) {
      if (!seen.has(extra)) queue.push(extra);
    }
  }
  const body = bodies.join("\n");
  ok(`scanned ${bodies.length} JS chunks (includes lazy EmployeeView)`);

  if (body.includes("Mijn Beschikbaarheid")) fail("stale marker Mijn Beschikbaarheid");
  if (body.includes("Weekoverzicht") && !body.includes("Mijn Planning Vandaag")) {
    fail("Weekoverzicht without Mijn Planning Vandaag");
  }
  for (const needle of ["Vandaag", "Mijn Planning Vandaag"]) {
    if (!body.includes(needle)) fail(`missing required string ${JSON.stringify(needle)}`);
  }
  ok("required UI strings present (Vandaag, Mijn Planning Vandaag)");
  if (body.includes("splitName")) fail("splitName still present");
  ok("no splitName");
  console.log(JSON.stringify({ live: LIVE, appVersion: ver, chunks: bodies.length }, null, 2));
  console.log("[verify-live-employee-ui] SUCCESS — live EmployeeView is current");
}

main().catch((err) => fail(err?.stack || String(err)));
