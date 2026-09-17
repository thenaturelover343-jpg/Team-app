import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanText, isAllowedTransition, normalizeEmail, validateLocation } from '../server/policy.ts';
import { addWeeks, availabilityConflict, overlaps, validateShiftWindow } from '../server/planning.ts';

test('vrije registratie wordt niet als statusovergang geaccepteerd', () => {
  assert.equal(isAllowedTransition('pending', 'completed'), false);
  assert.equal(isAllowedTransition('completed', 'arrived'), false);
});

test('alleen de twee toegestane statusovergangen slagen', () => {
  assert.equal(isAllowedTransition('pending', 'arrived'), true);
  assert.equal(isAllowedTransition('arrived', 'completed'), true);
});

test('locaties worden server-side begrensd', () => {
  assert.deepEqual(validateLocation({ lat: 50.94, lng: 4.04 }), { lat: 50.94, lng: 4.04 });
  assert.throws(() => validateLocation({ lat: 91, lng: 4 }), /Ongeldige locatie/);
  assert.throws(() => validateLocation({ lat: 50, lng: 181 }), /Ongeldige locatie/);
});

test('invoer wordt genormaliseerd en begrensd', () => {
  assert.equal(normalizeEmail('  TEST@EXAMPLE.COM '), 'test@example.com');
  assert.equal(cleanText('abcdef', 3), 'abc');
});

test('diensttijden en pauzes worden server-side gevalideerd', () => {
  assert.deepEqual(validateShiftWindow('09:00', '17:00', 30), { startTime: '09:00', endTime: '17:00', breakMinutes: 30, start: 540, end: 1020 });
  assert.throws(() => validateShiftWindow('17:00', '09:00', 30), /eindtijd/);
  assert.throws(() => validateShiftWindow('09:00', '10:00', 60), /pauze/);
});

test('overlappende diensten worden correct gevonden', () => {
  assert.equal(overlaps('09:00', '12:00', '11:30', '15:00'), true);
  assert.equal(overlaps('09:00', '12:00', '12:00', '15:00'), false);
});

test('wekelijkse herhaling behoudt de weekdag', () => {
  assert.equal(addWeeks('2026-09-14', 3), '2026-10-05');
});

test('beschikbaarheid blokkeert dagen en uren buiten het venster', () => {
  const availability = { '1': { enabled: true, start: '08:00', end: '17:00' } };
  assert.equal(availabilityConflict(availability, '2026-09-14', '09:00', '16:00'), false);
  assert.equal(availabilityConflict(availability, '2026-09-14', '07:00', '16:00'), true);
  assert.equal(availabilityConflict(availability, '2026-09-15', '09:00', '16:00'), true);
});
