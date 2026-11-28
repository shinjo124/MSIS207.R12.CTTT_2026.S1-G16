// Pure rules for user-to-user chat.
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

// One conversation per pair of users, whatever the order.
export function directKey(a, b) {
  const [low, high] = [Number(a), Number(b)].sort((x, y) => x - y);
  return `${low}:${high}`;
}

export function validateMessageBody(value) {
  if (typeof value !== 'string') return null;
  const body = value.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!body || body.length > MAX_CHAT_MESSAGE_LENGTH) return null;
  return body;
}

// Each user listens on their own channel; the server publishes "something changed in conversation X".
export const userChannel = (userId) => `tripo-chat:user-${Number(userId)}`;

export function tokenCapability(userId) {
  return JSON.stringify({ [userChannel(userId)]: ['subscribe'] });
}

export function messagePreview(body, max = 80) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Tripo usernames: 3–20 characters, a–z, 0–9, dot or underscore; no dot or underscore at either end,
// no two in a row. "@kiet.tran" and "Kiet.Tran" both become "kiet.tran".
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9]|[._](?=[a-z0-9])){2,19}$/;
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'tripo', 'tribot', 'support', 'help', 'system', 'root', 'api', 'www', 'moderator', 'mod']);

export function normalizeUsername(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^@+/, '').toLowerCase();
}

// The normalized username, or null when it breaks the rules or is reserved.
export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) return null;
  return username;
}

// What the people search matches: the text without a leading "@", LIKE-escaped.
export function searchPattern(value) {
  const text = normalizeUsername(value);
  return { text, like: `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, prefix: `${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%` };
}
