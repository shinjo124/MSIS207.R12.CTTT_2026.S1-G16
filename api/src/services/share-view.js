import { listDates } from './trip-rules.js';

export function buildSharedTripView(trip, destinations, activities) {
  const activitiesByDate = new Map();
  for (const activity of activities) {
    const items = activitiesByDate.get(activity.date) || [];
    const { id, date, time, category, title, city, address } = activity;
    items.push({ id, date, time, category, title, city, address });
    activitiesByDate.set(activity.date, items);
  }

  const days = listDates(trip.startDate, trip.endDate).map((date, index) => ({
    dayNumber: index + 1,
    date,
    activities: activitiesByDate.get(date) || [],
  }));

  return { ...trip, destinations, days };
}
