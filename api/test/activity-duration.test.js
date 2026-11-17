import assert from 'node:assert/strict';
import test from 'node:test';
import { validateActivity } from '../src/routes/activities.js';

test('validates optional duration as whole minutes between 1 and 1440', () => {
  assert.deepEqual(validateActivity({ durationMinutes: 90 }, true).value, { duration_minutes: 90 });
  assert.deepEqual(validateActivity({ durationMinutes: null }, true).value, { duration_minutes: null });
  for (const value of [0, -1, 1441, 1.5, '60', true]) {
    assert.equal(validateActivity({ durationMinutes: value }, true).error.code, 'INVALID_DURATION');
  }
});
