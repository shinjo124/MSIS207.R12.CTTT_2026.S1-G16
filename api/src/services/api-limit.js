export function apiLimitKey({ userId, ip, path }) {
  const apiPath = String(path || '').split('?')[0].replace(/^\/api\/?/, '');
  const endpoint = apiPath.split('/').filter(Boolean)[0] || 'root';
  return `${userId ? `user:${userId}` : `ip:${ip}`}:${endpoint}`;
}
