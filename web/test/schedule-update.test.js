import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSchedule, createMutationLock } from '../src/features/trips/schedule-update.js';

const trip = { budgetSummary: { remainingBudget: '10.00' }, days: [
  { date: '2026-06-01', activities: [{ id: 1, date: '2026-06-01', time: '09:00', durationMinutes: 60, title: 'Walk' }] },
  { date: '2026-06-02', activities: [] },
] };

test('moves an activity without changing budget and restores original schedule on failure', () => {
  const moved = updateSchedule(trip, 1, { date: '2026-06-02', time: '10:00' });
  assert.equal(moved.days[0].activities.length, 0);
  assert.equal(moved.days[1].activities[0].time, '10:00');
  assert.deepEqual(moved.budgetSummary, trip.budgetSummary);
  const restored = updateSchedule(moved, 1, { date: '2026-06-01', time: '09:00' });
  assert.deepEqual(restored, trip);
});

test('rejects concurrent mutations until the first has settled', async () => {
  const lock = createMutationLock();
  let release;
  const first = lock(() => new Promise((resolve) => { release = resolve; }));
  await assert.rejects(lock(async () => {}), /another change/i);
  release();
  await first;
  assert.equal(await lock(async () => 42), 42);
});

test('rejects writes before changing local data while offline and allows them after reconnecting', async () => {
  let online = false;
  let writes = 0;
  const lock = createMutationLock(() => online);
  await assert.rejects(lock(async () => { writes++; }), /connection/i);
  assert.equal(writes, 0);
  online = true;
  await lock(async () => { writes++; });
  assert.equal(writes, 1);
});
