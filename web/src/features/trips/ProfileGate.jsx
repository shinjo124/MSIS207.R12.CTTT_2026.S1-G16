// Trip pages need a signed-in user whose local profile exists (GET /api/auth/me ran).
export default function ProfileGate({ isSignedIn, profileStatus, profileError, action, children }) {
  if (profileStatus === 'loading') return <p className="empty-state" role="status">Setting up your profile…</p>;
  if (!isSignedIn) {
    return (
      <div className="panel empty-panel">
        <p>Sign in to {action}.</p>
        <a className="primary-button" href="/sign-in">Sign in</a>
      </div>
    );
  }
  if (profileStatus === 'error') {
    return <p className="empty-state error-state" role="alert">Profile setup failed: {profileError || 'Check the API connection and try again.'}</p>;
  }
  return children;
}
