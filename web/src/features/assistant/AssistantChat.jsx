import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel, formatDayHeading, formatMoney } from '../trips/trip-format.js';
import { t } from '../../lib/i18n.js';

const TRIP_PROMPTS = [
  'Which day still has free time?',
  'How much budget is left?',
  'Suggest 3 things to do on our free day.',
  'What should I pack for this trip?',
];
const GENERAL_PROMPTS = [
  'Where should I go in Vietnam in December?',
  'Plan 3 days in Đà Lạt for a small budget.',
  'What should I eat in Huế?',
  'How do I get from Hà Nội to Hạ Long?',
];
const MAX_HISTORY = 12;

function SuggestionCard({ suggestion, trip, onAdd, disabled }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const day = trip.days.find((item) => item.date === suggestion.date);
  async function add() {
    setState('saving'); setError('');
    try {
      await onAdd({ date: suggestion.date, title: suggestion.title, category: suggestion.category, time: suggestion.time || null,
        durationMinutes: suggestion.durationMinutes ?? null, city: suggestion.city || null, address: suggestion.address || null,
        plannedCost: suggestion.plannedCost ?? '0', note: suggestion.note || null });
      setState('added');
    } catch (addError) { setError(addError.message); setState('idle'); }
  }
  return (
    <li className="assistant-suggestion">
      <div>
        <strong>{suggestion.title}</strong>
        <span>{day ? `${t('Day {n}', { n: day.dayNumber })} · ${formatDayHeading(day.date)}` : suggestion.date}{suggestion.time ? ` · ${suggestion.time}` : ''}{suggestion.durationMinutes ? ` · ${t('{n} min', { n: suggestion.durationMinutes })}` : ''}</span>
        <span>{categoryLabel(suggestion.category)}{suggestion.plannedCost ? ` · ${formatMoney(suggestion.plannedCost, trip.currencyCode)}` : ''}{suggestion.address ? ` · ${suggestion.address}` : ''}</span>
        {suggestion.note && <p>{suggestion.note}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <button className={state === 'added' ? 'text-button' : 'primary-button'} type="button" disabled={disabled || state !== 'idle'} onClick={add}>
        {state === 'added' ? t("Added ✓") : state === 'saving' ? t("Adding…") : t("Add to plan")}
      </button>
    </li>
  );
}

// One conversation. With a trip it asks about that trip; without one it answers general travel questions.
// Messages live only in memory; the parent remounts this (key) when the trip changes so history never mixes trips.
export default function AssistantChat({ trip = null, getToken, onAddActivity, disabled = false }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, status]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function ask(text, base = messages) {
    const question = text.trim();
    if (!question || status === 'loading') return;
    const history = [...base, { role: 'user', text: question }];
    setMessages(history); setDraft(''); setError(''); setStatus('loading');
    try {
      const body = { messages: history.slice(-MAX_HISTORY).map(({ role, text: messageText }) => ({ role, text: messageText })) };
      const result = await apiRequest(trip ? `/trips/${trip.id}/assistant` : '/assistant', { method: 'POST', body, getToken });
      setMessages((current) => [...current, { role: 'assistant', text: result.data.reply, suggestions: result.data.suggestions || [] }]);
      setStatus('idle');
    } catch (askError) {
      setError(askError.code === 'ASSISTANT_NOT_CONFIGURED' ? t('Tribot is not set up on this server yet.') : askError.message);
      setStatus('error');
    }
  }

  const prompts = trip ? TRIP_PROMPTS : GENERAL_PROMPTS;
  return (
    <div className="assistant-chat">
      <ol className="assistant-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <li className="assistant-empty">
            <p>{trip ? t("Ask about this trip’s schedule and budget, or get ideas you can add with one click.") : t("Ask any travel question. Choose a trip above to ask about its plan.")}</p>
            <div className="assistant-prompts">
              {prompts.map((prompt) => (
                <button key={prompt} type="button" className="text-button" disabled={disabled} onClick={() => ask(t(prompt))}>{t(prompt)}</button>
              ))}
            </div>
          </li>
        )}
        {messages.map((message, index) => (
          <li key={index} className={`assistant-message is-${message.role}`}>
            <p>{message.text}</p>
            {trip && message.suggestions?.length > 0 && (
              <ul className="assistant-suggestions" aria-label={t("Suggested activities")}>
                {message.suggestions.map((suggestion, k) => (
                  <SuggestionCard key={k} suggestion={suggestion} trip={trip} onAdd={onAddActivity} disabled={disabled} />
                ))}
              </ul>
            )}
          </li>
        ))}
        {status === 'loading' && <li className="assistant-message is-assistant is-typing" role="status"><p>{t("Thinking…")}</p></li>}
      </ol>

      {status === 'error' && (
        <p className="error-state" role="alert">{error} <button className="text-button" type="button" onClick={() => ask(messages[messages.length - 1].text, messages.slice(0, -1))}>{t("Try again")}</button></p>
      )}

      <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
        <label className="visually-hidden" htmlFor="assistant-input">{t("Ask Tribot")}</label>
        <textarea id="assistant-input" ref={inputRef} rows={1} maxLength={2000} value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(draft); } }}
          disabled={disabled || status === 'loading'} />
        <button className="primary-button" type="submit" disabled={disabled || status === 'loading' || !draft.trim()}>{t("Send")}</button>
      </form>
      <p className="assistant-disclaimer">{t("Tribot’s answers come from Google Gemini and can be wrong.")}{trip ? t(" This trip’s plan and budget are sent to Google to answer.") : ''} {t("Nothing is added until you press “Add to plan”.")}</p>
    </div>
  );
}
