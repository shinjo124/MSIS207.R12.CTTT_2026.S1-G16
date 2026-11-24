import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calendarStartDate, categoryLabel, formatDayHeading, formatMoney, mapsUrl, todayInTimeZone } from './trip-format.js';
import { minutesOfDay, shiftedTime, resizedDuration, calendarLanes, calendarDrop, calendarWeather, timeRange } from './calendar-math.js';
import WeatherPanel from '../dashboard/WeatherPanel.jsx';

const HOUR_HEIGHT = 64;
const TIP_WIDTH = 280;

function EventTip({ hover, currencyCode }) {
  const { activity, rect } = hover;
  const tipRef = useRef(null);
  const [position, setPosition] = useState(null);
  const place = [activity.address, activity.city].filter(Boolean).join(', ');
  const duration = activity.durationMinutes;
  const width = Math.min(TIP_WIDTH, window.innerWidth - 16);
  const left = rect.right + width + 10 <= window.innerWidth ? rect.right + 10 : Math.max(8, rect.left - 10 - width);
  const initialPosition = { top: Math.max(8, rect.top), left, width };
  useLayoutEffect(() => {
    const currentWidth = Math.min(TIP_WIDTH, window.innerWidth - 16);
    const height = tipRef.current?.getBoundingClientRect().height || 230;
    const currentLeft = rect.right + currentWidth + 10 <= window.innerWidth ? rect.right + 10 : Math.max(8, rect.left - 10 - currentWidth);
    const top = Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - height - 8));
    setPosition({ top, left: currentLeft, width: currentWidth });
  }, [rect]);
  return <div ref={tipRef} id={`calendar-tip-${activity.id}`} className="calendar-tip" role="tooltip" style={position || initialPosition}>
    <span className={`category-badge category-${activity.category}`}>{categoryLabel(activity.category)}:</span>
    <strong>{activity.title}</strong>
    <p>{activity.time ? (duration ? `${timeRange(activity.time, duration)} · ${duration} min` : `${activity.time} · Duration not set`) : 'No time set'}</p>
    {place && <p>{place}</p>}
    <p>Planned {formatMoney(activity.plannedCost, currencyCode)} · {activity.actualSpend == null ? 'Actual not recorded' : `Actual ${formatMoney(activity.actualSpend, currencyCode)}`}</p>
    {activity.note && <p className="calendar-tip-note">{activity.note}</p>}
    {activity.visited && <p>✓ Visited</p>}
    <small>Drag to move · drag the bottom edge to resize</small>
  </div>;
}

