import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVisitPing, visitReminderEvents, VISIT_DWELL_MS, type VisitSite } from '../server/visitClock.ts';

const here = { lat: 50.94, lng: 4.04 };
const away = { lat: 51.2, lng: 4.04 };
const now = 1_700_000_000_000;

function site(partial: Partial<VisitSite> & Pick<VisitSite, 'id' | 'status'>): VisitSite {
  return { name: partial.id, lat: here.lat, lng: here.lng, ...partial };
}

test('klanttijd start niet onder de twee minuten en niet zonder dagklok', () => {
  const pending = site({ id: 'a', status: 'pending' });
  const ping = { now, lat: here.lat, lng: here.lng, accuracy: 12, sites: [pending] };
  assert.equal(evaluateVisitPing({ ...ping, clockedIn: false, onBreak: false }).type, 'paused');
  assert.equal(evaluateVisitPing({ ...ping, clockedIn: true, onBreak: true }).type, 'paused');
  const first = evaluateVisitPing({ ...ping, clockedIn: true, onBreak: false });
  assert.equal(first.arrived.length, 0);
  assert.equal(first.patches[0]?.insideSince, now);
  const early = evaluateVisitPing({
    ...ping, now: now + VISIT_DWELL_MS - 1, clockedIn: true, onBreak: false,
    sites: [{ ...pending, insideSince: now }],
  });
  assert.equal(early.arrived.length, 0);
});

test('twee minuten op de werf zet aankomst op het moment van binnenrijden', () => {
  const pending = site({ id: 'a', name: 'Jansen', status: 'pending', insideSince: now });
  const result = evaluateVisitPing({
    now: now + VISIT_DWELL_MS, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 12, sites: [pending],
  });
  assert.equal(result.arrived[0]?.at, now);
  assert.equal(result.arrived[0]?.name, 'Jansen');
});

test('voorbijrijden en twee klanten in één cirkel starten niets', () => {
  const pending = site({ id: 'a', status: 'pending', insideSince: now });
  const left = evaluateVisitPing({
    now: now + 30_000, clockedIn: true, onBreak: false, lat: away.lat, lng: away.lng, accuracy: 12, sites: [pending],
  });
  assert.equal(left.patches.find(patch => patch.id === 'a')?.insideSince, null);
  assert.equal(left.arrived.length, 0);

  const both = evaluateVisitPing({
    now, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 12,
    sites: [site({ id: 'a', name: 'Jansen', status: 'pending' }), site({ id: 'b', name: 'Pieters', status: 'pending' })],
  });
  assert.equal(both.type, 'ambiguous');
  assert.deepEqual(both.choices.map(choice => choice.name), ['Jansen', 'Pieters']);
  assert.equal(both.arrived.length, 0);
});

test('vertrek na twee minuten buiten, en de volgende klant sluit de vorige', () => {
  const open = site({ id: 'a', name: 'Jansen', status: 'arrived', lat: away.lat, lng: away.lng, outsideSince: now });
  const gone = evaluateVisitPing({
    now: now + VISIT_DWELL_MS, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 12, sites: [open],
  });
  assert.equal(gone.departed[0]?.at, now);

  const next = site({ id: 'b', name: 'Pieters', status: 'pending', insideSince: now });
  const stillOpen = site({ id: 'a', name: 'Jansen', status: 'arrived', lat: away.lat, lng: away.lng, outsideSince: now - VISIT_DWELL_MS });
  const transfer = evaluateVisitPing({
    now: now + VISIT_DWELL_MS, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 12, sites: [stillOpen, next],
  });
  assert.equal(transfer.departed[0]?.id, 'a');
  assert.equal(transfer.departed[0]?.at, now);
  assert.equal(transfer.arrived[0]?.id, 'b');
});

test('een bevestigde cirkel telt meteen, een bevestigd vertrek ook', () => {
  const pending = site({ id: 'a', name: 'Jansen', status: 'pending' });
  const arrived = evaluateVisitPing({
    now, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 20,
    sites: [pending], confirmedDwell: true,
  });
  assert.equal(arrived.arrived[0]?.at, now - VISIT_DWELL_MS);

  const open = site({ id: 'a', name: 'Jansen', status: 'arrived', lat: away.lat, lng: away.lng, arrivalTime: now });
  const left = evaluateVisitPing({
    now: now + 10_000, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 20,
    sites: [open], confirmedExit: true,
  });
  assert.equal(left.departed[0]?.at, now + 10_000);

  const stillThere = site({ id: 'a', name: 'Jansen', status: 'arrived', arrivalTime: now });
  const forced = evaluateVisitPing({
    now: now + 5_000, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 20,
    sites: [stillThere], confirmedExit: true,
  });
  assert.equal(forced.departed[0]?.id, 'a');

  const coarse = evaluateVisitPing({
    now, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 800,
    sites: [site({ id: 'b', name: 'Pieters', status: 'pending' })], confirmedDwell: true,
  });
  assert.equal(coarse.arrived[0]?.name, 'Pieters');
  assert.equal(evaluateVisitPing({
    now, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 800,
    sites: [site({ id: 'b', status: 'pending' })],
  }).type, 'weak');

  const both = evaluateVisitPing({
    now, clockedIn: true, onBreak: false, lat: here.lat, lng: here.lng, accuracy: 20,
    sites: [site({ id: 'a', name: 'Jansen', status: 'pending' }), site({ id: 'b', name: 'Pieters', status: 'pending' })],
    confirmedDwell: true,
  });
  assert.equal(both.type, 'ambiguous');
  assert.equal(both.arrived.length, 0);
});

test('herinnering op het geplande uur en geen aankomst na dertig minuten', () => {
  const row = { assignmentId: 'job-1', userId: 'user-1', customerName: 'Jansen', date: '2026-09-17', startTime: '10:00', status: 'pending', hasArrival: false };
  assert.equal(visitReminderEvents([row], new Date('2026-09-17T08:05:00Z'))[0]?.type, 'visit_reminder');
  assert.equal(visitReminderEvents([row], new Date('2026-09-17T08:40:00Z')).some(event => event.type === 'visit_missing'), true);
  assert.equal(visitReminderEvents([{ ...row, hasArrival: true }], new Date('2026-09-17T08:40:00Z')).length, 0);
});
