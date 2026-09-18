import { env } from "cloudflare:workers";
import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { cleanText as clean, isAllowedTransition, normalizeEmail as email, validateGeofence, validateLocation as location } from "../../../server/policy";
import { addWeeks, availabilityConflict, isValidDate, isValidTime, overlaps, parseAvailability, validateShiftWindow } from "../../../server/planning";
import { attendanceEvents, csv, workedMinutes, type PlannedAttendance } from "../../../server/phase4";
import { cutoff, normalizeRetention, safeErrorMessage, sha256, shouldRunDaily, type RetentionSettings } from "../../../server/privacy";

export const dynamic = "force-dynamic";

const FIREBASE_PROJECT_ID = "gen-lang-client-0310454092";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

type FirebaseIdentity = { uid: string; email: string; name: string };
type AppUser = FirebaseIdentity & { role: "admin" | "employee"; active: boolean };
type Json = Record<string, unknown>;

let jwksCache: { expiresAt: number; keys: Json[] } | null = null;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function id() {
  return crypto.randomUUID();
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function decodeJsonPart(value: string): Json {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Json;
}

async function getJwks() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  // In-memory JWKS cache only — CF cacheTtl conflicts with Google's Cache-Control: no-store
  const response = await fetch(FIREBASE_JWKS);
  if (!response.ok) throw new Error("Aanmelding kon niet worden gecontroleerd.");
  const payload = await response.json() as { keys?: Json[] };
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (!keys.length) throw new Error("Aanmelding kon niet worden gecontroleerd.");
  jwksCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

async function verifyFirebaseToken(request: Request): Promise<FirebaseIdentity> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("U bent niet aangemeld.");
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Ongeldige aanmelding.");
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Ongeldige aanmelding.");
  const key = (await getJwks()).find(item => item.kid === header.kid);
  if (!key) throw new Error("Aanmelding kon niet worden gecontroleerd.");
  const cryptoKey = await crypto.subtle.importKey(
    "jwk", key as JsonWebKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, decodeBase64Url(parts[2]), signed);
  const now = Math.floor(Date.now() / 1000);
  if (!valid || claims.aud !== FIREBASE_PROJECT_ID || claims.iss !== FIREBASE_ISSUER) throw new Error("Ongeldige aanmelding.");
  if (typeof claims.exp !== "number" || claims.exp <= now || typeof claims.iat !== "number" || claims.iat > now + 60) {
    throw new Error("Uw aanmelding is verlopen. Meld opnieuw aan.");
  }
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) throw new Error("Ongeldige aanmelding.");
  if (claims.email_verified !== true || typeof claims.email !== "string") throw new Error("Gebruik een geverifieerd e-mailadres.");
  return {
    uid: claims.sub,
    email: claims.email.toLowerCase(),
    name: typeof claims.name === "string" ? claims.name : claims.email.split("@")[0],
  };
}

function database() {
  if (!env.DB) throw new Error("De beveiligde database is tijdelijk niet beschikbaar.");
  return env.DB;
}

function bucket() {
  if (!env.BUCKET) throw new Error("Bestandsopslag is tijdelijk niet beschikbaar.");
  return env.BUCKET;
}

async function audit(db: D1Database, actorId: string, action: string, targetType: string, targetId: string, details: Json = {}) {
  await db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id(), actorId, action, targetType, targetId, JSON.stringify(details), Date.now()).run();
}

async function session(identity: FirebaseIdentity): Promise<AppUser> {
  const db = database();
  let row = await db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").bind(identity.uid).first<Json>();
  if (!row) {
    const total = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
    if (Number(total?.total || 0) === 0) {
      const bootstrapEmail = email(env.BOOTSTRAP_ADMIN_EMAIL);
      if (!bootstrapEmail || identity.email !== bootstrapEmail) throw new Error("Dit account is niet uitgenodigd.");
      const now = Date.now();
      await db.prepare(`INSERT INTO users (id, email, name, role, active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)`)
        .bind(identity.uid, identity.email, identity.name, now).run();
      await audit(db, identity.uid, "admin.bootstrapped", "user", identity.uid);
    } else {
      const invite = await db.prepare("SELECT id, name, phone, role FROM invites WHERE email = ? AND status = 'pending'")
        .bind(identity.email).first<Json>();
      if (!invite) throw new Error("Dit account is niet uitgenodigd.");
      const now = Date.now();
      await db.batch([
        db.prepare(`INSERT INTO users (id, email, name, phone, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
          .bind(identity.uid, identity.email, String(invite.name), invite.phone || null, String(invite.role), now),
        db.prepare("UPDATE invites SET status = 'accepted', accepted_at = ? WHERE id = ?").bind(now, String(invite.id)),
        db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at)
          VALUES (?, ?, 'employee.invite_accepted', 'user', ?, '{}', ?)`)
          .bind(id(), identity.uid, identity.uid, now),
      ]);
    }
    row = await db.prepare("SELECT id, email, name, role, active FROM users WHERE id = ?").bind(identity.uid).first<Json>();
  }
  if (!row || Number(row.active) !== 1 || (row.role !== "admin" && row.role !== "employee")) {
    throw new Error("Dit account is niet actief.");
  }
  return { uid: identity.uid, email: String(row.email), name: String(row.name), role: row.role, active: true } as AppUser;
}

function requireAdmin(user: AppUser) {
  if (user.role !== "admin") throw new Error("Alleen een beheerder mag dit uitvoeren.");
}

async function recordAccess(db: D1Database, user: AppUser, request: Request) {
  const accessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());
  await db.prepare(`INSERT OR IGNORE INTO access_events (id, user_id, access_date, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?)`).bind(id(), user.uid, accessDate, clean(request.headers.get("User-Agent"), 500) || null, Date.now()).run();
}

async function privacySettings(db: D1Database) {
  await db.prepare(`INSERT OR IGNORE INTO privacy_settings
    (id, controller_name, location_days, notification_days, audit_days, error_days, backup_days, updated_at)
    VALUES ('default', 'Barlicious & Koelverhuur', 90, 180, 730, 180, 365, ?)`).bind(Date.now()).run();
  return db.prepare("SELECT * FROM privacy_settings WHERE id='default'").first<Json>();
}

function mappedPrivacy(row: Json | null) {
  return {
    controllerName: String(row?.controller_name || "Barlicious & Koelverhuur"),
    contactEmail: row?.contact_email ? String(row.contact_email) : "",
    locationDays: Number(row?.location_days || 90), notificationDays: Number(row?.notification_days || 180),
    auditDays: Number(row?.audit_days || 730), errorDays: Number(row?.error_days || 180),
    backupDays: Number(row?.backup_days || 365), lastCleanupAt: row?.last_cleanup_at ? Number(row.last_cleanup_at) : undefined,
  };
}

async function runPrivacyCleanup(db: D1Database, actorId: string, force = false) {
  const row = await privacySettings(db);
  const now = Date.now();
  if (!force && !shouldRunDaily(row?.last_cleanup_at, now)) return { skipped: true, counts: {} };
  const retention = normalizeRetention(mappedPrivacy(row));
  const counts: Record<string, number> = {};
  const locationCutoff = cutoff(now, retention.locationDays);
  const results = await db.batch([
    db.prepare(`UPDATE shifts SET clock_in_lat=0, clock_in_lng=0, clock_in_accuracy=NULL, clock_in_distance=NULL,
      clock_out_lat=NULL, clock_out_lng=NULL, clock_out_accuracy=NULL, clock_out_distance=NULL,
      geofence_status='anonymized', location_anonymized_at=? WHERE clock_in<? AND location_anonymized_at IS NULL`).bind(now, locationCutoff),
    db.prepare("UPDATE assignments SET arrival_lat=NULL, arrival_lng=NULL, departure_lat=NULL, departure_lng=NULL WHERE created_at<?").bind(locationCutoff),
    db.prepare("UPDATE incidents SET latitude=NULL, longitude=NULL, accuracy=NULL WHERE created_at<?").bind(locationCutoff),
    db.prepare("DELETE FROM notifications WHERE created_at<?").bind(cutoff(now, retention.notificationDays)),
    db.prepare("DELETE FROM error_events WHERE created_at<?").bind(cutoff(now, retention.errorDays)),
    db.prepare("DELETE FROM access_events WHERE created_at<?").bind(cutoff(now, retention.auditDays)),
    db.prepare("DELETE FROM audit_events WHERE created_at<?").bind(cutoff(now, retention.auditDays)),
  ]);
  ["locations", "assignmentLocations", "incidentLocations", "notifications", "errors", "access", "audit"].forEach((key, index) => {
    counts[key] = Number(results[index]?.meta.changes || 0);
  });
  const expired = await db.prepare("SELECT id, object_key FROM backup_runs WHERE created_at<?").bind(cutoff(now, retention.backupDays)).all<Json>();
  for (const backup of expired.results as Json[]) {
    await bucket().delete(String(backup.object_key));
    await db.prepare("DELETE FROM backup_runs WHERE id=?").bind(String(backup.id)).run();
  }
  counts.backups = expired.results.length;
  await db.prepare("UPDATE privacy_settings SET last_cleanup_at=?, updated_by=?, updated_at=? WHERE id='default'").bind(now, actorId, now).run();
  await audit(db, actorId, "privacy.cleanup", "privacy_settings", "default", counts);
  return { skipped: false, counts };
}

const BACKUP_TABLES = ["users", "invites", "customers", "planned_shifts", "planned_shift_members", "assignments", "shifts", "timesheet_approvals", "shift_breaks", "incidents", "correction_requests", "attachments", "notifications", "audit_events", "access_events", "privacy_settings", "pilot_programs", "pilot_members", "pilot_feedback"] as const;

