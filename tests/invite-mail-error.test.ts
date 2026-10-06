import assert from 'node:assert/strict';
import test from 'node:test';
import { mailErrorInfo, mailErrorText } from '../src/lib/inviteMailError.ts';

test('uses Firebase error code with Dutch explanation', () => {
  const info = mailErrorInfo({ code: 'auth/operation-not-allowed', message: 'Firebase: Error (auth/operation-not-allowed).' });
  assert.equal(info.code, 'auth/operation-not-allowed');
  assert.match(info.explanation, /e-maillink/i);
  assert.match(mailErrorText(info), /\(auth\/operation-not-allowed\)/);
});

test('known codes: quota, invalid email, network', () => {
  assert.match(mailErrorInfo({ code: 'auth/quota-exceeded' }).explanation, /maximum/);
  assert.match(mailErrorInfo({ code: 'auth/invalid-email' }).explanation, /ongeldig/);
  assert.match(mailErrorInfo({ code: 'auth/network-request-failed' }).explanation, /netwerk/i);
});

test('extracts code from message when code is missing', () => {
  assert.equal(mailErrorInfo(new Error('Firebase: Error (auth/quota-exceeded).')).code, 'auth/quota-exceeded');
});

test('plain network failure maps to network code', () => {
  assert.equal(mailErrorInfo(new TypeError('Failed to fetch')).code, 'auth/network-request-failed');
});

test('unknown error stays visible as onbekend', () => {
  const info = mailErrorInfo({ code: 'auth/something-new', message: 'x' });
  assert.equal(info.code, 'auth/something-new');
  assert.match(info.explanation, /Onbekende fout/);
  assert.equal(mailErrorInfo(undefined).code, 'onbekend');
});
