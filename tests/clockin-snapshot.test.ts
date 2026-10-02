import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateClockIn, requireSnapshotAuthHeader } from '../server/clockInRules.ts';

test('snapshot zonder Bearer wordt geweigerd', () => {
  assert.throws(() => requireSnapshotAuthHeader(null), /niet aangemeld/);
  assert.throws(() => requireSnapshotAuthHeader(''), /niet aangemeld/);
  assert.throws(() => requireSnapshotAuthHeader('Token abc'), /niet aangemeld/);
});

test('snapshot met kapotte JWT wordt geweigerd', () => {
  assert.throws(() => requireSnapshotAuthHeader('Bearer not-a-jwt'), /Ongeldige aanmelding/);
  assert.ok(requireSnapshotAuthHeader('Bearer aaa.bbb.ccc'));
});

test('clock-in weigert een tweede actieve shift', () => {
  const loc = { lat: 50.94, lng: 4.04, accuracy: 12, capturedAt: Date.now() };
  assert.throws(() => evaluateClockIn({ location: loc, alreadyActive: true }), /al ingeklokt/);
});

test('clock-in weigert een dienst die niet van de medewerker is', () => {
  const loc = { lat: 50.94, lng: 4.04, accuracy: 12, capturedAt: Date.now() };
  assert.throws(
    () => evaluateClockIn({ location: loc, alreadyActive: false, plannedShiftId: 'shift-1', plannedShift: null }),
    /niet beschikbaar/,
  );
});

test('clock-in noteert de zone maar blokkeert de dagstart niet', () => {
  const loc = { lat: 50.94, lng: 4.04, accuracy: 12, capturedAt: Date.now() };
  const ok = evaluateClockIn({
    location: loc,
    alreadyActive: false,
    plannedShiftId: 'shift-1',
    plannedShift: { siteLat: 50.94, siteLng: 4.04 },
  });
  assert.equal(ok.geofence.status, 'inside');
  assert.equal(ok.plannedShiftId, 'shift-1');

  const away = evaluateClockIn({
    location: loc,
    alreadyActive: false,
    plannedShiftId: 'shift-1',
    plannedShift: { siteLat: 51.2, siteLng: 4.04 },
  });
  assert.equal(away.geofence.status, 'outside');
});
