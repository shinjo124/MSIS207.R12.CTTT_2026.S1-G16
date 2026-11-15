import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import express from 'express';
import { pool } from '../src/db/pool.js';

test('an owner can create, edit and delete with one connection; another fixture user cannot read or edit', async (t) => {
  let viewer = 'alice';
  process.env.CLERK_SECRET_KEY = 'fixture';
  t.mock.module('@clerk/express', { namedExports: { getAuth: () => ({ userId: viewer, isAuthenticated: true }) } });
  const { default: trips } = await import('../src/routes/trips.js');
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.function('DATE_FORMAT', (value, _format) => value);
  db.function('TIME_FORMAT', (value, _format) => value);
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, clerk_user_id TEXT);
    INSERT INTO users VALUES (1,'alice'),(2,'bob');
    CREATE TABLE trips (id INTEGER PRIMARY KEY, title, start_date, end_date, group_size, budget, currency_code, owner_user_id, share_enabled, created_at, updated_at);
    CREATE TABLE destinations (id INTEGER PRIMARY KEY, local_name, name, country, region, map_query);
    INSERT INTO destinations(id, name) VALUES (1,'Hue');
    CREATE TABLE trip_destinations (trip_id, destination_id, destination_order);
    CREATE TABLE activities (id, trip_id, activity_date, start_time, category, title, city, address, planned_cost, actual_spend, note, visited);
    CREATE TABLE trip_photos (trip_id, cloudinary_public_id);
  `);
  const execute = async (sql, args) => {
    const stmt = db.prepare(sql.replace(/ FOR UPDATE$/, ''));
    if (sql.trimStart().startsWith('SELECT')) return [stmt.all(...args)];
    return [{ insertId: stmt.run(...args).lastInsertRowid }];
  };
  let held = false;
  t.mock.method(pool, 'execute', (...args) => {
    assert.equal(held, false, 'transaction tried to borrow a second connection');
    return execute(...args);
  });
  t.mock.method(pool, 'getConnection', async () => {
    assert.equal(held, false);
    held = true;
    return { execute, beginTransaction: () => db.exec('BEGIN'), commit: () => db.exec('COMMIT'),
      rollback: async () => db.exec('ROLLBACK'), release: () => { held = false; } };
  });
  const app = express();
  app.use(express.json(), trips);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = 'http://127.0.0.1:' + server.address().port;
  const values = { title: 'Initial', destinationIds: [1], startDate: '2026-11-15', endDate: '2026-11-16', groupSize: 2, currencyCode: 'VND', budget: '100' };
  const write = (path, method, title) => fetch(origin + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, title }) });
  const created = await write('/', 'POST', 'Initial');
  assert.equal(created.status, 201);
  const trip = (await created.json()).data;
  assert.equal(trip.destinations[0].name, 'Hue');
  assert.equal(trip.days.length, 2);
  const path = '/' + trip.id;
  viewer = 'bob';
  assert.equal((await fetch(origin + path)).status, 404);
  assert.equal((await write(path, 'PUT', 'Other')).status, 404);
  viewer = 'alice';
  assert.equal((await (await fetch(origin + path)).json()).data.title, 'Initial');
  const edited = await write(path, 'PUT', 'Updated');
  assert.equal((await edited.json()).data.title, 'Updated');
  assert.equal((await fetch(origin + path, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(origin + path)).status, 404);
  assert.equal(held, false);
});
