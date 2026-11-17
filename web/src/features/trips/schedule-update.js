export function updateSchedule(trip, id, values) {
  if (!trip) return trip;
  const activity = trip.days.flatMap((day) => day.activities).find((item) => item.id === id);
  if (!activity) return trip;
  const updated = { ...activity, ...values };
  if (!trip.days.some((day) => day.date === updated.date)) return trip;
  return { ...trip, days: trip.days.map((day) => {
    const activities = day.activities.filter((item) => item.id !== id);
    if (day.date === updated.date) activities.push(updated);
    activities.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.id - b.id);
    return { ...day, activities };
  }) };
}

export function createMutationLock(isOnline = () => globalThis.navigator?.onLine !== false) {
  let busy = false;
  return async (work) => {
    if (!isOnline()) throw new Error('A connection is required to save changes. Reconnect and try again.');
    if (busy) throw new Error('Please wait for another change to finish.');
    busy = true;
    try { return await work(); }
    finally { busy = false; }
  };
}
