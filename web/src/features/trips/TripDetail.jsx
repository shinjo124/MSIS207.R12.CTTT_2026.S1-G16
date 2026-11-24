import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ActivityForm from './ActivityForm.jsx';
import ProfileGate from './ProfileGate.jsx';
import ShareControl from './ShareControl.jsx';
import TripForm from './TripForm.jsx';
import TripCalendar from './TripCalendar.jsx';
import MemberControl from './MemberControl.jsx';
import { createMutationLock, updateSchedule } from './schedule-update.js';
import { createTripPoller, fetchChangedTrip } from './trip-polling.js';
import { MONEY_INPUT_PATTERN, categoryLabel, formatDate, formatDayHeading, formatMoney, formatTripTitle, mapsUrl, moneyInputProps, timeZoneLabel, todayInTimeZone, withDefaultTimeZone } from './trip-format.js';
import './trips.css';

function ActivityItem({ activity, trip, onEdit, onDelete, onToggleVisited, onMove, onDragStart, onDragEnd }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
      if (actionError.code === 'ACTIVITY_CONFLICT') setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const place = [activity.address, activity.city].filter(Boolean).join(', ');
  return (
    <li draggable={!busy} onDragStart={onDragStart} onDragEnd={onDragEnd} className={`activity board-activity${activity.visited ? ' visited' : ''}`}>
      <label className="board-check-in"><input type="checkbox" aria-label={activity.visited ? 'Mark activity as not visited' : 'Mark activity as visited'} checked={activity.visited} disabled={busy} onChange={() => run(() => onToggleVisited(!activity.visited))} /></label>
      <details>
        <summary>
          <span className={`category-badge category-${activity.category}`}>{categoryLabel(activity.category)}:</span>
          <strong>{activity.title}</strong>
          <span className="board-card-meta">{activity.time || 'No time'}{place ? ` · ${place}` : ''}</span>
        </summary>
        <div className="board-card-details">
          <p>Planned {formatMoney(activity.plannedCost, trip.currencyCode)} · {activity.actualSpend == null ? 'Actual not recorded' : `Actual ${formatMoney(activity.actualSpend, trip.currencyCode)}`}</p>
          {activity.note && <p className="activity-note">{activity.note}</p>}
          <div className="activity-actions">
            <a href={mapsUrl(activity)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
            <button className="text-button" type="button" onClick={onEdit} disabled={busy}>Edit</button>
            <label className="move-activity">Move to day <select value={activity.date} disabled={busy} onChange={(event) => run(() => onMove(event.target.value))}>{trip.days.map((day) => <option key={day.date} value={day.date}>Day {day.dayNumber} · {formatDayHeading(day.date)}</option>)}</select></label>
            {confirming ? <><button className="text-button danger" type="button" disabled={busy} onClick={() => run(() => onDelete(confirming.version))}>Confirm delete</button><button className="text-button" type="button" onClick={() => setConfirming(false)}>Keep</button></> : <button className="text-button danger" type="button" onClick={() => setConfirming({ version: activity.version })} disabled={busy}>Delete</button>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </details>
    </li>
  );
}

export function ActivityEditor({ activity, trip, onSave, onCancel }) {
  const current = trip.days.flatMap((day) => day.activities).find((item) => item.id === activity.id);
  return <div className="activity editing">
    {!current && <p role="alert">This activity was removed. Your draft is still here; copy it before closing.</p>}
    {current && current.version !== activity.version && <p role="status">This activity changed while you were editing. Your draft uses the original version.</p>}
    <ActivityForm activity={activity} days={trip.days} currencyCode={trip.currencyCode} onSubmit={onSave} onCancel={onCancel} />
  </div>;
}

function BudgetSpendRow({ activity, onRecordSpend }) {
  const [actualSpend, setActualSpend] = useState(() => String(activity.actualSpend ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (actualSpend && !MONEY_INPUT_PATTERN.test(actualSpend)) {
      setError('Enter an amount with up to two decimal places.');
      return;
    }
    setSaving(true); setError('');
    try { await onRecordSpend(activity, actualSpend || null); }
    catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }
  return <li><span>Day {activity.dayNumber} · {activity.title}</span><form onSubmit={submit}><label className="visually-hidden" htmlFor={`spend-${activity.id}`}>Actual spend for {activity.title}</label><input id={`spend-${activity.id}`} name="actualSpend" {...moneyInputProps(actualSpend, setActualSpend)} placeholder="Amount" /><button className="text-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>{error && <span role="alert" className="form-error">{error}</span>}</form></li>;
}

function BudgetSummary({ summary, trip, onRecordSpend }) {
  const currencyCode = trip.currencyCode;
  const activities = trip.days.flatMap((day) => day.activities.map((activity) => ({ ...activity, dayNumber: day.dayNumber })));
  return (
    <section className="budget-summary" aria-labelledby="budget-summary-title">
      <h2 id="budget-summary-title">Budget summary</h2>
      <dl className="budget-totals">
        <div className="is-budget"><dt>Budget</dt><dd>{formatMoney(summary.budget, currencyCode)}</dd></div>
        <div className="is-planned"><dt>Planned total</dt><dd>{formatMoney(summary.plannedTotal, currencyCode)}</dd></div>
        <div className="is-spent"><dt>Actual spent</dt><dd>{formatMoney(summary.totalActualSpend, currencyCode)}</dd></div>
        <div className={Number(summary.remainingBudget) > 0 ? 'is-remaining is-positive' : Number(summary.remainingBudget) < 0 ? 'is-remaining is-negative' : 'is-remaining'}><dt>Remaining</dt><dd>{formatMoney(summary.remainingBudget, currencyCode)}</dd></div>
        <div className={Number(summary.overBudget) > 0 ? 'is-over-budget' : ''}><dt>Over budget</dt><dd>{formatMoney(summary.overBudget, currencyCode)}</dd></div>
      </dl>
      <h3>Actual spend by category</h3>
      {summary.spendByCategory.length
        ? <ul className="budget-category-list">
            {summary.spendByCategory.map(({ category, amount }) => (
              <li key={category}><span>{categoryLabel(category)}</span><strong>{formatMoney(amount, currencyCode)}</strong></li>
            ))}
          </ul>
        : <p className="day-empty">No actual spend recorded yet.</p>}
      <h3>Record spending</h3>
      {activities.length ? <ul className="budget-record-list">{activities.map((activity) => <BudgetSpendRow key={`${activity.id}:${activity.version}`} activity={activity} onRecordSpend={onRecordSpend} />)}</ul> : <p className="day-empty">Add an activity before recording its spend.</p>}
    </section>
  );
}

export default function TripDetail({ tripId, getToken, isSignedIn, profileStatus, profileError, search = '' }) {
  const [trip, setTrip] = useState(null);
  const tripRef = useRef(null);
  tripRef.current = trip;
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [editingTrip, setEditingTrip] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [addingOn, setAddingOn] = useState(null);
  const [view, setView] = useState('calendar');
  const [selectedDay, setSelectedDay] = useState('');
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [moveError, setMoveError] = useState('');
  const [undoMove, setUndoMove] = useState(null);
  const [moving, setMoving] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [conflictError, setConflictError] = useState('');
  const [writing, setWriting] = useState(false);
  const [calendarInteraction, setCalendarInteraction] = useState(false);
  const [weatherEditing, setWeatherEditing] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('waiting');
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const addActivityFormRef = useRef(null);
  const addFromDashboardHandled = useRef(false);
  const tripToday = todayInTimeZone(trip?.timeZone);
  const ready = isSignedIn && profileStatus === 'ready';
  const runMutation = useRef(createMutationLock()).current;
  const pollerRef = useRef(null);
  const workspaceControlsRef = useRef(null);
  const [indicator, setIndicator] = useState(null);
  const paused = Boolean(editingTrip || confirmDelete || addingOn || dragged || moving || writing || calendarInteraction || weatherEditing);

  function changeView(nextView) {
    if (nextView === view) {
      if (nextView === 'calendar') setAddingOn(null);
      return;
    }
    setView(nextView);
    if (nextView === 'calendar') setAddingOn(null);
  }

  useLayoutEffect(() => {
    const controls = workspaceControlsRef.current;
    if (!controls) return undefined;
    const updateIndicator = () => {
      const activeButton = controls.querySelector('button[aria-pressed="true"]');
      if (!activeButton) return;
      setIndicator({ left: activeButton.offsetLeft, top: activeButton.offsetTop, width: activeButton.offsetWidth, height: activeButton.offsetHeight });
    };
    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [view, trip?.role]);

  useEffect(() => { if (addingOn) addActivityFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [addingOn]);
  useEffect(() => {
    if (status !== 'ready' || !trip || addFromDashboardHandled.current || new URLSearchParams(search).get('add') !== '1') return;
    addFromDashboardHandled.current = true;
    const date = trip.days.find((day) => day.date === tripToday)?.date || trip.days[0]?.date;
    if (date) beginAdd(date);
  }, [search, status, trip]);

  const onCalendarInteraction = useCallback((active) => {
    if (active) pollerRef.current?.stop();
    setCalendarInteraction(active);
    if (!active) setRefreshGeneration((current) => current + 1);
  }, []);

  const onWeatherEditingChange = useCallback((active) => {
    if (active) pollerRef.current?.stop();
    setWeatherEditing(active);
    if (!active) setRefreshGeneration((current) => current + 1);
  }, []);

  async function withMutation(work) {
    return runMutation(async () => {
      pollerRef.current?.stop();
      setWriting(true);
      try { return await work(); }
      finally { setWriting(false); setRefreshGeneration((current) => current + 1); }
    });
  }

  function beginAdd(date) { pollerRef.current?.stop(); setAddingOn(date); setEditingActivity(null); }
  function beginEdit(activity) { setEditingActivity((current) => current?.id === activity.id ? current : activity); setAddingOn(null); }

  const loadTrip = useCallback(async (signal) => {
    try {
      const result = await apiRequest(`/trips/${tripId}`, { getToken, signal });
      setTrip(withDefaultTimeZone(result.data));
      setStatus('ready');
    } catch (loadError) {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setStatus('error');
    }
  }, [getToken, tripId]);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    loadTrip(controller.signal);
    return () => controller.abort();
  }, [ready, loadTrip]);

  useEffect(() => {
    const onVisibility = () => { const next = document.visibilityState === 'visible'; if (!next) pollerRef.current?.stop(); setVisible(next); };
    const onOnline = () => { const next = navigator.onLine; if (!next) pollerRef.current?.stop(); setOnline(next); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => { document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); };
  }, []);

  useEffect(() => {
    if (!ready || status !== 'ready' || paused || !visible || !online) return undefined;
    const poller = createTripPoller({
      load: (signal) => fetchChangedTrip(
        () => apiRequest(`/trips/${tripId}/version?sync=1&wait=1&since=${tripRef.current?.revision || 0}`, { getToken, signal }),
        () => apiRequest(`/trips/${tripId}?sync=1`, { getToken, signal }),
        tripRef.current?.revision,
      ),
      apply: (result) => { if (result?.data) { tripRef.current = withDefaultTimeZone(result.data); setTrip(tripRef.current); } },
      onState: setSyncStatus,
    });
    pollerRef.current = poller;
    poller.start();
    return () => { poller.stop(); if (pollerRef.current === poller) pollerRef.current = null; };
  }, [ready, status, paused, visible, online, getToken, tripId, refreshGeneration]);

  async function saveTrip(values) {
    await withMutation(async () => {
      const result = await apiRequest(`/trips/${tripId}`, { method: 'PUT', body: values, getToken });
      setTrip(withDefaultTimeZone(result.data));
      setEditingTrip(false);
    });
  }

  async function deleteTrip() {
    setDeleteError('');
    try {
      await withMutation(async () => {
        await apiRequest(`/trips/${tripId}`, { method: 'DELETE', getToken });
        window.history.pushState(null, '', '/trips');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    } catch (removeError) { setDeleteError(removeError.message); }
  }

  async function addActivity(values) {
    await withMutation(async () => {
      await apiRequest(`/trips/${tripId}/activities`, { method: 'POST', body: values, getToken });
      setAddingOn(null);
      await loadTrip();
    });
  }

  async function updateActivity(id, values, closeEditor = false) {
    await withMutation(async () => {
      const previous = trip.days.flatMap((day) => day.activities).find((activity) => activity.id === id);
      if (previous && Object.hasOwn(values, 'visited')) {
        setTrip((current) => ({ ...current, days: current.days.map((day) => ({ ...day, activities: day.activities.map((activity) => activity.id === id ? { ...activity, visited: values.visited } : activity) })) }));
      }
      try {
        await apiRequest(`/activities/${id}`, { method: 'PATCH', body: values, getToken });
        if (closeEditor) setEditingActivity(null);
        setConflictError('');
        await loadTrip();
      } catch (error) {
        if (previous && Object.hasOwn(values, 'visited')) {
          setTrip((current) => ({ ...current, days: current.days.map((day) => ({ ...day, activities: day.activities.map((activity) => activity.id === id ? { ...activity, visited: previous.visited } : activity) })) }));
        }
        if (error.code === 'ACTIVITY_CONFLICT') {
          setConflictError(error.message);
        }
        throw error;
      }
    });
  }

  async function saveSchedule(id, values) {
    await withMutation(async () => {
      const activity = trip.days.flatMap((day) => day.activities).find((item) => item.id === id);
      if (!activity) throw new Error('Activity no longer exists. Reload the trip.');
      const original = { date: activity.date, time: activity.time, durationMinutes: activity.durationMinutes, version: activity.version };
      const { version = activity.version, ...schedule } = values;
      setTrip((current) => updateSchedule(current, id, schedule));
      try {
        const { data } = await apiRequest(`/activities/${id}`, { method: 'PATCH', body: { ...schedule, version }, getToken });
        setTrip((current) => updateSchedule(current, id, { date: data.date, time: data.time, durationMinutes: data.durationMinutes, version: data.version }));
        setConflictError('');
      } catch (error) {
        setTrip((current) => updateSchedule(current, id, original));
        if (error.code === 'ACTIVITY_CONFLICT') setConflictError(error.message);
        await loadTrip();
        throw error;
      }
    });
  }

  async function setDayDestination(date, destinationId) {
    await withMutation(async () => {
      await apiRequest(`/trips/${tripId}/days/${date}/destination`, { method: 'PUT', body: { destinationId }, getToken });
      await loadTrip();
    });
  }

  async function moveActivity(activity, date) {
    if (moving || date === activity.date) { setDragged(null); return; }
    setMoving(true);
    setMoveError('');
    try {
      await saveSchedule(activity.id, { date, version: activity.version });
      setUndoMove({ id: activity.id, date: activity.date, title: activity.title });
    } catch (error) {
      setMoveError(error.message);
      throw error;
    } finally {
      setMoving(false);
      setDragged(null);
    }
  }

  async function undoLastMove() {
    if (!undoMove || moving) return;
    setMoving(true);
    setMoveError('');
    try {
      await saveSchedule(undoMove.id, { date: undoMove.date });
      setUndoMove(null);
    } catch (error) { setMoveError(error.message); }
    finally { setMoving(false); }
  }

  async function removeActivity(id, version) {
    await withMutation(async () => {
      try {
        await apiRequest(`/activities/${id}`, { method: 'DELETE', body: { version }, getToken });
        setConflictError('');
        await loadTrip();
      } catch (error) {
        if (error.code === 'ACTIVITY_CONFLICT') {
          setConflictError(error.message);
          await loadTrip();
        }
        throw error;
      }
    });
  }

  function renderActivity(activity) {
    return <ActivityItem key={activity.id} activity={activity} trip={trip}
      onMove={(date) => moveActivity(activity, date)}
      onDragEnd={() => { setDragged(null); setDropTarget(null); }}
      onDragStart={(event) => { pollerRef.current?.stop(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(activity.id)); setDragged(activity); }}
      onEdit={() => beginEdit(activity)}
      onDelete={(version) => removeActivity(activity.id, version)}
      onToggleVisited={(visited) => updateActivity(activity.id, { visited, version: activity.version })} />;
  }

  return (
    <section className="trip-detail">
      <a className="back-link" href="/trips">← My trips</a>
      <ProfileGate isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} action="see this trip">
        {status === 'loading' && <p className="empty-state" role="status">Loading trip…</p>}
        {status === 'error' && <div className="panel empty-panel">
          <p className="error-state" role="alert">{error}</p>
          <button className="text-button" type="button" onClick={() => { setError(''); setStatus('loading'); loadTrip(); }}>Try again</button>
          <a className="text-button" href="/trips">Back to my trips</a>
        </div>}
        {status === 'ready' && trip && <>
          {conflictError && <p className="form-error" role="alert">{conflictError}</p>}
          {editingTrip
            ? <div className="panel">
                <h2>Edit trip</h2>
                <TripForm trip={trip} submitLabel="Save changes" onSubmit={saveTrip} onCancel={() => setEditingTrip(false)} />
              </div>
            : <header className="trip-header">
                <div>
                  <p className="eyebrow">{trip.destinations.map((destination) => destination.name.toUpperCase()).join(' → ')}</p>
                  <h1>{formatTripTitle(trip.title)}</h1>
                  {trip.role && <p className="trip-role">{trip.role === 'owner' ? 'Trip owner' : 'Collaborator'}</p>}
                  <p className="trip-meta">
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                    <span> · </span>{trip.dayCount} {trip.dayCount === 1 ? 'day' : 'days'}
                    <span> · </span>{trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}
                    <span> · </span>{timeZoneLabel(trip.timeZone)}
                    <span className={`trip-sync-dot${!online || syncStatus === 'error' ? ' is-error' : paused ? ' is-paused' : ''}`} role="status" title={!online ? 'Offline · Reconnect to save changes.' : paused ? 'Updates paused while you edit.' : syncStatus === 'error' ? 'Could not refresh trip. Retrying; your view may be out of date.' : 'Watching for trip changes.'} aria-label={!online ? 'Offline · Reconnect to save changes.' : paused ? 'Updates paused while you edit.' : syncStatus === 'error' ? 'Could not refresh trip. Retrying; your view may be out of date.' : 'Watching for trip changes.'} />
                  </p>
                </div>
                <div className="trip-header-actions">
                  <button className="text-button" type="button" onClick={() => { pollerRef.current?.stop(); setEditingTrip(true); }}>Edit trip</button>
                  {trip.role === 'owner' && (confirmDelete
                    ? <>
                        <button className="text-button danger" type="button" onClick={deleteTrip}>Delete trip and all activities</button>
                        <button className="text-button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </>
                    : <button className="text-button" type="button" onClick={() => { pollerRef.current?.stop(); setConfirmDelete(true); }}>Delete</button>)}
                  {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
                </div>
              </header>}

          <div ref={workspaceControlsRef} className="workspace-controls" role="group" aria-label="Trip sections">
            {indicator && <span className="workspace-indicator" aria-hidden="true" style={{ left: indicator.left, top: indicator.top, width: indicator.width, height: indicator.height }} />}
            <button type="button" aria-pressed={view === 'calendar'} onClick={() => changeView('calendar')}>Calendar</button>
            <button type="button" aria-pressed={view === 'itinerary'} onClick={() => changeView('itinerary')}>Day board</button>
            <button type="button" aria-pressed={view === 'budget'} onClick={() => changeView('budget')}>Budget</button>
            {trip.role === 'owner' && <button type="button" aria-pressed={view === 'share'} onClick={() => changeView('share')}>Share &amp; members</button>}
          </div>
          {editingActivity && <ActivityEditor key={editingActivity.id} activity={editingActivity} trip={trip} onSave={(values) => updateActivity(editingActivity.id, values, true)} onCancel={() => setEditingActivity(null)} />}
          {view === 'calendar' && <><TripCalendar trip={trip} getToken={getToken} disabled={!online || writing} onUpdate={saveSchedule} onInteractionChange={onCalendarInteraction} onEdit={beginEdit} onAdd={beginAdd} onDestinationChange={setDayDestination} />
            {addingOn && <div ref={addActivityFormRef} className="activity editing"><ActivityForm key={addingOn} date={addingOn} days={trip.days} currencyCode={trip.currencyCode} onSubmit={addActivity} onCancel={() => setAddingOn(null)} /></div>}
          </>}
          {view === 'share' && trip.role === 'owner' && <><MemberControl tripId={trip.id} getToken={getToken} /><ShareControl tripId={trip.id} getToken={getToken} /></>}

          {view === 'budget' && trip.budgetSummary && <BudgetSummary summary={trip.budgetSummary} trip={trip} onRecordSpend={(activity, actualSpend) => updateActivity(activity.id, { actualSpend, version: activity.version })} />}

          {view === 'itinerary' && <><div className="board-heading"><div><h2>Day board</h2><p>Each column is a day. Drag a card or open it to move it.</p></div><button className="primary-button" type="button" onClick={() => { const date = trip.days.find((day) => day.date === selectedDay)?.date || trip.days.find((day) => day.date === tripToday)?.date || trip.days[0].date; setSelectedDay(date); beginAdd(date); }}>+ Add activity</button></div>
          {moveError && <p className="form-error" role="alert">{moveError}</p>}
          {undoMove && <p role="status" className="move-notice">Moved {undoMove.title}. <button type="button" className="text-button" disabled={moving} onClick={undoLastMove}>Undo</button></p>}
          <label className="day-jump">Jump to day
            <select value={selectedDay || trip.days[0]?.date || ''} onChange={(event) => {
              const date = event.target.value;
              setSelectedDay(date);
              document.getElementById('day-' + date)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }}>
              {trip.days.map((day) => <option key={day.date} value={day.date}>Day {day.dayNumber} · {formatDayHeading(day.date)}</option>)}
            </select>
          </label>
          <ol className="day-list itinerary-board">
            {trip.days.map((day) => (
              <li key={day.date} id={'day-' + day.date} className={`day-card${dropTarget === day.date ? ' is-drop-target' : ''}`} onDragOver={(event) => { if (dragged && dragged.date !== day.date && !moving) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dropTarget !== day.date) setDropTarget(day.date); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={async (event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const activity = trip.days.flatMap((item) => item.activities).find((item) => String(item.id) === id); setDropTarget(null); if (!activity || moving) return; try { await moveActivity(activity, day.date); } catch { /* Error is shown above the board. */ } }}>
                <div className="day-heading">
                  <h2><span>Day {day.dayNumber}</span> {formatDayHeading(day.date)}</h2>
                  <label className="day-destination">Weather destination<select value={day.destinationId ?? ''} disabled={!online || writing} onChange={(event) => setDayDestination(day.date, Number(event.target.value))}>{trip.destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}</select></label>
                  {addingOn !== day.date && <button className="text-button day-add-activity" type="button" aria-label={`Add activity to Day ${day.dayNumber}`} title={`Add activity to Day ${day.dayNumber}`} onClick={() => beginAdd(day.date)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>}
                </div>
                <ul className="activity-list board-cards">
                  {day.activities.map((activity) => renderActivity(activity))}
                  {day.activities.length === 0 && <li className="board-empty">No activities yet. Add one below.</li>}
                </ul>
                {addingOn === day.date && <div ref={addActivityFormRef} className="activity editing">
                  <ActivityForm date={day.date} days={trip.days} currencyCode={trip.currencyCode} onSubmit={addActivity} onCancel={() => setAddingOn(null)} />
                </div>}
              </li>
            ))}
          </ol></>}
        </>}
      </ProfileGate>
    </section>
  );
}
