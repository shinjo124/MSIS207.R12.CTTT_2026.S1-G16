import test from 'node:test';
import assert from 'node:assert/strict';
import { readAblyEvent } from '../src/lib/chat-events.js';

test('reads the conversation from an Ably SSE message', () => {
  assert.deepEqual(readAblyEvent(JSON.stringify({ name: 'conversation', data: { conversationId: 5, messageId: 9 } })), { conversationId: 5, messageId: 9 });
  assert.deepEqual(readAblyEvent(JSON.stringify({ name: 'conversation', data: JSON.stringify({ conversationId: 5 }), encoding: 'json' })), { conversationId: 5, messageId: null });
  assert.equal(readAblyEvent('not json'), null);
  assert.equal(readAblyEvent(JSON.stringify({ data: { conversationId: 'x' } })), null);
});
