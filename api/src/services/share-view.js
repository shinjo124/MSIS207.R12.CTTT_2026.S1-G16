import { listDates } from './trip-rules.js';

// Group activities into inclusive itinerary days and copy only the activity fields safe to share.
export function buildSharedTripView(trip, destinations, activities) {
  const activitiesByDate = new Map();
  for (const activity of activities) {
    const items = activitiesByDate.get(activity.date) || [];
    const { id, date, time, durationMinutes, category, title, city, address } = activity;
    items.push({ id, date, time, durationMinutes, category, title, city, address });
    activitiesByDate.set(activity.date, items);
  }

  const days = listDates(trip.startDate, trip.endDate).map((date, index) => ({
    dayNumber: index + 1,
    date,
    activities: activitiesByDate.get(date) || [],
  }));

  return { ...trip, destinations, days };
}
