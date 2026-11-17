import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { canCompareWeatherDate, formatDate } from '../trips/trip-format.js';

export default function WeatherPanel({ trip, getToken, date, onEditingChange }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destinationId, setDestinationId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);

  const load = useCallback(async (signal) => {
    setStatus('loading'); setMessage('');
    try {
      const result = await apiRequest(`/trips/${trip.id}/weather`, { getToken, signal });
      if (signal?.aborted) return;
      setData(result.data); setStatus('ready');
    } catch (error) {
      if (!signal?.aborted) { setMessage(error.message); setStatus('error'); }
    }
  }, [trip.id, getToken]);
  useEffect(() => {
    if (editing) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(controller.signal); }, 600000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load, trip.revision, editing]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  function edit() {
    const location = data?.location;
    setDestinationId(String(location?.destinationId || trip.destinations[0]?.id || ''));
    setLatitude(location ? String(location.latitude) : '');
    setLongitude(location ? String(location.longitude) : '');
    setTimeZone(location?.timeZone || '');
    setConfirmed(false); setConfirmRemoval(false); setMessage(''); setEditing(true); onEditingChange?.(true);
  }
  function cancel() { setEditing(false); setMessage(''); onEditingChange?.(false); }
  async function save(event) {
    event.preventDefault();
    if (!latitude.trim() || !longitude.trim() || !confirmed) { setMessage('Enter coordinates and confirm that they match the selected destination.'); return; }
    setSaving(true); setMessage('');
    try {
      await apiRequest(`/trips/${trip.id}/weather-location`, { method: 'PUT', getToken, body: { destinationId: Number(destinationId), latitude: Number(latitude), longitude: Number(longitude), timeZone: timeZone.trim(), confirmed } });
      setEditing(false); onEditingChange?.(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }
  async function removeLocation() {
    setSaving(true); setMessage('');
    try {
      await apiRequest(`/trips/${trip.id}/weather-location`, { method: 'DELETE', getToken });
      setEditing(false); onEditingChange?.(false);
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  const targetDate = date || data?.today;
  const forecast = data?.forecast?.find((item) => item.date === targetDate);
  const matchingZone = canCompareWeatherDate(trip.timeZone, data?.location?.timeZone);
  return <section className="weather-panel" aria-label="Trip weather">
    <div className="weather-heading"><h2>Weather</h2>{!editing && <button type="button" className="text-button" onClick={edit}>Set location</button>}</div>
    {editing ? <form className="weather-form" onSubmit={save}>
      <p>Use verified coordinates and the IANA time zone for the selected destination. Weather is requested for that location only.</p>
      <label>Destination<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} required>{trip.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label>
      <label>Latitude<input type="number" step="any" min="-90" max="90" required value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
      <label>Longitude<input type="number" step="any" min="-180" max="180" required value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
      <label>IANA time zone<input required value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Asia/Ho_Chi_Minh" /></label>
      <label className="weather-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm the coordinates and time zone match this destination.</label>
      <div className="share-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save location'}</button><button className="text-button" type="button" disabled={saving} onClick={cancel}>Cancel</button></div>
      {data?.location && <div className="weather-removal">{confirmRemoval ? <><button className="text-button" type="button" disabled={saving} onClick={removeLocation}>Confirm removal</button> <button className="text-button" type="button" disabled={saving} onClick={() => setConfirmRemoval(false)}>Keep location</button></> : <button className="text-button" type="button" disabled={saving} onClick={() => setConfirmRemoval(true)}>Remove weather location</button>}</div>}
      {message && <p className="form-error" role="alert">{message}</p>}
    </form> : <>
      {status === 'loading' && <p role="status">Loading weather…</p>}
      {status === 'error' && <p role="alert">{message} <button className="text-button" type="button" onClick={() => load()}>Retry</button></p>}
      {status === 'ready' && data?.status === 'not-configured' && <p>Weather is not configured on the server. You can still set a location.</p>}
      {status === 'ready' && data?.status === 'missing-location' && <p>Set verified coordinates and a time zone to see weather.</p>}
      {status === 'ready' && data?.status === 'available' && <>
        <p><strong>{data.location.destinationName}</strong> · {data.location.timeZone}</p>
        {!date && <p><strong>{Math.round(data.current.temperature)}°C</strong> · {data.current.description}<br /><small>Observed {new Date(data.current.observedAt).toLocaleString(undefined, { timeZone: data.location.timeZone })}</small></p>}
        {!trip.timeZone ? <p>Set the trip time zone before comparing forecasts with trip dates.</p> : !matchingZone ? <p>Weather uses {data.location.timeZone}, but the trip uses {trip.timeZone}. Match the time zones to show forecasts on trip dates.</p> : targetDate && <p>{forecast ? <><strong>{Math.round(forecast.temperature)}°C</strong> · {forecast.description}<br /><small>Forecast for {formatDate(targetDate)}, {forecast.time} local time</small></> : <>No forecast is available for {formatDate(targetDate)}.</>}</p>}
        <p className="weather-attribution">Weather data: <a href="https://openweathermap.org/" target="_blank" rel="noreferrer">OpenWeather</a></p>
      </>}
    </>}
  </section>;
}
