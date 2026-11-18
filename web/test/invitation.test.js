import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationFromFragment, invitationUrl } from '../src/features/trips/invitation.js';

test('invitation tokens use only the URL fragment and reject malformed input', () => {
  const token = 'ab'.repeat(32);
  const url = new URL(invitationUrl('https://tripo.example', token));
  assert.equal(url.pathname, '/invite');
  assert.equal(url.search, '');
  assert.equal(invitationFromFragment(url.hash), token);
  assert.equal(invitationFromFragment('#token=bad'), null);
});
