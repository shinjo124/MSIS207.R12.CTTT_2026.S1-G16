import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { invitationUrl } from './invitation.js';
import { formatDateTime } from './trip-format.js';
import { t } from '../../lib/i18n.js';

// This owner panel manages edit access. The invitation is separate from the public read-only share link.
export default function MemberControl({ tripId, getToken }) {
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(null);
  const [showInviteUrl, setShowInviteUrl] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const loadMembers = useCallback(async () => {
    setStatus('loading');
    try { const result = await apiRequest(`/trips/${tripId}/members`, { getToken }); setMembers(result.data); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }, [getToken, tripId]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  // The API returns the raw invitation only when creating it, so this panel holds the copyable link.
  async function createInvite() {
    setStatus('working'); setMessage('');
    try {
      const result = await apiRequest(`/trips/${tripId}/invitations`, { method: 'POST', getToken });
      setInvite({ url: invitationUrl(window.location.origin, result.data.token), expiresAt: result.data.expiresAt });
      setShowInviteUrl(false);
      setStatus('ready');
    } catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function revokeInvite() {
    setStatus('working'); setMessage('');
    try { await apiRequest(`/trips/${tripId}/invitations`, { method: 'DELETE', getToken }); setInvite(null); setMessage(t('Invitation revoked.')); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function removeMember(id) {
    setStatus('working'); setMessage('');
    try { await apiRequest(`/trips/${tripId}/members/${id}`, { method: 'DELETE', getToken }); setMembers((current) => current.filter((member) => member.userId !== id)); setConfirming(null); setStatus('ready'); }
    catch (error) { setMessage(error.message); setStatus('error'); }
  }
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite.url); setMessage(t('Invitation copied.')); }
    catch { setShowInviteUrl(true); setMessage(t('Copy unavailable. Select and copy the link below.')); }
  }

  return <section className="share-control member-control" aria-labelledby="members-title">
    <h3 id="members-title">{t("Trip collaborators")}</h3>
    <p>{t("Invite one person to edit this trip. The link expires after 24 hours and works once. Creating a new link replaces any unused link.")}</p>
    <div className="share-actions"><button type="button" onClick={createInvite} disabled={status === 'working' || status === 'loading'}>{t("Create invitation")}</button><button type="button" className="secondary-action" onClick={revokeInvite} disabled={status === 'working' || status === 'loading'}>{t("Revoke invitation")}</button></div>
    {invite && <><div className="share-link-row"><input readOnly aria-label={t("Invitation link")} value={showInviteUrl ? invite.url : t('Invitation link ready to copy')} /><button type="button" onClick={copyInvite}>{t("Copy link")}</button></div><p>{t("Expires {date}. Share it only with someone you trust.", { date: formatDateTime(invite.expiresAt) })}</p></>}
    <h4>{t("Members")}</h4>
    {status === 'loading' && <p role="status">{t("Loading members…")}</p>}
    {status === 'ready' && members.length === 0 && <p>{t("No collaborators yet.")}</p>}
    {members.length > 0 && <ul>{members.map((member) => <li key={member.userId}><span>{member.displayName}</span>{confirming === member.userId ? <span><button type="button" disabled={status === 'working'} onClick={() => removeMember(member.userId)}>{t("Confirm removal")}</button> <button className="secondary-action" type="button" onClick={() => setConfirming(null)}>{t("Cancel")}</button></span> : <button className="secondary-action" type="button" disabled={status === 'working'} onClick={() => setConfirming(member.userId)}>{t("Remove")}</button>}</li>)}</ul>}
    {message && <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
    {status === 'error' && <button type="button" className="secondary-action" onClick={loadMembers}>{t("Retry loading members")}</button>}
  </section>;
}
