import { env } from "cloudflare:workers";
import { cleanText as clean, isAllowedTransition, normalizeEmail as email, validateGeofence, validateLocation as location } from "../../../server/policy";
import { addWeeks, availabilityConflict, isValidDate, isValidTime, overlaps, parseAvailability, validateShiftWindow } from "../../../server/planning";

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
  const response = await fetch(FIREBASE_JWKS, { cf: { cacheTtl: 3600, cacheEverything: true } });
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

function mapUser(row: Json) {
  return {
    id: row.id, email: row.email, name: row.name, phone: row.phone || "", role: row.role,
    active: Number(row.active) === 1, availability: row.availability || "",
    availabilitySchedule: parseAvailability(row.availability_json), createdAt: Number(row.created_at),
  };
}

function mapShift(row: Json) {
  return {
    id: row.id, userId: row.user_id, plannedShiftId: row.planned_shift_id || undefined, clockIn: Number(row.clock_in),
    clockInLoc: { lat: Number(row.clock_in_lat), lng: Number(row.clock_in_lng), accuracy: Number(row.clock_in_accuracy || 0), capturedAt: Number(row.clock_in_client_at || row.clock_in) },
    clockInDistance: row.clock_in_distance === null || row.clock_in_distance === undefined ? undefined : Number(row.clock_in_distance),
    ...(row.clock_out ? { clockOut: Number(row.clock_out), clockOutLoc: { lat: Number(row.clock_out_lat), lng: Number(row.clock_out_lng), accuracy: Number(row.clock_out_accuracy || 0), capturedAt: Number(row.clock_out_client_at || row.clock_out) }, clockOutDistance: row.clock_out_distance === null || row.clock_out_distance === undefined ? undefined : Number(row.clock_out_distance) } : {}),
    geofenceStatus: row.geofence_status || undefined, statusTag: row.status_tag || undefined, notes: row.notes || undefined,
  };
}

