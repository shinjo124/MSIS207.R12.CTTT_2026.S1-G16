import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import ActivityForm from './ActivityForm.jsx';
import ProfileGate from './ProfileGate.jsx';
import ShareControl from './ShareControl.jsx';
import TripForm from './TripForm.jsx';
import { categoryLabel, formatDate, formatDayHeading, formatMoney, mapsUrl } from './trip-format.js';
import './trips.css';

function ActivityItem({ activity, trip, editing, onEdit, onCancel, onSave, onDelete, onToggleVisited, onMove, onDragStart, onDragEnd }) {
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
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="activity editing">
        <ActivityForm activity={activity} days={trip.days} currencyCode={trip.currencyCode} onSubmit={onSave} onCancel={onCancel} />
      </li>
    );
  }

  const place = [activity.address, activity.city].filter(Boolean).join(', ');
  return (
    <li draggable={!busy} onDragStart={onDragStart} onDragEnd={onDragEnd} className={`activity${activity.visited ? ' visited' : ''}`}>
      <span className="activity-time">{activity.time || '—'}</span>
      <div className="activity-main">
        <p className="activity-title">
          <span className={`category-badge category-${activity.category}`}>{categoryLabel(activity.category)}</span>
          <strong>{activity.title}</strong>
        </p>
        {place && <p className="activity-place">{place}</p>}
        <p className="activity-money">
          Planned {formatMoney(activity.plannedCost, trip.currencyCode)}
          <span aria-hidden="true"> · </span>
          {activity.actualSpend == null
            ? <span className="not-recorded">Actual not recorded</span>
            : <>Actual {formatMoney(activity.actualSpend, trip.currencyCode)}</>}
        </p>
        {activity.note && <p className="activity-note">{activity.note}</p>}
        <div className="activity-actions">
          <label className="check-in">
            <input type="checkbox" checked={activity.visited} disabled={busy} onChange={() => run(() => onToggleVisited(!activity.visited))} />
            {activity.visited ? 'Visited' : 'Check in'}
          </label>
          <a href={mapsUrl(activity)} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
          <button className="text-button" type="button" onClick={onEdit} disabled={busy}>Edit</button>
          <label className="move-activity">Move to day <select value={activity.date} disabled={busy} onChange={(event) => run(() => onMove(event.target.value))}>{trip.days.map((day) => <option key={day.date} value={day.date}>Day {day.dayNumber} · {formatDayHeading(day.date)}</option>)}</select></label>
          {confirming
            ? <>
                <button className="text-button danger" type="button" disabled={busy} onClick={() => run(onDelete)}>Confirm delete</button>
                <button className="text-button" type="button" disabled={busy} onClick={() => setConfirming(false)}>Keep</button>
              </>
            : <button className="text-button" type="button" disabled={busy} onClick={() => setConfirming(true)}>Delete</button>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </li>
  );
}

function BudgetSummary({ summary, currencyCode }) {
  return (
    <section className="budget-summary" aria-labelledby="budget-summary-title">
      <h2 id="budget-summary-title">Budget summary</h2>
      <dl className="budget-totals">
        <div><dt>Budget</dt><dd>{formatMoney(summary.budget, currencyCode)}</dd></div>
        <div><dt>Actual spent</dt><dd>{formatMoney(summary.totalActualSpend, currencyCode)}</dd></div>
        <div><dt>Remaining</dt><dd>{formatMoney(summary.remainingBudget, currencyCode)}</dd></div>
        <div><dt>Over budget</dt><dd>{formatMoney(summary.overBudget, currencyCode)}</dd></div>
      </dl>
      <h3>Actual spend by category</h3>
      {summary.spendByCategory.length
        ? <ul className="budget-category-list">
            {summary.spendByCategory.map(({ category, amount }) => (
              <li key={category}><span>{categoryLabel(category)}</span><strong>{formatMoney(amount, currencyCode)}</strong></li>
            ))}
          </ul>
        : <p className="day-empty">No actual spend recorded yet.</p>}
    </section>
  );
}

