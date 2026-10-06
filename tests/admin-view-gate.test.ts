import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminUser, isEmployeeUser } from '../server/roles.ts';

test('plain medewerker is not admin and has no admin view switch', () => {
  const user = { role: 'employee' as const, isEmployee: true };
  assert.equal(isAdminUser(user), false);
  assert.equal(isEmployeeUser(user), true);
  // UI renders eye only when isAdminUser(user) — employee must not.
  assert.equal(Boolean(isAdminUser(user) && true), false);
});

test('dual beheerder+medewerker gets admin switch', () => {
  const user = { role: 'admin' as const, isEmployee: true };
  assert.equal(isAdminUser(user), true);
  assert.equal(isEmployeeUser(user), true);
});

test('admin-only also gets admin switch (can open beheer)', () => {
  const user = { role: 'admin' as const, isEmployee: false };
  assert.equal(isAdminUser(user), true);
});
