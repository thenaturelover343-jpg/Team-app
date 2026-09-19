#!/usr/bin/env node
/**
 * Pilot live guard (curl/HTTP only — no browser).
 * Fails loudly if live Worker misses required Dutch UI markers or SW/version.
 *
 * Usage:
 *   node scripts/verify-pilot-live.mjs
 *   LIVE_BASE_URL=https://... node scripts/verify-pilot-live.mjs
 */
const LIVE =
  process.env.LIVE_BASE_URL ||
  "https://barlicious-team-app.thenaturelover343.workers.dev";

function fail(msg) {
  console.error(`[verify-pilot-live] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[verify-pilot-live] OK: ${msg}`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), url: res.url, status: res.status };
}

/** Collect page + lazy/dynamic chunks so code-split builds still verify UI markers. */
async function collectAppJs(live, pageChunk) {
  const queue = [pageChunk];
  const seen = new Set();
  const parts = [];
  const loaded = [];

  while (queue.length) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const { text } = await fetchText(`${live}/_next/static/chunks/${name}`);
    parts.push(text);
    loaded.push(name);

    for (const m of text.matchAll(
      /(?:^|["'`/,])((?:EmployeeView|AdminView|HoursBarChart|LiveLocationMap|WeekPlanner|ControlCenter|QualityCenter|page)[A-Za-z0-9_-]*\.js)/g,
    )) {
      queue.push(m[1]);
    }
    for (const m of text.matchAll(
      /_next\/static\/chunks\/([A-Za-z0-9_-]+\.js)/g,
    )) {
      const chunk = m[1];
      // Skip shared runtime/framework noise unless named as app views above.
      if (
        /^(EmployeeView|AdminView|HoursBarChart|LiveLocationMap|WeekPlanner|ControlCenter|QualityCenter|page)-/.test(
          chunk,
        )
      ) {
        queue.push(chunk);
      }
    }
  }

  return { body: parts.join("\n"), loaded };
}

async function main() {
  console.log(`[verify-pilot-live] probing ${LIVE}`);

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

  const sw = await fetchText(`${LIVE}/sw.js`);
  if (!sw.text.includes("addEventListener('push'") && !sw.text.includes('addEventListener("push"')) {
    fail("sw.js missing push event listener");
  }
  if (!sw.text.includes("app-version.txt")) {
    fail("sw.js does not precache/network-first app-version.txt");
  }
  if (!/const CACHE\s*=\s*['"]barlicious-team-/.test(sw.text)) {
    fail("sw.js missing barlicious-team CACHE name");
  }
  if (!sw.text.includes("/_next/static/")) {
    fail("sw.js missing /_next/static/ cache-first path");
  }
  ok("sw.js push + CACHE + app-version + static cache wiring present");

  const { body, loaded } = await collectAppJs(LIVE, pageChunk);
  ok(`scanned chunks → ${loaded.join(", ")}`);

  const forbidden = ["Mijn Beschikbaarheid", "Beschikbaarheid"];
  for (const needle of forbidden) {
    if (body.includes(needle)) fail(`stale marker ${JSON.stringify(needle)} still in app chunks`);
  }
  ok(`no forbidden markers (${forbidden.join(", ")})`);

  const required = [
    "Vandaag",
    "Wat is gedaan",
    "Open Instellingen",
    "Nieuwe versie",
    "Klantenbeheer",
    "Mijn Planning Vandaag",
  ];
  for (const needle of required) {
    if (!body.includes(needle)) {
      fail(`missing required string ${JSON.stringify(needle)} across scanned chunks`);
    }
  }
  ok(`required UI strings present (${required.join(", ")})`);

  // Auth-gated API must reject anonymous calls (not 500 / not open)
  const apiRes = await fetch(`${LIVE}/api/team`, {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-cache" },
    body: JSON.stringify({ action: "snapshot", input: {} }),
  });
  if (apiRes.status === 200) fail("anonymous /api/team snapshot returned 200 (must require auth)");
  if (apiRes.status >= 500) fail(`anonymous /api/team returned ${apiRes.status}`);
  ok(`api/team rejects anonymous → HTTP ${apiRes.status}`);

  if (body.includes("splitName")) fail("splitName still present in app chunks");
  ok("no splitName");

  console.log(
    JSON.stringify(
      {
        live: LIVE,
        pageChunk,
        scannedChunks: loaded,
        appVersion: ver,
        counts: Object.fromEntries(
          [...required, ...forbidden].map((needle) => [
            needle,
            (body.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [])
              .length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
  console.log("[verify-pilot-live] SUCCESS — live pilot UI/SW/version OK");
}

main().catch((err) => fail(err?.stack || String(err)));
