import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoney, formatTripTitle } from '../src/features/trips/trip-format.js';

test('places the currency unit after the amount', () => {
  assert.equal(formatMoney('5000000', 'VND'), '5,000,000 ₫');
});

test('normalizes Vietnamese trip titles and removes spaces before punctuation', () => {
  assert.equal(formatTripTitle('Vu\u0303ng Ta\u0300u cuo\u0302\u0301i tua\u0302\u0300n , bie\u0302\u0309n va\u0300 ha\u0309i sa\u0309n'), 'Vũng Tàu cuối tuần, biển và hải sản');
});
