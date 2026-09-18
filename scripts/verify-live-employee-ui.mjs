#!/usr/bin/env node
/**
 * Post-deploy guard: fail if the LIVE Worker still serves a stale EmployeeView.
 * Stale markers: "Mijn Beschikbaarheid", lone "Weekoverzicht" without today-planning UI.
 * Required: "Vandaag" and "Mijn Planning Vandaag"; prefer subtle PrivacyPanel path.
 *
 * Usage:
 *   node scripts/verify-live-employee-ui.mjs
 *   LIVE_BASE_URL=https://... node scripts/verify-live-employee-ui.mjs
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
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), url: res.url, status: res.status };
}

async function main() {
  console.log(`[verify-live-employee-ui] probing ${LIVE}`);
  const html = await fetchText(`${LIVE}/`);
  const pageMatches = [
    ...html.text.matchAll(/\/_next\/static\/chunks\/(page-[A-Za-z0-9_-]+\.js)/g),
  ].map((m) => m[1]);
  const pageChunk = [...new Set(pageMatches)][0];
  if (!pageChunk) fail("could not find page-*.js chunk in live HTML");
  ok(`page chunk → ${pageChunk}`);

  const version = await fetchText(`${LIVE}/app-version.txt`);
  const ver = version.text.trim();
  if (!ver) fail("empty live app-version.txt");
  ok(`app-version → ${ver}`);

  const js = await fetchText(`${LIVE}/_next/static/chunks/${pageChunk}`);
  const body = js.text;

  const bad = [];
  if (body.includes("Mijn Beschikbaarheid")) bad.push("Mijn Beschikbaarheid");
  // Lone week-overview label from old UI (new UI uses "Mijn Planning Vandaag" + Vandaag toggle)
  if (body.includes("Weekoverzicht") && !body.includes("Mijn Planning Vandaag")) {
    bad.push("Weekoverzicht without Mijn Planning Vandaag");
  }
  if (bad.length) fail(`stale EmployeeView markers in ${pageChunk}: ${bad.join("; ")}`);

  const required = ["Vandaag", "Mijn Planning Vandaag"];
  for (const needle of required) {
    if (!body.includes(needle)) fail(`missing required string ${JSON.stringify(needle)} in ${pageChunk}`);
  }
  ok(`required UI strings present (${required.join(", ")})`);

  // PrivacyPanel subtle path: prop/marker "subtle" plus collapsed privacy copy markers
  const subtleOk =
    body.includes("subtle") &&
    (body.includes("Privacyverklaring") ||
      body.includes("Verwerkingsverantwoordelijke") ||
      body.includes("privacy-title") ||
      body.includes("Déclaration de confidentialité"));
  if (!subtleOk) {
    console.warn(
      "[verify-live-employee-ui] WARN: could not confidently detect PrivacyPanel subtle markers (non-fatal)"
    );
  } else {
    ok("PrivacyPanel subtle path markers detected");
  }

  // Old splitName helper must never ship
  if (body.includes("splitName")) fail(`splitName still present in ${pageChunk}`);
  ok("no splitName");

  console.log(
    JSON.stringify(
      {
        live: LIVE,
        pageChunk,
        appVersion: ver,
        counts: {
          vandaag: (body.match(/Vandaag/g) || []).length,
          planningVandaag: (body.match(/Mijn Planning Vandaag/g) || []).length,
          beschikbaarheid: (body.match(/Mijn Beschikbaarheid/g) || []).length,
          weekoverzicht: (body.match(/Weekoverzicht/g) || []).length,
          subtle: (body.match(/subtle/g) || []).length,
        },
      },
      null,
      2
    )
  );
  console.log("[verify-live-employee-ui] SUCCESS — live EmployeeView is current");
}

main().catch((err) => fail(err?.stack || String(err)));
