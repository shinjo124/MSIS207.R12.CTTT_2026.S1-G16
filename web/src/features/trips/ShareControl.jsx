import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';

export default function ShareControl({ tripId, getToken }) {
  const [sharePath, setSharePath] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const shareUrl = sharePath ? new URL(sharePath.replace(/^\/api\/share\//, '/share/'), window.location.origin).toString() : '';

  const loadShare = useCallback(async () => {
    if (!getToken || !tripId) {
      setStatus('unavailable');
      return;
    }
    setStatus('loading');
    try {
      const result = await apiRequest(`/trips/${tripId}/share`, { getToken });
      setSharePath(result.data.sharePath);
      setStatus('ready');
    } catch (error) {
      setMessage(error.message);
      setStatus('error');
    }
  }, [getToken, tripId]);

  useEffect(() => { loadShare(); }, [loadShare]);

  async function createShare() {
    setMessage('');
    setStatus('working');
    try {
      const result = await apiRequest(`/trips/${tripId}/share`, { method: 'POST', getToken });
      setSharePath(result.data.sharePath);
      setStatus('ready');
    } catch (error) {
      setMessage(error.message);
      setStatus('error');
    }
  }

  async function revokeShare() {
    setMessage('');
    setStatus('working');
    try {
      await apiRequest(`/trips/${tripId}/share`, { method: 'DELETE', getToken });
      setSharePath(null);
      setStatus('ready');
    } catch (error) {
      setMessage(error.message);
      setStatus('error');
    }
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Share link copied. Anyone with it can view this trip.');
    } catch {
      setMessage('Copy was unavailable. Select and copy the link below.');
    }
  }

  if (status === 'unavailable') return <p>Sign in to manage this trip’s share link.</p>;
  if (status === 'loading') return <p role="status">Checking share link…</p>;

  return (
    <section className="share-control" aria-label="Read-only trip sharing">
      <h3>Read-only share link</h3>
      <p>Anyone with the link can view this trip. You can replace or revoke it at any time.</p>
      {sharePath && <div className="share-link-row">
        <input aria-label="Active share link" readOnly value={shareUrl} />
        <button type="button" onClick={copyShare}>Copy</button>
      </div>}
      <div className="share-actions">
        <button type="button" onClick={createShare} disabled={status === 'working'}>
          {sharePath ? 'Replace link' : 'Create link'}
        </button>
        {sharePath && <button type="button" className="secondary-action" onClick={revokeShare} disabled={status === 'working'}>Revoke</button>}
      </div>
      {message && <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
    </section>
  );
}
