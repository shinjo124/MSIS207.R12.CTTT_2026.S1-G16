import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel, formatDate, formatDayHeading, formatMoney } from './trip-format.js';

export default function SharedTrip({ token }) {
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/share/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((result) => {
        setTrip(result.data);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  }, [token]);

  if (status === 'loading') return <p role="status">Loading shared trip…</p>;
  if (status !== 'ready') return <p role="alert">This shared trip is unavailable.</p>;

  const days = Array.isArray(trip.days) ? trip.days : null;
  const dayCount = days?.length ?? trip.dayCount;

  return (
    <article className="shared-trip">
      <p className="eyebrow">A TRIPO SHARED TRIP</p>
      <h1>{trip.title}</h1>
      <p>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}{dayCount ? <> <span>·</span> {dayCount} {dayCount === 1 ? 'day' : 'days'}</> : null} <span>·</span> {trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}</p>
      <p className="shared-budget">Budget {formatMoney(trip.budget, trip.currencyCode)}</p>
      <h2>Destinations</h2>
      <ul>{trip.destinations.map((place) => (
        <li key={place.id}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`} target="_blank" rel="noreferrer">
            {place.name}, {place.country}
          </a>
        </li>
      ))}</ul>
      <h2>Itinerary</h2>
      {days ? <ol className="day-list">
        {days.map((day) => (
          <li key={day.date} className="day-card">
            <div className="day-heading">
              <h3><span>Day {day.dayNumber}</span> {formatDayHeading(day.date)}</h3>
            </div>
            {day.activities.length === 0
              ? <p className="day-empty">Nothing planned yet.</p>
              : <ul className="activity-list">
                  {day.activities.map((activity) => {
                    const place = [activity.address, activity.city].filter(Boolean).join(', ');
                    return (
                      <li key={activity.id} className="activity">
                        <span className="activity-time">{activity.time || '—'}</span>
                        <div className="activity-main">
                          <p className="activity-title">
                            <span className={`category-badge category-${activity.category}`}>{categoryLabel(activity.category)}</span>
                            <strong>{activity.title}</strong>
                          </p>
                          {place && <p className="activity-place">{place}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>}
          </li>
        ))}
      </ol> : <p className="day-empty">Itinerary is not available on this shared link yet.</p>}
      <p className="read-only-note">This is a read-only trip link.</p>
    </article>
  );
}
