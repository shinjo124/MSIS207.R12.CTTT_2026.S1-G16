// Minimal Ably REST client (no SDK): server-side token requests and publishes.
// The API key stays on the server; browsers get short-lived subscribe-only tokens.
const ABLY_HOST = 'https://main.realtime.ably.net';

export function parseAblyKey(key) {
  const match = /^([^:\s]+):([^\s]+)$/.exec(String(key || '').trim());
  return match ? { keyName: match[1], secret: match[2], full: `${match[1]}:${match[2]}` } : null;
}

export function createAblyClient({ fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const call = async (key, path, body) => {
    const parsed = parseAblyKey(key);
    if (!parsed) throw new Error('ABLY_API_KEY is not in the form name:secret.');
    const response = await fetchImpl(`${ABLY_HOST}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(parsed.full).toString('base64')}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* no JSON body */ }
      throw new Error(`Ably request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return response.json();
  };

  return {
    // TokenDetails { token, expires, ... } for one client, limited to `capability` (a JSON string).
    async requestToken(key, { clientId, capability, ttlMs = 60 * 60 * 1000 }) {
      const { keyName } = parseAblyKey(key) || {};
      return call(key, `/keys/${encodeURIComponent(keyName)}/requestToken`, { keyName, clientId, capability, ttl: ttlMs, timestamp: Date.now() });
    },
    publish(key, channel, name, data) {
      return call(key, `/channels/${encodeURIComponent(channel)}/messages`, { name, data });
    },
  };
}

export const ably = createAblyClient();