async function createBackup(db: D1Database, actorId: string) {
  const backupId = id();
  const tables: Record<string, Json[]> = {};
  for (const table of BACKUP_TABLES) {
    const result = await db.prepare(`SELECT * FROM ${table} LIMIT 20000`).all<Json>();
    tables[table] = result.results as Json[];
  }
  const payload = JSON.stringify({ format: 1, createdAt: Date.now(), tables });
  const checksum = await sha256(payload);
  const objectKey = `backups/${new Date().toISOString().slice(0, 10)}/${backupId}.json`;
  await bucket().put(objectKey, payload, { httpMetadata: { contentType: "application/json" } });
  const rowCounts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
  await db.prepare(`INSERT INTO backup_runs (id, object_key, checksum, row_counts_json, status, created_by, created_at)
    VALUES (?, ?, ?, ?, 'completed', ?, ?)`).bind(backupId, objectKey, checksum, JSON.stringify(rowCounts), actorId, Date.now()).run();
  await audit(db, actorId, "backup.created", "backup", backupId, { rowCounts });
  return { id: backupId, checksum, rowCounts };
}

async function testBackup(db: D1Database, actorId: string) {
  const backup = await db.prepare("SELECT * FROM backup_runs WHERE status='completed' ORDER BY created_at DESC LIMIT 1").first<Json>();
  if (!backup) throw new Error("Er is nog geen back-up om te testen.");
  const object = await bucket().get(String(backup.object_key));
  if (!object) throw new Error("Het back-upbestand ontbreekt.");
  const text = await object.text();
  const parsed = JSON.parse(text) as { format?: number; tables?: Record<string, unknown[]> };
  const valid = parsed.format === 1 && parsed.tables && BACKUP_TABLES.every(table => Array.isArray(parsed.tables?.[table])) && await sha256(text) === backup.checksum;
  const now = Date.now();
  await db.prepare("UPDATE backup_runs SET tested_at=?, test_status=?, test_details=? WHERE id=?")
    .bind(now, valid ? "passed" : "failed", valid ? "Checksum, JSON-formaat en alle tabellen gecontroleerd." : "Integriteitscontrole mislukt.", String(backup.id)).run();
  await audit(db, actorId, "backup.restore_tested", "backup", String(backup.id), { valid });
  if (!valid) throw new Error("De hersteltest is mislukt.");
  return { ok: true, id: backup.id };
}

async function pushToUser(db: D1Database, userId: string, message: { title: string; body: string; url?: string }) {
  if (!env.VAPID_SUBJECT || !env.VAPID_SERVER_PUBLIC_KEY || !env.VAPID_SERVER_PRIVATE_KEY) return "unavailable";
  const subscriptions = await db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?").bind(userId).all<Json>();
  let delivered = 0;
  for (const row of subscriptions.results as Json[]) {
    const subscription: PushSubscription = {
      endpoint: String(row.endpoint), expirationTime: null,
      keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
    };
    try {
      const payload = await buildPushPayload({ data: JSON.stringify(message), options: { ttl: 60 * 60 } }, subscription, {
        subject: env.VAPID_SUBJECT, publicKey: env.VAPID_SERVER_PUBLIC_KEY, privateKey: env.VAPID_SERVER_PRIVATE_KEY,
      });
      const response = await fetch(subscription.endpoint, payload);
      if (response.ok) delivered += 1;
      else if (response.status === 404 || response.status === 410) await db.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(String(row.id)).run();
    } catch {
      // A notification record remains visible even if a device endpoint is temporarily unavailable.
    }
  }
  return delivered > 0 ? "sent" : subscriptions.results.length ? "failed" : "no_subscription";
}

