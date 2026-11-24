export function tripSyncKey(userId, ip) {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

// Only marked reads for one trip can use the polling allowance.
export function isTripSyncRequest(req) {
  return req.method === 'GET' && /^\/trips\/[1-9]\d*(?:\/version)?$/.test(req.path) && req.query?.sync === '1';
}
