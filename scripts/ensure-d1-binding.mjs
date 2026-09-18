#!/usr/bin/env node
/**
 * Guarantees dist/server/wrangler.json always has the production D1 binding
 * and BOOTSTRAP_ADMIN_EMAIL after vinext/vite build. Empty d1_databases wipe
 * the live Worker DB binding on deploy — that caused login outages.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = resolve(root, "dist/server/wrangler.json");
const hostingPath = resolve(root, ".openai/hosting.json");

const D1 = {
  binding: "DB",
  database_name: "team-app",
  database_id: "73a03a39-22d7-4c60-b263-320b42a2f4dd",
};
const BOOTSTRAP = "thenaturelover343@gmail.com";

if (!existsSync(wranglerPath)) {
  console.error(`[ensure-d1-binding] missing ${wranglerPath} — run build first`);
  process.exit(1);
}

const hosting = existsSync(hostingPath)
  ? JSON.parse(readFileSync(hostingPath, "utf8"))
  : {};
const d1Binding = {
  binding: hosting.d1 || D1.binding,
  database_name: hosting.d1_database_name || D1.database_name,
  database_id: hosting.d1_database_id || D1.database_id,
};
const bootstrap =
  hosting.vars?.BOOTSTRAP_ADMIN_EMAIL || BOOTSTRAP;

const data = JSON.parse(readFileSync(wranglerPath, "utf8"));
const existing = Array.isArray(data.d1_databases) ? data.d1_databases : [];
const hasCorrect = existing.some(
  (b) =>
    b &&
    b.binding === d1Binding.binding &&
    b.database_id === d1Binding.database_id
);

if (!hasCorrect) {
  data.d1_databases = [d1Binding];
  console.log(
    `[ensure-d1-binding] restored d1_databases → ${d1Binding.binding} (${d1Binding.database_id})`
  );
} else {
  console.log(`[ensure-d1-binding] d1_databases OK (${d1Binding.binding})`);
}

data.vars = { ...(data.vars || {}), BOOTSTRAP_ADMIN_EMAIL: bootstrap };
writeFileSync(wranglerPath, JSON.stringify(data, null, 2) + "\n");
console.log(`[ensure-d1-binding] vars.BOOTSTRAP_ADMIN_EMAIL set`);
