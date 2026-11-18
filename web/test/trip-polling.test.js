import test from 'node:test';
import assert from 'node:assert/strict';
import { createTripPoller } from '../src/features/trips/trip-polling.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('activity editor retains the original activity when another member deletes it', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { ActivityEditor } = await server.ssrLoadModule('/src/features/trips/TripDetail.jsx');
  const activity = { id: 1, version: 1, date: '2026-11-17', title: 'Original plan', category: 'other', plannedCost: 0 };
  const trip = { days: [{ date: '2026-11-17', dayNumber: 1, activities: [] }], currencyCode: 'VND' };
  const html = renderToStaticMarkup(React.createElement(ActivityEditor, { activity, trip, onSave: () => {}, onCancel: () => {} }));
  assert.match(html, /value="Original plan"/);
  assert.match(html, /Save activity/);
  assert.match(html, /activity was removed/);
  const moved = { ...trip, days: [{ ...trip.days[0], activities: [{ ...activity, version: 2, title: 'Remote edit' }] }] };
  const updatedHtml = renderToStaticMarkup(React.createElement(ActivityEditor, { activity, trip: moved, onSave: () => {}, onCancel: () => {} }));
  assert.match(updatedHtml, /value="Original plan"/);
  assert.match(updatedHtml, /activity changed while you were editing/);
});

test('stopping aborts and ignores a stale response, restarting applies only the fresh response', async () => {
  const pending = [];
  const applied = [];
  const timers = [];
  const poller = createTripPoller({
    load: (signal) => new Promise((resolve) => pending.push({ signal, resolve })),
    apply: (value) => applied.push(value),
    onState: () => {},
    schedule: (callback) => { timers.push(callback); return callback; },
    cancel: () => {},
  });
  poller.start();
  poller.stop();
  assert.equal(pending[0].signal.aborted, true);
  poller.start();
  pending[0].resolve('stale');
  pending[1].resolve('fresh');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(applied, ['fresh']);
  assert.equal(timers.length, 1);
  poller.stop();
});

test('does not schedule another poll until the current request settles', async () => {
  let finish;
  let timers = 0;
  const poller = createTripPoller({ load: () => new Promise((resolve) => { finish = resolve; }), apply: () => {}, onState: () => {}, schedule: () => { timers++; }, cancel: () => {} });
  poller.start();
  assert.equal(timers, 0);
  finish('ok');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(timers, 1);
  poller.stop();
});

test('reports an error and retries after the interval without discarding data', async () => {
  const states = [];
  const applied = [];
  let timer;
  let delay;
  let attempts = 0;
  const poller = createTripPoller({
    load: async () => { if (++attempts === 1) throw new Error('network'); return 'recovered'; },
    apply: (value) => applied.push(value),
    onState: (state) => states.push(state),
    schedule: (callback, ms) => { timer = callback; delay = ms; return callback; },
    cancel: () => {},
  });
  poller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(states, ['error']);
  assert.deepEqual(applied, []);
  assert.equal(delay, 5000);
  timer();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(states, ['error', 'current']);
  assert.deepEqual(applied, ['recovered']);
  poller.stop();
});

test('loads trip detail only when the revision changes', async () => {
  const { fetchChangedTrip } = await import('../src/features/trips/trip-polling.js');
  let details = 0;
  const getDetail = async () => { details++; return { data: { revision: 2 } }; };
  assert.equal(await fetchChangedTrip(async () => ({ data: { revision: 1 } }), getDetail, 1), null);
  assert.equal(details, 0);
  assert.deepEqual(await fetchChangedTrip(async () => ({ data: { revision: 2 } }), getDetail, 1), { data: { revision: 2 } });
  assert.equal(details, 1);
});

test('renews a completed long poll immediately without reloading unchanged trip data', async () => {
  const { fetchChangedTrip } = await import('../src/features/trips/trip-polling.js');
  let details = 0;
  const getDetail = async () => { details++; return { data: { revision: 3 } }; };
  const unchanged = await fetchChangedTrip(async () => ({ data: { revision: 2 }, pollAfterMs: 0 }), getDetail, 2);
  assert.deepEqual(unchanged, { data: null, pollAfterMs: 0 });
  assert.equal(details, 0);
  const changed = await fetchChangedTrip(async () => ({ data: { revision: 3 }, pollAfterMs: 0 }), getDetail, 2);
  assert.deepEqual(changed, { data: { revision: 3 }, pollAfterMs: 0 });
  let scheduledDelay;
  const poller = createTripPoller({ load: async () => unchanged, apply: () => {}, onState: () => {}, schedule: (_callback, ms) => { scheduledDelay = ms; }, cancel: () => {} });
  poller.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scheduledDelay, 0);
  poller.stop();
});
