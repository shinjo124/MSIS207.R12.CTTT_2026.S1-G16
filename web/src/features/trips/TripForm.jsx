import { useState } from 'react';
import DestinationPicker from './DestinationPicker.jsx';
import { CURRENCIES, countDays, todayIso } from './trip-format.js';

function initialValues(trip) {
  if (trip) {
    return {
      title: trip.title,
      destinations: trip.destinations.map(({ id, name }) => ({ id, name })),
      startDate: trip.startDate,
      endDate: trip.endDate,
      groupSize: String(trip.groupSize),
      currencyCode: trip.currencyCode,
      budget: String(Number(trip.budget)),
    };
  }
  return { title: '', destinations: [], startDate: todayIso(), endDate: todayIso(), groupSize: '2', currencyCode: 'VND', budget: '' };
}

// Same rules as the API; the server still validates every request.
function validate(values) {
  if (!values.title.trim()) return 'Give the trip a title.';
  if (!values.destinations.length) return 'Choose at least one destination.';
  if (!values.startDate || !values.endDate) return 'Choose a start and end date.';
  if (values.endDate < values.startDate) return 'The end date cannot be before the start date.';
  if (countDays(values.startDate, values.endDate) > 60) return 'A trip can be at most 60 days.';
  const groupSize = Number(values.groupSize);
  if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 100) return 'Group size must be a whole number from 1 to 100.';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(values.budget.trim())) return 'Budget must be zero or a positive amount (no minus sign, at most 2 decimals).';
  return '';
}

export default function TripForm({ trip = null, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(trip));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dayCount = values.endDate >= values.startDate ? countDays(values.startDate, values.endDate) : 0;

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validate(values);
    setError(problem);
    if (problem) return;

    setSaving(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        destinationIds: values.destinations.map((destination) => destination.id),
        startDate: values.startDate,
        endDate: values.endDate,
        groupSize: Number(values.groupSize),
        currencyCode: values.currencyCode,
        budget: values.budget.trim(),
      });
    } catch (submitError) {
      setError(submitError.message);
      setSaving(false);
    }
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit} noValidate>
      <label className="field field-wide">Trip title
        <input value={values.title} onChange={update('title')} maxLength={160} placeholder="A long weekend in Da Lat" required />
      </label>

      <fieldset className="field field-wide">
        <legend>Destinations <span>(type to search, pick in visiting order)</span></legend>
        <DestinationPicker
          selected={values.destinations}
          onChange={(destinations) => setValues((current) => ({ ...current, destinations }))}
        />
      </fieldset>

      <label className="field">Start date
        <input type="date" value={values.startDate} onChange={update('startDate')} required />
      </label>
      <label className="field">End date
        <input type="date" value={values.endDate} min={values.startDate} onChange={update('endDate')} required />
      </label>
      <p className="day-count field-wide" aria-live="polite">
        {dayCount ? <><b>{dayCount}</b> {dayCount === 1 ? 'day' : 'days'} — start and end dates included</> : 'The end date is before the start date.'}
      </p>

      <label className="field">Group size
        <input type="number" min="1" max="100" step="1" value={values.groupSize} onChange={update('groupSize')} required />
      </label>
      <label className="field">Currency
        <select value={values.currencyCode} onChange={update('currencyCode')}>
          {[...new Set([...CURRENCIES, values.currencyCode])].map((code) => <option key={code}>{code}</option>)}
        </select>
      </label>
      <label className="field field-wide">Whole-trip budget ({values.currencyCode})
        <input inputMode="decimal" value={values.budget} onChange={update('budget')} placeholder="5000000" required />
      </label>

      {error && <p className="form-error field-wide" role="alert">{error}</p>}
      <div className="form-actions field-wide">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="text-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </form>
  );
}
