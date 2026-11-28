import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { emitLocalChatEvent, isRealtime, onChatEvent, startChatRealtime } from '../../lib/chat-realtime.js';
import { getLanguage, t } from '../../lib/i18n.js';
import { formatDateTime } from '../trips/trip-format.js';
import './chat.css';

function Avatar({ name, url, group = false }) {
  if (url) return <img className="chat-avatar" src={url} alt="" />;
  return <span className={`chat-avatar${group ? ' is-group' : ''}`} aria-hidden="true">{group ? '✈' : (name || '?').slice(0, 1).toUpperCase()}</span>;
}

function goTo(url) {
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Messenger-style page: conversation list on the left, the open conversation on the right.
export default function MessagesPage({ getToken, search = '' }) {
  const openId = Number(new URLSearchParams(search).get('c')) || null;
  const [conversations, setConversations] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const listRef = useRef(null);
  const language = getLanguage();

  const loadList = useCallback(() => apiRequest('/chat/conversations', { getToken })
    .then((result) => setConversations(result.data)).catch(() => setConversations((current) => current || [])), [getToken]);

  const loadThread = useCallback(async (id, keep = false) => {
    if (!id) { setThread(null); return; }
    try {
      const result = await apiRequest(`/chat/conversations/${id}/messages`, { getToken });
      setThread((current) => (keep && current?.id === id && current.messages.length > result.data.messages.length ? current : result.data));
      setThreadError('');
      const last = result.data.messages[result.data.messages.length - 1];
      if (last && !last.mine) {
        await apiRequest(`/chat/conversations/${id}/read`, { method: 'POST', body: { messageId: last.id }, getToken }).catch(() => {});
        emitLocalChatEvent({ type: 'read', conversationId: id });
        loadList();
      }
    } catch (error) { setThreadError(error.message); }
  }, [getToken, loadList]);

  useEffect(() => { startChatRealtime(getToken); loadList(); }, [getToken, loadList]);
  useEffect(() => { setThread(null); setThreadError(''); setSendError(''); loadThread(openId); }, [openId, loadThread]);

  // Realtime events refresh at once; polling keeps things current when Ably is off (and as a safety net).
  useEffect(() => {
    const off = onChatEvent((event) => {
      if (event.type !== 'message') return;
      loadList();
      if (event.conversationId === openId) loadThread(openId, true);
    });
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadList();
      if (openId) loadThread(openId, true);
    }, isRealtime() ? 30000 : 4000);
    return () => { off(); clearInterval(poll); };
  }, [openId, loadList, loadThread]);

  useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' }); }, [thread?.messages.length, thread?.id]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setPeople([]); return undefined; }
    const timer = setTimeout(() => {
      apiRequest(`/chat/users?q=${encodeURIComponent(q)}`, { getToken }).then((result) => setPeople(result.data)).catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, getToken]);

  async function startChat(person) {
    const result = await apiRequest('/chat/direct', { method: 'POST', body: { userId: person.id }, getToken });
    setQuery(''); setPeople([]);
    await loadList();
    goTo(`/messages?c=${result.data.id}`);
  }

  async function send(event) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || !thread || sending) return;
    setSending(true); setSendError('');
    try {
      await apiRequest(`/chat/conversations/${thread.id}/messages`, { method: 'POST', body: { body }, getToken });
      setDraft('');
      await loadThread(thread.id);
      loadList();
    } catch (error) { setSendError(error.message); } finally { setSending(false); }
  }

  async function toggleBlock() {
    const other = thread.members.find((member) => member.id !== thread.viewerId);
    if (!other) return;
    if (thread.blockedByMe) await apiRequest(`/chat/blocks/${other.id}`, { method: 'DELETE', getToken });
    else if (window.confirm(t('Block {name}? You will not be able to message each other.', { name: other.name }))) await apiRequest('/chat/blocks', { method: 'POST', body: { userId: other.id }, getToken });
    loadThread(thread.id);
  }

  const time = (value) => formatDateTime(value, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

  return (
    <section className={`chat-page${openId ? ' has-open' : ''}`} aria-label={t('Messages')}>
      <aside className="chat-sidebar">
        <h1>{t('Messages')}</h1>
        <label className="chat-search">
          <span className="visually-hidden">{t('Find people')}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Find people to message…')} />
        </label>
        {people.length > 0 && (
          <ul className="chat-people">
            {people.map((person) => (
              <li key={person.id}><button type="button" onClick={() => startChat(person)}><Avatar name={person.name} url={person.avatarUrl} />{person.name}</button></li>
            ))}
          </ul>
        )}
        {conversations === null && <p className="chat-hint" role="status">{t('Loading…')}</p>}
        {conversations?.length === 0 && !people.length && <p className="chat-hint">{t('No conversations yet. Search for someone above, or open a trip and press “Group chat”.')}</p>}
        <ul className="chat-list">
          {(conversations || []).map((item) => (
            <li key={item.id}>
              <a href={`/messages?c=${item.id}`} className={`${item.id === openId ? 'is-open' : ''}${item.unread ? ' is-unread' : ''}`}>
                <Avatar name={item.title} url={item.avatarUrl} group={item.kind === 'trip'} />
                <span className="chat-list-text">
                  <strong>{item.title || t('Conversation')}</strong>
                  <small>{item.lastMessage ? `${item.lastMessage.mine ? `${t('You')}: ` : ''}${item.lastMessage.preview}` : t('No messages yet')}</small>
                </span>
                {item.unread > 0 && <b className="chat-badge">{item.unread}</b>}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <div className="chat-thread">
        {!openId && <p className="chat-empty">{t('Choose a conversation or find someone to message.')}</p>}
        {openId && threadError && <p className="chat-empty error-state" role="alert">{threadError}</p>}
        {openId && !thread && !threadError && <p className="chat-empty" role="status">{t('Loading…')}</p>}
        {thread && (
          <>
            <header className="chat-thread-head">
              <a className="chat-back" href="/messages" aria-label={t('Back to conversations')}>←</a>
              <Avatar name={thread.title} group={thread.kind === 'trip'} url={thread.kind === 'direct' ? thread.members.find((m) => m.id !== thread.viewerId)?.avatarUrl : null} />
              <div>
                <strong>{thread.title}</strong>
                <small>{thread.kind === 'trip' ? t('Trip group · {n} people', { n: thread.members.length }) : t('Direct message')}</small>
              </div>
              {thread.kind === 'trip' && thread.tripId && <a className="text-button" href={`/trips/${thread.tripId}`}>{t('Open trip')}</a>}
              {thread.kind === 'direct' && <button type="button" className="text-button" onClick={toggleBlock}>{thread.blockedByMe ? t('Unblock') : t('Block')}</button>}
            </header>
            <ol className="chat-messages" ref={listRef} aria-live="polite">
              {thread.messages.length === 0 && <li className="chat-hint">{t('Say hello!')}</li>}
              {thread.messages.map((message, index) => {
                const previous = thread.messages[index - 1];
                const showName = thread.kind === 'trip' && !message.mine && previous?.senderId !== message.senderId;
                return (
                  <li key={message.id} className={`chat-message ${message.mine ? 'is-mine' : 'is-theirs'}`}>
                    {showName && <span className="chat-sender">{message.senderName}</span>}
                    <p lang={language}>{message.body}</p>
                    <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
                  </li>
                );
              })}
            </ol>
            {thread.blocked
              ? <p className="chat-blocked">{thread.blockedByMe ? t('You blocked this person. Unblock to send messages.') : t('You cannot message this person.')}</p>
              : (
                <form className="chat-composer" onSubmit={send}>
                  <label className="visually-hidden" htmlFor="chat-input">{t('Message')}</label>
                  <textarea id="chat-input" rows={1} maxLength={2000} value={draft} placeholder={t('Write a message…')}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
                  <button className="primary-button" type="submit" disabled={sending || !draft.trim()}>{t('Send')}</button>
                </form>
              )}
            {sendError && <p className="form-error chat-send-error" role="alert">{sendError}</p>}
          </>
        )}
      </div>
    </section>
  );
}

