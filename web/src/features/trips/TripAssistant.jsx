import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel, formatDayHeading, formatMoney } from './trip-format.js';

const QUICK_PROMPTS = [
  'Which day still has free time?',
  'How much budget is left, and what did we spend most on?',
  'Suggest 3 things to do on our free day.',
  'What should I pack for this trip?',
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
        <span>{day ? `Day ${day.dayNumber} · ${formatDayHeading(day.date)}` : suggestion.date}{suggestion.time ? ` · ${suggestion.time}` : ''}{suggestion.durationMinutes ? ` · ${suggestion.durationMinutes} min` : ''}</span>
        <span>{categoryLabel(suggestion.category)}{suggestion.plannedCost ? ` · ${formatMoney(suggestion.plannedCost, trip.currencyCode)}` : ''}{suggestion.address ? ` · ${suggestion.address}` : ''}</span>
        {suggestion.note && <p>{suggestion.note}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <button className={state === 'added' ? 'text-button' : 'primary-button'} type="button" disabled={disabled || state !== 'idle'} onClick={add}>
        {state === 'added' ? 'Added ✓' : state === 'saving' ? 'Adding…' : 'Add to plan'}
      </button>
    </li>
  );
}

// Chat with the trip assistant. Messages live only in this tab; suggestions are added through the normal activity API.
export default function TripAssistant({ trip, getToken, onAddActivity, disabled = false }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, status]);

  async function ask(text, base = messages) {
    const question = text.trim();
    if (!question || status === 'loading') return;
    const history = [...base, { role: 'user', text: question }];
    setMessages(history); setDraft(''); setError(''); setStatus('loading');
    try {
      const body = { messages: history.slice(-MAX_HISTORY).map(({ role, text: messageText }) => ({ role, text: messageText })) };
      const result = await apiRequest(`/trips/${trip.id}/assistant`, { method: 'POST', body, getToken });
      setMessages((current) => [...current, { role: 'assistant', text: result.data.reply, suggestions: result.data.suggestions || [] }]);
      setStatus('idle');
    } catch (askError) {
      setError(askError.code === 'ASSISTANT_NOT_CONFIGURED' ? 'The assistant is not set up on this server yet.' : askError.message);
      setStatus('error');
    }
  }

  return (
    <section className="assistant-panel" aria-labelledby="assistant-title">
      <div className="board-heading">
        <div>
          <h2 id="assistant-title">Trip assistant</h2>
          <p>Ask about this trip's schedule and budget, get ideas, or ask any travel question.</p>
        </div>
      </div>

      {messages.length === 0 && (
        <div className="assistant-empty">
          <p>Try one of these:</p>
          <div className="assistant-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" className="text-button" disabled={disabled} onClick={() => ask(prompt)}>{prompt}</button>
            ))}
          </div>
        </div>
      )}

      <ol className="assistant-messages" ref={listRef} aria-live="polite">
        {messages.map((message, index) => (
          <li key={index} className={`assistant-message is-${message.role}`}>
            <p>{message.text}</p>
            {message.suggestions?.length > 0 && (
              <ul className="assistant-suggestions" aria-label="Suggested activities">
                {message.suggestions.map((suggestion, k) => (
                  <SuggestionCard key={k} suggestion={suggestion} trip={trip} onAdd={onAddActivity} disabled={disabled} />
                ))}
              </ul>
            )}
          </li>
        ))}
        {status === 'loading' && <li className="assistant-message is-assistant is-typing" role="status"><p>Thinking…</p></li>}
      </ol>

      {status === 'error' && (
        <p className="error-state" role="alert">{error} <button className="text-button" type="button" onClick={() => ask(messages[messages.length - 1].text, messages.slice(0, -1))}>Try again</button></p>
      )}

      <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
        <label className="visually-hidden" htmlFor="assistant-input">Ask the trip assistant</label>
        <textarea id="assistant-input" rows={2} maxLength={2000} value={draft} placeholder="e.g. Ngày 2 còn trống giờ nào?"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(draft); } }}
          disabled={disabled || status === 'loading'} />
        <button className="primary-button" type="submit" disabled={disabled || status === 'loading' || !draft.trim()}>Send</button>
      </form>
      <p className="assistant-disclaimer">Answers are written by Google Gemini and can be wrong. To answer, this trip's plan and budget are sent to Google. Suggestions are only added when you press “Add to plan”.</p>
    </section>
  );
}
