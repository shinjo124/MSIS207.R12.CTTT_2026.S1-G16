import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftedTime, resizedDuration, calendarLanes, calendarDrop, calendarWeather, timeRange } from '../src/features/trips/calendar-math.js';

test('moving across days changes both date and time', () => {
  assert.deepEqual(calendarDrop({ date: '2026-01-01', time: '09:00' }, '2026-01-02', 75), { date: '2026-01-02', time: '10:15' });
});

test('dropping outside a calendar date preserves the original schedule', () => {
  const activity = { date: '2026-01-01', time: '09:00' };
  assert.deepEqual(calendarDrop(activity, undefined, 75), { date: '2026-01-01', time: '09:00' });
});

test('moving snaps to quarter hours and stays within a day', () => {
  assert.equal(shiftedTime('09:00', 16), '09:15');
  assert.equal(shiftedTime('00:00', -30), '00:00');
  assert.equal(shiftedTime('23:45', 30), '23:45');
});

test('resizing keeps duration within calendar bounds', () => {
  assert.equal(resizedDuration('09:00', 60, -80), 15);
  assert.equal(resizedDuration('23:00', 60, 60), 60);
  assert.equal(resizedDuration('23:59', 60, 0), 1);
  assert.equal(resizedDuration('09:00', 60, 17), 75);
});

// A chain of time overlaps should keep a stable lane count across the whole group.
test('overlapping events keep separate lanes even across chained overlaps', () => {
  const layout = calendarLanes([
    { id: 1, time: '09:00', durationMinutes: 90 },
    { id: 2, time: '09:30', durationMinutes: 30 },
    { id: 3, time: '10:15', durationMinutes: 30 },
  ]);
  assert.notEqual(layout.get(1).lane, layout.get(2).lane);
  assert.notEqual(layout.get(1).lane, layout.get(3).lane);
  assert.equal(layout.get(1).columns, 2);
});
test('calendar weather follows the event date and only uses matching, available forecasts', () => {
  const weather = { status: 'available', location: { timeZone: 'Asia/Ho_Chi_Minh', destinationName: 'Hoi An' }, forecast: [{ date: '2026-11-18', description: 'clear sky', temperature: 25 }, { date: '2026-11-19', description: 'light rain', temperature: 23 }] };
  assert.equal(calendarWeather(weather, 'Asia/Ho_Chi_Minh', '2026-11-19').description, 'light rain');
  assert.equal(calendarWeather(weather, 'Asia/Ho_Chi_Minh', '2026-11-20'), null);
  assert.equal(calendarWeather(weather, 'Asia/Tokyo', '2026-11-19'), null);
  assert.equal(calendarWeather({ ...weather, status: 'missing-location' }, 'Asia/Ho_Chi_Minh', '2026-11-19'), null);
});

test('time range shows the end time and stops at midnight', () => {
  assert.equal(timeRange('09:00', 75), '09:00–10:15');
  assert.equal(timeRange('23:30', 120), '23:30–24:00');
});
