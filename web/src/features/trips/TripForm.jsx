import { useState } from 'react';
import DestinationPicker from './DestinationPicker.jsx';
import { CURRENCIES, countDays, destinationTimeZone } from './trip-format.js';

const TIME_ZONES = [['Asia/Ho_Chi_Minh', 'Vietnam'], ['Asia/Bangkok', 'Thailand'], ['Asia/Singapore', 'Singapore'], ['Asia/Tokyo', 'Japan'], ['Asia/Seoul', 'South Korea'], ['Europe/London', 'United Kingdom'], ['Europe/Paris', 'Central Europe'], ['America/Los_Angeles', 'US Pacific'], ['America/New_York', 'US Eastern']];

function initialValues(trip, initialDestination) {
  if (trip) {
    return {
      title: trip.title,
      destinations: trip.destinations.map(({ id, name, country, timeZone }) => ({ id, name, country, timeZone })),
      startDate: trip.startDate,
      endDate: trip.endDate,
      groupSize: String(trip.groupSize),
      currencyCode: trip.currencyCode,
      budget: String(Number(trip.budget)),
      timeZone: trip.timeZone || '',
    };
  }
  return { title: '', destinations: initialDestination ? [initialDestination] : [], startDate: '', endDate: '', groupSize: '2', currencyCode: 'VND', budget: '', timeZone: destinationTimeZone(initialDestination) || 'Asia/Ho_Chi_Minh' };
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

export default function TripForm({ trip = null, initialDestination = null, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(trip, initialDestination));
  const [revision] = useState(() => trip?.revision);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoneConfirmed, setZoneConfirmed] = useState(false);
  const dayCount = values.endDate >= values.startDate ? countDays(values.startDate, values.endDate) : 0;
  const destinationsChanged = Boolean(trip) && values.destinations.map((item) => item.id).join(',') !== trip.destinations.map((item) => item.id).join(',');
  const zone = values.timeZone.trim();
  const zoneChanged = zone !== (trip?.timeZone || '') || Boolean(zone && destinationsChanged);
  const automaticZone = zone && zone === destinationTimeZone(values.destinations[0]);

  const update = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    let problem = validate(values);
    if (!problem && !zone) problem = 'Set a time zone for the first destination.';
    if (!problem && zoneChanged && zone && !zoneConfirmed && !automaticZone) problem = 'Confirm that the time zone matches the trip destinations.';
    setError(problem);
    if (problem) return;

    setSaving(true);
    try {
      await onSubmit({
        ...(trip ? { revision } : {}),
        title: values.title.trim(),
        destinationIds: values.destinations.map((destination) => destination.id),
        startDate: values.startDate,
        endDate: values.endDate,
        groupSize: Number(values.groupSize),
        currencyCode: values.currencyCode,
        budget: values.budget.trim(),
        ...(zoneChanged ? { timeZone: zone || null, timeZoneConfirmed: Boolean(zoneConfirmed || automaticZone) } : {}),
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
          onChange={(destinations) => { setZoneConfirmed(false); setValues((current) => ({ ...current, destinations, timeZone: current.destinations[0]?.id !== destinations[0]?.id ? (destinations.length ? destinationTimeZone(destinations[0]) || '' : 'Asia/Ho_Chi_Minh') : current.timeZone })); }}
        />
      </fieldset>

      <label className="field field-wide">Trip time zone
        <select value={values.timeZone} onChange={(event) => { setZoneConfirmed(false); update('timeZone')(event); }}>
          {[...new Set([...TIME_ZONES.map(([zone]) => zone), values.timeZone])].filter(Boolean).map((zone) => <option key={zone} value={zone}>{TIME_ZONES.find(([value]) => value === zone)?.[1] || zone.replaceAll('_', ' ')}</option>)}
        </select>
        <span>Starts with the first destination's time zone. You can change it manually.</span>
      </label>
      {zoneChanged && zone && !automaticZone && <label className="field-wide"><input type="checkbox" checked={zoneConfirmed} onChange={(event) => setZoneConfirmed(event.target.checked)} /> I confirm this time zone matches the trip destinations.</label>}

      <label className="field">Start date
        <input type="date" value={values.startDate} onChange={update('startDate')} required />
      </label>
      <label className="field">End date
        <input type="date" value={values.endDate} min={values.startDate} onChange={update('endDate')} required />
      </label>
      <p className="day-count field-wide" aria-live="polite">
        {dayCount ? <><b>{dayCount}</b> {dayCount === 1 ? 'day' : 'days'} — start and end dates included</> : !values.startDate || !values.endDate ? 'Choose dates to see the trip length.' : 'The end date is before the start date.'}
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