function mapAssignment(row: Json) {
  return {
    id: row.id, userId: row.user_id, customerId: row.customer_id, customerName: row.customer_name || "",
    description: row.description, date: row.date, startTime: row.start_time || "", status: row.status,
    arrivalTime: row.arrival_time ? Number(row.arrival_time) : undefined,
    departureTime: row.departure_time ? Number(row.departure_time) : undefined,
    workNotes: row.work_notes || "", tasks: JSON.parse(String(row.tasks_json || "[]")),
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
      customerLongitude: row.customer_longitude ?? undefined, date: row.date, startTime: row.start_time,
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
  const usersQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM users ORDER BY name")
    : db.prepare("SELECT * FROM users WHERE id = ?").bind(user.uid);
  const shiftsQuery = user.role === "admin"
    ? db.prepare("SELECT * FROM shifts ORDER BY clock_in DESC LIMIT 1000")
    : db.prepare("SELECT * FROM shifts WHERE user_id = ? ORDER BY clock_in DESC LIMIT 500").bind(user.uid);
  const assignmentsQuery = user.role === "admin"
    ? db.prepare(`SELECT a.*, c.name AS customer_name FROM assignments a LEFT JOIN customers c ON c.id = a.customer_id ORDER BY a.date DESC, a.start_time DESC LIMIT 1000`)
    : db.prepare(`SELECT a.*, c.name AS customer_name FROM assignments a LEFT JOIN customers c ON c.id = a.customer_id WHERE a.user_id = ? ORDER BY a.date DESC, a.start_time DESC LIMIT 500`).bind(user.uid);
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
  const [usersResult, shiftsResult, assignmentsResult, customersResult, plannedResult, breaksResult, incidentsResult, correctionsResult, attachmentsResult] = await Promise.all([
    usersQuery.all<Json>(), shiftsQuery.all<Json>(), assignmentsQuery.all<Json>(),
    db.prepare("SELECT * FROM customers ORDER BY name").all<Json>(),
    plannedQuery.all<Json>(), breaksQuery.all<Json>(), incidentsQuery.all<Json>(), correctionsQuery.all<Json>(), attachmentsQuery.all<Json>(),
  ]);
  return {
    user: mapUser((usersResult.results as Json[]).find(item => item.id === user.uid) || {}),
    users: (usersResult.results as Json[]).map(mapUser),
    shifts: (shiftsResult.results as Json[]).map(mapShift),
    assignments: (assignmentsResult.results as Json[]).map(mapAssignment),
    customers: (customersResult.results as Json[]).map(row => ({
      id: row.id, name: row.name, address: row.address, phone: row.phone || "", email: row.email || "",
      latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined, createdAt: Number(row.created_at),
    })),
    plannedShifts: mapPlannedShifts(plannedResult.results as Json[]),
    breaks: (breaksResult.results as Json[]).map(row => ({ id: row.id, shiftId: row.shift_id, userId: row.user_id, startedAt: Number(row.started_at), endedAt: row.ended_at ? Number(row.ended_at) : undefined })),
    incidents: (incidentsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, plannedShiftId: row.planned_shift_id || undefined, category: row.category, severity: row.severity, description: row.description, status: row.status, latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined, accuracy: row.accuracy ?? undefined, occurredAt: Number(row.occurred_at), createdAt: Number(row.created_at) })),
    correctionRequests: (correctionsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, shiftId: row.shift_id, requestedClockIn: row.requested_clock_in ? Number(row.requested_clock_in) : undefined, requestedClockOut: row.requested_clock_out ? Number(row.requested_clock_out) : undefined, reason: row.reason, status: row.status, reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : undefined, createdAt: Number(row.created_at) })),
    attachments: (attachmentsResult.results as Json[]).map(row => ({ id: row.id, userId: row.user_id, entityType: row.entity_type, entityId: row.entity_id, filename: row.filename, mimeType: row.mime_type, size: Number(row.size), createdAt: Number(row.created_at) })),
  };
}

