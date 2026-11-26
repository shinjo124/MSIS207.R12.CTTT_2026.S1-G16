import { useState } from 'react';
import { CATEGORIES, MONEY_INPUT_PATTERN, formatDayHeading, moneyInputProps } from './trip-format.js';
import { t } from '../../lib/i18n.js';

// Create and edit share this form. Edit mode loads saved values while create mode starts on the requested day.
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
    if (!values.title.trim()) problem = t('Enter a place or activity name.');
    else if (values.durationMinutes && (!/^\d+$/.test(values.durationMinutes) || Number(values.durationMinutes) < 1 || Number(values.durationMinutes) > 1440)) problem = t('Duration must be between 1 and 1440 minutes.');
    else if (values.plannedCost && !MONEY_INPUT_PATTERN.test(values.plannedCost)) problem = t('Planned cost must be zero or a positive amount.');
    else if (values.actualSpend && !MONEY_INPUT_PATTERN.test(values.actualSpend)) problem = t('Actual spend must be empty or a positive amount.');
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
      <p className="activity-form-intro field-wide">{activity ? t("Editing activity for") : t("Adding activity for")} <strong>{formatDayHeading(values.date)}</strong>. {t("Start with a name; the other details are optional.")}</p>
      <label className="field field-wide">{t("Place or activity")}
        <input value={values.title} onChange={update('title')} maxLength={160} required autoFocus />
      </label>
      <label className="field">{t("Category")}
        <select value={values.category} onChange={update('category')}>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
        </select>
      </label>
      <details className="activity-more field-wide" open={activity ? true : undefined}>
        <summary>{t("Add time, location, cost or notes (optional)")}</summary>
        <div className="activity-more-fields">
      <label className="field">{t("Time")}
        <input type="time" value={values.time} onChange={update('time')} />
      </label>
      <label className="field">{t("Duration (minutes)")}
        <input type="number" min="1" max="1440" step="1" value={values.durationMinutes} onChange={update('durationMinutes')} placeholder={t("Not set")} />
      </label>
      {activity && <label className="field">{t("Day")}
        <select value={values.date} onChange={update('date')}>
          {days.map((day) => <option key={day.date} value={day.date}>{t("Day {n}", { n: day.dayNumber })} · {formatDayHeading(day.date)}</option>)}
        </select>
      </label>}
      <label className="field">{t("City")}
        <input value={values.city} onChange={update('city')} maxLength={120} />
      </label>
      <label className="field field-wide">{t("Address")}
        <input value={values.address} onChange={update('address')} maxLength={255} />
      </label>
      <label className="field">{t("Planned cost ({currency})", { currency: currencyCode })}
        <input {...moneyInputProps(values.plannedCost, (plannedCost) => setValues((current) => ({ ...current, plannedCost })))} />
      </label>
      <label className="field">{t("Actual spend ({currency})", { currency: currencyCode })}
        <input {...moneyInputProps(values.actualSpend, (actualSpend) => setValues((current) => ({ ...current, actualSpend })))} placeholder={t("Not recorded yet")} />
      </label>
      <label className="field field-wide">{t("Note")}
        <textarea value={values.note} onChange={update('note')} maxLength={1000} rows={2} />
      </label>
        </div>
      </details>
      {error && <p className="form-error field-wide" role="alert">{error}</p>}
      <div className="form-actions field-wide">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? t("Saving…") : activity ? t("Save activity") : t("Add activity")}</button>
        <button className="text-button" type="button" onClick={onCancel} disabled={saving}>{t("Cancel")}</button>
      </div>
    </form>
  );
}
