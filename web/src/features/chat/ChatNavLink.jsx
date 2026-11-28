import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { onChatEvent, startChatRealtime } from '../../lib/chat-realtime.js';
import { t } from '../../lib/i18n.js';

// "Messages" link in the top bar with an unread badge.
export default function ChatNavLink({ getToken, active }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => apiRequest('/chat/unread', { getToken }).then((result) => { if (alive) setUnread(result.data.unread); }).catch(() => {});
    startChatRealtime(getToken);
    load();
    const poll = setInterval(load, 30000);
    const off = onChatEvent((event) => { if (event.type === 'message' || event.type === 'read') load(); });
    return () => { alive = false; clearInterval(poll); off(); };
  }, [getToken]);

  return (
    <a className="nav-link chat-nav-link" href="/messages" aria-current={active ? 'page' : undefined}>
      <span>{t('Messages')}</span>
      {unread > 0 && <b className="chat-badge" aria-label={t('{n} unread messages', { n: unread })}>{unread > 99 ? '99+' : unread}</b>}
    </a>
  );
}
