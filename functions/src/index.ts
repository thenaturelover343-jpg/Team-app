import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const db = getFirestore();
const enforceAppCheck = process.env.FUNCTIONS_EMULATOR !== 'true';
const appUrl = defineString('APP_URL', { default: 'http://localhost:3000' });

type Role = 'admin' | 'employee';
type LocationInput = { lat: number; lng: number; accuracy: number; capturedAt?: number };

function authContext(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Log opnieuw in.');
  if (request.auth.token.active === false) throw new HttpsError('permission-denied', 'Uw account is gedeactiveerd.');
  return request.auth;
}

function requireAdmin(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
  const auth = authContext(request);
  if (auth.token.role !== 'admin') throw new HttpsError('permission-denied', 'Alleen beheerders mogen dit uitvoeren.');
  return auth;
}

function text(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${field} is ongeldig.`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new HttpsError('invalid-argument', `${field} is ongeldig.`);
  return result;
}

function location(value: unknown): LocationInput {
  if (!value || typeof value !== 'object') throw new HttpsError('invalid-argument', 'Locatie ontbreekt.');
  const candidate = value as Record<string, unknown>;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  const accuracy = Number(candidate.accuracy);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new HttpsError('invalid-argument', 'Locatiecoördinaten zijn ongeldig.');
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10_000) {
    throw new HttpsError('invalid-argument', 'Locatienauwkeurigheid is ongeldig.');
  }
  return { lat, lng, accuracy, capturedAt: Number(candidate.capturedAt) || Date.now() };
}

function audit(actorId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  return {
    actorId,
    action,
    targetType,
    targetId,
    details,
    createdAt: FieldValue.serverTimestamp(),
  };
}

export const inviteEmployee = onCall({ enforceAppCheck }, async request => {
  const actor = requireAdmin(request);
  const email = text(request.data?.email, 'E-mail', 255).toLowerCase();
  const name = text(request.data?.name, 'Naam', 100);
  const phone = text(request.data?.phone ?? '', 'Telefoon', 50, false);

  let userRecord;
  try {
    userRecord = await getAuth().getUserByEmail(email);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    userRecord = await getAuth().createUser({ email, displayName: name, emailVerified: false, disabled: false });
  }
  if (userRecord.customClaims?.role === 'admin') {
    throw new HttpsError('failed-precondition', 'Een bestaande beheerder kan niet als medewerker worden uitgenodigd.');
  }
  await getAuth().setCustomUserClaims(userRecord.uid, { role: 'employee', active: true });
  await db.collection('users').doc(userRecord.uid).set({
    email,
    name,
    phone,
    role: 'employee',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const resetLink = await getAuth().generatePasswordResetLink(email, { url: appUrl.value() });
  await db.collection('audit_events').add(audit(actor.uid, 'employee.invited', 'user', userRecord.uid, { email }));
  return { uid: userRecord.uid, resetLink };
});

export const setEmployeeAccess = onCall({ enforceAppCheck }, async request => {
  const actor = requireAdmin(request);
  const uid = text(request.data?.uid, 'Gebruiker', 128);
  const role = request.data?.role as Role;
  const active = request.data?.active;
  if (uid === actor.uid) throw new HttpsError('failed-precondition', 'U kunt uw eigen toegang hier niet wijzigen.');
  if (!['admin', 'employee'].includes(role) || typeof active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Rol of status is ongeldig.');
  }

  await getAuth().updateUser(uid, { disabled: !active });
  await getAuth().setCustomUserClaims(uid, { role, active });
  await db.collection('users').doc(uid).set({ role, active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.collection('audit_events').add(audit(actor.uid, 'employee.access_changed', 'user', uid, { role, active }));
  return { ok: true };
});

export const saveCustomer = onCall({ enforceAppCheck }, async request => {
  const actor = requireAdmin(request);
  const id = typeof request.data?.id === 'string' && request.data.id ? text(request.data.id, 'Klant', 128) : db.collection('customers').doc().id;
  const ref = db.collection('customers').doc(id);
  const existing = await ref.get();
  const customer = {
    name: text(request.data?.name, 'Naam', 200),
    address: text(request.data?.address, 'Adres', 500),
    phone: text(request.data?.phone ?? '', 'Telefoon', 50, false),
    email: text(request.data?.email ?? '', 'E-mail', 255, false).toLowerCase(),
    createdAt: existing.exists ? existing.get('createdAt') : FieldValue.serverTimestamp(),
  };
  await ref.set(customer);
  await db.collection('audit_events').add(audit(actor.uid, existing.exists ? 'customer.updated' : 'customer.created', 'customer', id));
  return { id };
});

export const saveAssignment = onCall({ enforceAppCheck }, async request => {
  const actor = requireAdmin(request);
  const id = typeof request.data?.id === 'string' && request.data.id ? text(request.data.id, 'Opdracht', 128) : db.collection('assignments').doc().id;
  const userId = text(request.data?.userId, 'Medewerker', 128);
  const customerId = text(request.data?.customerId, 'Klant', 128);
  const date = text(request.data?.date, 'Datum', 10);
  const startTime = text(request.data?.startTime, 'Starttijd', 5);
  const description = text(request.data?.description ?? '', 'Beschrijving', 1000, false);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw new HttpsError('invalid-argument', 'Datum of starttijd is ongeldig.');
  }

  const ref = db.collection('assignments').doc(id);
  const [existing, employee, customer] = await Promise.all([
    ref.get(),
    db.collection('users').doc(userId).get(),
    db.collection('customers').doc(customerId).get(),
  ]);
  if (!employee.exists || employee.get('role') !== 'employee' || employee.get('active') === false) {
    throw new HttpsError('failed-precondition', 'De geselecteerde medewerker is niet actief.');
  }
  if (!customer.exists) throw new HttpsError('not-found', 'Klant niet gevonden.');
  if (existing.exists && existing.get('status') !== 'pending') {
    throw new HttpsError('failed-precondition', 'Alleen geplande opdrachten kunnen worden gewijzigd.');
  }

  if (existing.exists) {
    await ref.update({ userId, customerId, customerName: customer.get('name'), date, startTime, description });
  } else {
    await ref.create({
      userId, customerId, customerName: customer.get('name'), date, startTime, description,
      status: 'pending', acknowledged: false, createdAt: FieldValue.serverTimestamp(),
    });
  }
  await db.collection('audit_events').add(audit(actor.uid, existing.exists ? 'assignment.updated' : 'assignment.created', 'assignment', id, { userId, customerId }));
  return { id };
});

export const deleteAssignment = onCall({ enforceAppCheck }, async request => {
  const actor = requireAdmin(request);
  const id = text(request.data?.id, 'Opdracht', 128);
  const ref = db.collection('assignments').doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Opdracht niet gevonden.');
  if (snapshot.get('status') !== 'pending') throw new HttpsError('failed-precondition', 'Alleen geplande opdrachten kunnen worden verwijderd.');
  await ref.delete();
  await db.collection('audit_events').add(audit(actor.uid, 'assignment.deleted', 'assignment', id));
  return { ok: true };
});

export const clockIn = onCall({ enforceAppCheck }, async request => {
  const actor = authContext(request);
  const loc = location(request.data?.location);
  const activeRef = db.collection('active_shifts').doc(actor.uid);
  const shiftRef = db.collection('shifts').doc();
  const eventRef = db.collection('time_events').doc();
  const auditRef = db.collection('audit_events').doc();

  await db.runTransaction(async transaction => {
    const active = await transaction.get(activeRef);
    if (active.exists) throw new HttpsError('already-exists', 'U bent al ingeklokt.');
    transaction.create(shiftRef, {
      userId: actor.uid,
      active: true,
      clockIn: FieldValue.serverTimestamp(),
      clockInLoc: loc,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(activeRef, { userId: actor.uid, shiftId: shiftRef.id, clockIn: FieldValue.serverTimestamp() });
    transaction.create(eventRef, { userId: actor.uid, shiftId: shiftRef.id, type: 'clock_in', location: loc, createdAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, audit(actor.uid, 'shift.clock_in', 'shift', shiftRef.id));
  });
  return { shiftId: shiftRef.id };
});

export const clockOut = onCall({ enforceAppCheck }, async request => {
  const actor = authContext(request);
  const loc = location(request.data?.location);
  const notes = text(request.data?.notes ?? '', 'Notities', 2000, false);
  const statusTag = request.data?.statusTag;
  const statuses = ['Normaal', 'Vertraagd', 'Gedeeltelijk afgerond', 'Probleem gemeld'];
  if (!statuses.includes(statusTag)) throw new HttpsError('invalid-argument', 'Status is ongeldig.');

  const activeRef = db.collection('active_shifts').doc(actor.uid);
  const eventRef = db.collection('time_events').doc();
  const auditRef = db.collection('audit_events').doc();
  await db.runTransaction(async transaction => {
    const active = await transaction.get(activeRef);
    if (!active.exists) throw new HttpsError('not-found', 'Geen actieve shift gevonden.');
    const shiftId = active.get('shiftId') as string;
    const shiftRef = db.collection('shifts').doc(shiftId);
    const shift = await transaction.get(shiftRef);
    if (!shift.exists || shift.get('userId') !== actor.uid || shift.get('active') !== true) {
      throw new HttpsError('failed-precondition', 'De actieve shift is ongeldig.');
    }
    transaction.update(shiftRef, {
      active: false,
      clockOut: FieldValue.serverTimestamp(),
      clockOutLoc: loc,
      notes,
      statusTag,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.delete(activeRef);
    transaction.create(eventRef, { userId: actor.uid, shiftId, type: 'clock_out', location: loc, createdAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, audit(actor.uid, 'shift.clock_out', 'shift', shiftId, { statusTag }));
  });
  return { ok: true };
});

export const acknowledgeAssignment = onCall({ enforceAppCheck }, async request => {
  const actor = authContext(request);
  const assignmentId = text(request.data?.assignmentId, 'Opdracht', 128);
  const ref = db.collection('assignments').doc(assignmentId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.get('userId') !== actor.uid) throw new HttpsError('permission-denied', 'Opdracht niet gevonden.');
  await ref.update({ acknowledged: true, acknowledgedAt: FieldValue.serverTimestamp() });
  await db.collection('audit_events').add(audit(actor.uid, 'assignment.acknowledged', 'assignment', assignmentId));
  return { ok: true };
});

export const transitionAssignment = onCall({ enforceAppCheck }, async request => {
  const actor = authContext(request);
  const assignmentId = text(request.data?.assignmentId, 'Opdracht', 128);
  const nextStatus = request.data?.status;
  if (!['arrived', 'completed'].includes(nextStatus)) throw new HttpsError('invalid-argument', 'Status is ongeldig.');
  const loc = location(request.data?.location);
  const ref = db.collection('assignments').doc(assignmentId);
  const auditRef = db.collection('audit_events').doc();

  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('userId') !== actor.uid) throw new HttpsError('permission-denied', 'Opdracht niet gevonden.');
    const current = snapshot.get('status');
    if ((nextStatus === 'arrived' && current !== 'pending') || (nextStatus === 'completed' && current !== 'arrived')) {
      throw new HttpsError('failed-precondition', 'Deze statusovergang is niet toegestaan.');
    }
    const updates = nextStatus === 'arrived'
      ? { status: 'arrived', arrivalTime: FieldValue.serverTimestamp(), arrivalLoc: loc }
      : { status: 'completed', departureTime: FieldValue.serverTimestamp(), departureLoc: loc, workNotes: text(request.data?.notes ?? '', 'Notities', 2000, false) };
    transaction.update(ref, updates);
    transaction.create(auditRef, audit(actor.uid, `assignment.${nextStatus}`, 'assignment', assignmentId));
  });
  return { ok: true };
});
