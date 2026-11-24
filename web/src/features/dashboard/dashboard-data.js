import { todayInTimeZone } from '../trips/trip-format.js';

export function upcomingActivities(days, today) {
  return days.filter((day) => day.date >= today)
    .flatMap((day) => day.activities.map((activity) => ({ ...activity, date: day.date })))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99'));
}

export function budgetBalance(summary) {
  return Number(summary.overBudget) > 0
    ? { label: 'Over budget', amount: summary.overBudget }
    : { label: 'Remaining', amount: summary.remainingBudget };
}

// Check each trip against its own local date. Prefer a current trip, then the next upcoming one.
export function selectDashboardTripForZones(trips, now = new Date()) {
  const dated = trips.map((trip) => ({ trip, today: todayInTimeZone(trip.timeZone, now) })).filter((item) => item.today);
  const current = dated.filter(({ trip, today }) => trip.startDate <= today && trip.endDate >= today).sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  const upcoming = dated.filter(({ trip, today }) => trip.startDate > today).sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  return current[0]?.trip || upcoming[0]?.trip || trips[0] || null;
}
