// Ably wraps our payload: { name, data } where data may arrive as an object or a JSON string.
export function readAblyEvent(raw) {
  try {
    const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
    let data = message?.data;
    if (typeof data === 'string') data = JSON.parse(data);
    const conversationId = Number(data?.conversationId);
    return Number.isSafeInteger(conversationId) && conversationId > 0 ? { conversationId, messageId: Number(data.messageId) || null } : null;
  } catch {
    return null;
  }
}

