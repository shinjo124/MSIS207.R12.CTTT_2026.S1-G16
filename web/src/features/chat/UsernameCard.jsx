import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';

// The signed-in user's Tripo username: others find them by it in Messages.
export default function UsernameCard({ getToken }) {
  const [username, setUsername] = useState(undefined);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/auth/username', { getToken, signal: controller.signal })
      .then((result) => setUsername(result.data.username))
      .catch((loadError) => { if (loadError.name !== 'AbortError') setUsername(null); });
    return () => controller.abort();
  }, [getToken]);

  async function save(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const result = await apiRequest('/auth/username', { method: 'PUT', body: { username: value }, getToken });
      setUsername(result.data.username);
      setEditing(false);
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  if (username === undefined) return null;

  if (username && !editing) {
    return (
      <p className="chat-username">
        {t('Your username')}: <strong>@{username}</strong>
        <button type="button" className="text-button" onClick={() => { setValue(username); setError(''); setEditing(true); }}>{t('Change')}</button>
      </p>
    );
  }

  return (
    <form className="chat-username-form" onSubmit={save}>
      <label htmlFor="chat-username-input">{username ? t('New username') : t('Choose a username so friends can find you')}</label>
      <div>
        <span aria-hidden="true">@</span>
        <input id="chat-username-input" value={value} maxLength={21} autoComplete="off" autoCapitalize="none" spellCheck={false}
          onChange={(event) => setValue(event.target.value)} aria-describedby="chat-username-hint" />
        <button className="primary-button" type="submit" disabled={saving || value.trim().length < 3}>{t('Save')}</button>
        {username && <button type="button" className="text-button" onClick={() => setEditing(false)}>{t('Cancel')}</button>}
      </div>
      <small id="chat-username-hint">{t('3–20 characters: letters a–z, numbers, dots or underscores.')}</small>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
