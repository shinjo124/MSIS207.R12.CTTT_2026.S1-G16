import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { formatDayHeading, formatMoney } from './trip-format.js';

// Split bill: who is on the trip, who paid each recorded spend, who shares it, and who owes whom.
// `revision` reloads the data when the trip changes (for example a new actual spend).
export default function SplitBill({ tripId, revision, getToken, disabled = false }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/trips/${tripId}/split`, { getToken, signal: controller.signal })
      .then((result) => { setData(result.data); setStatus('ready'); })
      .catch((loadError) => { if (loadError.name !== 'AbortError') { setError(loadError.message); setStatus('error'); } });
    return () => controller.abort();
  }, [tripId, revision, getToken]);

  async function change(path, options) {
    setBusy(true); setError('');
    try {
      const result = await apiRequest(path, { ...options, getToken });
      setData(result.data);
      return true;
    } catch (changeError) {
      setError(changeError.message);
      return false;
    } finally { setBusy(false); }
  }

  async function addPerson(event, suggestion) {
    event?.preventDefault();
    const body = suggestion ? { name: suggestion.name, userId: suggestion.userId } : { name };
    if (!body.name.trim()) return;
    if (await change(`/trips/${tripId}/people`, { method: 'POST', body }) && !suggestion) setName('');
  }

  const removePerson = (person) => change(`/trips/${tripId}/people/${person.id}`, { method: 'DELETE' });
  const saveSplit = (expense, next) => change(`/trips/${tripId}/split/${expense.activityId}`, {
    method: 'PUT', body: { paidBy: next.paidBy ?? null, participants: next.participants ?? [] },
  });

  if (status === 'loading') return <section className="split-bill"><p className="form-hint" role="status">{t('Loading…')}</p></section>;
  if (status === 'error') return <section className="split-bill"><p className="form-hint error-state" role="alert">{error}</p></section>;

  const { people, expenses, balances, transfers, suggestions, unassigned, currencyCode } = data;
  const nameOf = (id) => people.find((person) => person.id === id)?.name || '?';
  const money = (amount) => formatMoney(amount, currencyCode);
  const locked = disabled || busy;

  return (
    <section className="split-bill" aria-labelledby="split-title">
      <div className="split-heading">
        <h2 id="split-title">{t('Split the bill')}</h2>
        <p>{t('Record who paid each spend. Tripo splits it equally and shows who should pay whom.')}</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <h3>{t('People on this trip')}</h3>
      <ul className="split-people">
        {people.map((person) => (
          <li key={person.id}>
            <span className="split-avatar" aria-hidden="true">{person.name.slice(0, 1).toUpperCase()}</span>
            {person.name}
            <button type="button" aria-label={t('Remove {name}', { name: person.name })} disabled={locked} onClick={() => removePerson(person)}>×</button>
          </li>
        ))}
        {suggestions.map((suggestion) => (
          <li key={`s${suggestion.userId}`} className="is-suggestion">
            <button type="button" disabled={locked} onClick={(event) => addPerson(event, suggestion)}>+ {suggestion.name}</button>
          </li>
        ))}
      </ul>
      <form className="split-add" onSubmit={addPerson}>
        <label className="visually-hidden" htmlFor="split-person-name">{t('Add a person')}</label>
        <input id="split-person-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder={t('Add a person')} disabled={locked} />
        <button className="primary-button" type="submit" disabled={locked || !name.trim()}>{t('Add')}</button>
      </form>

      <h3>{t('Spending to split')}</h3>
      {!expenses.length && <p className="day-empty">{t('Record actual spending below first, then choose who paid.')}</p>}
      {expenses.length > 0 && people.length === 0 && <p className="day-empty">{t('Add the people on this trip to start splitting.')}</p>}
      {expenses.length > 0 && people.length > 0 && (
        <ul className="split-expenses">
          {expenses.map((expense) => {
            const everyone = !expense.participants.length;
            const sharing = everyone ? people.map((person) => person.id) : expense.participants;
            const toggle = (id) => {
              const next = sharing.includes(id) ? sharing.filter((item) => item !== id) : [...sharing, id];
              if (!next.length) return;
              saveSplit(expense, { paidBy: expense.paidBy, participants: next.length === people.length ? [] : next });
            };
            return (
              <li key={expense.activityId}>
                <div className="split-expense-head">
                  <div><strong>{expense.title}</strong><small>{formatDayHeading(expense.date)}</small></div>
                  <b>{money(expense.amount)}</b>
                </div>
                <label className="split-payer">{t('Paid by')}
                  <select value={expense.paidBy ?? ''} disabled={locked} onChange={(event) => saveSplit(expense, { paidBy: event.target.value ? Number(event.target.value) : null, participants: expense.participants })}>
                    <option value="">{t('Choose who paid')}</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <div className="split-sharers" role="group" aria-label={t('Shared by')}>
                  <span>{t('Shared by')}</span>
                  {people.map((person) => (
                    <button key={person.id} type="button" aria-pressed={sharing.includes(person.id)} disabled={locked} onClick={() => toggle(person.id)}>{person.name}</button>
                  ))}
                  <small>{t('{amount} each', { amount: money((Number(expense.amount) / sharing.length).toFixed(2)) })}</small>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {people.length > 0 && expenses.length > 0 && <>
        <h3>{t('Balances')}</h3>
        {unassigned > 0 && <p className="form-hint">{t('{n} spends have no payer yet and are not counted.', { n: unassigned })}</p>}
        <div className="split-table-wrap"><table className="split-balances">
          <thead><tr><th scope="col">{t('Person')}</th><th scope="col">{t('Paid')}</th><th scope="col">{t('Share')}</th><th scope="col">{t('Balance')}</th></tr></thead>
          <tbody>
            {balances.map((row) => (
              <tr key={row.personId}>
                <th scope="row">{row.name}</th>
                <td>{money(row.paid)}</td>
                <td>{money(row.share)}</td>
                <td className={Number(row.net) > 0 ? 'is-positive' : Number(row.net) < 0 ? 'is-negative' : ''}>{Number(row.net) > 0 ? '+' : ''}{money(row.net)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>

        <h3>{t('Settle up')}</h3>
        {transfers.length
          ? <ul className="split-transfers">
              {transfers.map((transfer) => (
                <li key={`${transfer.from}-${transfer.to}`}>
                  <span>{nameOf(transfer.from)}</span><span aria-hidden="true">→</span><span>{nameOf(transfer.to)}</span>
                  <strong>{money(transfer.amount)}</strong>
                </li>
              ))}
            </ul>
          : <p className="day-empty">{t('Everyone is even.')}</p>}
      </>}
    </section>
  );
}