async function notify(db: D1Database, input: { userId: string; type: string; title: string; body: string; dedupeKey: string; entityType?: string; entityId?: string }) {
  const notificationId = id();
  const result = await db.prepare(`INSERT OR IGNORE INTO notifications
    (id, user_id, type, title, body, entity_type, entity_id, dedupe_key, push_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .bind(notificationId, input.userId, input.type, input.title, input.body, input.entityType || null, input.entityId || null, input.dedupeKey, Date.now()).run();
  if (!result.meta.changes) return false;
  const pushStatus = await pushToUser(db, input.userId, { title: input.title, body: input.body, url: "/" });
  await db.prepare("UPDATE notifications SET push_status=? WHERE id=?").bind(pushStatus, notificationId).run();
  return true;
}

async function notifyAdmins(db: D1Database, input: Omit<Parameters<typeof notify>[1], "userId" | "dedupeKey"> & { dedupeKey: string }) {
  const admins = await db.prepare("SELECT id FROM users WHERE role='admin' AND active=1").all<{ id: string }>();
  await Promise.all(admins.results.map(admin => notify(db, { ...input, userId: admin.id, dedupeKey: `${input.dedupeKey}:${admin.id}` })));
}

async function runAttendanceSweep(db: D1Database) {
  const result = await db.prepare(`SELECT ps.id AS shift_id, psm.user_id, u.name AS user_name, ps.date, ps.start_time, ps.title,
      EXISTS(SELECT 1 FROM shifts s WHERE s.planned_shift_id=ps.id AND s.user_id=psm.user_id) AS has_clock_in
    FROM planned_shifts ps JOIN planned_shift_members psm ON psm.shift_id=ps.id JOIN users u ON u.id=psm.user_id
    WHERE ps.status='published' AND ps.date BETWEEN date('now','-1 day') AND date('now','+1 day')`).all<Json>();
  const rows: PlannedAttendance[] = (result.results as Json[]).map(row => ({
    shiftId: String(row.shift_id), userId: String(row.user_id), date: String(row.date), startTime: String(row.start_time),
    title: String(row.title), userName: String(row.user_name), hasClockIn: Number(row.has_clock_in) === 1,
  }));
  for (const event of attendanceEvents(rows, new Date())) {
    await notify(db, { userId: event.userId, type: event.type, title: event.title, body: event.body, dedupeKey: event.dedupeKey, entityType: "planned_shift", entityId: event.shiftId });
    if (event.type === "late" || event.type === "no_show") {
      await notifyAdmins(db, { type: event.type, title: event.title, body: event.body, dedupeKey: `${event.dedupeKey}:admin`, entityType: "planned_shift", entityId: event.shiftId });
    }
  }
}

function splitDisplayName(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const space = trimmed.indexOf(" ");
  if (space < 0) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, space).trim(), lastName: trimmed.slice(space + 1).trim() };
}

function mapUser(row: Json) {
  const displayName = String(row.name || "");
  const fromCols = {
    firstName: row.first_name != null ? String(row.first_name) : "",
    lastName: row.last_name != null ? String(row.last_name) : "",
  };
  const split = splitDisplayName(displayName);
  const firstName = fromCols.firstName || split.firstName;
  const lastName = fromCols.lastName || split.lastName;
  const name = (`${firstName} ${lastName}`.trim() || displayName).trim();
  return {
    id: row.id, email: row.email, name, firstName, lastName,
    phone: row.phone || "", address: row.address || "", role: row.role,
    active: Number(row.active) === 1, availability: row.availability || "",
    availabilitySchedule: parseAvailability(row.availability_json), createdAt: Number(row.created_at),
  };
}

function mapShift(row: Json) {
  const anonymized = Boolean(row.location_anonymized_at);
  return {
    id: row.id, userId: row.user_id, plannedShiftId: row.planned_shift_id || undefined, clockIn: Number(row.clock_in),
    ...(!anonymized ? { clockInLoc: { lat: Number(row.clock_in_lat), lng: Number(row.clock_in_lng), accuracy: Number(row.clock_in_accuracy || 0), capturedAt: Number(row.clock_in_client_at || row.clock_in) }, clockInDistance: row.clock_in_distance === null || row.clock_in_distance === undefined ? undefined : Number(row.clock_in_distance) } : {}),
    ...(row.clock_out ? { clockOut: Number(row.clock_out), ...(!anonymized ? { clockOutLoc: { lat: Number(row.clock_out_lat), lng: Number(row.clock_out_lng), accuracy: Number(row.clock_out_accuracy || 0), capturedAt: Number(row.clock_out_client_at || row.clock_out) }, clockOutDistance: row.clock_out_distance === null || row.clock_out_distance === undefined ? undefined : Number(row.clock_out_distance) } : {}) } : {}),
    locationAnonymizedAt: anonymized ? Number(row.location_anonymized_at) : undefined,
    geofenceStatus: row.geofence_status || undefined, statusTag: row.status_tag || undefined, notes: row.notes || undefined,
    approvalStatus: row.approval_status || "pending", approvedBy: row.reviewed_by || undefined,
    approvedAt: row.reviewed_at ? Number(row.reviewed_at) : undefined, approvalNote: row.admin_note || undefined,
  };
}

function mapAssignment(row: Json) {
  return {
    id: row.id, userId: row.user_id, customerId: row.customer_id, customerName: row.customer_name || "",
    customerAddress: row.customer_address || "",
    siteAddress: row.site_address || "", siteLatitude: row.site_latitude ?? undefined, siteLongitude: row.site_longitude ?? undefined,
    description: row.description, date: row.date, startTime: row.start_time || "", status: row.status,
    arrivalTime: row.arrival_time ? Number(row.arrival_time) : undefined,
    departureTime: row.departure_time ? Number(row.departure_time) : undefined,
    workNotes: row.work_notes || "", materials: row.materials || "", completionNotes: row.completion_notes || "",
    tasks: JSON.parse(String(row.tasks_json || "[]")),
    acknowledged: Number(row.acknowledged) === 1, createdAt: Number(row.created_at),
  };
}

function mapPlannedShifts(rows: Json[]) {
  const grouped = new Map<string, Json>();
  for (const row of rows) {
    const shiftId = String(row.id);
    const current = grouped.get(shiftId) || {
      id: shiftId, title: row.title, customerId: row.customer_id || "", customerName: row.customer_name || "",
      customerAddress: row.customer_address || "", customerLatitude: row.customer_latitude ?? undefined,
      customerLongitude: row.customer_longitude ?? undefined,
      siteAddress: row.site_address || "", siteLatitude: row.site_latitude ?? undefined, siteLongitude: row.site_longitude ?? undefined,
      date: row.date, startTime: row.start_time,
      endTime: row.end_time, breakMinutes: Number(row.break_minutes), notes: row.notes || "", status: row.status,
      recurrenceGroupId: row.recurrence_group_id || undefined, publishedAt: row.published_at ? Number(row.published_at) : undefined,
      createdAt: Number(row.created_at), checklist: JSON.parse(String(row.checklist_json || "[]")), memberIds: [], confirmations: {}, checklistStates: {},
    };
    if (row.member_user_id) {
      (current.memberIds as string[]).push(String(row.member_user_id));
      (current.confirmations as Record<string, string>)[String(row.member_user_id)] = String(row.confirmation_status || "pending");
      (current.checklistStates as Record<string, string[]>)[String(row.member_user_id)] = JSON.parse(String(row.checklist_state_json || "[]"));
    }
    grouped.set(shiftId, current);
  }
  return [...grouped.values()];
}

function cleanAvailability(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result: Record<string, { enabled: boolean; start: string; end: string }> = {};
  for (let day = 0; day < 7; day += 1) {
    const item = (input as Record<string, unknown>)[String(day)];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const enabled = (item as Json).enabled === true;
    const start = clean((item as Json).start, 5);
    const end = clean((item as Json).end, 5);
    if (enabled && (!isValidTime(start) || !isValidTime(end) || start >= end)) throw new Error("Controleer de beschikbaarheidsuren.");
    result[String(day)] = { enabled, start: isValidTime(start) ? start : "09:00", end: isValidTime(end) ? end : "17:00" };
  }
  return result;
}

async function snapshot(user: AppUser) {
  const db = database();
  const settings = await privacySettings(db);
  await runPrivacyCleanup(db, user.uid).catch(() => undefined);
  if (user.role === "admin") {
    const latest = await db.prepare("SELECT created_at FROM backup_runs WHERE status='completed' ORDER BY created_at DESC LIMIT 1").first<Json>();
    if (shouldRunDaily(latest?.created_at, Date.now())) await createBackup(db, user.uid).catch(() => undefined);
  }
  await runAttendanceSweep(db);
  const usersQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM users ORDER BY name")
    : db.prepare("SELECT * FROM users WHERE id = ?").bind(user.uid);
  const shiftsQuery = user.role === "admin"
    ? db.prepare(`SELECT s.*, ta.status AS approval_status, ta.reviewed_by, ta.reviewed_at, ta.admin_note
        FROM shifts s LEFT JOIN timesheet_approvals ta ON ta.shift_id=s.id ORDER BY s.clock_in DESC LIMIT 1000`)
    : db.prepare(`SELECT s.*, ta.status AS approval_status, ta.reviewed_by, ta.reviewed_at, ta.admin_note
        FROM shifts s LEFT JOIN timesheet_approvals ta ON ta.shift_id=s.id WHERE s.user_id = ? ORDER BY s.clock_in DESC LIMIT 500`).bind(user.uid);
  const assignmentsQuery = user.role === "admin"
    ? db.prepare(`SELECT a.*, c.name AS customer_name, c.address AS customer_address FROM assignments a LEFT JOIN customers c ON c.id = a.customer_id ORDER BY a.date DESC, a.start_time DESC LIMIT 1000`)
    : db.prepare(`SELECT a.*, c.name AS customer_name, c.address AS customer_address FROM assignments a LEFT JOIN customers c ON c.id = a.customer_id WHERE a.user_id = ? ORDER BY a.date DESC, a.start_time DESC LIMIT 500`).bind(user.uid);
  const plannedQuery = user.role === "admin"
    ? db.prepare(`SELECT ps.*, c.name AS customer_name, c.address AS customer_address, c.latitude AS customer_latitude,
        c.longitude AS customer_longitude, psm.user_id AS member_user_id, psm.confirmation_status, psm.checklist_state_json
        FROM planned_shifts ps LEFT JOIN customers c ON c.id = ps.customer_id
        LEFT JOIN planned_shift_members psm ON psm.shift_id = ps.id ORDER BY ps.date, ps.start_time LIMIT 3000`)
    : db.prepare(`SELECT ps.*, c.name AS customer_name, c.address AS customer_address, c.latitude AS customer_latitude,
        c.longitude AS customer_longitude, psm.user_id AS member_user_id, psm.confirmation_status, psm.checklist_state_json
        FROM planned_shifts ps LEFT JOIN customers c ON c.id = ps.customer_id
        JOIN planned_shift_members psm ON psm.shift_id = ps.id
        WHERE psm.user_id = ? AND ps.status = 'published' ORDER BY ps.date, ps.start_time LIMIT 1000`).bind(user.uid);
  const breaksQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM shift_breaks ORDER BY started_at DESC LIMIT 2000")
    : db.prepare("SELECT * FROM shift_breaks WHERE user_id=? ORDER BY started_at DESC LIMIT 500").bind(user.uid);
  const incidentsQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM incidents ORDER BY created_at DESC LIMIT 1000")
    : db.prepare("SELECT * FROM incidents WHERE user_id=? ORDER BY created_at DESC LIMIT 500").bind(user.uid);
  const correctionsQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM correction_requests ORDER BY created_at DESC LIMIT 1000")
    : db.prepare("SELECT * FROM correction_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 500").bind(user.uid);
  const attachmentsQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM attachments ORDER BY created_at DESC LIMIT 1000")
    : db.prepare(`SELECT a.* FROM attachments a WHERE a.user_id=? OR (
        a.entity_type='planned_shift' AND EXISTS (
          SELECT 1 FROM planned_shift_members psm WHERE psm.shift_id=a.entity_id AND psm.user_id=?
        )
      ) ORDER BY a.created_at DESC LIMIT 500`).bind(user.uid, user.uid);
  const notificationsQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 500").bind(user.uid)
    : db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 300").bind(user.uid);
  const auditQuery = user.role === "admin" ? db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 150") : db.prepare("SELECT * FROM audit_events WHERE actor_id=? ORDER BY created_at DESC LIMIT 50").bind(user.uid);
  const accessQuery = user.role === "admin" ? db.prepare("SELECT * FROM access_events ORDER BY created_at DESC LIMIT 150") : db.prepare("SELECT * FROM access_events WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.uid);
  const pilotQuery = user.role === "admin"
    ? db.prepare(`SELECT pp.*, pm.user_id, u.name AS user_name FROM pilot_programs pp LEFT JOIN pilot_members pm ON pm.pilot_id=pp.id LEFT JOIN users u ON u.id=pm.user_id WHERE pp.status='active' ORDER BY pp.started_at DESC`)
    : db.prepare(`SELECT pp.*, pm.user_id, u.name AS user_name FROM pilot_programs pp JOIN pilot_members pm ON pm.pilot_id=pp.id LEFT JOIN users u ON u.id=pm.user_id WHERE pp.status='active' AND pm.user_id=?`).bind(user.uid);
  const [usersResult, shiftsResult, assignmentsResult, customersResult, plannedResult, breaksResult, incidentsResult, correctionsResult, attachmentsResult, notificationsResult, pushCount, auditResult, accessResult, backupResult, errorsResult, pilotResult, feedbackResult] = await Promise.all([
    usersQuery.all<Json>(), shiftsQuery.all<Json>(), assignmentsQuery.all<Json>(),
    db.prepare("SELECT * FROM customers ORDER BY name").all<Json>(),
    plannedQuery.all<Json>(), breaksQuery.all<Json>(), incidentsQuery.all<Json>(), correctionsQuery.all<Json>(), attachmentsQuery.all<Json>(),
    notificationsQuery.all<Json>(), db.prepare("SELECT COUNT(*) AS total FROM push_subscriptions WHERE user_id=?").bind(user.uid).first<{ total: number }>(),
    auditQuery.all<Json>(), accessQuery.all<Json>(),
    user.role === "admin" ? db.prepare("SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT 30").all<Json>() : Promise.resolve({ results: [] }),
    user.role === "admin" ? db.prepare("SELECT * FROM error_events ORDER BY created_at DESC LIMIT 100").all<Json>() : Promise.resolve({ results: [] }),
    pilotQuery.all<Json>(),
    user.role === "admin" ? db.prepare("SELECT * FROM pilot_feedback ORDER BY created_at DESC LIMIT 100").all<Json>() : db.prepare("SELECT * FROM pilot_feedback WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.uid).all<Json>(),
  ]);
  return {
    user: mapUser((usersResult.results as Json[]).find(item => item.id === user.uid) || {}),
    users: (usersResult.results as Json[]).map(mapUser),
    shifts: (shiftsResult.results as Json[]).map(mapShift),
    assignments: (assignmentsResult.results as Json[]).map(mapAssignment),
    customers: (customersResult.results as Json[]).map(row => ({
      id: row.id, name: row.name, address: row.address, phone: row.phone || "", email: row.email || "",
      btwNumber: row.btw_number ? String(row.btw_number) : undefined,
      latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined, createdAt: Number(row.created_at),
    })),
    plannedShifts: mapPlannedShifts(plannedResult.results as Json[]),
    breaks: (breaksResult.results as Json[]).map(row => ({ id: row.id, shiftId: row.shift_id, userId: row.user_id, startedAt: Number(row.started_at), endedAt: row.ended_at ? Number(row.ended_at) : undefined })),
    incidents: (incidentsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, plannedShiftId: row.planned_shift_id || undefined, category: row.category, severity: row.severity, description: row.description, status: row.status, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined, accuracy: row.accuracy ?? undefined, occurredAt: Number(row.occurred_at), createdAt: Number(row.created_at) })),
    correctionRequests: (correctionsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, shiftId: row.shift_id, requestedClockIn: row.requested_clock_in ? Number(row.requested_clock_in) : undefined, requestedClockOut: row.requested_clock_out ? Number(row.requested_clock_out) : undefined, reason: row.reason, status: row.status, reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : undefined, createdAt: Number(row.created_at) })),
    attachments: (attachmentsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, entityType: row.entity_type, entityId: row.entity_id, filename: row.filename, mimeType: row.mime_type, size: Number(row.size), storage: row.data_url ? "inline" : "r2", createdAt: Number(row.created_at) })),
    notifications: (notificationsResult.results as Json[]).map(row => ({
      id: row.id, userId: row.user_id, type: row.type, title: row.title, body: row.body,
      entityType: row.entity_type || undefined, entityId: row.entity_id || undefined,
      readAt: row.read_at ? Number(row.read_at) : undefined, pushStatus: row.push_status, createdAt: Number(row.created_at),
    })),
    push: { supported: Boolean(env.VAPID_SERVER_PUBLIC_KEY), enabled: Number(pushCount?.total || 0) > 0, publicKey: env.VAPID_SERVER_PUBLIC_KEY || "" },
    privacy: mappedPrivacy(settings),
    auditEvents: (auditResult.results as Json[]).map(row => ({ id: row.id, actorId: row.actor_id, action: row.action, targetType: row.target_type, targetId: row.target_id, createdAt: Number(row.created_at) })),
    accessEvents: (accessResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, accessDate: row.access_date, userAgent: row.user_agent || "", createdAt: Number(row.created_at) })),
    backups: (backupResult.results as Json[]).map(row => ({ id: row.id, status: row.status, checksum: row.checksum, rowCounts: JSON.parse(String(row.row_counts_json || "{}")), createdAt: Number(row.created_at), testedAt: row.tested_at ? Number(row.tested_at) : undefined, testStatus: row.test_status || undefined, testDetails: row.test_details || undefined })),
    errors: (errorsResult.results as Json[]).map(row => ({ id: row.id, actorId: row.actor_id || undefined, action: row.action || undefined, message: row.message, severity: row.severity, createdAt: Number(row.created_at) })),
    pilot: (() => { const rows = pilotResult.results as Json[]; if (!rows.length) return null; const first = rows[0]; return { id: first.id, status: first.status, startedAt: Number(first.started_at), endsAt: Number(first.ends_at), members: rows.filter(row => row.user_id).map(row => ({ userId: String(row.user_id), name: String(row.user_name || "") })) }; })(),
    pilotFeedback: (feedbackResult.results as Json[]).map(row => ({ id: row.id, pilotId: row.pilot_id, userId: row.user_id, rating: Number(row.rating), category: row.category, message: row.message, createdAt: Number(row.created_at) })),
  };
}

async function act(user: AppUser, action: string, input: Json) {
  const db = database();
  const now = Date.now();
  if (action === "snapshot") return snapshot(user);

  if (action === "updatePrivacySettings") {
    requireAdmin(user);
    const controllerName = clean(input.controllerName, 200);
    const contactEmail = email(input.contactEmail) || null;
    if (!controllerName) throw new Error("Naam van de verwerkingsverantwoordelijke is verplicht.");
    const retention = normalizeRetention(input as Partial<Record<keyof RetentionSettings, unknown>>);
    await db.prepare(`UPDATE privacy_settings SET controller_name=?, contact_email=?, location_days=?, notification_days=?,
      audit_days=?, error_days=?, backup_days=?, updated_by=?, updated_at=? WHERE id='default'`)
      .bind(controllerName, contactEmail, retention.locationDays, retention.notificationDays, retention.auditDays, retention.errorDays, retention.backupDays, user.uid, now).run();
    await audit(db, user.uid, "privacy.settings_updated", "privacy_settings", "default", retention);
    return { ok: true };
  }

  if (action === "runPrivacyCleanup") {
    requireAdmin(user);
    return runPrivacyCleanup(db, user.uid, true);
  }

  if (action === "createBackup") {
    requireAdmin(user);
    return createBackup(db, user.uid);
  }

  if (action === "testLatestBackup") {
    requireAdmin(user);
    return testBackup(db, user.uid);
  }

  if (action === "startPilot") {
    requireAdmin(user);
    const memberIds = [...new Set((Array.isArray(input.memberIds) ? input.memberIds : []).map(value => clean(value, 160)).filter(Boolean))];
    const durationDays = Math.max(7, Math.min(30, Math.trunc(Number(input.durationDays) || 14)));
    if (memberIds.length < 2 || memberIds.length > 5) throw new Error("Kies 2 tot 5 actieve werknemers voor de pilot.");
    if (await db.prepare("SELECT 1 FROM pilot_programs WHERE status='active'").first()) throw new Error("Er loopt al een pilot.");
    const placeholders = memberIds.map(() => "?").join(",");
    const activeMembers = await db.prepare(`SELECT id FROM users WHERE active=1 AND id IN (${placeholders})`).bind(...memberIds).all<Json>();
    if (activeMembers.results.length !== memberIds.length) throw new Error("Een geselecteerde werknemer is niet actief.");
    const pilotId = id();
    await db.batch([
      db.prepare("INSERT INTO pilot_programs (id, status, created_by, started_at, ends_at) VALUES (?, 'active', ?, ?, ?)").bind(pilotId, user.uid, now, now + durationDays * 86400000),
      ...memberIds.map(memberId => db.prepare("INSERT INTO pilot_members (pilot_id, user_id, invited_at) VALUES (?, ?, ?)").bind(pilotId, memberId, now)),
    ]);
    await Promise.all(memberIds.map(memberId => notify(db, { userId: memberId, type: "pilot", title: "U neemt deel aan de app-pilot", body: `Test de app ${durationDays} dagen en geef feedback via uw profiel.`, dedupeKey: `pilot:${pilotId}:${memberId}`, entityType: "pilot", entityId: pilotId })));
    await audit(db, user.uid, "pilot.started", "pilot", pilotId, { memberIds, durationDays });
    return { id: pilotId };
  }

  if (action === "closePilot") {
    requireAdmin(user);
    const pilotId = clean(input.id, 160);
    const result = await db.prepare("UPDATE pilot_programs SET status='closed', closed_at=? WHERE id=? AND status='active'").bind(now, pilotId).run();
    if (!result.meta.changes) throw new Error("Actieve pilot niet gevonden.");
    await audit(db, user.uid, "pilot.closed", "pilot", pilotId);
    return { ok: true };
  }

  if (action === "submitPilotFeedback") {
    const pilotId = clean(input.pilotId, 160);
    const rating = Math.trunc(Number(input.rating));
    const category = clean(input.category, 80);
    const message = clean(input.message, 2000);
    const member = await db.prepare(`SELECT 1 FROM pilot_members pm JOIN pilot_programs pp ON pp.id=pm.pilot_id
      WHERE pm.pilot_id=? AND pm.user_id=? AND pp.status='active'`).bind(pilotId, user.uid).first();
    if (!member || rating < 1 || rating > 5 || !category || !message) throw new Error("Vul geldige pilotfeedback in.");
    const feedbackId = id();
    await db.prepare("INSERT INTO pilot_feedback (id, pilot_id, user_id, rating, category, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(feedbackId, pilotId, user.uid, rating, category, message, now).run();
    await audit(db, user.uid, "pilot.feedback_submitted", "pilot", pilotId, { rating, category });
    return { id: feedbackId };
  }

  if (action === "savePushSubscription") {
    const subscription = input.subscription && typeof input.subscription === "object" ? input.subscription as Json : {};
    const keys = subscription.keys && typeof subscription.keys === "object" ? subscription.keys as Json : {};
    const endpoint = clean(subscription.endpoint, 2000);
    const p256dh = clean(keys.p256dh, 500);
    const auth = clean(keys.auth, 500);
    if (!endpoint.startsWith("https://") || !p256dh || !auth) throw new Error("Ongeldig pushabonnement.");
    const subscriptionId = id();
    await db.prepare(`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,
      p256dh=excluded.p256dh, auth=excluded.auth, user_agent=excluded.user_agent, updated_at=excluded.updated_at`)
      .bind(subscriptionId, user.uid, endpoint, p256dh, auth, clean(input.userAgent, 500) || null, now, now).run();
    await audit(db, user.uid, "notifications.push_enabled", "user", user.uid);
    return { ok: true };
  }

  if (action === "deletePushSubscription") {
    const endpoint = clean(input.endpoint, 2000);
    await db.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?").bind(user.uid, endpoint).run();
    await audit(db, user.uid, "notifications.push_disabled", "user", user.uid);
    return { ok: true };
  }

  if (action === "testPush") {
    await notify(db, { userId: user.uid, type: "test", title: "Pushmeldingen werken", body: "U ontvangt voortaan belangrijke teammeldingen op dit toestel.", dedupeKey: `test:${user.uid}:${now}` });
    return { ok: true };
  }

  if (action === "markNotificationRead") {
    const notificationId = clean(input.id, 160);
    await db.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(now, notificationId, user.uid).run();
    return { ok: true };
  }

  if (action === "markAllNotificationsRead") {
    await db.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(now, user.uid).run();
    return { ok: true };
  }

  if (action === "runNotificationSweep") {
    await runAttendanceSweep(db);
    return { ok: true };
  }

  if (action === "inviteEmployee") {
    requireAdmin(user);
    const targetEmail = email(input.email);
    const name = clean(input.name, 160);
    if (!targetEmail || !name) throw new Error("Naam en e-mailadres zijn verplicht.");
    const inviteRole = input.role === "admin" ? "admin" : "employee";
    const inviteId = id();
    await db.prepare(`INSERT INTO invites (id, email, name, phone, role, status, invited_by, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, role = excluded.role, status = 'pending', invited_by = excluded.invited_by, created_at = excluded.created_at, accepted_at = NULL`)
      .bind(inviteId, targetEmail, name, clean(input.phone, 80) || null, inviteRole, user.uid, now).run();
    await audit(db, user.uid, "employee.invited", "invite", targetEmail, { role: inviteRole });
    return { uid: `invite:${targetEmail}`, resetLink: "" };
  }

  if (action === "setEmployeeAccess") {
    requireAdmin(user);
    const uid = clean(input.uid, 160);
    const role = input.role === "admin" ? "admin" : "employee";
    const active = input.active === true ? 1 : 0;
    if (!uid || uid === user.uid && (!active || role !== "admin")) throw new Error("U kunt uw eigen hoofdbeheer niet uitschakelen.");
    const result = await db.prepare("UPDATE users SET role = ?, active = ? WHERE id = ?").bind(role, active, uid).run();
    if (!result.meta.changes) throw new Error("Medewerker niet gevonden.");
    await audit(db, user.uid, "employee.access_changed", "user", uid, { role, active: Boolean(active) });
    return { ok: true };
  }

  if (action === "saveCustomer") {
    requireAdmin(user);
    const customerId = clean(input.id, 160) || id();
    const name = clean(input.name, 200);
    const address = clean(input.address, 500);
    if (!name || !address) throw new Error("Naam en adres zijn verplicht.");
    const btwNumber = clean(input.btwNumber, 40) || null;
    const hasLatitude = input.latitude !== "" && input.latitude !== null && input.latitude !== undefined;
    const hasLongitude = input.longitude !== "" && input.longitude !== null && input.longitude !== undefined;
    if (hasLatitude !== hasLongitude) throw new Error("Vul zowel breedte- als lengtegraad in.");
    const latitude = hasLatitude ? Number(input.latitude) : null;
    const longitude = hasLongitude ? Number(input.longitude) : null;
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude! < -180 || longitude! > 180)) {
      throw new Error("De coördinaten zijn ongeldig.");
    }
    await db.prepare(`INSERT INTO customers (id, name, address, phone, email, btw_number, latitude, longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, address=excluded.address, phone=excluded.phone, email=excluded.email,
        btw_number=excluded.btw_number, latitude=excluded.latitude, longitude=excluded.longitude, updated_at=excluded.updated_at`)
      .bind(customerId, name, address, clean(input.phone, 80) || null, email(input.email) || null, btwNumber, latitude, longitude, now, now).run();
    await audit(db, user.uid, "customer.saved", "customer", customerId);
    return { id: customerId };
  }

  if (action === "savePlannedShift") {
    requireAdmin(user);
    const title = clean(input.title, 200);
    const customerId = clean(input.customerId, 160) || null;
    const date = clean(input.date, 10);
    const window = validateShiftWindow(clean(input.startTime, 5), clean(input.endTime, 5), Number(input.breakMinutes));
    const memberIds = [...new Set((Array.isArray(input.memberIds) ? input.memberIds : []).map(value => clean(value, 160)).filter(Boolean))];
    const repeatWeeks = Math.max(1, Math.min(12, Number(input.repeatWeeks) || 1));
    const checklist = (Array.isArray(input.checklist) ? input.checklist : []).map(item => clean(item, 240)).filter(Boolean).slice(0, 50);
    const siteAddress = clean(input.siteAddress, 500) || null;
    const hasSiteLat = input.siteLatitude !== "" && input.siteLatitude !== null && input.siteLatitude !== undefined;
    const hasSiteLng = input.siteLongitude !== "" && input.siteLongitude !== null && input.siteLongitude !== undefined;
    if (hasSiteLat !== hasSiteLng) throw new Error("Vul zowel breedte- als lengtegraad van het opdrachtadres in.");
    const siteLatitude = hasSiteLat ? Number(input.siteLatitude) : null;
    const siteLongitude = hasSiteLng ? Number(input.siteLongitude) : null;
    if (siteLatitude !== null && (!Number.isFinite(siteLatitude) || siteLatitude < -90 || siteLatitude > 90 || !Number.isFinite(siteLongitude) || siteLongitude! < -180 || siteLongitude! > 180)) {
      throw new Error("De coördinaten van het opdrachtadres zijn ongeldig.");
    }
    if (!title || !isValidDate(date) || memberIds.length === 0) throw new Error("Titel, datum en minstens één medewerker zijn verplicht.");
    const placeholders = memberIds.map(() => "?").join(",");
    const membersResult = await db.prepare(`SELECT id, name, active, availability_json FROM users WHERE id IN (${placeholders}) AND role IN ('employee','admin')`)
      .bind(...memberIds).all<Json>();
    const members = membersResult.results as Json[];
    if (members.length !== memberIds.length || members.some(member => Number(member.active) !== 1)) throw new Error("Een geselecteerde medewerker is niet actief.");
    const conflicts: string[] = [];
    for (let week = 0; week < repeatWeeks; week += 1) {
      const occurrenceDate = addWeeks(date, week);
      for (const member of members) {
        if (availabilityConflict(parseAvailability(member.availability_json), occurrenceDate, window.startTime, window.endTime)) {
          conflicts.push(`${String(member.name)} is niet beschikbaar op ${occurrenceDate}`);
        }
        const existing = await db.prepare(`SELECT ps.start_time, ps.end_time FROM planned_shifts ps
          JOIN planned_shift_members psm ON psm.shift_id = ps.id
          WHERE psm.user_id = ? AND ps.date = ? AND ps.status IN ('draft','published')`)
          .bind(String(member.id), occurrenceDate).all<Json>();
        if ((existing.results as Json[]).some(shift => overlaps(window.startTime, window.endTime, String(shift.start_time), String(shift.end_time)))) {
          conflicts.push(`${String(member.name)} heeft al een overlappende dienst op ${occurrenceDate}`);
        }
      }
    }
    if (conflicts.length) throw new Error(`Planningsconflict: ${[...new Set(conflicts)].slice(0, 4).join("; ")}`);
    const recurrenceGroupId = repeatWeeks > 1 ? id() : null;
    const statements: D1PreparedStatement[] = [];
    const createdIds: string[] = [];
    for (let week = 0; week < repeatWeeks; week += 1) {
      const shiftId = id();
      createdIds.push(shiftId);
      statements.push(db.prepare(`INSERT INTO planned_shifts
        (id, title, customer_id, site_address, site_latitude, site_longitude, date, start_time, end_time, break_minutes, notes, status, recurrence_group_id, created_by, checklist_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`)
        .bind(shiftId, title, customerId, siteAddress, siteLatitude, siteLongitude, addWeeks(date, week), window.startTime, window.endTime, window.breakMinutes,
          clean(input.notes, 2000) || null, recurrenceGroupId, user.uid, JSON.stringify(checklist), now, now));
      for (const memberId of memberIds) {
        statements.push(db.prepare("INSERT INTO planned_shift_members (shift_id, user_id, confirmation_status) VALUES (?, ?, 'pending')")
          .bind(shiftId, memberId));
      }
    }
    await db.batch(statements);
    await audit(db, user.uid, "planning.shift_created", "planned_shift", createdIds[0], { createdIds, repeatWeeks, memberIds });
    return { ids: createdIds };
  }

  if (action === "publishPlannedShifts") {
    requireAdmin(user);
    const shiftIds = [...new Set((Array.isArray(input.shiftIds) ? input.shiftIds : []).map(value => clean(value, 160)).filter(Boolean))];
    if (!shiftIds.length || shiftIds.length > 100) throw new Error("Selecteer minstens één dienst om te publiceren.");
    const placeholders = shiftIds.map(() => "?").join(",");
    const result = await db.prepare(`UPDATE planned_shifts SET status='published', published_at=?, updated_at=? WHERE id IN (${placeholders}) AND status='draft'`)
      .bind(now, now, ...shiftIds).run();
    if (!result.meta.changes) throw new Error("Er zijn geen conceptdiensten om te publiceren.");
    await audit(db, user.uid, "planning.published", "planned_shift", shiftIds[0], { shiftIds, count: result.meta.changes });
    const members = await db.prepare(`SELECT ps.id, ps.title, ps.date, ps.start_time, psm.user_id FROM planned_shifts ps
      JOIN planned_shift_members psm ON psm.shift_id=ps.id WHERE ps.id IN (${placeholders})`).bind(...shiftIds).all<Json>();
    await Promise.all((members.results as Json[]).map(row => notify(db, {
      userId: String(row.user_id), type: "planning_published", title: "Nieuwe planning gepubliceerd",
      body: `${String(row.title)} op ${String(row.date)} om ${String(row.start_time)}.`,
      dedupeKey: `published:${String(row.id)}:${String(row.user_id)}:${now}`, entityType: "planned_shift", entityId: String(row.id),
    })));
    return { count: result.meta.changes };
  }

  if (action === "deletePlannedShift") {
    requireAdmin(user);
    const shiftId = clean(input.id, 160);
    const row = await db.prepare("SELECT status FROM planned_shifts WHERE id=?").bind(shiftId).first<Json>();
    if (!row) throw new Error("Dienst niet gevonden.");
    if (row.status !== "draft") throw new Error("Een gepubliceerde dienst kan niet verwijderd worden.");
    await db.batch([
      db.prepare("DELETE FROM planned_shift_members WHERE shift_id=?").bind(shiftId),
      db.prepare("DELETE FROM planned_shifts WHERE id=?").bind(shiftId),
    ]);
    await audit(db, user.uid, "planning.shift_deleted", "planned_shift", shiftId);
    return { ok: true };
  }

  if (action === "confirmPlannedShift") {
    const shiftId = clean(input.shiftId, 160);
    const confirmation = input.status === "declined" ? "declined" : input.status === "confirmed" ? "confirmed" : "";
    if (!confirmation) throw new Error("Ongeldige bevestiging.");
    const result = await db.prepare(`UPDATE planned_shift_members SET confirmation_status=?, confirmed_at=?
      WHERE shift_id=? AND user_id=? AND EXISTS (SELECT 1 FROM planned_shifts WHERE id=? AND status='published')`)
      .bind(confirmation, now, shiftId, user.uid, shiftId).run();
    if (!result.meta.changes) throw new Error("Deze dienst kan niet bevestigd worden.");
    await audit(db, user.uid, `planning.${confirmation}`, "planned_shift", shiftId);
    await notifyAdmins(db, { type: "planning_confirmation", title: confirmation === "confirmed" ? "Dienst bevestigd" : "Dienst geweigerd",
      body: `${user.name} heeft een geplande dienst ${confirmation === "confirmed" ? "bevestigd" : "geweigerd"}.`,
      dedupeKey: `confirmation:${shiftId}:${user.uid}:${confirmation}:${now}`, entityType: "planned_shift", entityId: shiftId });
    return { ok: true };
  }

  if (action === "saveAssignment") {
    requireAdmin(user);
    const assignmentId = clean(input.id, 160) || id();
    const userId = clean(input.userId, 160);
    const customerId = clean(input.customerId, 160);
    const date = clean(input.date, 10);
    if (!userId || !customerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Medewerker, klant en datum zijn verplicht.");
    const customer = await db.prepare("SELECT address, latitude, longitude FROM customers WHERE id=?").bind(customerId).first<Json>();
    if (!customer) throw new Error("Klant niet gevonden.");
    let siteAddress = clean(input.siteAddress, 500);
    if (!siteAddress) siteAddress = clean(customer.address, 500);
    const hasSiteLat = input.siteLatitude !== "" && input.siteLatitude !== null && input.siteLatitude !== undefined;
    const hasSiteLng = input.siteLongitude !== "" && input.siteLongitude !== null && input.siteLongitude !== undefined;
    if (hasSiteLat !== hasSiteLng) throw new Error("Vul zowel breedte- als lengtegraad van het opdrachtadres in.");
    let siteLatitude = hasSiteLat ? Number(input.siteLatitude) : (customer.latitude === null || customer.latitude === undefined ? null : Number(customer.latitude));
    let siteLongitude = hasSiteLng ? Number(input.siteLongitude) : (customer.longitude === null || customer.longitude === undefined ? null : Number(customer.longitude));
    if (!hasSiteLat && !hasSiteLng && siteAddress !== clean(customer.address, 500)) {
      siteLatitude = null;
      siteLongitude = null;
    }
    if (siteLatitude !== null && (!Number.isFinite(siteLatitude) || siteLatitude < -90 || siteLatitude > 90 || !Number.isFinite(siteLongitude!) || siteLongitude! < -180 || siteLongitude! > 180)) {
      throw new Error("De coördinaten van het opdrachtadres zijn ongeldig.");
    }
    const existing = await db.prepare("SELECT status, created_at FROM assignments WHERE id = ?").bind(assignmentId).first<Json>();
    if (existing && existing.status !== "pending") throw new Error("Een gestarte opdracht kan niet opnieuw ingepland worden.");
    await db.prepare(`INSERT INTO assignments (id, user_id, customer_id, description, date, start_time, site_address, site_latitude, site_longitude, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, customer_id=excluded.customer_id, description=excluded.description,
        date=excluded.date, start_time=excluded.start_time, site_address=excluded.site_address, site_latitude=excluded.site_latitude,
        site_longitude=excluded.site_longitude, updated_at=excluded.updated_at`)
      .bind(assignmentId, userId, customerId, clean(input.description), date, clean(input.startTime, 5) || null, siteAddress || null, siteLatitude, siteLongitude, Number(existing?.created_at || now), now).run();
    await audit(db, user.uid, "assignment.saved", "assignment", assignmentId, { userId, customerId, siteAddress });
    return { id: assignmentId };
  }

  if (action === "deleteAssignment") {
    requireAdmin(user);
    const assignmentId = clean(input.id, 160);
    const row = await db.prepare("SELECT status FROM assignments WHERE id = ?").bind(assignmentId).first<Json>();
    if (!row) throw new Error("Opdracht niet gevonden.");
    if (row.status !== "pending") throw new Error("Een gestarte opdracht kan niet verwijderd worden.");
    await db.prepare("DELETE FROM assignments WHERE id = ?").bind(assignmentId).run();
    await audit(db, user.uid, "assignment.deleted", "assignment", assignmentId);
    return { ok: true };
  }

  if (action === "clockIn") {
    const loc = location(input.location);
    const active = await db.prepare("SELECT shift_id FROM active_shifts WHERE user_id = ?").bind(user.uid).first();
    if (active) throw new Error("U bent al ingeklokt.");
    const plannedShiftId = clean(input.plannedShiftId, 160) || null;
    let target: { lat: number; lng: number } | undefined;
    if (plannedShiftId) {
      const planned = await db.prepare(`SELECT ps.id, ps.site_latitude, ps.site_longitude, c.latitude, c.longitude FROM planned_shifts ps
        JOIN planned_shift_members psm ON psm.shift_id=ps.id LEFT JOIN customers c ON c.id=ps.customer_id
        WHERE ps.id=? AND psm.user_id=? AND ps.status='published'`).bind(plannedShiftId, user.uid).first<Json>();
      if (!planned) throw new Error("Deze geplande dienst is niet beschikbaar voor uw account.");
      const lat = planned.site_latitude ?? planned.latitude;
      const lng = planned.site_longitude ?? planned.longitude;
      if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
        target = { lat: Number(lat), lng: Number(lng) };
      }
    }
    const geofence = validateGeofence(loc, target);
    const shiftId = id();
    await db.batch([
      db.prepare(`INSERT INTO shifts (id, user_id, planned_shift_id, clock_in, clock_in_lat, clock_in_lng, clock_in_accuracy,
        clock_in_distance, clock_in_client_at, geofence_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(shiftId, user.uid, plannedShiftId, now, loc.lat, loc.lng, loc.accuracy, geofence.distance, loc.capturedAt, geofence.status),
      db.prepare("INSERT INTO active_shifts (user_id, shift_id) VALUES (?, ?)").bind(user.uid, shiftId),
      db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'shift.clock_in', 'shift', ?, '{}', ?)`)
        .bind(id(), user.uid, shiftId, now),
    ]);
    return { shiftId, geofenceStatus: geofence.status, distance: geofence.distance };
  }

  if (action === "clockOut") {
    const loc = location(input.location);
    const active = await db.prepare(`SELECT a.shift_id, s.planned_shift_id, ps.site_latitude, ps.site_longitude, c.latitude, c.longitude FROM active_shifts a
      JOIN shifts s ON s.id=a.shift_id LEFT JOIN planned_shifts ps ON ps.id=s.planned_shift_id LEFT JOIN customers c ON c.id=ps.customer_id
      WHERE a.user_id=?`).bind(user.uid).first<Json>();
    if (!active) throw new Error("Er is geen actieve shift.");
    const openBreak = await db.prepare("SELECT break_id FROM active_breaks WHERE user_id=?").bind(user.uid).first();
    if (openBreak) throw new Error("Beëindig eerst uw actieve pauze.");
    const geoLat = active.site_latitude ?? active.latitude;
    const geoLng = active.site_longitude ?? active.longitude;
    const target = geoLat !== null && geoLat !== undefined && geoLng !== null && geoLng !== undefined
      ? { lat: Number(geoLat), lng: Number(geoLng) } : undefined;
    const geofence = validateGeofence(loc, target);
    await db.batch([
      db.prepare(`UPDATE shifts SET clock_out=?, clock_out_lat=?, clock_out_lng=?, clock_out_accuracy=?, clock_out_distance=?,
        clock_out_client_at=?, notes=?, status_tag=? WHERE id=? AND clock_out IS NULL`)
        .bind(now, loc.lat, loc.lng, loc.accuracy, geofence.distance, loc.capturedAt, clean(input.notes), clean(input.statusTag, 80), active.shift_id),
      db.prepare("DELETE FROM active_shifts WHERE user_id = ? AND shift_id = ?").bind(user.uid, active.shift_id),
      db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'shift.clock_out', 'shift', ?, ?, ?)`)
        .bind(id(), user.uid, active.shift_id, JSON.stringify({ statusTag: clean(input.statusTag, 80) }), now),
    ]);
    return { ok: true };
  }

  if (action === "startBreak") {
    const active = await db.prepare("SELECT shift_id FROM active_shifts WHERE user_id=?").bind(user.uid).first<{ shift_id: string }>();
    if (!active) throw new Error("U moet ingeklokt zijn om een pauze te starten.");
    if (await db.prepare("SELECT break_id FROM active_breaks WHERE user_id=?").bind(user.uid).first()) throw new Error("Er loopt al een pauze.");
    const breakId = id();
    await db.batch([
      db.prepare("INSERT INTO shift_breaks (id, shift_id, user_id, started_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(breakId, active.shift_id, user.uid, now, now),
      db.prepare("INSERT INTO active_breaks (user_id, break_id, shift_id) VALUES (?, ?, ?)").bind(user.uid, breakId, active.shift_id),
    ]);
    await audit(db, user.uid, "shift.break_started", "shift", active.shift_id, { breakId });
    return { breakId };
  }

  if (action === "endBreak") {
    const active = await db.prepare("SELECT break_id, shift_id FROM active_breaks WHERE user_id=?").bind(user.uid).first<{ break_id: string; shift_id: string }>();
    if (!active) throw new Error("Er loopt geen actieve pauze.");
    await db.batch([
      db.prepare("UPDATE shift_breaks SET ended_at=? WHERE id=? AND ended_at IS NULL").bind(now, active.break_id),
      db.prepare("DELETE FROM active_breaks WHERE user_id=?").bind(user.uid),
    ]);
    await audit(db, user.uid, "shift.break_ended", "shift", active.shift_id, { breakId: active.break_id });
    return { ok: true };
  }

  if (action === "updatePlannedShiftChecklist") {
    const plannedShiftId = clean(input.plannedShiftId, 160);
    const shift = await db.prepare(`SELECT ps.checklist_json FROM planned_shifts ps JOIN planned_shift_members psm ON psm.shift_id=ps.id
      WHERE ps.id=? AND psm.user_id=? AND ps.status='published'`).bind(plannedShiftId, user.uid).first<Json>();
    if (!shift) throw new Error("Dienst niet gevonden.");
    const allowed = new Set((JSON.parse(String(shift.checklist_json || "[]")) as string[]).map((_, index) => String(index)));
    const completed = [...new Set((Array.isArray(input.completed) ? input.completed : []).map(value => clean(value, 20)).filter(value => allowed.has(value)))];
    await db.prepare("UPDATE planned_shift_members SET checklist_state_json=? WHERE shift_id=? AND user_id=?")
      .bind(JSON.stringify(completed), plannedShiftId, user.uid).run();
    await audit(db, user.uid, "planning.checklist_updated", "planned_shift", plannedShiftId, { completed });
    return { ok: true };
  }

  if (action === "createIncident") {
    const incidentId = id();
    const category = clean(input.category, 80);
    const severity = input.severity === "high" ? "high" : input.severity === "medium" ? "medium" : "low";
    const description = clean(input.description, 4000);
    const plannedShiftId = clean(input.plannedShiftId, 160) || null;
    if (!category || !description) throw new Error("Categorie en beschrijving zijn verplicht.");
    if (plannedShiftId && user.role !== "admin") {
      const assigned = await db.prepare("SELECT 1 FROM planned_shift_members WHERE shift_id=? AND user_id=?")
        .bind(plannedShiftId, user.uid).first();
      if (!assigned) throw new Error("Deze geplande dienst is niet beschikbaar voor uw account.");
    }
    let loc: ReturnType<typeof location> | null = null;
    if (input.location) loc = location(input.location);
    const occurredAt = Number(input.occurredAt);
    const safeOccurredAt = Number.isFinite(occurredAt) && Math.abs(now - occurredAt) <= 24 * 60 * 60 * 1000 ? occurredAt : now;
    await db.prepare(`INSERT INTO incidents (id, user_id, planned_shift_id, category, severity, description, status,
      latitude, longitude, accuracy, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`)
      .bind(incidentId, user.uid, plannedShiftId, category, severity, description, loc?.lat || null, loc?.lng || null, loc?.accuracy || null, safeOccurredAt, now).run();
    await audit(db, user.uid, "incident.created", "incident", incidentId, { severity, category });
    await notifyAdmins(db, { type: "incident", title: severity === "high" ? "Dringend incident" : "Nieuw incident",
      body: `${user.name}: ${category} — ${description.slice(0, 180)}`, dedupeKey: `incident:${incidentId}`,
      entityType: "incident", entityId: incidentId });
    return { id: incidentId };
  }

  if (action === "createCorrectionRequest") {
    const shiftId = clean(input.shiftId, 160);
    const reason = clean(input.reason, 2000);
    const shift = await db.prepare("SELECT id FROM shifts WHERE id=? AND user_id=?").bind(shiftId, user.uid).first();
    if (!shift || !reason) throw new Error("Kies een eigen tijdregistratie en geef een reden op.");
    const requestedClockIn = input.requestedClockIn ? Number(input.requestedClockIn) : null;
    const requestedClockOut = input.requestedClockOut ? Number(input.requestedClockOut) : null;
    if ((!requestedClockIn && !requestedClockOut) || requestedClockIn && !Number.isFinite(requestedClockIn) || requestedClockOut && !Number.isFinite(requestedClockOut)) throw new Error("Vul minstens één geldige correctietijd in.");
    const requestId = id();
    await db.prepare(`INSERT INTO correction_requests (id, user_id, shift_id, requested_clock_in, requested_clock_out, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`)
      .bind(requestId, user.uid, shiftId, requestedClockIn, requestedClockOut, reason, now).run();
    await audit(db, user.uid, "correction.requested", "shift", shiftId, { requestId });
    await notifyAdmins(db, { type: "correction", title: "Nieuw correctieverzoek", body: `${user.name} vraagt een aanpassing van geregistreerde uren.`,
      dedupeKey: `correction:${requestId}`, entityType: "correction_request", entityId: requestId });
    return { id: requestId };
  }

  if (action === "reviewCorrectionRequest") {
    requireAdmin(user);
    const requestId = clean(input.id, 160);
    const decision = input.status === "approved" ? "approved" : input.status === "rejected" ? "rejected" : "";
    const requestRow = await db.prepare("SELECT * FROM correction_requests WHERE id=? AND status='pending'").bind(requestId).first<Json>();
    if (!requestRow || !decision) throw new Error("Correctieverzoek niet gevonden of al behandeld.");
    if (decision === "approved") {
      const shift = await db.prepare("SELECT clock_in, clock_out FROM shifts WHERE id=?").bind(String(requestRow.shift_id)).first<Json>();
      const nextIn = requestRow.requested_clock_in ? Number(requestRow.requested_clock_in) : Number(shift?.clock_in);
      const nextOut = requestRow.requested_clock_out ? Number(requestRow.requested_clock_out) : shift?.clock_out ? Number(shift.clock_out) : null;
      if (nextOut !== null && nextOut <= nextIn) throw new Error("De gecorrigeerde eindtijd moet na de starttijd liggen.");
      await db.prepare("UPDATE shifts SET clock_in=?, clock_out=? WHERE id=?").bind(nextIn, nextOut, String(requestRow.shift_id)).run();
    }
    await db.prepare("UPDATE correction_requests SET status=?, reviewed_by=?, reviewed_at=? WHERE id=?")
      .bind(decision, user.uid, now, requestId).run();
    await audit(db, user.uid, `correction.${decision}`, "correction_request", requestId);
    await notify(db, { userId: String(requestRow.user_id), type: "correction_reviewed",
      title: decision === "approved" ? "Correctie goedgekeurd" : "Correctie afgewezen",
      body: decision === "approved" ? "Uw tijdcorrectie is verwerkt." : "Uw tijdcorrectie werd afgewezen.",
      dedupeKey: `correction-reviewed:${requestId}:${decision}`, entityType: "correction_request", entityId: requestId });
    return { ok: true };
  }

  if (action === "reviewTimesheet") {
    requireAdmin(user);
    const shiftId = clean(input.shiftId, 160);
    const decision = input.status === "approved" ? "approved" : input.status === "rejected" ? "rejected" : "";
    const shift = await db.prepare("SELECT user_id, clock_out FROM shifts WHERE id=?").bind(shiftId).first<Json>();
    if (!shift || !shift.clock_out || !decision) throw new Error("Alleen afgesloten tijdregistraties kunnen worden beoordeeld.");
    await db.prepare(`INSERT INTO timesheet_approvals (shift_id, status, reviewed_by, reviewed_at, admin_note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(shift_id) DO UPDATE SET status=excluded.status, reviewed_by=excluded.reviewed_by,
      reviewed_at=excluded.reviewed_at, admin_note=excluded.admin_note, updated_at=excluded.updated_at`)
      .bind(shiftId, decision, user.uid, now, clean(input.note, 1000) || null, now).run();
    await audit(db, user.uid, `timesheet.${decision}`, "shift", shiftId);
    await notify(db, { userId: String(shift.user_id), type: "timesheet_reviewed",
      title: decision === "approved" ? "Uren goedgekeurd" : "Uren afgewezen",
      body: decision === "approved" ? "Uw geregistreerde uren zijn goedgekeurd." : `Uw uren zijn afgewezen.${clean(input.note, 1000) ? ` Reden: ${clean(input.note, 1000)}` : ""}`,
      dedupeKey: `timesheet:${shiftId}:${decision}:${now}`, entityType: "shift", entityId: shiftId });
    return { ok: true };
  }

  if (action === "exportHours") {
    requireAdmin(user);
    const startDate = clean(input.startDate, 10);
    const endDate = clean(input.endDate, 10);
    const kind = input.kind === "invoice" ? "invoice" : "payroll";
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) throw new Error("Kies een geldige exportperiode.");
    const rows = await db.prepare(`SELECT s.id, s.clock_in, s.clock_out, u.name AS user_name, u.email,
        ps.title, ps.date, ps.break_minutes, c.name AS customer_name,
        COALESCE((SELECT SUM(CASE WHEN sb.ended_at IS NOT NULL THEN sb.ended_at-sb.started_at ELSE 0 END) FROM shift_breaks sb WHERE sb.shift_id=s.id), 0) AS actual_break_ms
      FROM shifts s JOIN users u ON u.id=s.user_id
      JOIN timesheet_approvals ta ON ta.shift_id=s.id AND ta.status='approved'
      LEFT JOIN planned_shifts ps ON ps.id=s.planned_shift_id LEFT JOIN customers c ON c.id=ps.customer_id
      WHERE date(s.clock_in/1000, 'unixepoch') BETWEEN ? AND ? AND s.clock_out IS NOT NULL ORDER BY s.clock_in`)
      .bind(startDate, endDate).all<Json>();
    const header = kind === "payroll"
      ? ["Medewerker", "E-mail", "Datum", "Start", "Einde", "Geplande pauze minuten", "Geregistreerde pauze minuten", "Gewerkte minuten", "Gewerkte uren", "Dienst"]
      : ["Klant", "Datum", "Medewerker", "Start", "Einde", "Geplande pauze minuten", "Geregistreerde pauze minuten", "Factureerbare minuten", "Factureerbare uren", "Dienst"];
    const exportRows = (rows.results as Json[]).map(row => {
      const recordedBreakMinutes = Math.round(Number(row.actual_break_ms || 0) / 60000);
      const minutes = workedMinutes(Number(row.clock_in), Number(row.clock_out), recordedBreakMinutes);
      const common = [String(row.date || new Date(Number(row.clock_in)).toISOString().slice(0, 10)), new Date(Number(row.clock_in)).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }), new Date(Number(row.clock_out)).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }), Number(row.break_minutes || 0), recordedBreakMinutes, minutes, (minutes / 60).toFixed(2), String(row.title || "Niet gekoppeld")];
      return kind === "payroll" ? [row.user_name, row.email, ...common] : [row.customer_name || "Geen klant", common[0], row.user_name, ...common.slice(1)];
    });
    await audit(db, user.uid, `export.${kind}`, "export", `${startDate}:${endDate}`, { rows: exportRows.length });
    return { filename: `${kind === "payroll" ? "loonexport" : "facturatie-export"}-${startDate}-${endDate}.csv`, csv: csv([header, ...exportRows]), rows: exportRows.length };
  }

  if (action === "acknowledgeAssignment") {
    const assignmentId = clean(input.assignmentId, 160);
    const result = await db.prepare("UPDATE assignments SET acknowledged=1, updated_at=? WHERE id=? AND user_id=? AND status='pending'")
      .bind(now, assignmentId, user.uid).run();
    if (!result.meta.changes) throw new Error("Opdracht niet gevonden of niet meer in behandeling.");
    await audit(db, user.uid, "assignment.acknowledged", "assignment", assignmentId);
    return { ok: true };
  }

  if (action === "transitionAssignment") {
    const assignmentId = clean(input.assignmentId, 160);
    const nextStatus = input.status === "arrived" ? "arrived" : input.status === "completed" ? "completed" : "";
    const loc = location(input.location);
    const row = await db.prepare("SELECT status FROM assignments WHERE id=? AND user_id=?").bind(assignmentId, user.uid).first<Json>();
    const allowed = isAllowedTransition(row?.status, nextStatus);
    if (!allowed) throw new Error("Deze statusovergang is niet toegestaan.");
    if (nextStatus === "arrived") {
      await db.prepare("UPDATE assignments SET status='arrived', arrival_time=?, arrival_lat=?, arrival_lng=?, updated_at=? WHERE id=?")
        .bind(now, loc.lat, loc.lng, now, assignmentId).run();
    } else {
      await db.prepare("UPDATE assignments SET status='completed', departure_time=?, departure_lat=?, departure_lng=?, work_notes=?, materials=?, completion_notes=?, updated_at=? WHERE id=?")
        .bind(now, loc.lat, loc.lng, clean(input.notes ?? input.workNotes, 4000), clean(input.materials, 4000) || null, clean(input.completionNotes, 4000) || null, now, assignmentId).run();
    }
    await audit(db, user.uid, `assignment.${nextStatus}`, "assignment", assignmentId);
    return { ok: true };
  }

  if (action === "updateProfile") {
    const firstName = clean(input.firstName, 80);
    const lastName = clean(input.lastName, 80);
    if (!firstName || !lastName) throw new Error("Voornaam en achternaam zijn verplicht.");
    const phone = clean(input.phone, 80);
    const address = clean(input.address, 500);
    if (!phone) throw new Error("Telefoonnummer is verplicht.");
    if (!address) throw new Error("Adres is verplicht.");
    const name = clean(input.name, 160) || `${firstName} ${lastName}`.trim();
    await db.prepare("UPDATE users SET name=?, first_name=?, last_name=?, phone=?, address=? WHERE id=?")
      .bind(name, firstName, lastName, phone, address, user.uid).run();
    await audit(db, user.uid, "profile.updated", "user", user.uid);
    return { ok: true };
  }

  if (action === "updateAssignmentDetails") {
    const assignmentId = clean(input.assignmentId, 160);
    const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 100) : [];
    const result = await db.prepare("UPDATE assignments SET tasks_json=?, work_notes=?, materials=?, completion_notes=?, updated_at=? WHERE id=? AND user_id=? AND status!='completed'")
      .bind(JSON.stringify(tasks), clean(input.workNotes, 4000), clean(input.materials, 4000) || null, clean(input.completionNotes, 4000) || null, now, assignmentId, user.uid).run();
    if (!result.meta.changes) throw new Error("Opdracht kan niet meer worden aangepast.");
    await audit(db, user.uid, "assignment.details_updated", "assignment", assignmentId);
    return { ok: true };
  }

  throw new Error("Onbekende actie.");
}

