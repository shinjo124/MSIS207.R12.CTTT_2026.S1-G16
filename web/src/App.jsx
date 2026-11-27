import { lazy, Suspense } from 'react';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/react';
import { LANGUAGES, getLanguage, setLanguage, t } from './lib/i18n.js';

// Load feature screens when their routes first need them to keep the first bundle smaller.
const PostsFeed = lazy(() => import('./features/posts/PostsFeed.jsx'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.jsx'));
const SharedTrip = lazy(() => import('./features/trips/SharedTrip.jsx'));
const TripDetail = lazy(() => import('./features/trips/TripDetail.jsx'));
const TripsPage = lazy(() => import('./features/trips/TripsPage.jsx'));
const InvitePage = lazy(() => import('./features/trips/InvitePage.jsx'));
const ExplorePage = lazy(() => import('./features/explore/ExplorePage.jsx'));
const ProvincePage = lazy(() => import('./features/explore/ProvincePage.jsx'));
const HomeHero = lazy(() => import('./features/home/HomeHero.jsx'));
const HomeSuggestions = lazy(() => import('./features/home/HomeSuggestions.jsx'));

// VIE / ENG switch. The choice is remembered in this browser.
export function LanguageSwitch() {
  const current = getLanguage();
  return (
    <div className="language-switch" role="group" aria-label={t('Language')}>
      {LANGUAGES.map(({ code, label }) => <button key={code} type="button" lang={code} aria-pressed={current === code} onClick={() => setLanguage(code)}>{label}</button>)}
    </div>
  );
}

export function Topbar({ getToken, active, isSignedIn }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label={t("Tripo home")}><span className="brand-mark" aria-hidden="true">T</span> tripo</a>
      <nav className="app-nav" aria-label={t("Main navigation")}>
        {[['home', '/', isSignedIn ? t("Dashboard") : t("Home")], ['trips', '/trips', t("My trips")], ['explore', '/explore', t("Explore")], ['stories', '/stories', t("Stories")]].map(([key, href, label]) => <a key={key} className="nav-link" href={href} aria-current={active === key ? 'page' : key === 'trips' && active === 'trip-detail' ? 'location' : undefined}><span style={{ viewTransitionName: `main-nav-label-${key}` }}>{label}</span></a>)}
      </nav>
      <LanguageSwitch />
      {getToken ? <>
        <Show when="signed-out">
          <div className="auth-controls">
            <SignInButton mode="redirect"><button className="sign-in" type="button">{t("Sign in")}</button></SignInButton>
            <SignUpButton mode="redirect"><button className="sign-in" type="button">{t("Sign up")}</button></SignUpButton>
          </div>
        </Show>
        <Show when="signed-in"><div className="account-controls"><UserButton /></div></Show>
      </> : <span className="top-note">{t("Sign in is not configured.")}</span>}
    </header>
  );
}

// Keep the URL route separate from its query string so cached tabs can retain their state.
export default function App(props) {
  const path = (props.path || window.location.pathname).replace(/\/+$/, '') || '/';
  const shareToken = path.match(/^\/share\/([a-f0-9]{64})$/)?.[1];
  if (shareToken) return <main className="page-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label={t("Tripo home")}><span className="brand-mark" aria-hidden="true">T</span> tripo</a>
      <span className="top-note">{t("A trip to look forward to.")}</span>
      <a className="nav-link" href="/">{t("Plan your own trip ↗")}</a>
    </header>
    <Suspense fallback={<p role="status">{t("Loading…")}</p>}><SharedTrip token={shareToken} /></Suspense>
  </main>;

  if (path === '/invite') return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} /><Suspense fallback={<p role="status">{t("Loading…")}</p>}><InvitePage {...props} /></Suspense></main>;

  if (path === '/trips') {
    return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} active="trips" /><Suspense fallback={<p role="status">{t("Loading…")}</p>}><TripsPage {...props} /></Suspense></main>;
  }
  const tripId = path.match(/^\/trips\/(\d+)$/)?.[1];
  if (tripId) {
    return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} active="trip-detail" /><Suspense fallback={<p role="status">{t("Loading…")}</p>}><TripDetail key={tripId} tripId={tripId} {...props} /></Suspense></main>;
  }
  const provinceId = path.match(/^\/explore\/(\d+)$/)?.[1];
  if (provinceId) {
    return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} active="explore" /><Suspense fallback={<p role="status">{t("Loading…")}</p>}><ProvincePage key={provinceId} destinationId={provinceId} /></Suspense></main>;
  }
  if (path === '/' || path === '/explore' || path === '/stories') return <HomePage {...props} page={path === '/explore' ? 'explore' : path === '/stories' ? 'stories' : 'home'} />;
  return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} /><section className="panel empty-panel"><h1>{t("Page not found")}</h1><p>{t("This page may have moved or the address may be incomplete.")}</p><a className="primary-button" href="/">{t("Go home")}</a></section></main>;
}

// Signed-in Home uses the dashboard. Explore and Stories reuse this shell and stay public.
function HomePage({ getToken, isSignedIn = false, profileStatus = 'signed-out', profileError = '', page, active = true, search = '' }) {
  return (
    <main className="page-shell">
      <Topbar getToken={getToken} isSignedIn={isSignedIn} active={page} />

      {page === 'home' && isSignedIn && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><Dashboard getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} active={active} /></Suspense>}

      {page === 'home' && !isSignedIn && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><HomeHero /></Suspense>}
      {page === 'home' && <Suspense fallback={null}><HomeSuggestions /></Suspense>}

      {page === 'explore' && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><ExplorePage active={active} search={search} /></Suspense>}

      {page === 'stories' && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><PostsFeed getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} /></Suspense>}

      <footer className="site-footer">
        <div className="site-footer-brand"><strong>tripo</strong><span>{t("Plan a little. Enjoy a lot.")}</span></div>
        <nav aria-label={t('Footer')}>
          <a href="/explore">{t('Explore')}</a>
          <a href="/stories">{t('Stories')}</a>
          <a href="/trips?new=1">{t('Create a trip')}</a>
        </nav>
      </footer>
    </main>
  );
}
