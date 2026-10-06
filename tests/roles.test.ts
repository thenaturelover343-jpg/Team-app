import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessFromToggles,
  flagsFromInviteRole,
  flagsFromStored,
  mergeAccess,
  parseInviteRole,
  roleLabelNl,
} from '../server/roles.ts';

test('invite roles map to flags', () => {
  assert.deepEqual(flagsFromInviteRole('employee'), { role: 'employee', isEmployee: true });
  assert.deepEqual(flagsFromInviteRole('admin'), { role: 'admin', isEmployee: false });
  assert.deepEqual(flagsFromInviteRole('both'), { role: 'admin', isEmployee: true });
  assert.equal(parseInviteRole('admin_employee'), 'both');
});

test('legacy admin without is_employee is treated as employee too', () => {
  assert.deepEqual(flagsFromStored('admin', undefined), { role: 'admin', isEmployee: true });
  assert.deepEqual(flagsFromStored('admin', 0), { role: 'admin', isEmployee: false });
  assert.deepEqual(flagsFromStored('employee', 0), { role: 'employee', isEmployee: true });
});

test('merging employee invite onto admin keeps one dual account', () => {
  assert.deepEqual(
    mergeAccess({ role: 'admin', isEmployee: false }, 'employee'),
    { role: 'admin', isEmployee: true },
  );
  assert.deepEqual(
    mergeAccess({ role: 'admin', isEmployee: true }, 'admin'),
    { role: 'admin', isEmployee: true },
  );
  assert.deepEqual(
    mergeAccess({ role: 'employee', isEmployee: true }, 'admin'),
    { role: 'admin', isEmployee: true },
  );
});

test('toggles require at least one role', () => {
  assert.throws(() => accessFromToggles(false, false), /minstens/);
  assert.deepEqual(accessFromToggles(true, true), { role: 'admin', isEmployee: true });
  assert.deepEqual(accessFromToggles(true, false), { role: 'admin', isEmployee: false });
  assert.deepEqual(accessFromToggles(false, true), { role: 'employee', isEmployee: true });
});

test('Dutch labels', () => {
  assert.equal(roleLabelNl({ role: 'admin', isEmployee: true }), 'Beheerder + Medewerker');
  assert.equal(roleLabelNl({ role: 'admin', isEmployee: false }), 'Beheerder');
  assert.equal(roleLabelNl({ role: 'employee', isEmployee: true }), 'Medewerker');
});
