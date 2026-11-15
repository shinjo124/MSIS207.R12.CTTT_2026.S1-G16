import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { syncProfile } from '../src/services/profiles.js';

test('an email conflict never changes the other Clerk profile', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, clerk_user_id TEXT UNIQUE, email TEXT UNIQUE, display_name TEXT)');
  const adapter = { async execute(sql, args) {
    const stmt = db.prepare(sql);
    if (sql.trimStart().startsWith('SELECT')) return [stmt.all(...args)];
    try { return [stmt.run(...args)]; }
    catch (error) { if (error.errcode === 2067) error.code = 'ER_DUP_ENTRY'; throw error; }
  } };
  try {
    const first = await syncProfile('a', 'first@example.test', 'First', adapter);
    await assert.rejects(syncProfile('b', 'first@example.test', 'Other', adapter), { code: 'ER_DUP_ENTRY' });
    assert.equal(db.prepare('SELECT display_name FROM users').get().display_name, 'First');
    await syncProfile('b', 'second@example.test', 'Second', adapter);
    await assert.rejects(syncProfile('a', 'second@example.test', 'Changed', adapter), { code: 'ER_DUP_ENTRY' });
    const updated = await syncProfile('a', 'new@example.test', 'Updated', adapter);
    assert.equal(updated.id, first.id);
    assert.equal(updated.displayName, 'Updated');
  } finally { db.close(); }
});
