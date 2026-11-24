// Protected screens wait for both Clerk sign-in and the local profile created by /api/auth/me.
export default function ProfileGate({ isSignedIn, profileStatus, profileError, action, children }) {
  if (profileStatus === 'loading') return <p className="empty-state" role="status">Setting up your profile…</p>;
  if (!isSignedIn) {
    return (
      <div className="panel empty-panel">
        <p>Sign in to {action}.</p>
        <a className="primary-button" href={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`}>Sign in</a>
      </div>
    );
  }
  if (profileStatus === 'error') {
    return <p className="empty-state error-state" role="alert">Profile setup failed: {profileError || 'Check the API connection and try again.'}</p>;
  }
  return children;
}
