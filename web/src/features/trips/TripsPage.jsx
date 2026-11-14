import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ProfileGate from './ProfileGate.jsx';
import TripForm from './TripForm.jsx';
import { formatDate, formatMoney } from './trip-format.js';
import './trips.css';

export default function TripsPage({ getToken, isSignedIn, profileStatus, profileError }) {
  const [trips, setTrips] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(() => new URLSearchParams(window.location.search).has('new'));
  const ready = isSignedIn && profileStatus === 'ready';

  const loadTrips = useCallback(async (signal) => {
    setStatus('loading');
    setError('');
    try {
      const result = await apiRequest('/trips', { getToken, signal });
      setTrips(result.data);
      setStatus(result.data.length ? 'ready' : 'empty');
    } catch (loadError) {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setStatus('error');
    }
  }, [getToken]);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    loadTrips(controller.signal);
    return () => controller.abort();
  }, [ready, loadTrips]);

  async function createTrip(values) {
    const result = await apiRequest('/trips', { method: 'POST', body: values, getToken });
    window.location.assign(`/trips/${result.data.id}`);
  }

  return (
    <section className="trips-page" aria-labelledby="trips-title">
      <div className="section-heading">
        <div><p className="eyebrow">YOUR PLANS</p><h1 id="trips-title">My trips</h1></div>
        {ready && !showForm && <button className="primary-button" type="button" onClick={() => setShowForm(true)}>New trip</button>}
      </div>

      <ProfileGate isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} action="plan a trip">
        {showForm && <div className="panel">
          <h2>Plan a new trip</h2>
          <TripForm submitLabel="Create trip" onSubmit={createTrip} onCancel={() => setShowForm(false)} />
        </div>}

        {status === 'loading' && <p className="empty-state" role="status">Loading your trips…</p>}
        {status === 'error' && <p className="empty-state error-state" role="alert">
          {error} <button className="text-button" type="button" onClick={() => loadTrips()}>Try again</button>
        </p>}
        {status === 'empty' && !showForm && <div className="panel empty-panel">
          <p>You have not planned any trips yet.</p>
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}>Plan your first trip</button>
        </div>}
        {status === 'ready' && <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <a className="trip-card" href={`/trips/${trip.id}`}>
                <span className="trip-card-days">{trip.dayCount}<small>{trip.dayCount === 1 ? 'day' : 'days'}</small></span>
                <span className="trip-card-body">
                  <strong>{trip.title}</strong>
                  <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}</span>
                  <span>{trip.destinations.map((destination) => destination.name).join(' → ') || 'No destinations'}</span>
                </span>
                <span className="trip-card-budget">{formatMoney(trip.budget, trip.currencyCode)}<small>budget</small></span>
              </a>
            </li>
          ))}
        </ul>}
      </ProfileGate>
    </section>
  );
}
