import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ProfileGate from '../trips/ProfileGate.jsx';
import { formatDate, formatMoney, formatTripTitle, todayInTimeZone, withDefaultTimeZone } from '../trips/trip-format.js';
import { selectDashboardTripForZones, upcomingActivities, budgetBalance } from './dashboard-data.js';
import WeatherPanel from './WeatherPanel.jsx';
import { t } from '../../lib/i18n.js';

// The dashboard combines a selected trip's itinerary and budget with separate weather and news requests.
export default function Dashboard({ getToken, isSignedIn, profileStatus, profileError, active = true }) {
  const [trips, setTrips] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [news, setNews] = useState(null);
  const [newsStatus, setNewsStatus] = useState('loading');
  const tripRef = useRef(null);
  tripRef.current = trip;
  const today = trip ? todayInTimeZone(trip.timeZone, now) : null;
  const ready = isSignedIn && profileStatus === 'ready';

  const loadTrips = useCallback(async (signal) => {
    setStatus((current) => current === 'ready' || current === 'empty' ? current : 'loading');
    setError('');
    try {
      const result = await apiRequest('/trips', { getToken, signal });
      const normalizedTrips = result.data.map(withDefaultTimeZone);
      setTrips(normalizedTrips);
      setSelectedId((current) => normalizedTrips.some((item) => String(item.id) === current)
        ? current
        : String((selectDashboardTripForZones(normalizedTrips) || normalizedTrips[0])?.id || ''));
      setStatus(result.data.length ? 'ready' : 'empty');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setStatus((current) => current === 'ready' || current === 'empty' ? current : 'error');
      }
    }
  }, [getToken]);

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    if (!ready || !active) return undefined;
    const controller = new AbortController();
    loadTrips(controller.signal);
    return () => controller.abort();
  }, [active, ready, loadTrips]);

  useEffect(() => {
    if (!ready || !active) return undefined;
    const controller = new AbortController();
    apiRequest('/news', { getToken, signal: controller.signal })
      .then((result) => { setNews(result.data); setNewsStatus('ready'); })
      .catch((err) => {
        if (err.name !== 'AbortError') setNewsStatus('error');
      });
    return () => controller.abort();
  }, [active, getToken, ready]);

  useEffect(() => {
    if (!selectedId) { setTrip(null); setDetailStatus('loading'); return undefined; }
    if (!ready || !active) return undefined;
    const controller = new AbortController();
    if (String(tripRef.current?.id) !== selectedId) {
      setDetailStatus('loading');
      setTrip(null);
    }
    apiRequest(`/trips/${selectedId}`, { getToken, signal: controller.signal })
      .then((result) => { setTrip(withDefaultTimeZone(result.data)); setDetailStatus('ready'); })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setDetailStatus((current) => String(tripRef.current?.id) === selectedId ? 'ready' : 'error');
        }
      });
    return () => controller.abort();
  }, [active, ready, selectedId, getToken, retry]);

  const activities = trip && today ? upcomingActivities(trip.days, today).slice(0, 5) : [];
  // The selected trip's time zone determines which date counts as today.
  const currentDay = trip?.days.find((day) => day.date === today);
  const nextActivity = activities[0];
  const todayDestination = trip?.destinations.find((destination) => String(destination.id) === String(currentDay?.destinationId))?.name || currentDay?.activities.find((activity) => activity.city)?.city;
  const weatherDate = currentDay?.date || (today && trip ? (trip.startDate > today ? trip.startDate : trip.endDate < today ? trip.endDate : null) : null);
  const balance = trip ? budgetBalance(trip.budgetSummary) : null;
  return <section className="dashboard" aria-labelledby="dashboard-title">
    <div className="dashboard-header">
      <div><h1 id="dashboard-title">{t("Your travel dashboard")}</h1><p>{t("Your trips, plans, and spending in one place.")}</p></div>
      <a className="primary-button" href="/trips?new=1">{t("Plan a trip")}</a>
    </div>
    <ProfileGate isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} action="view your dashboard">
      {status === 'loading' && <p className="empty-state" role="status">{t("Loading your trips…")}</p>}
      {status === 'error' && <p className="empty-state error-state" role="alert">{error} <button type="button" onClick={() => loadTrips()}>{t("Try again")}</button></p>}
      {status === 'empty' && <div className="dashboard-empty"><h2>{t("Your next trip starts here")}</h2><p>{t("Create a trip to see your itinerary and budget here.")}</p><a href="/trips?new=1">{t("Plan your first trip")}</a></div>}
      {status === 'ready' && <>
        {trips.length > 1 && <div className="dashboard-selector"><label htmlFor="dashboard-trip">{t("Choose a trip")}</label><select id="dashboard-trip" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {trips.map((item) => <option key={item.id} value={item.id}>{formatTripTitle(item.title)}</option>)}
        </select><a href="/trips">{t("View all trips")}</a></div>}
        {selectedId && detailStatus === 'loading' && <p className="empty-state" role="status">{t("Loading trip details…")}</p>}
        {selectedId && detailStatus === 'error' && <p className="empty-state error-state" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</button></p>}
        {trip && <div className="dashboard-grid">
          <article className="dashboard-trip"><span>{!today ? t("Time zone not set") : trip.startDate <= today && trip.endDate >= today ? t("Happening now") : trip.startDate > today ? t("Upcoming trip") : t("Past trip")}</span><h2>{formatTripTitle(trip.title)}</h2><p>{trip.destinations.map((destination) => destination.name).join(' → ') || t("No destinations added")}</p><p>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</p>{!trip.timeZone && <p>{t("Set a trip time zone to determine today.")}</p>}{currentDay && <p>{t("Day {n} of {total}", { n: currentDay.dayNumber, total: trip.dayCount })}{todayDestination ? ` · ${t('Today in {place}', { place: todayDestination })}` : ''}</p>}{nextActivity && <p>{t("Next:")} {nextActivity.title}{nextActivity.time ? ` · ${nextActivity.time}` : ''}</p>}<a href={`/trips/${trip.id}`}>{t("Open trip")} <span aria-hidden="true">→</span></a></article>
          <section className="dashboard-budget" aria-labelledby="budget-title"><h2 id="budget-title">{t("Trip budget")}</h2><dl><div><dt>{t("Budget")}</dt><dd>{formatMoney(trip.budgetSummary.budget, trip.currencyCode)}</dd></div><div><dt>{t("Planned total")}</dt><dd>{formatMoney(trip.budgetSummary.plannedTotal, trip.currencyCode)}</dd></div><div><dt>{t("Spent")}</dt><dd>{formatMoney(trip.budgetSummary.totalActualSpend, trip.currencyCode)}</dd></div><div className={balance.label === 'Over budget' ? 'is-over-budget' : ''}><dt>{t(balance.label)}</dt><dd>{formatMoney(balance.amount, trip.currencyCode)}</dd></div></dl><p>{t("Based on planned costs and actual spending recorded in this trip.")}</p></section>
          {weatherDate && <WeatherPanel key={`${trip.id}-${weatherDate}`} trip={trip} getToken={getToken} date={weatherDate} />}
          <section className="dashboard-agenda" aria-labelledby="agenda-title"><div className="dashboard-agenda-heading"><h2 id="agenda-title">{t("Today & upcoming")}</h2><a href={`/trips/${trip.id}`}>{t("View itinerary")}</a></div>{!today ? <p>{t("Set the trip time zone to see today and upcoming activities.")}</p> : activities.length ? <ul>{activities.map((activity) => <li key={activity.id}><time dateTime={activity.date}>{formatDate(activity.date, { weekday: 'short', day: 'numeric', month: 'short' })}</time><div><strong>{activity.title}</strong><span>{activity.time || t("Time not set")}{activity.city ? ` · ${activity.city}` : ''}</span></div></li>)}</ul> : <div className="dashboard-agenda-empty"><p>{trip.endDate < today ? t("No upcoming activities.") : t("No activities planned yet.")}</p><a className="text-button" href={`/trips/${trip.id}?add=1`}>{t("Add activity")}</a></div>}</section>
        <section className="dashboard-news" aria-labelledby="news-title"><h2 id="news-title">{t("Travel news")}</h2>{newsStatus === 'loading' && <p role="status">{t("Loading travel news…")}</p>}{newsStatus === 'error' && <p role="status">{t("Travel news is unavailable right now.")}</p>}{newsStatus === 'ready' && news?.status === 'unavailable' && <p>{t("Travel news is temporarily unavailable.")}</p>}{newsStatus === 'ready' && news?.status !== 'unavailable' && !news?.articles?.length && <p>{t("No travel headlines are available right now.")}</p>}{newsStatus === 'ready' && news?.articles?.length > 0 && <ul>{news.articles.map((article) => <li key={article.url}><a href={article.url} target="_blank" rel="noreferrer"><strong>{article.title}</strong><span>{article.source}{article.publishedAt ? ` · ${formatDate(article.publishedAt.slice(0, 10))}` : ''}</span></a>{article.summary && <p>{article.summary}</p>}</li>)}</ul>}</section>
        </div>}

      </>}
    </ProfileGate>
  </section>;
}
