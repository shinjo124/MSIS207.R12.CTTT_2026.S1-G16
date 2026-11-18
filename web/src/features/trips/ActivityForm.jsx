import { useState } from 'react';
import { CATEGORIES, formatDayHeading } from './trip-format.js';

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

function initialValues(activity, date) {
  return {
    date: activity?.date || date,
    time: activity?.time || '',
    durationMinutes: activity?.durationMinutes == null ? '' : String(activity.durationMinutes),
    category: activity?.category || 'sightseeing',
    title: activity?.title || '',
    city: activity?.city || '',
    address: activity?.address || '',
    plannedCost: activity ? String(Number(activity.plannedCost)) : '',
    // Empty = not recorded yet (stored as NULL, not 0).
    actualSpend: activity?.actualSpend == null ? '' : String(Number(activity.actualSpend)),
    note: activity?.note || '',
  };
}

export default function ActivityForm({ activity = null, date, days, currencyCode, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(activity, date));
  const [initialVersion] = useState(() => activity?.version);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    let problem = '';
    if (!values.title.trim()) problem = 'Enter a place or activity name.';
    else if (values.durationMinutes && (!/^\d+$/.test(values.durationMinutes) || Number(values.durationMinutes) < 1 || Number(values.durationMinutes) > 1440)) problem = 'Duration must be between 1 and 1440 minutes.';
    else if (values.plannedCost.trim() && !MONEY.test(values.plannedCost.trim())) problem = 'Planned cost must be zero or a positive amount.';
    else if (values.actualSpend.trim() && !MONEY.test(values.actualSpend.trim())) problem = 'Actual spend must be empty or a positive amount.';
    setError(problem);
    if (problem) return;

    setSaving(true);
    try {
      await onSubmit({
        ...(activity ? { version: initialVersion } : {}),
        date: values.date,
        time: values.time || null,
        durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : null,
        category: values.category,
        title: values.title.trim(),
        city: values.city.trim() || null,
        address: values.address.trim() || null,
        plannedCost: values.plannedCost.trim() || '0',
        actualSpend: values.actualSpend.trim() || null,
        note: values.note.trim() || null,
      });
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  }

  return (
    <form className="activity-form" onSubmit={handleSubmit} noValidate>
      <label className="field field-wide">Place or activity
        <input value={values.title} onChange={update('title')} maxLength={160} placeholder="Xuan Huong Lake" required autoFocus />
      </label>
      <label className="field">Category
        <select value={values.category} onChange={update('category')}>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <details className="activity-more field-wide" open={activity ? true : undefined}>
        <summary>Time, location, costs and notes</summary>
        <div className="activity-more-fields">
      <label className="field">Time
        <input type="time" value={values.time} onChange={update('time')} />
      </label>
      <label className="field">Duration (minutes)
        <input type="number" min="1" max="1440" step="1" value={values.durationMinutes} onChange={update('durationMinutes')} placeholder="Not set" />
      </label>
      {activity && <label className="field">Day
        <select value={values.date} onChange={update('date')}>
          {days.map((day) => <option key={day.date} value={day.date}>Day {day.dayNumber} · {formatDayHeading(day.date)}</option>)}
        </select>
      </label>}
      <label className="field">City
        <input value={values.city} onChange={update('city')} maxLength={120} placeholder="Da Lat" />
      </label>
      <label className="field field-wide">Address
        <input value={values.address} onChange={update('address')} maxLength={255} placeholder="Tran Quoc Toan, Ward 1" />
      </label>
      <label className="field">Planned cost ({currencyCode})
        <input inputMode="decimal" value={values.plannedCost} onChange={update('plannedCost')} placeholder="0" />
      </label>
      <label className="field">Actual spend ({currencyCode})
        <input inputMode="decimal" value={values.actualSpend} onChange={update('actualSpend')} placeholder="Not recorded yet" />
      </label>
      <label className="field field-wide">Note
        <textarea value={values.note} onChange={update('note')} maxLength={1000} rows={2} placeholder="Book ahead, bring a jacket…" />
      </label>
        </div>
      </details>
      {error && <p className="form-error field-wide" role="alert">{error}</p>}
      <div className="form-actions field-wide">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : activity ? 'Save activity' : 'Add activity'}</button>
        <button className="text-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}
