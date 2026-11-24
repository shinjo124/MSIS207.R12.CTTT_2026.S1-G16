export const minutesOfDay = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Drag and resize work in 15-minute increments, with bounds enforced by the helpers below.
const snap = (value) => Math.round(value / 15) * 15;
export function shiftedTime(time, delta) {
  const minutes = Math.max(0, Math.min(1425, snap(minutesOfDay(time) + delta)));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function calendarDrop(activity, date, delta) {
  return { date: date || activity.date, time: date ? shiftedTime(activity.time, delta) : activity.time };
}
export function resizedDuration(time, duration, delta) {
  return Math.min(1440 - minutesOfDay(time), Math.max(15, snap(duration + delta)));
}
// Group overlapping events and reuse a lane once its previous event ends.
export function calendarLanes(activities) {
  const layout = new Map();
  let group = [], ends = [], groupEnd = -1;
  function finishGroup() {
    for (const item of group) layout.set(item.id, { lane: item.lane, columns: ends.length });
    group = []; ends = []; groupEnd = -1;
  }
  for (const activity of [...activities].sort((a, b) => a.time.localeCompare(b.time))) {
    const start = minutesOfDay(activity.time);
    if (start >= groupEnd) finishGroup();
    const end = start + (activity.durationMinutes || 60);
    let lane = ends.findIndex((value) => value <= start);
    if (lane === -1) lane = ends.length;
    ends[lane] = end;
    groupEnd = Math.max(groupEnd, end);
    group.push({ id: activity.id, lane });
  }
  finishGroup();
  return layout;
}

// A forecast date is only comparable when the trip and weather location use the same time zone.
export function calendarWeather(weather, timeZone, date) {
  if (weather?.status !== 'available' || !timeZone || weather.location?.timeZone !== timeZone) return null;
  return weather.forecast?.find((item) => item.date === date) || null;
}

const clock = (minutes) => minutes >= 1440 ? '24:00' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export function timeRange(time, duration) {
  const start = minutesOfDay(time);
  return `${clock(start)}–${clock(Math.min(1440, start + duration))}`;
}