export default function TripDetail({ tripId, getToken, isSignedIn, profileStatus, profileError }) {
  const [trip, setTrip] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [editingTrip, setEditingTrip] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [addingOn, setAddingOn] = useState(null);
  const [view, setView] = useState('itinerary');
  const [selectedDay, setSelectedDay] = useState('');
  const [dragged, setDragged] = useState(null);
  const [moveError, setMoveError] = useState('');
  const [undoMove, setUndoMove] = useState(null);
  const [moving, setMoving] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const ready = isSignedIn && profileStatus === 'ready';

  const loadTrip = useCallback(async (signal) => {
    try {
      const result = await apiRequest(`/trips/${tripId}`, { getToken, signal });
      setTrip(result.data);
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

  async function saveTrip(values) {
    const result = await apiRequest(`/trips/${tripId}`, { method: 'PUT', body: values, getToken });
    setTrip(result.data);
    setEditingTrip(false);
  }

  async function deleteTrip() {
    setDeleteError('');
    try {
      await apiRequest(`/trips/${tripId}`, { method: 'DELETE', getToken });
      window.location.assign('/trips');
    } catch (removeError) {
      setDeleteError(removeError.message);
    }
  }

  async function addActivity(values) {
    await apiRequest(`/trips/${tripId}/activities`, { method: 'POST', body: values, getToken });
    setAddingOn(null);
    await loadTrip();
  }

  async function updateActivity(id, values) {
    await apiRequest(`/activities/${id}`, { method: 'PATCH', body: values, getToken });
    setEditingActivity(null);
    await loadTrip();
  }

  async function moveActivity(activity, date) {
    if (moving || date === activity.date) return;
    setMoving(true);
    setMoveError('');
    try {
      await apiRequest(`/activities/${activity.id}`, { method: 'PATCH', body: { date }, getToken });
      setUndoMove({ id: activity.id, date: activity.date, title: activity.title });
      await loadTrip();
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
      await apiRequest(`/activities/${undoMove.id}`, { method: 'PATCH', body: { date: undoMove.date }, getToken });
      setUndoMove(null);
      await loadTrip();
    } catch (error) {
      setMoveError(error.message);
    } finally { setMoving(false); }
  }

  async function removeActivity(id) {
    await apiRequest(`/activities/${id}`, { method: 'DELETE', getToken });
    await loadTrip();
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
          {editingTrip
            ? <div className="panel">
                <h2>Edit trip</h2>
                <TripForm trip={trip} submitLabel="Save changes" onSubmit={saveTrip} onCancel={() => setEditingTrip(false)} />
              </div>
            : <header className="trip-header">
                <div>
                  <p className="eyebrow">{trip.destinations.map((destination) => destination.name.toUpperCase()).join(' → ')}</p>
                  <h1>{trip.title}</h1>
                  <p className="trip-meta">
                    {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                    <span> · </span>{trip.dayCount} {trip.dayCount === 1 ? 'day' : 'days'}
                    <span> · </span>{trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}
                  </p>
                </div>
                <div className="trip-header-actions">
                  <button className="text-button" type="button" onClick={() => setEditingTrip(true)}>Edit trip</button>
                  {confirmDelete
                    ? <>
                        <button className="text-button danger" type="button" onClick={deleteTrip}>Delete trip and all activities</button>
                        <button className="text-button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </>
                    : <button className="text-button" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>}
                  {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
                </div>
              </header>}

          <div className="workspace-controls" aria-label="Trip sections">
            <button type="button" aria-pressed={view === 'itinerary'} onClick={() => setView('itinerary')}>Itinerary</button>
            <button type="button" aria-pressed={view === 'budget'} onClick={() => setView('budget')}>Budget</button>
            <button type="button" aria-pressed={view === 'share'} onClick={() => setView('share')}>Share</button>
          </div>
          {view === 'share' && <ShareControl tripId={trip.id} getToken={getToken} />}

          {view === 'budget' && trip.budgetSummary && <BudgetSummary summary={trip.budgetSummary} currencyCode={trip.currencyCode} />}

          {view === 'itinerary' && <><div className="board-heading"><div><h2>Itinerary</h2><p>Drag an activity to another day, or use its move control.</p></div><button className="primary-button" type="button" onClick={() => { setAddingOn(trip.days[0].date); document.getElementById('day-' + trip.days[0].date)?.scrollIntoView({ behavior: 'smooth' }); }}>+ Add activity</button></div>
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
              <li key={day.date} id={'day-' + day.date} className="day-card" onDragOver={(event) => { if (dragged) event.preventDefault(); }} onDrop={async (event) => { event.preventDefault(); if (!dragged || moving) return; try { await moveActivity(dragged, day.date); } catch { /* Error is shown above the board. */ } }}>
                <div className="day-heading">
                  <h2><span>Day {day.dayNumber}</span> {formatDayHeading(day.date)}</h2>
                  {addingOn !== day.date && <button className="text-button" type="button" onClick={() => { setAddingOn(day.date); setEditingActivity(null); }}>+ Add activity</button>}
                </div>
                {day.activities.length === 0 && addingOn !== day.date && <p className="day-empty">Nothing planned yet.</p>}
                <ul className="activity-list">
                  {day.activities.map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                      trip={trip}
                      editing={editingActivity === activity.id}
                      onMove={(date) => moveActivity(activity, date)}
                      onDragEnd={() => setDragged(null)}
                      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(activity.id)); setDragged(activity); }}
                      onEdit={() => { setEditingActivity(activity.id); setAddingOn(null); }}
                      onCancel={() => setEditingActivity(null)}
                      onSave={(values) => updateActivity(activity.id, values)}
                      onDelete={() => removeActivity(activity.id)}
                      onToggleVisited={(visited) => updateActivity(activity.id, { visited })}
                    />
                  ))}
                </ul>
                {addingOn === day.date && <div className="activity editing">
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
