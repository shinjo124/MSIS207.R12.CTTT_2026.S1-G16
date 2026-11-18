import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { invitationUrl } from './invitation.js';
import { formatDateTime } from './trip-format.js';

export default function MemberControl({ tripId, getToken }) {
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const loadMembers = useCallback(async () => {
    setStatus('loading');
    try { const result = await apiRequest(`/trips/${tripId}/members`, { getToken }); setMembers(result.data); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }, [getToken, tripId]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function createInvite() {
    setStatus('working'); setMessage('');
    try {
      const result = await apiRequest(`/trips/${tripId}/invitations`, { method: 'POST', getToken });
      setInvite({ url: invitationUrl(window.location.origin, result.data.token), expiresAt: result.data.expiresAt });
      setStatus('ready');
    } catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function revokeInvite() {
    setStatus('working'); setMessage('');
    try { await apiRequest(`/trips/${tripId}/invitations`, { method: 'DELETE', getToken }); setInvite(null); setMessage('Invitation revoked.'); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function removeMember(id) {
    setStatus('working'); setMessage('');
    try { await apiRequest(`/trips/${tripId}/members/${id}`, { method: 'DELETE', getToken }); setMembers((current) => current.filter((member) => member.userId !== id)); setConfirming(null); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite.url); setMessage('Invitation copied.'); }
    catch { setMessage('Copy unavailable. Select and copy the link below.'); }
  }

  return <section className="share-control member-control" aria-labelledby="members-title">
    <h3 id="members-title">Trip collaborators</h3>
    <p>Invite one person to edit this trip. The link expires after 24 hours and works once. Creating a new link replaces any unused link.</p>
    <div className="share-actions"><button type="button" onClick={createInvite} disabled={status === 'working' || status === 'loading'}>Create invitation</button><button type="button" className="secondary-action" onClick={revokeInvite} disabled={status === 'working' || status === 'loading'}>Revoke invitation</button></div>
    {invite && <><div className="share-link-row"><input readOnly aria-label="Invitation link" value={invite.url} /><button type="button" onClick={copyInvite}>Copy</button></div><p>Expires {formatDateTime(invite.expiresAt)}. Share it only with someone you trust.</p></>}
    <h4>Members</h4>
    {status === 'loading' && <p role="status">Loading members…</p>}
    {status === 'ready' && members.length === 0 && <p>No collaborators yet.</p>}
    {members.length > 0 && <ul>{members.map((member) => <li key={member.userId}><span>{member.displayName}</span>{confirming === member.userId ? <span><button type="button" disabled={status === 'working'} onClick={() => removeMember(member.userId)}>Confirm removal</button> <button className="secondary-action" type="button" onClick={() => setConfirming(null)}>Cancel</button></span> : <button className="secondary-action" type="button" disabled={status === 'working'} onClick={() => setConfirming(member.userId)}>Remove</button>}</li>)}</ul>}
    {message && <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
    {status === 'error' && <button type="button" className="secondary-action" onClick={loadMembers}>Retry loading members</button>}
  </section>;
}
