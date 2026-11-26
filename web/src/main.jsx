import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import App, { LanguageSwitch } from './App.jsx';
import '@fontsource-variable/dm-sans';
import { apiRequest } from './lib/api.js';
import { t } from './lib/i18n.js';
import { useLanguage } from './lib/use-language.js';
import { runViewTransition } from './lib/view-transition.js';
import { INVITATION_RETURN_KEY, INVITATION_STORAGE_KEY } from './features/trips/invitation.js';
import './styles.css';
import './polish.css';

const ChatBubble = lazy(() => import('./features/assistant/ChatBubble.jsx'));

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const TAB_PATHS = ['/', '/trips', '/explore', '/stories'];
const defaultDescription = document.querySelector('meta[name="description"]').content;

const PUBLIC_PAGES = {
  '/': ['Tripo | Group Trip Planner', defaultDescription],
  '/explore': ['Explore Vietnam Destinations | Tripo', 'Browse destinations across Vietnam and find places to visit on your next trip.'],
  '/stories': ['Travel Stories | Tripo', 'Browse travel stories and photos shared by the Tripo community.'],
};

function updatePageMetadata() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = Object.hasOwn(PUBLIC_PAGES, path) ? PUBLIC_PAGES[path] : null;
  const canonical = document.querySelector('link[rel="canonical"]');
  const robots = document.querySelector('meta[name="robots"]');

  if (page) {
    const [title, description] = page;
    const url = `https://www.tripo.website${path}`;
    const link = canonical || document.createElement('link');
    link.rel = 'canonical';
    link.href = url;
    if (!canonical) document.head.append(link);
    robots?.remove();
    document.title = title;
    document.querySelector('meta[name="description"]').content = description;
    return;
  }

  canonical?.remove();
  // Trip, share, account, and unrecognized URLs should stay out of search results.
  const meta = robots || document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex';
  if (!robots) document.head.append(meta);
  document.title = 'Tripo';
  document.querySelector('meta[name="description"]').content = defaultDescription;
}

updatePageMetadata();

// Keep visited top-level tabs mounted so switching tabs preserves their local UI state.
function AuthenticatedPages({ path, search, ...props }) {
  const [visitedPaths, setVisitedPaths] = useState(() => TAB_PATHS.includes(path) ? [path] : []);
  const paths = TAB_PATHS.includes(path) && !visitedPaths.includes(path) ? [...visitedPaths, path] : visitedPaths;

  useEffect(() => {
    if (TAB_PATHS.includes(path)) setVisitedPaths((current) => current.includes(path) ? current : [...current, path]);
  }, [path]);

  return <>
    {paths.map((tabPath) => <div key={tabPath} className={`route-page${tabPath === path ? ' is-active' : ''}`} hidden={tabPath !== path}>
      <App path={tabPath} search={tabPath === path ? search : ''} active={tabPath === path} {...props} />
    </div>)}
    {!TAB_PATHS.includes(path) && <div className="route-page is-active"><App path={path} search={search} active {...props} /></div>}
  </>;
}

// Clerk provides the session. Tripo still needs a matching local profile before protected reads and writes.
function AuthenticatedApp({ path, search }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [profileStatus, setProfileStatus] = useState('signed-out');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || path !== '/') return;
    try {
      if (sessionStorage.getItem(INVITATION_RETURN_KEY) && sessionStorage.getItem(INVITATION_STORAGE_KEY)) {
        sessionStorage.removeItem(INVITATION_RETURN_KEY);
        window.history.replaceState(null, '', '/invite');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch { /* The invitation can be reopened after sign in. */ }
  }, [isLoaded, isSignedIn, path]);

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
  }, [getToken, isLoaded, isSignedIn, userId]);

  return <>
    <AuthenticatedPages key={userId || 'guest'} path={path} search={search} getToken={getToken} isSignedIn={isLoaded && Boolean(isSignedIn)} profileStatus={isLoaded ? profileStatus : 'loading'} profileError={profileError} />
    {isLoaded && isSignedIn && profileStatus === 'ready' && <Suspense fallback={null}><ChatBubble key={userId} path={path} getToken={getToken} /></Suspense>}
  </>;
}

function AuthPage({ signUp }) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label={t("Tripo home")}><span className="brand-mark" aria-hidden="true">T</span> tripo</a>
        <span className="top-note">{t("Make room for the good days.")}</span>
        <LanguageSwitch />
      </header>
      <section className="auth-page">
        {signUp ? <SignUp path="/sign-up" /> : <SignIn path="/sign-in" />}
      </section>
    </main>
  );
}

// Track path and query together so links such as /trips?new=1 can open the right view.
function AppRoot() {
  useLanguage(); // re-render every screen when VIE / ENG changes
  const [path, setPath] = useState(() => `${window.location.pathname}${window.location.search}`);
  useEffect(() => {
    const updatePath = () => {
      updatePageMetadata();
      setPath(`${window.location.pathname}${window.location.search}`);
    };
    const followLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up')) return;
      event.preventDefault();
      runViewTransition(() => {
        window.history.pushState(null, '', url.pathname + url.search);
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo(0, 0);
      });
    };
    window.addEventListener('popstate', updatePath);
    document.addEventListener('click', followLink);
    return () => { window.removeEventListener('popstate', updatePath); document.removeEventListener('click', followLink); };
  }, []);
  const url = new URL(path, window.location.origin);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/sign-up' || pathname.startsWith('/sign-up/')) return <AuthPage signUp />;
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return <AuthPage />;
  return <AuthenticatedApp path={pathname} search={url.search} />;
}

function LanguageRoot() { useLanguage(); return <App />; }

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
      : <LanguageRoot />}
  </React.StrictMode>,
);
