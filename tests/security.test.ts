import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanText, isAllowedTransition, normalizeEmail, validateLocation } from '../server/policy.ts';

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
