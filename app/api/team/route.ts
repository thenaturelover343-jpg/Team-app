import { env } from "cloudflare:workers";
import { cleanText as clean, isAllowedTransition, normalizeEmail as email, validateLocation as location } from "../../../server/policy";
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
    id: row.id, userId: row.user_id, clockIn: Number(row.clock_in),
    clockInLoc: { lat: Number(row.clock_in_lat), lng: Number(row.clock_in_lng) },
    ...(row.clock_out ? { clockOut: Number(row.clock_out), clockOutLoc: { lat: Number(row.clock_out_lat), lng: Number(row.clock_out_lng) } } : {}),
    statusTag: row.status_tag || undefined, notes: row.notes || undefined,
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
      createdAt: Number(row.created_at), memberIds: [], confirmations: {},
    };
    if (row.member_user_id) {
      (current.memberIds as string[]).push(String(row.member_user_id));
      (current.confirmations as Record<string, string>)[String(row.member_user_id)] = String(row.confirmation_status || "pending");
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
        c.longitude AS customer_longitude, psm.user_id AS member_user_id, psm.confirmation_status
        FROM planned_shifts ps LEFT JOIN customers c ON c.id = ps.customer_id
        LEFT JOIN planned_shift_members psm ON psm.shift_id = ps.id ORDER BY ps.date, ps.start_time LIMIT 3000`)
    : db.prepare(`SELECT ps.*, c.name AS customer_name, c.address AS customer_address, c.latitude AS customer_latitude,
        c.longitude AS customer_longitude, psm.user_id AS member_user_id, psm.confirmation_status
        FROM planned_shifts ps LEFT JOIN customers c ON c.id = ps.customer_id
        JOIN planned_shift_members psm ON psm.shift_id = ps.id
        WHERE psm.user_id = ? AND ps.status = 'published' ORDER BY ps.date, ps.start_time LIMIT 1000`).bind(user.uid);
  const [usersResult, shiftsResult, assignmentsResult, customersResult, plannedResult] = await Promise.all([
    usersQuery.all<Json>(), shiftsQuery.all<Json>(), assignmentsQuery.all<Json>(),
    db.prepare("SELECT * FROM customers ORDER BY name").all<Json>(),
    plannedQuery.all<Json>(),
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
        (id, title, customer_id, date, start_time, end_time, break_minutes, notes, status, recurrence_group_id, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`)
        .bind(shiftId, title, customerId, addWeeks(date, week), window.startTime, window.endTime, window.breakMinutes,
          clean(input.notes, 2000) || null, recurrenceGroupId, user.uid, now, now));
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
    const shiftId = id();
    await db.batch([
      db.prepare("INSERT INTO shifts (id, user_id, clock_in, clock_in_lat, clock_in_lng) VALUES (?, ?, ?, ?, ?)").bind(shiftId, user.uid, now, loc.lat, loc.lng),
      db.prepare("INSERT INTO active_shifts (user_id, shift_id) VALUES (?, ?)").bind(user.uid, shiftId),
      db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'shift.clock_in', 'shift', ?, '{}', ?)`)
        .bind(id(), user.uid, shiftId, now),
    ]);
    return { shiftId };
  }

  if (action === "clockOut") {
    const loc = location(input.location);
    const active = await db.prepare("SELECT shift_id FROM active_shifts WHERE user_id = ?").bind(user.uid).first<{ shift_id: string }>();
    if (!active) throw new Error("Er is geen actieve shift.");
    await db.batch([
      db.prepare("UPDATE shifts SET clock_out=?, clock_out_lat=?, clock_out_lng=?, notes=?, status_tag=? WHERE id=? AND clock_out IS NULL")
        .bind(now, loc.lat, loc.lng, clean(input.notes), clean(input.statusTag, 80), active.shift_id),
      db.prepare("DELETE FROM active_shifts WHERE user_id = ? AND shift_id = ?").bind(user.uid, active.shift_id),
      db.prepare(`INSERT INTO audit_events (id, actor_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, 'shift.clock_out', 'shift', ?, ?, ?)`)
        .bind(id(), user.uid, active.shift_id, JSON.stringify({ statusTag: clean(input.statusTag, 80) }), now),
    ]);
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

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== new URL(request.url).origin) return json({ error: "Ongeldige aanvraag." }, 403);
    const identity = await verifyFirebaseToken(request);
    const user = await session(identity);
    const payload = await request.json() as { action?: unknown; input?: unknown };
    const action = clean(payload.action, 80);
    const input = payload.input && typeof payload.input === "object" ? payload.input as Json : {};
    return json({ data: await act(user, action, input) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "De bewerking is mislukt.";
    const status = /niet aangemeld|aanmelding|uitgenodigd|niet actief|Alleen/.test(message) ? 403 : 400;
    return json({ error: message }, status);
  }
}
