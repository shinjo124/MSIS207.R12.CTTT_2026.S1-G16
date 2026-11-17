export function tripSyncKey(userId, ip) {
  return userId ? `user:${userId}` : `ip:${ip}`;
}

export function isTripSyncRequest(req) {
  return req.method === 'GET' && /^\/trips\/[1-9]\d*(?:\/version)?$/.test(req.path) && req.query?.sync === '1';
}
