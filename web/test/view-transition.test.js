import assert from 'node:assert/strict';
import test from 'node:test';
import { runViewTransition } from '../src/lib/view-transition.js';

test('updates immediately when view transitions are unavailable', () => {
  let updated = false;
  runViewTransition(() => { updated = true; });
  assert.equal(updated, true);
});
