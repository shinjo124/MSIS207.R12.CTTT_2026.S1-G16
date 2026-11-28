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
