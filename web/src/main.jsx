import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import App from './App.jsx';
import { apiRequest } from './lib/api.js';
import './styles.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AuthenticatedApp() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [profileStatus, setProfileStatus] = useState('signed-out');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProfileStatus('signed-out');
      return;
    }

    const controller = new AbortController();
    setProfileStatus('loading');
    setProfileError('');
    apiRequest('/auth/me', { getToken, signal: controller.signal })
      .then(() => setProfileStatus('ready'))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setProfileError(error.message);
          setProfileStatus('error');
        }
      });

    return () => controller.abort();
  }, [getToken, isLoaded, isSignedIn]);

  return <App getToken={getToken} isSignedIn={isLoaded && Boolean(isSignedIn)} profileStatus={isLoaded ? profileStatus : 'loading'} profileError={profileError} />;
}

function AuthPage({ signUp }) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Tripo home"><span className="brand-mark">T</span> tripo</a>
        <span className="top-note">Make room for the good days.</span>
      </header>
      <section className="auth-page">
        {signUp ? <SignUp path="/sign-up" /> : <SignIn path="/sign-in" />}
      </section>
    </main>
  );
}

function AppRoot() {
  const path = window.location.pathname;
  if (path === '/sign-up' || path.startsWith('/sign-up/')) return <AuthPage signUp />;
  if (path === '/sign-in' || path.startsWith('/sign-in/')) return <AuthPage />;
  return <AuthenticatedApp />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {publishableKey
      ? <ClerkProvider
          publishableKey={publishableKey}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        ><AppRoot /></ClerkProvider>
      : <App />}
  </React.StrictMode>,
);
