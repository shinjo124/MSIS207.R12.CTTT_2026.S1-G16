import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/react';
import { apiRequest } from './lib/api.js';
import { LANGUAGES, getLanguage, setLanguage, t } from './lib/i18n.js';

// Load feature screens when their routes first need them to keep the first bundle smaller.
const PostsFeed = lazy(() => import('./features/posts/PostsFeed.jsx'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.jsx'));
const SharedTrip = lazy(() => import('./features/trips/SharedTrip.jsx'));
const TripDetail = lazy(() => import('./features/trips/TripDetail.jsx'));
const TripsPage = lazy(() => import('./features/trips/TripsPage.jsx'));
const InvitePage = lazy(() => import('./features/trips/InvitePage.jsx'));

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
  if (path === '/' || path === '/explore' || path === '/stories') return <HomePage {...props} page={path === '/explore' ? 'explore' : path === '/stories' ? 'stories' : 'home'} />;
  return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} /><section className="panel empty-panel"><h1>{t("Page not found")}</h1><p>{t("This page may have moved or the address may be incomplete.")}</p><a className="primary-button" href="/">{t("Go home")}</a></section></main>;
}

// Signed-in Home uses the dashboard. Explore and Stories reuse this shell and stay public.
function HomePage({ getToken, isSignedIn = false, profileStatus = 'signed-out', profileError = '', page, active = true }) {
  const [destinations, setDestinations] = useState([]);
  const [category, setCategory] = useState('');
  const [destinationStatus, setDestinationStatus] = useState('loading');
  const [destinationError, setDestinationError] = useState('');
  const [categories, setCategories] = useState([]);
  const loadedDestinationQuery = useRef(null);

  useEffect(() => {
    if (page !== 'explore' || !active) return undefined;
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    if (loadedDestinationQuery.current === query) return undefined;
    const controller = new AbortController();
    setDestinationError('');

    apiRequest(`/destinations${query}`, { getToken, signal: controller.signal })
      .then((result) => result.data || [])
      .then((data) => {
        loadedDestinationQuery.current = query;
        setDestinations(data);
        if (!category) setCategories([...new Set(data.map((place) => place.category))].sort());
        setDestinationStatus(data.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setDestinationError(error.message || t('Could not load destinations.'));
        setDestinationStatus('error');
      });

    return () => controller.abort();
  }, [active, category, page]);

  return (
    <main className="page-shell">
      <Topbar getToken={getToken} isSignedIn={isSignedIn} active={page} />

      {page === 'home' && isSignedIn && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><Dashboard getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} active={active} /></Suspense>}

      {page === 'home' && !isSignedIn && <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">{t("GOOD TRIPS, WELL PLANNED")}</p>
          <h1>{t("More time")}<br />{t("for")} <em>{t("there.")}</em></h1>
          <p className="hero-text">{t("Bring the places, plans, and costs for your next trip together in one easy-to-share itinerary.")}</p>
          <a className="primary-button" href="/trips?new=1">{t("Create a trip")} <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-art" aria-label={t("Illustration of a coastal trip")}>
          <div className="sun" />
          <div className="ridge ridge-back" />
          <div className="ridge ridge-front" />
          <div className="sea" />
          <div className="art-label"><span>01</span> {t("A little further, together")}</div>
        </div>
      </section>}

      {page === 'explore' && <section className="destinations" aria-labelledby="destinations-title">
        <div className="section-heading">
          <div><p className="eyebrow">{t("A PLACE TO START")}</p><h2 id="destinations-title">{t("Find your kind of away.")}</h2></div>
          <p>{t("Curated ideas for your next shared adventure.")}</p>
        </div>
        <div className="category-filters" aria-label={t("Filter destinations by type")}>
          {['', ...categories].map((item) => (
            <button key={item || 'all'} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>
              {item ? t(item) : t("All")}
            </button>
          ))}
        </div>
        {destinationStatus === 'loading' && <p className="empty-state" role="status">{t("Loading destination ideas…")}</p>}
        {destinationStatus === 'error' && <p className="empty-state error-state" role="alert">{destinationError}</p>}
        {destinationStatus === 'empty' && <p className="empty-state">{t("No destination ideas in this category yet.")}</p>}
        {destinationStatus === 'ready' && <div className="destination-grid">
          {destinations.length ? destinations.map((place) => (
            <article className="destination-card" key={place.id}>
              <div className={`destination-art destination-${place.category.toLowerCase()}`}>{place.imageUrl && <img src={place.imageUrl} alt={`${place.name}, ${place.country}`} loading="lazy" />}<span>{t(place.category)}</span></div>
              <div className="destination-meta"><h3>{place.name}</h3><span>{t(place.country)}</span></div>
              <p>{place.summary}</p>
              {place.bestSeason && <p className="destination-season">{t("Best season · {season}", { season: place.bestSeason })}</p>}
              <a className="text-button" href={`/trips?new=1&destination=${encodeURIComponent(place.id)}`}>{t("Plan a trip here")}</a>
            </article>
          )) : null}
        </div>}
      </section>}

      {page === 'stories' && <Suspense fallback={<p role="status">{t("Loading…")}</p>}><PostsFeed getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} /></Suspense>}

      <footer><span>tripo</span><span>{t("Plan a little. Enjoy a lot.")}</span></footer>
    </main>
  );
}