async function act(user: AppUser, action: string, input: Json) {
  const db = database();
  const now = Date.now();
  if (action === "snapshot") return snapshot(user);

  if (action === "inviteEmployee") {
    requireAdmin(user);
    const targetEmail = email(input.email);
    const name = clean(input.name, 160);
    if (!targetEmail || !name) throw new Error("Naam en e-mailadres zijn verplicht.");
    const inviteId = id();
    await db.prepare(`INSERT INTO invites (id, email, name, phone, role, status, invited_by, created_at)
      VALUES (?, ?, ?, ?, 'employee', 'pending', ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, status = 'pending', invited_by = excluded.invited_by, created_at = excluded.created_at, accepted_at = NULL`)
      .bind(inviteId, targetEmail, name, clean(input.phone, 80) || null, user.uid, now).run();
    await audit(db, user.uid, "employee.invited", "invite", targetEmail);
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
    const hasLatitude = input.latitude !== "" && input.latitude !== null && input.latitude !== undefined;
    const hasLongitude = input.longitude !== "" && input.longitude !== null && input.longitude !== undefined;
    if (hasLatitude !== hasLongitude) throw new Error("Vul zowel breedte- als lengtegraad in.");
    const latitude = hasLatitude ? Number(input.latitude) : null;
    const longitude = hasLongitude ? Number(input.longitude) : null;
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude! < -180 || longitude! > 180)) {
      throw new Error("De coördinaten zijn ongeldig.");
    }
    await db.prepare(`INSERT INTO customers (id, name, address, phone, email, latitude, longitude, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, address=excluded.address, phone=excluded.phone, email=excluded.email,
        latitude=excluded.latitude, longitude=excluded.longitude, updated_at=excluded.updated_at`)
      .bind(customerId, name, address, clean(input.phone, 80) || null, email(input.email) || null, latitude, longitude, now, now).run();
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
        (id, title, customer_id, date, start_time, end_time, break_minutes, notes, status, recurrence_group_id, created_by, checklist_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`)
        .bind(shiftId, title, customerId, addWeeks(date, week), window.startTime, window.endTime, window.breakMinutes,
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
    return { ok: true };
  }

  if (action === "saveAssignment") {
    requireAdmin(user);
    const assignmentId = clean(input.id, 160) || id();
    const userId = clean(input.userId, 160);
    const customerId = clean(input.customerId, 160);
    const date = clean(input.date, 10);
    if (!userId || !customerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Medewerker, klant en datum zijn verplicht.");
    const existing = await db.prepare("SELECT status, created_at FROM assignments WHERE id = ?").bind(assignmentId).first<Json>();
    if (existing && existing.status !== "pending") throw new Error("Een gestarte opdracht kan niet opnieuw ingepland worden.");
    await db.prepare(`INSERT INTO assignments (id, user_id, customer_id, description, date, start_time, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, customer_id=excluded.customer_id, description=excluded.description,
        date=excluded.date, start_time=excluded.start_time, updated_at=excluded.updated_at`)
      .bind(assignmentId, userId, customerId, clean(input.description), date, clean(input.startTime, 5) || null, Number(existing?.created_at || now), now).run();
    await audit(db, user.uid, "assignment.saved", "assignment", assignmentId, { userId, customerId });
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
      const planned = await db.prepare(`SELECT ps.id, c.latitude, c.longitude FROM planned_shifts ps
        JOIN planned_shift_members psm ON psm.shift_id=ps.id LEFT JOIN customers c ON c.id=ps.customer_id
        WHERE ps.id=? AND psm.user_id=? AND ps.status='published'`).bind(plannedShiftId, user.uid).first<Json>();
      if (!planned) throw new Error("Deze geplande dienst is niet beschikbaar voor uw account.");
      if (planned.latitude !== null && planned.latitude !== undefined && planned.longitude !== null && planned.longitude !== undefined) {
        target = { lat: Number(planned.latitude), lng: Number(planned.longitude) };
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
    const active = await db.prepare(`SELECT a.shift_id, s.planned_shift_id, c.latitude, c.longitude FROM active_shifts a
      JOIN shifts s ON s.id=a.shift_id LEFT JOIN planned_shifts ps ON ps.id=s.planned_shift_id LEFT JOIN customers c ON c.id=ps.customer_id
      WHERE a.user_id=?`).bind(user.uid).first<Json>();
    if (!active) throw new Error("Er is geen actieve shift.");
    const openBreak = await db.prepare("SELECT break_id FROM active_breaks WHERE user_id=?").bind(user.uid).first();
    if (openBreak) throw new Error("Beëindig eerst uw actieve pauze.");
    const target = active.latitude !== null && active.latitude !== undefined && active.longitude !== null && active.longitude !== undefined
      ? { lat: Number(active.latitude), lng: Number(active.longitude) } : undefined;
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
    return { ok: true };
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
      await db.prepare("UPDATE assignments SET status='completed', departure_time=?, departure_lat=?, departure_lng=?, work_notes=?, updated_at=? WHERE id=?")
        .bind(now, loc.lat, loc.lng, clean(input.notes), now, assignmentId).run();
    }
    await audit(db, user.uid, `assignment.${nextStatus}`, "assignment", assignmentId);
    return { ok: true };
  }

  if (action === "updateProfile") {
    const availabilitySchedule = cleanAvailability(input.availabilitySchedule);
    await db.prepare("UPDATE users SET name=?, phone=?, availability=?, availability_json=? WHERE id=?")
      .bind(clean(input.name, 160), clean(input.phone, 80), clean(input.availability, 1000), JSON.stringify(availabilitySchedule), user.uid).run();
    await audit(db, user.uid, "profile.updated", "user", user.uid);
    return { ok: true };
  }

  if (action === "updateAssignmentDetails") {
    const assignmentId = clean(input.assignmentId, 160);
    const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 100) : [];
    const result = await db.prepare("UPDATE assignments SET tasks_json=?, work_notes=?, updated_at=? WHERE id=? AND user_id=? AND status!='completed'")
      .bind(JSON.stringify(tasks), clean(input.workNotes), now, assignmentId, user.uid).run();
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
  if (!(file instanceof File) || !entityId || !["planned_shift", "incident"].includes(entityType)) throw new Error("Ongeldig bestand of doel.");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Een bestand mag maximaal 10 MB groot zijn.");
  const allowedTypes = new Set(["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  if (!file.type.startsWith("image/") && !allowedTypes.has(file.type)) throw new Error("Dit bestandstype is niet toegestaan.");
  const db = database();
  if (entityType === "planned_shift") {
    const allowed = user.role === "admin" || Boolean(await db.prepare("SELECT 1 FROM planned_shift_members WHERE shift_id=? AND user_id=?").bind(entityId, user.uid).first());
    if (!allowed) throw new Error("U mag geen bestanden aan deze dienst toevoegen.");
  } else {
    const incident = await db.prepare("SELECT user_id FROM incidents WHERE id=?").bind(entityId).first<Json>();
    if (!incident || user.role !== "admin" && incident.user_id !== user.uid) throw new Error("Incident niet gevonden.");
  }
  const attachmentId = id();
  const safeName = clean(file.name, 180).replace(/[^a-zA-Z0-9._ -]/g, "_") || "bestand";
  const objectKey = `${entityType}/${entityId}/${attachmentId}-${safeName}`;
  await bucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  const now = Date.now();
  await db.prepare(`INSERT INTO attachments (id, user_id, entity_type, entity_id, object_key, filename, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(attachmentId, user.uid, entityType, entityId, objectKey, safeName, file.type || "application/octet-stream", file.size, now).run();
  await audit(db, user.uid, "attachment.uploaded", entityType, entityId, { attachmentId, filename: safeName, size: file.size });
  return { id: attachmentId, filename: safeName, mimeType: file.type, size: file.size, createdAt: now };
}

async function downloadAttachment(user: AppUser, attachmentId: string) {
  const db = database();
  const row = await db.prepare("SELECT * FROM attachments WHERE id=?").bind(attachmentId).first<Json>();
  if (!row) throw new Error("Bestand niet gevonden.");
  const ownsFile = row.user_id === user.uid;
  const isShiftMember = row.entity_type === "planned_shift" && Boolean(await db.prepare(
    "SELECT 1 FROM planned_shift_members WHERE shift_id=? AND user_id=?"
  ).bind(String(row.entity_id), user.uid).first());
  if (user.role !== "admin" && !ownsFile && !isShiftMember) throw new Error("Bestand niet gevonden.");
  const object = await bucket().get(String(row.object_key));
  if (!object) throw new Error("Bestand niet gevonden.");
  return new Response(object.body, {
    headers: {
      "Content-Type": String(row.mime_type),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(row.filename))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Ongeldige aanvraag." }, 403);
    const identity = await verifyFirebaseToken(request);
    const user = await session(identity);
    if ((request.headers.get("Content-Type") || "").includes("multipart/form-data")) {
      return json({ data: await uploadAttachment(user, request) });
    }
    const payload = await request.json() as { action?: unknown; input?: unknown };
    const action = clean(payload.action, 80);
    const input = payload.input && typeof payload.input === "object" ? payload.input as Json : {};
    if (action === "downloadAttachment") return downloadAttachment(user, clean(input.id, 160));
    return json({ data: await act(user, action, input) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "De bewerking is mislukt.";
    const status = /niet aangemeld|aanmelding|uitgenodigd|niet actief|Alleen/.test(message) ? 403 : 400;
    return json({ error: message }, status);
  }
}
