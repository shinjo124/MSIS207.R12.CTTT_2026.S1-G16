import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel, formatDate, formatDayHeading, formatTripTitle, timeZoneLabel, withDefaultTimeZone } from './trip-format.js';
import './trips.css';

export default function SharedTrip({ token }) {
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');
  const [view, setView] = useState('calendar');

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/share/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((result) => {
        setTrip(withDefaultTimeZone(result.data));
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });
    return () => controller.abort();
  }, [token]);

  if (status === 'loading') return <p className="shared-state" role="status">Loading shared trip…</p>;
  if (status !== 'ready') return <section className="shared-state" aria-labelledby="share-unavailable-title">
    <p className="eyebrow">SHARED ITINERARY</p>
    <h1 id="share-unavailable-title">This trip link is unavailable.</h1>
    <p>It may have been revoked or replaced by its owner.</p>
    <a className="primary-button" href="/">Explore Tripo</a>
  </section>;

  const days = Array.isArray(trip.days) ? trip.days : null;
  const dayCount = days?.length ?? trip.dayCount;

  return (
    <article className="shared-trip">
      <p className="eyebrow">A TRIPO SHARED TRIP</p>
      <h1>{formatTripTitle(trip.title)}</h1>
      <p>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}{dayCount ? <> <span>·</span> {dayCount} {dayCount === 1 ? 'day' : 'days'}</> : null} <span>·</span> {trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'} <span>·</span> {timeZoneLabel(trip.timeZone)}</p>
      <h2>Destinations</h2>
      <ul>{trip.destinations.map((place) => (
        <li key={place.id}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`} target="_blank" rel="noreferrer">
            {place.name}, {place.country}
          </a>
        </li>
      ))}</ul>
      <nav className="shared-trip-views" aria-label="Trip views">
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
        <button type="button" aria-pressed={view === 'day-board'} onClick={() => setView('day-board')}>Day board</button>
      </nav>
      {days ? <ol className="day-list">
        {view === 'day-board' && days.map((day) => (
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
                            <span className={`category-badge category-${activity.category}`}>{categoryLabel(activity.category)}:</span>
                            <strong>{activity.title}</strong>
                          </p>
                          {activity.durationMinutes != null && <p className="activity-place">Duration: {activity.durationMinutes} min</p>}
                          {place && <p className="activity-place">{place}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>}
          </li>
        ))}
      </ol> : null}
      {days && view === 'calendar' && <div className="shared-calendar" aria-label="Read-only trip calendar">
        {days.map((day) => <section className="shared-calendar-day" key={day.date}>
          <h2><span>Day {day.dayNumber}</span>{formatDayHeading(day.date)}</h2>
          {day.activities.length ? <ul>{day.activities.map((activity) => <li key={activity.id}><time>{activity.time || '—'}</time><strong>{formatTripTitle(activity.title)}</strong>{activity.durationMinutes != null && <span>{activity.durationMinutes} min</span>}</li>)}</ul> : <p>Nothing planned yet.</p>}
        </section>)}
      </div>}
      {!days && <p className="day-empty">Calendar and day board are not available on this shared link yet.</p>}
      <p className="read-only-note">This is a read-only trip link.</p>
    </article>
  );
}
