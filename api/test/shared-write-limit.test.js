import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import express from 'express';
import { pool } from '../src/db/pool.js';
import { sharedWriteLimit } from '../src/middleware/shared-write-limit.js';

// Separate middleware instances use one fixture database to model independent API processes.
test('write limits are shared between middleware instances and reset after the window', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  let now = 1000;
  db.function('UNIX_TIMESTAMP', () => now);
  db.exec('CREATE TABLE write_limits (scope TEXT, subject TEXT, window_start INTEGER, hits INTEGER, PRIMARY KEY (scope, subject))');
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => db.exec('BEGIN'),
    execute: async (sql, args) => {
      sql = sql.replace('ON DUPLICATE KEY UPDATE', 'ON CONFLICT(scope, subject) DO UPDATE SET').replace(/ FOR UPDATE$/, '');
      const statement = db.prepare(sql);
      return sql.startsWith('SELECT') ? [statement.all(...args)] : [statement.run(...args)];
    },
    commit: async () => db.exec('COMMIT'),
    rollback: async () => db.exec('ROLLBACK'),
    release: () => {},
  }));
  const a = sharedWriteLimit('post', 2, 3);
  const b = sharedWriteLimit('post', 2, 3);
  const request = async (middleware, userId) => {
    const result = { status: 200 };
    await middleware({ userId }, { status(code) { result.status = code; return this; }, json(body) { result.body = body; } }, (error) => { if (error) throw error; });
    return result.status;
  };
  assert.equal(await request(a, 1), 200);
  assert.equal(await request(b, 1), 200);
  assert.equal(await request(a, 1), 429);
  assert.equal(await request(b, 2), 200);
  assert.equal(await request(a, 3), 429);
  now += 901;
  assert.equal(await request(b, 1), 200);
});

test('write limiter fails closed when the shared database is unavailable', async (t) => {
  t.mock.method(pool, 'getConnection', async () => { throw new Error('database unavailable'); });
  let passed = false;
  let failure;
  await sharedWriteLimit('post', 15, 100)({ userId: 1 }, {}, (error) => { if (error) failure = error; else passed = true; });
  assert.equal(passed, false);
  assert.equal(failure?.message, 'database unavailable');
});

test('post routes enforce shared write and upload limits', async (t) => {
  const previous = process.env.CLERK_SECRET_KEY;
  process.env.CLERK_SECRET_KEY = 'fixture';
  t.after(() => { if (previous === undefined) delete process.env.CLERK_SECRET_KEY; else process.env.CLERK_SECRET_KEY = previous; });
  t.mock.module('@clerk/express', { namedExports: { getAuth: () => ({ userId: 'fixture', isAuthenticated: true }) } });
  const { default: posts } = await import('../src/routes/posts.js');
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.function('UNIX_TIMESTAMP', () => 1000);
  db.exec('CREATE TABLE write_limits (scope TEXT, subject TEXT, window_start INTEGER, hits INTEGER, PRIMARY KEY (scope, subject))');
  t.mock.method(pool, 'execute', async () => [[{ id: 1 }]]);
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => db.exec('BEGIN'),
    execute: async (sql, args) => {
      sql = sql.replace('ON DUPLICATE KEY UPDATE', 'ON CONFLICT(scope, subject) DO UPDATE SET').replace(/ FOR UPDATE$/, '');
      const statement = db.prepare(sql);
      return sql.startsWith('SELECT') ? [statement.all(...args)] : [statement.run(...args)];
    },
    commit: async () => db.exec('COMMIT'), rollback: async () => db.exec('ROLLBACK'), release: () => {},
  }));
  const app = express();
  app.use(express.json());
  app.use('/posts', posts);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin + '/posts', { method: 'POST', body: new FormData() })).status, 400);
  for (let i = 0; i < 9; i++) {
    assert.equal((await fetch(origin + '/posts', { method: 'POST', body: new FormData() })).status, 400);
  }
  assert.equal((await fetch(origin + '/posts', { method: 'POST', body: new FormData() })).status, 429);
  for (let i = 0; i < 5; i++) {
    const response = await fetch(origin + '/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, i < 4 ? 400 : 429);
  }
});
