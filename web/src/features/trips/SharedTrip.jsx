import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';

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

  return (
    <article className="shared-trip">
      <p className="eyebrow">A TRIPO SHARED TRIP</p>
      <h1>{trip.title}</h1>
      <p>{trip.startDate} – {trip.endDate} <span>·</span> {trip.groupSize} travelers</p>
      <p className="shared-budget">Budget {Number(trip.budget).toLocaleString()} {trip.currencyCode}</p>
      <h2>Destinations</h2>
      <ul>{trip.destinations.map((place) => (
        <li key={place.id}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`} target="_blank" rel="noreferrer">
            {place.name}, {place.country}
          </a>
        </li>
      ))}</ul>
      <p className="read-only-note">This is a read-only trip link.</p>
    </article>
  );
}
