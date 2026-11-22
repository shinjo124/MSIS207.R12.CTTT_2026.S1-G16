import test from 'node:test';
import assert from 'node:assert/strict';
import { apiLimitKey } from '../src/services/api-limit.js';

test('isolates authenticated users and API areas while keeping anonymous requests IP-based', () => {
  assert.equal(apiLimitKey({ userId: 'user-a', ip: '192.0.2.1', path: '/api/trips/1' }), 'user:user-a:trips');
  assert.notEqual(
    apiLimitKey({ userId: 'user-a', ip: '192.0.2.1', path: '/api/trips/1' }),
    apiLimitKey({ userId: 'user-b', ip: '192.0.2.1', path: '/api/trips/1' }),
  );
  assert.notEqual(
    apiLimitKey({ userId: 'user-a', ip: '192.0.2.1', path: '/api/trips/1' }),
    apiLimitKey({ userId: 'user-a', ip: '192.0.2.1', path: '/api/posts' }),
  );
  assert.equal(apiLimitKey({ userId: null, ip: '192.0.2.1', path: '/api/destinations' }), 'ip:192.0.2.1:destinations');
});
