import { useEffect, useRef, useState } from 'react';
import { calendarStartDate, formatDayHeading, todayInTimeZone } from './trip-format.js';
import { minutesOfDay, shiftedTime, resizedDuration, calendarLanes, calendarDrop } from './calendar-math.js';
import WeatherPanel from '../dashboard/WeatherPanel.jsx';

const HOUR_HEIGHT = 64;

export default function TripCalendar({ trip, getToken, onUpdate, onEdit, onAdd, onInteractionChange, onWeatherEditingChange, disabled = false }) {
  const [date, setDate] = useState(() => calendarStartDate(trip));
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const hoursRef = useRef(null);
  const gesture = useRef(null);
  const day = trip.days.find((item) => item.date === date) || trip.days[0];
  const today = todayInTimeZone(trip.timeZone, now);
  const startIndex = Math.max(0, trip.days.findIndex((item) => item.date === day.date));
  const visibleDays = trip.days.slice(startIndex, startIndex + (wide ? 3 : 1));

  useEffect(() => { const media = window.matchMedia('(min-width: 641px)'); const change = () => setWide(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { if (disabled) { gesture.current = null; setPreview(null); onInteractionChange(false); } }, [disabled, onInteractionChange]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT; }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer); }, []);
  useEffect(() => () => onInteractionChange(false), [onInteractionChange]);

  async function save(activity, values) {
    setBusy(true);
    setError('');
    try { await onUpdate(activity.id, { ...values, version: activity.version }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function startGesture(event, activity, mode) {
    if (busy || disabled || event.button !== 0) return;
    event.preventDefault();
    onInteractionChange(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { activity, mode, y: event.clientY, x: event.clientX };
  }

  function finishGesture(event) {
    const current = gesture.current;
    gesture.current = null;
    setPreview(null);
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

  function cancelGesture() { if (!gesture.current) return; gesture.current = null; setPreview(null); onInteractionChange(false); }
  function moveGesture(event) { if (gesture.current) setPreview({ id: gesture.current.activity.id, mode: gesture.current.mode, x: event.clientX - gesture.current.x, delta: (event.clientY - gesture.current.y) / HOUR_HEIGHT * 60 }); }

  return <section className="trip-calendar" aria-labelledby="calendar-title">
    <div className="calendar-heading"><div><h2 id="calendar-title">Calendar</h2><p>Drag an event to change its day or time, or drag its bottom edge to change its duration. Use Edit for precise or keyboard changes.</p></div><button className="primary-button" type="button" disabled={disabled || busy} onClick={() => onAdd(day.date)}>Add activity</button></div>
    <div className="calendar-days" aria-label="Choose calendar day">{trip.days.map((item) => <button key={item.date} data-calendar-date={item.date} type="button" aria-pressed={day.date === item.date} aria-current={today === item.date ? 'date' : undefined} onClick={() => setDate(item.date)}>{today === item.date ? 'Today · ' : ''}{formatDayHeading(item.date)}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {busy && <p role="status">Saving calendar changes…</p>}
    <div className="calendar-navigation"><button type="button" disabled={startIndex === 0} onClick={() => setDate(trip.days[startIndex - 1].date)}>Previous</button><button type="button" disabled={startIndex + visibleDays.length >= trip.days.length} onClick={() => setDate(trip.days[startIndex + visibleDays.length].date)}>Next</button></div>
    <div className="calendar-column-headings">{visibleDays.map((item) => <strong key={item.date}>{formatDayHeading(item.date)}</strong>)}</div>
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
          return <div key={activity.id} className="calendar-event" style={{ top: start / 60 * HOUR_HEIGHT, height: Math.max(32, Math.min(duration, 1440 - start) / 60 * HOUR_HEIGHT), left: `${lane / columns * 100}%`, width: `calc(${width}% - 3px)`, transform: change?.mode === 'move' ? `translateX(${change.x}px)` : undefined, pointerEvents: change ? 'none' : undefined, zIndex: change ? 100 : index + 1 }}>
            <div className="calendar-event-drag" onPointerDown={(event) => startGesture(event, activity, 'move')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}><strong>{activity.title}</strong><span>{time} · {activity.durationMinutes ? `${duration} min` : 'Duration not set'}{end > 1440 ? ' · continues next day' : ''}</span></div>
            <button type="button" className="calendar-edit" onClick={() => onEdit(activity)} disabled={busy || disabled} aria-label={`Edit ${activity.title}`}>Edit</button>
            <div className="calendar-resize" aria-hidden="true" onPointerDown={(event) => startGesture(event, activity, 'resize')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} />
          </div>;
        })}</div>;
        })}</div>
      </div>
    </div>
    <div className="calendar-unscheduled-columns">{visibleDays.map((column) => <section key={column.date} className="calendar-unscheduled" data-calendar-date={column.date} data-calendar-unscheduled><h3>{formatDayHeading(column.date)} · Not scheduled</h3>{column.activities.some((activity) => !activity.time) ? <ul>{column.activities.filter((activity) => !activity.time).map((activity) => <li key={activity.id}><span className="calendar-unscheduled-drag" onPointerDown={(event) => startGesture(event, activity, 'unscheduled')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture}>{activity.title}</span><button className="text-button" type="button" disabled={busy || disabled} onClick={() => onEdit(activity)}>Set time</button></li>)}</ul> : <p>All activities have a time.</p>}</section>)}</div>
    <WeatherPanel trip={trip} getToken={getToken} date={day.date} onEditingChange={onWeatherEditingChange} />
  </section>;
}
