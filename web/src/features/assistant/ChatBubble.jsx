import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { formatTripTitle } from '../trips/trip-format.js';
import AssistantChat from './AssistantChat.jsx';
import './assistant.css';

// Floating chat button shown on every signed-in page.
// On /trips/:id it uses that trip; elsewhere it answers general questions and lets the user pick a trip.
export default function ChatBubble({ path, getToken }) {
  const pageTripId = path.match(/^\/trips\/(\d+)$/)?.[1] || '';
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState(pageTripId);
  const [trips, setTrips] = useState(null);
  const [trip, setTrip] = useState(null);
  const [tripError, setTripError] = useState('');

  // Follow the page: opening a trip selects it; leaving a trip page goes back to general questions.
  useEffect(() => { setTripId(pageTripId); }, [pageTripId]);

  useEffect(() => {
    if (!open || trips) return undefined;
    const controller = new AbortController();
    apiRequest('/trips', { getToken, signal: controller.signal })
      .then((result) => setTrips(result.data))
      .catch((error) => { if (error.name !== 'AbortError') setTrips([]); });
    return () => controller.abort();
  }, [open, trips, getToken]);

  const loadTrip = useCallback(async (signal) => {
    if (!tripId) { setTrip(null); return; }
    try {
      const result = await apiRequest(`/trips/${tripId}`, { getToken, signal });
      setTrip(result.data); setTripError('');
    } catch (error) {
      if (error.name !== 'AbortError') { setTrip(null); setTripError(error.message); }
    }
  }, [tripId, getToken]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setTrip(null); setTripError('');
    loadTrip(controller.signal);
    return () => controller.abort();
  }, [open, loadTrip]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function addActivity(values) {
    await apiRequest(`/trips/${tripId}/activities`, { method: 'POST', body: values, getToken });
    // Let an open trip page refresh, then refresh our copy so free-time answers stay current.
    window.dispatchEvent(new CustomEvent('tripo:trip-changed', { detail: { tripId } }));
    await loadTrip();
  }

  const waitingForTrip = Boolean(tripId) && !trip && !tripError;
  return (
    <div className="chat-bubble">
      {open && (
        <section className="chat-bubble-panel" id="chat-bubble-panel" role="dialog" aria-label="Tripo assistant">
          <header className="chat-bubble-header">
            <div>
              <h2>Tripo assistant</h2>
              <label>
                <span className="visually-hidden">Ask about</span>
                <select value={tripId} onChange={(event) => setTripId(event.target.value)}>
                  <option value="">General travel questions</option>
                  {tripId && !trips?.some((item) => String(item.id) === tripId) && <option value={tripId}>{trip ? formatTripTitle(trip.title) : 'This trip'}</option>}
                  {(trips || []).map((item) => <option key={item.id} value={String(item.id)}>{formatTripTitle(item.title)}</option>)}
                </select>
              </label>
            </div>
            <button type="button" className="chat-bubble-close" aria-label="Close assistant" onClick={() => setOpen(false)}>×</button>
          </header>
          {tripError && <p className="error-state" role="alert">{tripError}</p>}
          {waitingForTrip
            ? <p className="chat-bubble-loading" role="status">Loading trip…</p>
            : <AssistantChat key={tripId || 'general'} trip={tripId ? trip : null} getToken={getToken} onAddActivity={addActivity} disabled={Boolean(tripError)} />}
        </section>
      )}
      <button type="button" className="chat-bubble-button" aria-expanded={open} aria-controls="chat-bubble-panel" aria-label={open ? 'Close assistant' : 'Open Tripo assistant'} onClick={() => setOpen((value) => !value)}>
        {open
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>}
      </button>
    </div>
  );
}
