import test from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, cutoff, normalizeRetention, safeErrorMessage, shouldRunDaily } from "../server/privacy.ts";

test("retention periods are bounded to safe operational ranges", () => {
  assert.deepEqual(normalizeRetention({ locationDays: 1, notificationDays: 9999, auditDays: 800 }), {
    locationDays: 30, notificationDays: 730, auditDays: 800, errorDays: 180, backupDays: 365,
  });
});

test("daily jobs and cutoffs are deterministic", () => {
  const now = 2_000_000_000_000;
  assert.equal(cutoff(now, 3), now - 3 * DAY_MS);
  assert.equal(shouldRunDaily(now - DAY_MS, now), true);
  assert.equal(shouldRunDaily(now - DAY_MS + 1, now), false);
});

test("error logging removes bearer credentials and truncates", () => {
  const result = safeErrorMessage(new Error(`Bearer abc.def.ghi ${"x".repeat(600)}`));
  assert.equal(result.includes("abc.def.ghi"), false);
  assert.equal(result.length, 500);
});