export default function TripCalendar({ trip, getToken, onUpdate, onEdit, onAdd, onInteractionChange, onDestinationChange, disabled = false }) {
  const [date, setDate] = useState(() => calendarStartDate(trip));
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches);
  const [preview, setPreview] = useState(null);
  const [weatherByDestination, setWeatherByDestination] = useState({});
  const [error, setError] = useState('');
  const [pressed, setPressed] = useState(null);
  const [hover, setHover] = useState(null);
  const scrollRef = useRef(null);
  const hoursRef = useRef(null);
  const gesture = useRef(null);
  const day = trip.days.find((item) => item.date === date) || trip.days[0];
  const today = todayInTimeZone(trip.timeZone, now);
  // Show one day on narrow screens or up to three consecutive days on wider ones.
  const columnCount = wide ? 3 : 1;
  const startIndex = Math.min(Math.max(0, trip.days.findIndex((item) => item.date === day.date)), Math.max(0, trip.days.length - columnCount));
  const visibleDays = trip.days.slice(startIndex, startIndex + columnCount);
  const updateWeather = useCallback((destinationId, value) => setWeatherByDestination((current) => ({ ...current, [destinationId]: value })), []);
  // Load one forecast per visible destination even when several days use it.
  const weatherDestinations = [...new Set(visibleDays.map((item) => item.destinationId).filter(Boolean).map(String))];

  useEffect(() => { const media = window.matchMedia('(min-width: 641px)'); const change = () => setWide(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { if (disabled) { gesture.current = null; setPreview(null); setPressed(null); setHover(null); onInteractionChange(false); } }, [disabled, onInteractionChange]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT; }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => () => onInteractionChange(false), [onInteractionChange]);
  useEffect(() => {
    if (!hover) return undefined;
    const clear = () => setHover(null);
    window.addEventListener('scroll', clear, true);
    return () => window.removeEventListener('scroll', clear, true);
  }, [hover]);

  async function save(activity, values) {
    setBusy(true);
    setError('');
    try { await onUpdate(activity.id, { ...values, version: activity.version }); if (values.date) setDate(values.date); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  // Capture the pointer for the duration of a drag and tell the trip page to pause polling.
  function startGesture(event, activity, mode) {
    if (busy || disabled || event.button !== 0) return;
    event.preventDefault();
    onInteractionChange(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { activity, mode, y: event.clientY, x: event.clientX };
    setPressed({ id: activity.id, mode });
    setHover(null);
  }

  // Use the pointer's final position to distinguish a timed move, an unscheduled drop, and a resize.
  function finishGesture(event) {
    const current = gesture.current;
    gesture.current = null;
    setPreview(null);
    setPressed(null);
    onInteractionChange(false);
    if (!current || Math.hypot(event.clientY - current.y, event.clientX - current.x) < 4) return;
    const delta = (event.clientY - current.y) / HOUR_HEIGHT * 60;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = element?.closest('[data-calendar-date]')?.dataset.calendarDate;
    if (current.mode === 'unscheduled') {
      const hours = hoursRef.current?.getBoundingClientRect();
      if (hours && event.clientX >= hours.left && event.clientX <= hours.right && event.clientY >= hours.top && event.clientY <= hours.bottom && element?.closest('.calendar-scroll')) {
        save(current.activity, { date: target || current.activity.date, time: shiftedTime('00:00', (event.clientY - hours.top) / HOUR_HEIGHT * 60) });
      }
      return;
    }
    if (current.mode === 'move' && element?.closest('[data-calendar-unscheduled]')) {
      save(current.activity, { date: target || current.activity.date, time: null });
      return;
    }
    if (current.mode === 'move') {
      const values = calendarDrop(current.activity, target, element?.closest('.calendar-scroll') ? delta : 0);
      if (values.date !== current.activity.date || values.time !== current.activity.time) save(current.activity, values);
    } else {
      const durationMinutes = resizedDuration(current.activity.time, current.activity.durationMinutes || 60, delta);
      if (Math.abs(event.clientY - current.y) >= 4) save(current.activity, { durationMinutes });
    }
  }

  function cancelGesture() { if (!gesture.current) return; gesture.current = null; setPreview(null); setPressed(null); onInteractionChange(false); }
  function showTip(event, activity) {
    if (gesture.current) return;
    if (event.type === 'pointerenter' ? event.pointerType !== 'mouse' : !event.target.matches?.(':focus-visible')) return;
    const { top, left, right, bottom } = event.currentTarget.getBoundingClientRect();
    setHover({ activity, rect: { top, left, right, bottom } });
  }
  function moveGesture(event) { if (gesture.current) setPreview({ id: gesture.current.activity.id, mode: gesture.current.mode, x: event.clientX - gesture.current.x, delta: (event.clientY - gesture.current.y) / HOUR_HEIGHT * 60 }); }

  return <section className="trip-calendar" aria-labelledby="calendar-title">
    <div className="calendar-heading"><div><h2 id="calendar-title">Calendar</h2><p>Drag an event to change its day or time, or drag its bottom edge to change its duration. Use the activity button for precise or keyboard changes.</p></div><button className="primary-button" type="button" disabled={disabled || busy} onClick={() => onAdd(day.date)}>Add activity</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <p role="status">Saving calendar changes…</p>}
    <div className="calendar-navigation"><button type="button" disabled={startIndex === 0} onClick={() => setDate(trip.days[startIndex - 1].date)}>Previous</button><button type="button" disabled={startIndex + visibleDays.length >= trip.days.length} onClick={() => setDate(trip.days[startIndex + visibleDays.length].date)}>Next</button></div>
    <div className="calendar-column-headings">{visibleDays.map((item) => <div key={item.date}><button className="calendar-day-heading" type="button" aria-pressed={day.date === item.date} aria-current={today === item.date ? 'date' : undefined} onClick={() => setDate(item.date)}>{today === item.date ? 'Today · ' : ''}{formatDayHeading(item.date)}</button><label>Weather destination<select aria-label={`Weather destination for ${formatDayHeading(item.date)}`} value={item.destinationId ?? ''} disabled={disabled || busy} onChange={(event) => onDestinationChange(item.date, Number(event.target.value))}>{trip.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label></div>)}</div>
    <div className="calendar-scroll" ref={scrollRef} aria-label="Calendar schedule">
      <div ref={hoursRef} className="calendar-hours" style={{ height: 24 * HOUR_HEIGHT }}>
        {Array.from({ length: 24 }, (_, hour) => <div className="calendar-hour" key={hour} style={{ top: hour * HOUR_HEIGHT }}><span>{String(hour).padStart(2, '0')}:00</span></div>)}
        <div className="calendar-columns">{visibleDays.map((column) => {
          const timed = column.activities.filter((activity) => activity.time);
          const lanes = calendarLanes(timed);
          return <div key={column.date} className="calendar-column" data-calendar-date={column.date}>{timed.map((activity, index) => {
          const change = preview?.id === activity.id ? preview : null;
          const time = change?.mode === 'move' ? shiftedTime(activity.time, change.delta) : activity.time;
          const start = minutesOfDay(time);
          const duration = change?.mode === 'resize' ? resizedDuration(time, activity.durationMinutes || 60, change.delta) : activity.durationMinutes || 60;
          const end = start + duration;
          const { lane, columns } = lanes.get(activity.id);
          const width = 100 / columns;
          const forecast = calendarWeather(weatherByDestination[column.destinationId], weatherByDestination[column.destinationId]?.location?.timeZone, column.date);
          const rain = forecast && /rain|drizzle|thunder|snow/i.test(forecast.description);
          const clear = forecast && /clear/i.test(forecast.description);
          const active = change || (pressed?.id === activity.id ? pressed : null);
          const showRange = Boolean(activity.durationMinutes) || change?.mode === 'resize';
          return <div key={activity.id} className={`calendar-event event-cat-${activity.category}${active ? (active.mode === 'resize' ? ' is-resizing' : ' is-moving') : ''}`} onPointerEnter={(event) => showTip(event, activity)} onPointerLeave={() => setHover(null)} onFocus={(event) => showTip(event, activity)} onBlur={() => setHover(null)} style={{ top: start / 60 * HOUR_HEIGHT, height: Math.max(32, Math.min(duration, 1440 - start) / 60 * HOUR_HEIGHT), left: `${lane / columns * 100}%`, width: `calc(${width}% - 3px)`, transform: change?.mode === 'move' ? `translateX(${change.x}px)` : undefined, pointerEvents: change ? 'none' : undefined, zIndex: change ? 100 : index + 1 }}>
            <div className="calendar-event-drag" onPointerDown={(event) => startGesture(event, activity, 'move')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>
              <strong>{activity.title}</strong>
              {forecast && <span className="calendar-event-weather" title={`Daily forecast by OpenWeather for ${weatherByDestination[column.destinationId].location.destinationName}: ${forecast.description}, ${Math.round(forecast.temperature)}°C`} aria-label={`Daily forecast for ${weatherByDestination[column.destinationId].location.destinationName}: ${forecast.description}, ${Math.round(forecast.temperature)} degrees Celsius`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{clear ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/></> : <><path d="M6 17a4 4 0 0 1-.3-8 6.5 6.5 0 0 1 12.6 1A3.5 3.5 0 0 1 18 17H6Z"/>{rain && <path d="m9 19-1 2m5-2-1 2m5-2-1 2"/>}</>}</svg>
                <span className="calendar-event-weather-description">{forecast.description}</span>
                <span>{Math.round(forecast.temperature)}°</span>
              </span>}
              <span>{showRange ? `${timeRange(time, duration)} · ${duration} min` : `${time} · Duration not set`}{end > 1440 ? ' · continues next day' : ''}</span>
            </div>
            <a className="calendar-map-link" href={mapsUrl(activity)} target="_blank" rel="noreferrer" aria-label={`Open ${activity.title} in Google Maps`} title="Google Maps" onPointerDown={(event) => event.stopPropagation()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></a>
            <button type="button" className="calendar-edit" onClick={() => onEdit(activity)} disabled={busy || disabled} aria-label={`Edit ${activity.title}`} title={`Edit ${activity.title}`} aria-describedby={hover?.activity.id === activity.id ? `calendar-tip-${activity.id}` : undefined}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
            <div className="calendar-resize" aria-hidden="true" title="Drag to change duration" onPointerDown={(event) => startGesture(event, activity, 'resize')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}><span /></div>
          </div>;
        })}</div>;
        })}</div>
      </div>
    </div>
    <div className="calendar-unscheduled-columns">{visibleDays.map((column) => <section key={column.date} className="calendar-unscheduled" data-calendar-date={column.date} data-calendar-unscheduled><h3>{formatDayHeading(column.date)} · Not scheduled</h3>{column.activities.some((activity) => !activity.time) ? <ul>{column.activities.filter((activity) => !activity.time).map((activity) => <li key={activity.id}><span className="calendar-unscheduled-drag" title="Drag onto the calendar to set a time" onPointerDown={(event) => startGesture(event, activity, 'unscheduled')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>{activity.title}</span><button className="text-button" type="button" disabled={busy || disabled} onClick={() => onEdit(activity)}>Set time</button></li>)}</ul> : <p>All activities have a time.</p>}</section>)}</div>
    {hover && !pressed && !preview && createPortal(<EventTip hover={hover} currencyCode={trip.currencyCode} />, document.body)}
    {weatherDestinations.map((destinationId) => {
      const matchingDay = visibleDays.find((item) => String(item.destinationId) === String(destinationId));
      return <WeatherPanel key={`${trip.id}-${destinationId}`} trip={trip} getToken={getToken} date={matchingDay.date} destinationId={destinationId} hidden onWeatherChange={updateWeather} />;
    })}
  </section>;
}
