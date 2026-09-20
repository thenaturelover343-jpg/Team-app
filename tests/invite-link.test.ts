import assert from 'node:assert/strict';
import test from 'node:test';
import { invitePath, inviteUrl } from '../src/lib/inviteLink.ts';

test('invite links are shareable and origin-safe', () => {
  assert.equal(invitePath('abc123'), '/?invite=abc123');
  assert.equal(inviteUrl('https://barlicious-team-app.thenaturelover343.workers.dev/', 'tok'), 'https://barlicious-team-app.thenaturelover343.workers.dev/?invite=tok');
  assert.equal(invitePath('a b'), '/?invite=a%20b');
});
