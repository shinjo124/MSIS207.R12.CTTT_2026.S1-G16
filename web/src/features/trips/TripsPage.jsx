import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ProfileGate from './ProfileGate.jsx';
import TripForm from './TripForm.jsx';
import { formatDate, formatMoney, formatTripTitle } from './trip-format.js';
import './trips.css';
import { t } from '../../lib/i18n.js';

export default function TripsPage({ getToken, isSignedIn, profileStatus, profileError, active = true, search = window.location.search }) {
  const [trips, setTrips] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(() => new URLSearchParams(search).has('new'));
  const [suggestedDestination, setSuggestedDestination] = useState(null);
  const ready = isSignedIn && profileStatus === 'ready';

  const loadTrips = useCallback(async (signal) => {
    setStatus((current) => current === 'ready' || current === 'empty' ? current : 'loading');
    setError('');
    try {
      const result = await apiRequest('/trips', { getToken, signal });
      setTrips(result.data);
      setStatus(result.data.length ? 'ready' : 'empty');
    } catch (loadError) {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setStatus((current) => current === 'ready' || current === 'empty' ? current : 'error');
    }
  }, [getToken]);

  useEffect(() => {
    setShowForm(new URLSearchParams(search).has('new'));
  }, [search]);

  useEffect(() => {
    // An Explore link can prefill a catalog destination in the new-trip form.
    const destinationId = new URLSearchParams(search).get('destination');
    if (!destinationId) { setSuggestedDestination(null); return undefined; }
    const controller = new AbortController();
    apiRequest('/destinations?scope=all', { getToken, signal: controller.signal })
      .then((result) => setSuggestedDestination(result.data.find((destination) => String(destination.id) === destinationId) || null))
      .catch((error) => { if (error.name !== 'AbortError') setSuggestedDestination(null); });
    return () => controller.abort();
  }, [getToken, search]);

  useEffect(() => {
    if (!ready || !active) return undefined;
    const controller = new AbortController();
    loadTrips(controller.signal);
    return () => controller.abort();
  }, [active, ready, loadTrips]);

  // Navigate to the saved trip using the server's ID rather than constructing a draft route.
  async function createTrip(values) {
    const result = await apiRequest('/trips', { method: 'POST', body: values, getToken });
    window.history.pushState(null, '', `/trips/${result.data.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <section className="trips-page" aria-labelledby="trips-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t("YOUR PLANS")}</p><h1 id="trips-title">{t("My trips")}</h1></div>
        {ready && !showForm && <button className="primary-button" type="button" onClick={() => setShowForm(true)}>{t("New trip")}</button>}
      </div>

      <ProfileGate isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} action="plan a trip">
        {showForm && <div className="panel">
          <h2>{t("Plan a new trip")}</h2>
          <TripForm getToken={getToken} key={suggestedDestination?.id || 'new'} initialDestination={suggestedDestination} submitLabel={t("Create trip")} onSubmit={createTrip} onCancel={() => setShowForm(false)} />
        </div>}

        {status === 'loading' && <p className="empty-state" role="status">{t("Loading your trips…")}</p>}
        {status === 'error' && <p className="empty-state error-state" role="alert">
          {error} <button className="text-button" type="button" onClick={() => loadTrips()}>{t("Try again")}</button>
        </p>}
        {status === 'empty' && !showForm && <div className="panel empty-panel">
          <p>{t("You have not planned any trips yet.")}</p>
          <button className="primary-button" type="button" onClick={() => setShowForm(true)}>{t("Plan your first trip")}</button>
        </div>}
        {status === 'ready' && <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <a className="trip-card" href={`/trips/${trip.id}`}>
                <span className="trip-card-days">{trip.dayCount}<small>{trip.dayCount === 1 ? 'day' : 'days'}</small></span>
                <span className="trip-card-body">
                  <strong>{formatTripTitle(trip.title)}</strong>
                  <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)} · {trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}</span>
                  <span>{trip.destinations.map((destination) => destination.name).join(' → ') || t("No destinations")}</span>
                </span>
                <span className="trip-card-budget">{formatMoney(trip.budget, trip.currencyCode)}<small>{t("budget")}</small></span>
              </a>
            </li>
          ))}
        </ul>}
      </ProfileGate>
    </section>
  );
}
