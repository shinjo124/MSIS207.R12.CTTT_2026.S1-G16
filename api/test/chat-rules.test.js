import test from 'node:test';
import assert from 'node:assert/strict';
import { directKey, messagePreview, tokenCapability, userChannel, validateMessageBody } from '../src/services/chat-rules.js';
import { createAblyClient, parseAblyKey } from '../src/services/ably.js';

test('a pair of users always maps to the same direct conversation', () => {
  assert.equal(directKey(7, 3), '3:7');
  assert.equal(directKey('3', 7), '3:7');
});

test('message bodies are trimmed and limited', () => {
  assert.equal(validateMessageBody('  Chào cả nhóm!  '), 'Chào cả nhóm!');
  assert.equal(validateMessageBody('dòng 1 \r\ndòng 2'), 'dòng 1\ndòng 2');
  assert.equal(validateMessageBody('   '), null);
  assert.equal(validateMessageBody('x'.repeat(2001)), null);
  assert.equal(validateMessageBody(5), null);
});

test('tokens only allow listening on the user own channel', () => {
  assert.equal(userChannel(12), 'tripo-chat:user-12');
  assert.deepEqual(JSON.parse(tokenCapability(12)), { 'tripo-chat:user-12': ['subscribe'] });
  assert.equal(messagePreview('a '.repeat(100), 10).length, 10);
});

test('Ably client sends basic auth and the token request body', async () => {
  assert.deepEqual(parseAblyKey('app.key:secret'), { keyName: 'app.key', secret: 'secret', full: 'app.key:secret' });
  assert.equal(parseAblyKey('nocolon'), null);
  const calls = [];
  const client = createAblyClient({ fetchImpl: async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ token: 't', expires: 1 }) }; } });
  await client.requestToken('app.key:secret', { clientId: 'user-1', capability: tokenCapability(1) });
  await client.publish('app.key:secret', userChannel(1), 'conversation', { conversationId: 5 });
  assert.equal(calls[0].url, 'https://main.realtime.ably.net/keys/app.key/requestToken');
  assert.equal(calls[0].options.headers.Authorization, `Basic ${Buffer.from('app.key:secret').toString('base64')}`);
  assert.equal(calls[0].body.clientId, 'user-1');
  assert.equal(typeof calls[0].body.timestamp, 'number');
  assert.equal(calls[1].url, 'https://main.realtime.ably.net/channels/tripo-chat%3Auser-1/messages');
  assert.deepEqual(calls[1].body, { name: 'conversation', data: { conversationId: 5 } });
});
