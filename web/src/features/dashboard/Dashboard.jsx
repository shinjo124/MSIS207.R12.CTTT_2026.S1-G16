import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ProfileGate from '../trips/ProfileGate.jsx';
import { formatDate, formatMoney, todayInTimeZone } from '../trips/trip-format.js';
import { selectDashboardTripForZones, upcomingActivities, budgetBalance } from './dashboard-data.js';
import WeatherPanel from './WeatherPanel.jsx';

export default function Dashboard({ getToken, isSignedIn, profileStatus, profileError }) {
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const today = trip ? todayInTimeZone(trip.timeZone, now) : null;
  const ready = isSignedIn && profileStatus === 'ready';

  const loadTrips = useCallback(async (signal) => {
    setStatus('loading');
    try {
      const result = await apiRequest('/trips', { getToken, signal });
      setTrips(result.data);
      setSelectedId(String(selectDashboardTripForZones(result.data)?.id || ''));
      setStatus(result.data.length ? 'ready' : 'empty');
    } catch (err) {
      if (err.name !== 'AbortError') { setError(err.message); setStatus('error'); }
    }
  }, [getToken]);

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    loadTrips(controller.signal);
    return () => controller.abort();
  }, [ready, loadTrips]);

  useEffect(() => {
    if (!ready || !selectedId) { setTrip(null); return undefined; }
    const controller = new AbortController();
    setDetailStatus('loading');
    setTrip(null);
    apiRequest(`/trips/${selectedId}`, { getToken, signal: controller.signal })
      .then((result) => { setTrip(result.data); setDetailStatus('ready'); })
      .catch((err) => {
        if (err.name !== 'AbortError') { setError(err.message); setDetailStatus('error'); }
      });
    return () => controller.abort();
  }, [ready, selectedId, getToken, retry]);

  const activities = trip && today ? upcomingActivities(trip.days, today).slice(0, 5) : [];
  const balance = trip ? budgetBalance(trip.budgetSummary) : null;
  return <section className="dashboard" aria-labelledby="dashboard-title">
    <div className="dashboard-header">
      <div><h1 id="dashboard-title">Your travel dashboard</h1><p>Your trips, plans, and spending in one place.</p></div>
      <a className="primary-button" href="/trips?new=1">Plan a trip</a>
    </div>
    <ProfileGate isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} action="view your dashboard">
      {status === 'loading' && <p className="empty-state" role="status">Loading your trips…</p>}
      {status === 'error' && <p className="empty-state error-state" role="alert">{error} <button type="button" onClick={() => loadTrips()}>Try again</button></p>}
      {status === 'empty' && <div className="dashboard-empty"><h2>Your next trip starts here</h2><p>Create a trip to see your itinerary and budget here.</p><a href="/trips?new=1">Plan your first trip</a></div>}
      {status === 'ready' && <>
        <div className="dashboard-selector"><label htmlFor="dashboard-trip">Choose a trip</label><select id="dashboard-trip" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <option value="">Select a trip</option>{trips.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select><a href="/trips">View all trips</a></div>
        {!selectedId && <p className="empty-state">No current or upcoming trip. Select a past trip above or plan a new one.</p>}
        {selectedId && detailStatus === 'loading' && <p className="empty-state" role="status">Loading trip details…</p>}
        {selectedId && detailStatus === 'error' && <p className="empty-state error-state" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>}
        {trip && <div className="dashboard-grid">
          <article className="dashboard-trip"><span>{!today ? 'Time zone not set' : trip.startDate <= today && trip.endDate >= today ? 'Happening now' : trip.startDate > today ? 'Upcoming trip' : 'Past trip'}</span><h2>{trip.title}</h2><p>{trip.destinations.map((destination) => destination.name).join(' → ') || 'No destinations added'}</p><p>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</p><p>{trip.timeZone || 'Set a trip time zone to determine today.'}</p><a href={`/trips/${trip.id}`}>Open trip <span aria-hidden="true">→</span></a></article>
          <section className="dashboard-budget" aria-labelledby="budget-title"><h2 id="budget-title">Trip budget</h2><dl><div><dt>Budget</dt><dd>{formatMoney(trip.budgetSummary.budget, trip.currencyCode)}</dd></div><div><dt>Spent</dt><dd>{formatMoney(trip.budgetSummary.totalActualSpend, trip.currencyCode)}</dd></div><div><dt>{balance.label}</dt><dd>{formatMoney(balance.amount, trip.currencyCode)}</dd></div></dl><p>Based on actual spending recorded in this trip.</p></section>
          <WeatherPanel key={trip.id} trip={trip} getToken={getToken} />
          <section className="dashboard-agenda" aria-labelledby="agenda-title"><div className="dashboard-agenda-heading"><h2 id="agenda-title">Today &amp; upcoming</h2><a href={`/trips/${trip.id}`}>View itinerary</a></div>{!today ? <p>Set the trip time zone to see today and upcoming activities.</p> : activities.length ? <ul>{activities.map((activity) => <li key={activity.id}><time dateTime={activity.date}>{formatDate(activity.date, { weekday: 'short', day: 'numeric', month: 'short' })}</time><div><strong>{activity.title}</strong><span>{activity.time || 'Time not set'}{activity.city ? ` · ${activity.city}` : ''}</span></div></li>)}</ul> : <p>No activities scheduled from today. Add one to your trip.</p>}</section>
        </div>}
      </>}
    </ProfileGate>
  </section>;
}
