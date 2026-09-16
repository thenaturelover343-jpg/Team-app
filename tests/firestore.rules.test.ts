import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection } from 'firebase/firestore';

let environment: RulesTestEnvironment;

const user = (role: 'admin' | 'employee', active = true) => ({
  name: role,
  email: `${role}@example.com`,
  role,
  active,
  createdAt: Date.now(),
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'team-app-rules-test',
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'admin-1'), user('admin'));
    await setDoc(doc(db, 'users', 'employee-1'), user('employee'));
    await setDoc(doc(db, 'users', 'employee-2'), user('employee'));
    await setDoc(doc(db, 'shifts', 'shift-1'), { userId: 'employee-1', active: true, clockIn: Date.now(), clockInLoc: { lat: 50, lng: 4 } });
    await setDoc(doc(db, 'assignments', 'assignment-1'), {
      userId: 'employee-1', customerId: 'customer-1', customerName: 'Klant', description: 'Werk',
      date: '2026-09-16', startTime: '09:00', status: 'pending', createdAt: Date.now(), tasks: [], acknowledged: false,
    });
    await setDoc(doc(db, 'audit_events', 'audit-1'), { actorId: 'employee-1', createdAt: Date.now() });
  });
});

afterAll(async () => environment.cleanup());

describe('Firestore Security Rules', () => {
  it('weigert niet-aangemelde toegang', async () => {
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'users', 'employee-1')));
  });

  it('laat een actieve medewerker uitsluitend het eigen profiel lezen', async () => {
    const db = environment.authenticatedContext('employee-1', { role: 'employee', active: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'employee-1')));
    await assertFails(getDoc(doc(db, 'users', 'employee-2')));
    await assertFails(getDocs(collection(db, 'users')));
  });

  it('laat een medewerker profielgegevens maar geen rol wijzigen', async () => {
    const db = environment.authenticatedContext('employee-1', { role: 'employee', active: true }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'employee-1'), { phone: '0400000000' }));
    await assertFails(updateDoc(doc(db, 'users', 'employee-1'), { role: 'admin' }));
  });

  it('weigert alle clientwrites naar shifts en auditlogs', async () => {
    const db = environment.authenticatedContext('employee-1', { role: 'employee', active: true }).firestore();
    await assertFails(setDoc(doc(db, 'shifts', 'shift-2'), { userId: 'employee-1', clockIn: Date.now() }));
    await assertFails(updateDoc(doc(db, 'shifts', 'shift-1'), { clockOut: Date.now() }));
    await assertFails(setDoc(doc(db, 'audit_events', 'audit-2'), { actorId: 'employee-1' }));
  });

  it('laat medewerkers taken aanpassen maar niet de opdrachtstatus', async () => {
    const db = environment.authenticatedContext('employee-1', { role: 'employee', active: true }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'assignments', 'assignment-1'), { tasks: [{ id: '1', text: 'Controle', completed: true }] }));
    await assertFails(updateDoc(doc(db, 'assignments', 'assignment-1'), { status: 'completed' }));
  });

  it('laat beheerders lezen maar dwingt opdrachtwrites via de backend', async () => {
    const db = environment.authenticatedContext('admin-1', { role: 'admin', active: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'assignments', 'assignment-1')));
    await assertFails(updateDoc(doc(db, 'assignments', 'assignment-1'), { userId: 'employee-2', customerId: 'customer-2' }));
  });

  it('dwingt klantwrites via de backend', async () => {
    const db = environment.authenticatedContext('admin-1', { role: 'admin', active: true }).firestore();
    await assertFails(setDoc(doc(db, 'customers', 'customer-2'), { name: 'Klant', address: 'Adres', createdAt: Date.now() }));
  });

  it('weigert gedeactiveerde accounts', async () => {
    const db = environment.authenticatedContext('employee-1', { role: 'employee', active: false }).firestore();
    await assertFails(getDoc(doc(db, 'users', 'employee-1')));
  });
});
