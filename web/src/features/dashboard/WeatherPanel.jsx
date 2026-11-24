import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { formatDate } from '../trips/trip-format.js';

// The dashboard shows this panel. The calendar can use it as a hidden loader for destination forecasts.
export default function WeatherPanel({ trip, getToken, date, destinationId, onWeatherChange, hidden = false }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  // Request by destination for the calendar or by date for a single dashboard forecast.
  const query = destinationId ? `?destinationId=${encodeURIComponent(destinationId)}` : date ? `?date=${encodeURIComponent(date)}` : '';
  const load = useCallback(async (signal) => {
    setStatus('loading'); setMessage('');
    try {
      const result = await apiRequest(`/trips/${trip.id}/weather${query}`, { getToken, signal });
      if (signal?.aborted) return;
      setData(result.data); setStatus('ready');
    } catch (error) {
      if (!signal?.aborted) { setMessage(error.message); setStatus('error'); }
    }
  }, [getToken, query, trip.id]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(controller.signal); }, 600000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load]);
  useEffect(() => { onWeatherChange?.(destinationId || date, status === 'ready' ? data : null); }, [data, date, destinationId, status, onWeatherChange]);

  const forecast = data?.forecast?.find((item) => item.date === date);
  const description = forecast?.description?.toLowerCase() || '';
  const weather = /thunder|storm|rain|drizzle|shower/.test(description) ? 'rain' : /cloud|overcast|mist|fog/.test(description) ? 'cloud' : 'sun';
  if (hidden) return null;
  return <section className="weather-panel" data-weather={status === 'ready' && data?.status === 'available' ? weather : undefined} aria-label="Trip weather">
    <div className="weather-heading"><h2>Weather</h2></div>
    {status === 'loading' && <p role="status">Loading weather…</p>}
    {status === 'error' && <p role="alert">{message} <button className="text-button" type="button" onClick={() => load()}>Retry</button></p>}
    {status === 'ready' && data?.status === 'not-configured' && <p>Weather is not configured on the server yet.</p>}
    {status === 'ready' && data?.status === 'missing-location' && <p>Add a destination with weather coordinates to see the forecast.</p>}
    {status === 'ready' && data?.status === 'available' && <>
      <p className="weather-location">{data.location.destinationName}</p>
      {forecast ? <>
        <div className="weather-current">
          <strong className="weather-temperature">{Math.round(forecast.temperature)}°C</strong>
          <span className="weather-condition">{forecast.description}</span>
        </div>
        <p className="weather-forecast-time">Forecast for {formatDate(date)}, {forecast.time} local time</p>
      </> : <p>No forecast is available for {formatDate(date)}.</p>}
      <p className="weather-attribution">Weather: <a href="https://openweathermap.org/" target="_blank" rel="noreferrer">OpenWeather</a> · Location data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors (ODbL)</a></p>
    </>}
  </section>;
}