async function uploadAttachment(user: AppUser, request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const entityType = clean(form.get("entityType"), 40);
  const entityId = clean(form.get("entityId"), 160);
  if (!(file instanceof File) || !entityId || !["planned_shift", "incident", "assignment"].includes(entityType)) throw new Error("Ongeldig bestand of doel.");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Een bestand mag maximaal 10 MB groot zijn.");
  const allowedTypes = new Set(["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  if (!file.type.startsWith("image/") && !allowedTypes.has(file.type)) throw new Error("Dit bestandstype is niet toegestaan.");
  const db = database();
  if (entityType === "planned_shift") {
    const allowed = user.role === "admin" || Boolean(await db.prepare("SELECT 1 FROM planned_shift_members WHERE shift_id=? AND user_id=?").bind(entityId, user.uid).first());
    if (!allowed) throw new Error("U mag geen bestanden aan deze dienst toevoegen.");
  } else if (entityType === "assignment") {
    const assignment = await db.prepare("SELECT user_id, status FROM assignments WHERE id=?").bind(entityId).first<Json>();
    if (!assignment) throw new Error("Opdracht niet gevonden.");
    if (user.role !== "admin" && assignment.user_id !== user.uid) throw new Error("U mag geen bestanden aan deze opdracht toevoegen.");
    if (assignment.status === "completed" && user.role !== "admin") throw new Error("Deze opdracht is al afgerond.");
  } else {
    const incident = await db.prepare("SELECT user_id FROM incidents WHERE id=?").bind(entityId).first<Json>();
    if (!incident || user.role !== "admin" && incident.user_id !== user.uid) throw new Error("Incident niet gevonden.");
  }
  const attachmentId = id();
  const safeName = clean(file.name, 180).replace(/[^a-zA-Z0-9._ -]/g, "_") || "bestand";
  const objectKey = `${entityType}/${entityId}/${attachmentId}-${safeName}`;
  let dataUrl: string | null = null;
  if (env.BUCKET) {
    await env.BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  } else {
    if (file.size > 1.5 * 1024 * 1024) throw new Error("Zonder cloudopslag mag een foto maximaal 1,5 MB zijn. Probeer opnieuw met een kleinere foto.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    dataUrl = `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
  }
  const now = Date.now();
  await db.prepare(`INSERT INTO attachments (id, user_id, entity_type, entity_id, object_key, filename, mime_type, size, data_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(attachmentId, user.uid, entityType, entityId, objectKey, safeName, file.type || "application/octet-stream", file.size, dataUrl, now).run();
  await audit(db, user.uid, "attachment.uploaded", entityType, entityId, { attachmentId, filename: safeName, size: file.size, storage: dataUrl ? "inline" : "r2" });
  return { id: attachmentId, filename: safeName, mimeType: file.type, size: file.size, storage: dataUrl ? "inline" : "r2", createdAt: now };
}

async function downloadAttachment(user: AppUser, attachmentId: string) {
  const db = database();
  const row = await db.prepare("SELECT * FROM attachments WHERE id=?").bind(attachmentId).first<Json>();
  if (!row) throw new Error("Bestand niet gevonden.");
  const ownsFile = row.user_id === user.uid;
  const isShiftMember = row.entity_type === "planned_shift" && Boolean(await db.prepare(
    "SELECT 1 FROM planned_shift_members WHERE shift_id=? AND user_id=?"
  ).bind(String(row.entity_id), user.uid).first());
  const isAssignmentOwner = row.entity_type === "assignment" && Boolean(await db.prepare(
    "SELECT 1 FROM assignments WHERE id=? AND user_id=?"
  ).bind(String(row.entity_id), user.uid).first());
  if (user.role !== "admin" && !ownsFile && !isShiftMember && !isAssignmentOwner) throw new Error("Bestand niet gevonden.");
  const headers = {
    "Content-Type": String(row.mime_type),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(row.filename))}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (typeof row.data_url === "string" && row.data_url.startsWith("data:")) {
    const base64 = String(row.data_url).split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, { headers });
  }
  if (!env.BUCKET) throw new Error("Bestandsopslag is tijdelijk niet beschikbaar.");
  const object = await env.BUCKET.get(String(row.object_key));
  if (!object) throw new Error("Bestand niet gevonden.");
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  let actorId: string | null = null;
  let actionName = "request";
  try {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Ongeldige aanvraag." }, 403);
    const identity = await verifyFirebaseToken(request);
    const user = await session(identity);
    actorId = user.uid;
    await recordAccess(database(), user, request);
    if ((request.headers.get("Content-Type") || "").includes("multipart/form-data")) {
      return json({ data: await uploadAttachment(user, request) });
    }
    const payload = await request.json() as { action?: unknown; input?: unknown };
    const action = clean(payload.action, 80);
    actionName = action || "unknown";
    const input = payload.input && typeof payload.input === "object" ? payload.input as Json : {};
    if (action === "downloadAttachment") return downloadAttachment(user, clean(input.id, 160));
    return json({ data: await act(user, action, input) });
  } catch (error) {
    const message = safeErrorMessage(error);
    if (actorId) {
      try {
        await database().prepare("INSERT INTO error_events (id, actor_id, action, message, severity, created_at) VALUES (?, ?, ?, ?, 'error', ?)")
          .bind(id(), actorId, actionName, message, Date.now()).run();
      } catch { /* Error logging must never hide the original response. */ }
    }
    const status = /niet aangemeld|aanmelding|uitgenodigd|niet actief|Alleen/.test(message) ? 403 : 400;
    return json({ error: message }, status);
  }
}
