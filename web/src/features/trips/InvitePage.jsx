import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { invitationFromFragment, INVITATION_RETURN_KEY, INVITATION_STORAGE_KEY } from './invitation.js';
import { t } from '../../lib/i18n.js';

// The first visit can carry a fragment. After sign-in, the token may only be in this tab's session storage.
function storedInvitation() {
  try { return invitationFromFragment(`#token=${encodeURIComponent(sessionStorage.getItem(INVITATION_STORAGE_KEY) || '')}`); } catch { return null; }
}

export default function InvitePage({ getToken, isSignedIn, profileStatus, profileError }) {
  const [token] = useState(() => window.location.hash ? invitationFromFragment(window.location.hash) : storedInvitation());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    if (!token) return;
    try {
      sessionStorage.setItem(INVITATION_STORAGE_KEY, token);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch { setStorageAvailable(false); }
  }, [token]);

  function signIn() {
    try { sessionStorage.setItem(INVITATION_STORAGE_KEY, token); sessionStorage.setItem(INVITATION_RETURN_KEY, '1'); }
    catch { /* The user can reopen the original invitation after signing in. */ }
  }
  function cancel() {
    try { sessionStorage.removeItem(INVITATION_STORAGE_KEY); sessionStorage.removeItem(INVITATION_RETURN_KEY); } catch { /* Storage may be disabled. */ }
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  // Membership changes only after the user explicitly accepts and the API verifies the invitation.
  async function accept() {
    if (!token || !isSignedIn || profileStatus !== 'ready') return;
    setBusy(true); setMessage('');
    try {
      const result = await apiRequest('/trips/invitations/accept', { method: 'POST', body: { token }, getToken });
      try { sessionStorage.removeItem(INVITATION_STORAGE_KEY); sessionStorage.removeItem(INVITATION_RETURN_KEY); } catch { /* Storage may be disabled. */ }
      window.history.replaceState(null, '', `/trips/${result.data.tripId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) { setMessage(error.message); setBusy(false); }
  }
  return <section className="invite-page" aria-labelledby="invite-title">
    <h1 id="invite-title">{t("Trip invitation")}</h1>
    {!token ? <p>{t("This invitation is missing or invalid. Ask the trip owner for a new link.")}</p> : <>
      <p>{t("You have been invited to collaborate on a trip. Joining lets you edit its details and activities.")}</p>
      {profileStatus === 'loading' && <p role="status">{t("Setting up your profile…")}</p>}
      {!isSignedIn && profileStatus !== 'loading' && <><p>{t("Sign in before deciding whether to join.")}</p>{!storageAvailable && <p>{t("After signing in, reopen the original invitation link.")}</p>}<a className="primary-button" href="/sign-in" onClick={signIn}>{t("Sign in")}</a></>}
      {isSignedIn && profileStatus === 'error' && <p role="alert">{t("Profile setup failed:")} {profileError || t("Check the connection and try again.")}</p>}
      {isSignedIn && profileStatus === 'ready' && <button className="primary-button" type="button" onClick={accept} disabled={busy}>{busy ? t("Joining…") : t("Accept invitation")}</button>}
      {message && <p className="form-error" role="alert">{message}</p>}
    </>}
    <button className="invite-cancel" type="button" onClick={cancel} disabled={busy}>{t("Cancel")}</button>
  </section>;
}
