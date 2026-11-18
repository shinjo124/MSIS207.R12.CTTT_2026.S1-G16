import test from 'node:test';
import assert from 'node:assert/strict';
import { todayInTimeZone, calendarStartDate } from '../src/features/trips/trip-format.js';

test('resolves today at the destination rather than the device, including DST', () => {
  const instant = new Date('2026-03-08T07:30:00Z');
  assert.equal(todayInTimeZone('America/Los_Angeles', instant), '2026-03-07');
  assert.equal(todayInTimeZone('Asia/Ho_Chi_Minh', instant), '2026-03-08');
  assert.equal(todayInTimeZone(null, instant), null);
  assert.equal(todayInTimeZone('Invalid/Zone', instant), null);
});

test('calendar starts at today only when destination time zone places today in the trip', () => {
  const trip = { startDate: '2026-03-07', endDate: '2026-03-10', timeZone: 'America/Los_Angeles' };
  assert.equal(calendarStartDate(trip, new Date('2026-03-09T06:00:00Z')), '2026-03-08');
  assert.equal(calendarStartDate({ ...trip, timeZone: null }, new Date()), trip.startDate);
});

test('selects the current trip using each trip time zone without guessing missing zones', async () => {
  const { selectDashboardTripForZones } = await import('../src/features/dashboard/dashboard-data.js');
  const trips = [
    { id: 1, startDate: '2026-03-08', endDate: '2026-03-08', timeZone: null },
    { id: 2, startDate: '2026-03-07', endDate: '2026-03-07', timeZone: 'America/Los_Angeles' },
    { id: 3, startDate: '2026-03-09', endDate: '2026-03-10', timeZone: 'Asia/Ho_Chi_Minh' },
  ];
  assert.equal(selectDashboardTripForZones(trips, new Date('2026-03-08T07:30:00Z')).id, 2);
  assert.equal(selectDashboardTripForZones([trips[0]], new Date('2026-03-08T07:30:00Z')).id, 1);
});

test('weather dates require an explicitly matching trip time zone', async () => {
  const { canCompareWeatherDate } = await import('../src/features/trips/trip-format.js');
  assert.equal(canCompareWeatherDate('Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh'), true);
  assert.equal(canCompareWeatherDate(null, 'Asia/Ho_Chi_Minh'), false);
  assert.equal(canCompareWeatherDate('America/New_York', 'Asia/Ho_Chi_Minh'), false);
});
