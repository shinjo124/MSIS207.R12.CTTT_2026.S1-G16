import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { pool } from '../src/db/pool.js';
import { isTripSyncRequest, tripSyncKey } from '../src/services/trip-sync-limit.js';

test('authenticated viewers on one IP have separate sync limits', () => {
  assert.notEqual(tripSyncKey('user-a', '192.0.2.1'), tripSyncKey('user-b', '192.0.2.1'));
  assert.equal(tripSyncKey('user-a', '192.0.2.1'), tripSyncKey('user-a', '192.0.2.2'));
  assert.equal(tripSyncKey(null, '192.0.2.1'), tripSyncKey(null, '192.0.2.1'));
  assert.notEqual(tripSyncKey(null, '192.0.2.1'), tripSyncKey(null, '192.0.2.2'));
});

test('only explicitly marked single-trip GETs use the sync limiter', () => {
  assert.equal(isTripSyncRequest({ method: 'GET', path: '/trips/42', query: { sync: '1' } }), true);
  assert.equal(isTripSyncRequest({ method: 'GET', path: '/trips/42/version', query: { sync: '1' } }), true);
  assert.equal(isTripSyncRequest({ method: 'PUT', path: '/trips/42', query: { sync: '1' } }), false);
  assert.equal(isTripSyncRequest({ method: 'GET', path: '/trips/42/share', query: { sync: '1' } }), false);
  assert.equal(isTripSyncRequest({ method: 'GET', path: '/trips/42', query: {} }), false);
  assert.equal(isTripSyncRequest({ method: 'GET', path: '/trips/42', query: { sync: ['1', '1'] } }), false);
});

test('Express sync limit separates authenticated users on the same IP', async (t) => {
  const previous = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'fixture';
  t.after(() => { if (previous === undefined) delete process.env.CLERK_SECRET_KEY; else process.env.CLERK_SECRET_KEY = previous; });
  t.mock.module('@clerk/express', { exports: {
    clerkMiddleware: () => (_req, _res, next) => next(),
    getAuth: (req) => ({ userId: req.headers['x-test-user'], isAuthenticated: Boolean(req.headers['x-test-user']) }),
    clerkClient: {},
  } });
  t.mock.method(pool, 'execute', async () => [[{ id: 1 }]]);
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/api/trips/42/version?sync=1&wait=invalid`;
  const request = (user) => fetch(url, { headers: { 'x-test-user': user } });
  for (let i = 0; i < 600; i++) assert.equal((await request('user-a')).status, 400);
  assert.equal((await request('user-a')).status, 429);
  assert.equal((await request('user-b')).status, 400);
});
