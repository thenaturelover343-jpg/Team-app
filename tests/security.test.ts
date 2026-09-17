import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanText, distanceMeters, isAllowedTransition, normalizeEmail, validateGeofence, validateLocation } from '../server/policy.ts';
import { addWeeks, availabilityConflict, overlaps, validateShiftWindow } from '../server/planning.ts';
import { attendanceEvents, csv, workedMinutes } from '../server/phase4.ts';

test('vrije registratie wordt niet als statusovergang geaccepteerd', () => {
  assert.equal(isAllowedTransition('pending', 'completed'), false);
  assert.equal(isAllowedTransition('completed', 'arrived'), false);
});

test('alleen de twee toegestane statusovergangen slagen', () => {
  assert.equal(isAllowedTransition('pending', 'arrived'), true);
  assert.equal(isAllowedTransition('arrived', 'completed'), true);
});

test('locaties worden server-side begrensd', () => {
  const capturedAt = Date.now();
  assert.deepEqual(validateLocation({ lat: 50.94, lng: 4.04, accuracy: 12, capturedAt }), { lat: 50.94, lng: 4.04, accuracy: 12, capturedAt });
  assert.throws(() => validateLocation({ lat: 91, lng: 4, accuracy: 12, capturedAt }), /Ongeldige locatie/);
  assert.throws(() => validateLocation({ lat: 50, lng: 181, accuracy: 12, capturedAt }), /Ongeldige locatie/);
  assert.throws(() => validateLocation({ lat: 50.94, lng: 4.04, accuracy: 6000, capturedAt }), /GPS-nauwkeurigheid/);
  assert.throws(() => validateLocation({ lat: 50.94, lng: 4.04, accuracy: 12, capturedAt: capturedAt - 25 * 60 * 60 * 1000 }), /verlopen/);
});

test('geofence controleert afstand en GPS-nauwkeurigheid', () => {
  const target = { lat: 50.94, lng: 4.04 };
  assert.ok(distanceMeters(target, { lat: 50.9405, lng: 4.04 }) < 100);
  assert.equal(validateGeofence({ ...target, accuracy: 10 }, target).status, 'inside');
  assert.equal(validateGeofence({ ...target, accuracy: 10 }).status, 'unverified');
  assert.throws(() => validateGeofence({ ...target, accuracy: 101 }, target), /onvoldoende nauwkeurig/);
  assert.throws(() => validateGeofence({ lat: 51, lng: 4.04, accuracy: 10 }, target), /buiten de toegestane zone/);
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

test('herinneringen, te-laat- en no-showmeldingen worden gededupliceerd opgebouwd', () => {
  const row = { shiftId: 'shift-1', userId: 'user-1', userName: 'Karim', date: '2026-09-17', startTime: '10:00', title: 'Ochtenddienst', hasClockIn: false };
  assert.equal(attendanceEvents([row], new Date('2026-09-17T07:30:00Z')).at(0)?.type, 'reminder');
  assert.equal(attendanceEvents([row], new Date('2026-09-17T08:15:00Z')).at(0)?.type, 'late');
  assert.equal(attendanceEvents([row], new Date('2026-09-17T08:35:00Z')).at(0)?.type, 'no_show');
  assert.equal(attendanceEvents([{ ...row, hasClockIn: true }], new Date('2026-09-17T08:35:00Z')).length, 0);
});

test('gewerkte minuten trekken de pauze af en CSV ontsnapt velden', () => {
  assert.equal(workedMinutes(0, 8 * 60 * 60 * 1000, 30), 450);
  assert.equal(csv([['Naam', 'Notitie'], ['A', 'tekst, met komma']]), '\uFEFFNaam;Notitie\r\nA;"tekst, met komma"\r\n');
});
