import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import posts from '../src/routes/posts.js';
import { pool } from '../src/db/pool.js';

test('public feed and comments return all pages and exclude private posts', async (t) => {
  delete process.env.CLERK_SECRET_KEY; // Test process serves anonymous requests.
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE users (id, clerk_user_id, display_name);
    CREATE TABLE posts (id INTEGER, body, created_at, trip_id, place_id, author_user_id, visibility);
    CREATE TABLE post_likes (post_id, user_id);
    CREATE TABLE post_comments (id INTEGER, post_id INTEGER, body, created_at, author_user_id);
    CREATE TABLE post_photos (id, post_id, image_url, alt_text, sort_order);
    INSERT INTO users VALUES (1, 'a', 'Test');
    INSERT INTO posts VALUES (1,'older',1,NULL,NULL,1,'public'),(2,'newer',2,NULL,NULL,1,'public'),(3,'private',3,NULL,NULL,1,'private');
    INSERT INTO post_comments VALUES (1,1,'first',1,1),(2,1,'second',2,1);
    INSERT INTO post_likes VALUES (1,1);
  `);
  const calls = t.mock.method(pool, 'execute', async (sql, args) => [db.prepare(sql).all(...args)]);
  const app = express();
  app.use('/posts', posts);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const get = async (suffix) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/posts${suffix}`);
    assert.equal(res.status, 200);
    return res.json();
  };
  const first = await get('?limit=1');
  assert.deepEqual(first.data.map((p) => p.id), [2]);
  assert.equal(first.hasMore, true);
  assert.equal(calls.mock.callCount(), 2);
  const last = await get('?page=2&limit=1');
  assert.equal(last.hasMore, false);
  assert.deepEqual(last.data.map((p) => [p.id, p.liked, p.likesCount]), [[1, false, 1]]);
  const comments = await get('/1/comments?limit=1');
  assert.deepEqual(comments.data.map((c) => c.body), ['first']);
  assert.equal(comments.nextOffset, 1);
  const more = await get('/1/comments?limit=1&offset=1');
  assert.deepEqual(more.data.map((c) => c.body), ['second']);
  assert.equal(more.nextOffset, null);
});
