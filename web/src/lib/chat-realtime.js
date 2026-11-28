// Instant chat updates through Ably Server-Sent Events, without the Ably SDK.
// The API gives a short-lived token that can only listen on the signed-in user's channel.
// If Ably is not set up (or fails), `isRealtime()` stays false and pages fall back to polling.
import { apiRequest } from './api.js';
import { readAblyEvent } from './chat-events.js';

const ABLY_SSE = 'https://main.realtime.ably.net/event-stream';
const listeners = new Set();
let source = null;
let started = false;
let realtime = false;
let retryMs = 5000;
let timer = null;
let tokenGetter = null;

export function isRealtime() { return realtime; }

export function onChatEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Lets pages tell each other (for example the unread badge) that something changed locally.
export function emitLocalChatEvent(event) { emit(event); }

function emit(event) { listeners.forEach((listener) => { try { listener(event); } catch { /* keep others */ } }); }

function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(connect, ms);
}

async function connect() {
  if (!tokenGetter || typeof window === 'undefined' || !window.EventSource) return;
  source?.close();
  source = null;
  try {
    const { data } = await apiRequest('/chat/realtime-token', { getToken: tokenGetter });
    if (!data?.enabled) { realtime = false; emit({ type: 'mode' }); return; }
    const url = `${ABLY_SSE}?${new URLSearchParams({ channels: data.channel, v: '1.2', accessToken: data.token })}`;
    source = new EventSource(url);
    source.onopen = () => { realtime = true; retryMs = 5000; emit({ type: 'mode' }); };
    source.onmessage = (event) => { const parsed = readAblyEvent(event.data); if (parsed) emit({ type: 'message', ...parsed }); };
    source.onerror = () => {
      // Expired tokens cannot reconnect on their own: close, fetch a new token, try again later.
      realtime = false; emit({ type: 'mode' });
      source?.close(); source = null;
      schedule(retryMs); retryMs = Math.min(retryMs * 2, 60000);
    };
    // Refresh a little before the token expires.
    if (data.expires) schedule(Math.max(60000, Number(data.expires) - Date.now() - 120000));
  } catch {
    realtime = false; emit({ type: 'mode' });
    schedule(retryMs); retryMs = Math.min(retryMs * 2, 60000);
  }
}

export function startChatRealtime(getToken) {
  tokenGetter = getToken;
  if (started) return;
  started = true;
  connect();
}

export function stopChatRealtime() {
  started = false; tokenGetter = null; realtime = false;
  clearTimeout(timer); source?.close(); source = null;
}
