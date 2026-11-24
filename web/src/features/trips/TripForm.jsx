import { useId, useState } from 'react';
import DestinationPicker from './DestinationPicker.jsx';
import { CURRENCIES, MONEY_INPUT_PATTERN, countDays, destinationTimeZone, moneyInputProps } from './trip-format.js';

const TIME_ZONES = [['Asia/Ho_Chi_Minh', 'Vietnam'], ['Asia/Bangkok', 'Thailand'], ['Asia/Singapore', 'Singapore'], ['Asia/Tokyo', 'Japan'], ['Asia/Seoul', 'South Korea'], ['Europe/London', 'United Kingdom'], ['Europe/Paris', 'Central Europe'], ['America/Los_Angeles', 'US Pacific'], ['America/New_York', 'US Eastern']];

function initialValues(trip, initialDestination) {
  if (trip) {
    return {
      title: trip.title,
      destinations: trip.destinations.map(({ id, name, country, timeZone, custom }) => ({ id, name, country, timeZone, custom })),
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
  if (!MONEY_INPUT_PATTERN.test(values.budget)) return 'Budget must be zero or a positive amount (no minus sign, at most 2 decimals).';
  return '';
}

export default function TripForm({ trip = null, initialDestination = null, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(trip, initialDestination));
  // Keep the revision from when editing began so the API can detect a newer trip update.
  const [revision] = useState(() => trip?.revision);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [zoneConfirmed, setZoneConfirmed] = useState(false);
  const zoneListId = useId();
  const dayCount = values.endDate >= values.startDate ? countDays(values.startDate, values.endDate) : 0;
  const destinationsChanged = Boolean(trip) && values.destinations.map((item) => item.id).join(',') !== trip.destinations.map((item) => item.id).join(',');
  const zone = values.timeZone.trim();
  const zoneChanged = zone !== (trip?.timeZone || '') || Boolean(zone && destinationsChanged);
  // A known destination zone can be accepted automatically. A different selection needs confirmation.
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
        // Use the mixed request only when creating new custom rows. Already-saved destinations can still be sent by ID.
        ...(values.destinations.some(({ draft }) => draft)
          ? { destinations: values.destinations.map(({ id, name, country, draft }) => draft ? { name, country } : { id }) }
          : { destinationIds: values.destinations.map(({ id }) => id) }),
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
      <p className="trip-form-intro field-wide">Add the places you’ll visit, set your dates, then choose a group size and budget.</p>
      <label className="field field-wide">Trip title
        <input value={values.title} onChange={update('title')} maxLength={160} placeholder="A long weekend in Da Lat" required />
      </label>

      <fieldset className="field field-wide">
        <legend>Where are you going? <span>Add destinations in the order you’ll visit them.</span></legend>
        <DestinationPicker
          selected={values.destinations}
          allowCustom
          onChange={(destinations) => { setZoneConfirmed(false); setValues((current) => ({ ...current, destinations, timeZone: current.destinations[0]?.id !== destinations[0]?.id ? (destinations.length ? destinationTimeZone(destinations[0]) || '' : 'Asia/Ho_Chi_Minh') : current.timeZone })); }}
        />
      </fieldset>

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
      <label className="field">Trip time zone
        <input list={zoneListId} value={values.timeZone} maxLength={64} placeholder="e.g. Asia/Ho_Chi_Minh"
          onChange={(event) => { setZoneConfirmed(false); update('timeZone')(event); }} />
        <datalist id={zoneListId}>
          {TIME_ZONES.map(([value, label]) => <option key={value} value={value} label={label} />)}
        </datalist>
        <span>Choose a time zone or enter one such as Asia/Ho_Chi_Minh.</span>
      </label>
      {zoneChanged && zone && !automaticZone && values.destinations.length > 0 && <label className="field-wide zone-confirm"><input type="checkbox" checked={zoneConfirmed} onChange={(event) => setZoneConfirmed(event.target.checked)} /> I confirm this time zone matches the trip destinations.</label>}
      <fieldset className="field field-wide budget-field">
        <legend>Whole-trip budget</legend>
        <div className="budget-input-row">
          <input aria-label="Whole-trip budget" {...moneyInputProps(values.budget, (budget) => setValues((current) => ({ ...current, budget })))} placeholder="5.000.000" required />
          <select aria-label="Currency" value={values.currencyCode} onChange={update('currencyCode')}>
            {[...new Set([...CURRENCIES, values.currencyCode])].map((code) => <option key={code}>{code}</option>)}
          </select>
        </div>
      </fieldset>

      {error && <p className="form-error field-wide" role="alert">{error}</p>}
      <div className="form-actions field-wide">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="text-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>}
      </div>
    </form>
  );
}
