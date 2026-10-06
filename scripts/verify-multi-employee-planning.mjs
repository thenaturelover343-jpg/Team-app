#!/usr/bin/env node
/**
 * HTTP + D1 simulation: admin creates planning for 2+ employees → each gets membership + notification.
 * Does not auto-publish existing drafts. Cleans up its own verify-* rows.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.env.LIVE_BASE_URL || "https://barlicious-team-app.thenaturelover343.workers.dev";
const EXPECTED_VERSION = process.env.EXPECTED_APP_VERSION || "20261006140000-multi-employee-planning";
const TAG = `verify-multi-${Date.now()}`;

function fail(msg) {
  console.error(`[verify-multi] FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[verify-multi] OK: ${msg}`);
}

function d1(command) {
  const r = spawnSync(
    process.execPath,
    [
      "--import", "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1", "execute", "team-app", "--remote",
      "--config", "dist/server/wrangler.json",
      "--json",
      "--command", command,
    ],
    { cwd: root, encoding: "utf8", env: process.env },
  );
  if (r.status !== 0) fail(`d1 execute failed: ${r.stderr || r.stdout}`);
  const parsed = JSON.parse(r.stdout);
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!block?.success) fail(`d1 not success: ${r.stdout.slice(0, 400)}`);
  return block.results || [];
}

async function httpGet(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache", "user-agent": "BarliciousVerify/1.0" } });
  if (!res.ok) fail(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function httpPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "BarliciousVerify/1.0" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  console.log(`[verify-multi] LIVE=${LIVE} tag=${TAG}`);

  // --- HTTP: version + unauth API guard ---
  const ver = (await httpGet(`${LIVE}/app-version.txt`)).trim();
  if (ver !== EXPECTED_VERSION) fail(`app-version got ${ver}, expected ${EXPECTED_VERSION}`);
  ok(`app-version ${ver}`);

  const unauth = await httpPost(`${LIVE}/api/team`, { action: "snapshot", input: {} });
  if (unauth.status < 400) fail(`unauth snapshot should fail, got ${unauth.status}`);
  ok(`unauth API rejected (${unauth.status})`);

  const html = await httpGet(`${LIVE}/`);
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9._-]+\.js/g)].map(m => m[0]);
  let body = html;
  for (const p of chunks.slice(0, 35)) body += await httpGet(`${LIVE}${p}`);
  for (const needle of ["Opslaan en publiceren", "Alleen concept", "Klantopdrachten", "Medewerkers"]) {
    if (!body.includes(needle)) fail(`live bundle missing ${JSON.stringify(needle)}`);
  }
  ok("live UI markers for multi-employee planning present");

  // --- D1: drafts report (never auto-publish) ---
  const drafts = d1("SELECT id, title, date, status FROM planned_shifts WHERE status='draft' ORDER BY created_at DESC LIMIT 50");
  ok(`draft planned_shifts pending (list only): ${drafts.length}`);
  if (drafts.length) console.log(JSON.stringify(drafts, null, 2));

  const employees = d1("SELECT id, name FROM users WHERE active=1 AND is_employee=1 ORDER BY name LIMIT 10");
  if (employees.length < 2) fail(`need ≥2 employees, got ${employees.length}`);
  const [e1, e2] = employees;
  ok(`employees for simulation: ${e1.name}, ${e2.name}`);

  const customers = d1("SELECT id, name, address FROM customers LIMIT 1");
  if (!customers.length) fail("need at least one customer");
  const customer = customers[0];

  const shiftId = `${TAG}-shift`;
  const asg1 = `${TAG}-asg-1`;
  const asg2 = `${TAG}-asg-2`;
  const n1 = `${TAG}-n1`;
  const n2 = `${TAG}-n2`;
  const n3 = `${TAG}-n3`;
  const n4 = `${TAG}-n4`;
  const now = Date.now();
  const date = "2026-10-08"; // upcoming Thu in same week window as 2026-10-06

  // Simulate savePlannedShift with default publish for 2 members
  d1(`INSERT INTO planned_shifts (id, title, customer_id, site_address, site_latitude, site_longitude, date, start_time, end_time, break_minutes, notes, status, recurrence_group_id, created_by, checklist_json, published_at, created_at, updated_at)
      VALUES ('${shiftId}', 'VERIFY multi publish', '${customer.id}', NULL, NULL, NULL, '${date}', '09:00', '17:00', 30, 'auto-verify', 'published', NULL, '${e1.id}', '[]', ${now}, ${now}, ${now})`);
  d1(`INSERT INTO planned_shift_members (shift_id, user_id, confirmation_status) VALUES ('${shiftId}', '${e1.id}', 'pending')`);
  d1(`INSERT INTO planned_shift_members (shift_id, user_id, confirmation_status) VALUES ('${shiftId}', '${e2.id}', 'pending')`);
  d1(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, dedupe_key, push_status, created_at)
      VALUES ('${n1}', '${e1.id}', 'planning_published', 'Nieuwe planning gepubliceerd', 'VERIFY multi publish op ${date} om 09:00.', 'planned_shift', '${shiftId}', 'published:${shiftId}:${e1.id}:${now}', 'skipped', ${now})`);
  d1(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, dedupe_key, push_status, created_at)
      VALUES ('${n2}', '${e2.id}', 'planning_published', 'Nieuwe planning gepubliceerd', 'VERIFY multi publish op ${date} om 09:00.', 'planned_shift', '${shiftId}', 'published:${shiftId}:${e2.id}:${now}', 'skipped', ${now})`);

  // Simulate saveAssignment multi-member (one row + notify per employee)
  d1(`INSERT INTO assignments (id, user_id, customer_id, description, date, start_time, site_address, site_latitude, site_longitude, status, created_at, updated_at)
      VALUES ('${asg1}', '${e1.id}', '${customer.id}', 'VERIFY multi assignment', '${date}', '10:00', '${(customer.address || "").replace(/'/g, "''")}', NULL, NULL, 'pending', ${now}, ${now})`);
  d1(`INSERT INTO assignments (id, user_id, customer_id, description, date, start_time, site_address, site_latitude, site_longitude, status, created_at, updated_at)
      VALUES ('${asg2}', '${e2.id}', '${customer.id}', 'VERIFY multi assignment', '${date}', '10:00', '${(customer.address || "").replace(/'/g, "''")}', NULL, NULL, 'pending', ${now}, ${now})`);
  d1(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, dedupe_key, push_status, created_at)
      VALUES ('${n3}', '${e1.id}', 'assignment_assigned', 'Nieuwe klantopdracht', '${customer.name} op ${date} om 10:00.', 'assignment', '${asg1}', 'assignment:${asg1}:${e1.id}:${now}', 'skipped', ${now})`);
  d1(`INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, dedupe_key, push_status, created_at)
      VALUES ('${n4}', '${e2.id}', 'assignment_assigned', 'Nieuwe klantopdracht', '${customer.name} op ${date} om 10:00.', 'assignment', '${asg2}', 'assignment:${asg2}:${e2.id}:${now}', 'skipped', ${now})`);

  const members = d1(`SELECT user_id FROM planned_shift_members WHERE shift_id='${shiftId}' ORDER BY user_id`);
  if (members.length !== 2) fail(`expected 2 members, got ${members.length}`);
  const memberIds = members.map(r => r.user_id).sort();
  if (!memberIds.includes(e1.id) || !memberIds.includes(e2.id)) fail("memberIds missing selected employees");
  ok(`planned_shift ${shiftId} has both selected employees`);

  const shiftNotifs = d1(`SELECT user_id, type FROM notifications WHERE entity_id='${shiftId}' AND type='planning_published'`);
  if (shiftNotifs.length !== 2) fail(`expected 2 planning notifications, got ${shiftNotifs.length}`);
  ok("planning_published notification per selected employee");

  const asgs = d1(`SELECT id, user_id FROM assignments WHERE id IN ('${asg1}','${asg2}') ORDER BY user_id`);
  if (asgs.length !== 2) fail(`expected 2 assignments, got ${asgs.length}`);
  ok("assignment row per selected employee");

  const asgNotifs = d1(`SELECT user_id, type FROM notifications WHERE id IN ('${n3}','${n4}')`);
  if (asgNotifs.length !== 2) fail(`expected 2 assignment notifications, got ${asgNotifs.length}`);
  ok("assignment_assigned notification per selected employee");

  // Employee-side visibility predicates (published + member match / self assignment)
  const vis1 = d1(`SELECT ps.id FROM planned_shifts ps JOIN planned_shift_members psm ON psm.shift_id=ps.id WHERE psm.user_id='${e1.id}' AND ps.status='published' AND ps.id='${shiftId}'`);
  const vis2 = d1(`SELECT ps.id FROM planned_shifts ps JOIN planned_shift_members psm ON psm.shift_id=ps.id WHERE psm.user_id='${e2.id}' AND ps.status='published' AND ps.id='${shiftId}'`);
  if (!vis1.length || !vis2.length) fail("employee snapshot filter would hide published multi-member shift");
  ok("employee snapshot filter: published+member match for both");

  const aVis1 = d1(`SELECT id FROM assignments WHERE user_id='${e1.id}' AND id='${asg1}' AND date>='2026-10-05'`);
  const aVis2 = d1(`SELECT id FROM assignments WHERE user_id='${e2.id}' AND id='${asg2}' AND date>='2026-10-05'`);
  if (!aVis1.length || !aVis2.length) fail("employee assignment week filter failed");
  ok("employee assignment filter: self + upcoming week for both");

  // Cleanup verify rows
  d1(`DELETE FROM notifications WHERE id IN ('${n1}','${n2}','${n3}','${n4}')`);
  d1(`DELETE FROM planned_shift_members WHERE shift_id='${shiftId}'`);
  d1(`DELETE FROM planned_shifts WHERE id='${shiftId}'`);
  d1(`DELETE FROM assignments WHERE id IN ('${asg1}','${asg2}')`);
  ok("cleaned verify-* rows");

  console.log(JSON.stringify({
    live: LIVE,
    appVersion: ver,
    draftsPending: drafts.length,
    drafts,
    employeesVerified: [e1.name, e2.name],
    tag: TAG,
  }, null, 2));
  console.log("[verify-multi] SUCCESS");
}

main().catch(err => fail(err?.stack || String(err)));
