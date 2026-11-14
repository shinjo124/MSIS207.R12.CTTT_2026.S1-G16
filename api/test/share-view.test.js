import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharedTripView } from '../src/services/share-view.js';

test('builds inclusive days and groups public activities by date', () => {
  const trip = {
    id: 7,
    title: 'Da Lat',
    startDate: '2026-11-14',
    endDate: '2026-11-16',
    budget: '100.00',
    currencyCode: 'VND',
  };
  const activities = [
    { id: 3, date: '2026-11-15', time: null, category: 'food_drink', title: 'Market', city: null, address: null, note: 'private note' },
    { id: 2, date: '2026-11-14', time: '09:00', category: 'sightseeing', title: 'Lake', city: null, address: null, actualSpend: '50.00', visited: true },
  ];

  assert.deepEqual(buildSharedTripView(trip, [{ id: 1, name: 'Da Lat' }], activities), {
    ...trip,
    destinations: [{ id: 1, name: 'Da Lat' }],
    days: [
      { dayNumber: 1, date: '2026-11-14', activities: [{ id: 2, date: '2026-11-14', time: '09:00', category: 'sightseeing', title: 'Lake', city: null, address: null }] },
      { dayNumber: 2, date: '2026-11-15', activities: [{ id: 3, date: '2026-11-15', time: null, category: 'food_drink', title: 'Market', city: null, address: null }] },
      { dayNumber: 3, date: '2026-11-16', activities: [] },
    ],
  });
});
