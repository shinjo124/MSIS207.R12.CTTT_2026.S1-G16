import { lazy, Suspense, useEffect, useState } from 'react';
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/react';
import { apiBaseUrl } from './lib/api.js';

const PostsFeed = lazy(() => import('./features/posts/PostsFeed.jsx'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.jsx'));
const SharedTrip = lazy(() => import('./features/trips/SharedTrip.jsx'));
const TripDetail = lazy(() => import('./features/trips/TripDetail.jsx'));
const TripsPage = lazy(() => import('./features/trips/TripsPage.jsx'));
const InvitePage = lazy(() => import('./features/trips/InvitePage.jsx'));

export function Topbar({ getToken, active, isSignedIn }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Tripo home"><span className="brand-mark">T</span> tripo</a>
      <nav className="app-nav" aria-label="Main navigation">
        {[['home', '/', isSignedIn ? 'Dashboard' : 'Home'], ['trips', '/trips', 'My trips'], ['explore', '/explore', 'Explore'], ['stories', '/stories', 'Stories']].map(([key, href, label]) => <a key={key} className="nav-link" href={href} aria-current={active === key ? 'page' : key === 'trips' && active === 'trip-detail' ? 'location' : undefined}>{label}</a>)}
      </nav>
      {getToken ? <>
        <Show when="signed-out">
          <div className="auth-controls">
            <SignInButton mode="redirect"><button className="sign-in" type="button">Sign in</button></SignInButton>
            <SignUpButton mode="redirect"><button className="sign-in" type="button">Sign up</button></SignUpButton>
          </div>
        </Show>
        <Show when="signed-in"><UserButton /></Show>
      </> : <span className="top-note">Sign in is not configured.</span>}
    </header>
  );
}

// Each route is chosen once per page load (links do full navigations), so the hook order stays stable.
export default function App(props) {
  const path = (props.path || window.location.pathname).replace(/\/+$/, '') || '/';
  const shareToken = path.match(/^\/share\/([a-f0-9]{64})$/)?.[1];
  if (shareToken) return <main className="page-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Tripo home"><span className="brand-mark">T</span> tripo</a>
      <span className="top-note">A trip to look forward to.</span>
      <a className="nav-link" href="/">Plan your own trip ↗</a>
    </header>
    <Suspense fallback={<p role="status">Loading…</p>}><SharedTrip token={shareToken} /></Suspense>
  </main>;

  if (path === '/invite') return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} /><Suspense fallback={<p role="status">Loading…</p>}><InvitePage {...props} /></Suspense></main>;

  if (path === '/trips') {
    return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} active="trips" /><Suspense fallback={<p role="status">Loading…</p>}><TripsPage {...props} /></Suspense></main>;
  }
  const tripId = path.match(/^\/trips\/(\d+)$/)?.[1];
  if (tripId) {
    return <main className="page-shell"><Topbar getToken={props.getToken} isSignedIn={props.isSignedIn} active="trip-detail" /><Suspense fallback={<p role="status">Loading…</p>}><TripDetail key={tripId} tripId={tripId} {...props} /></Suspense></main>;
  }
  return <HomePage {...props} page={path === '/explore' ? 'explore' : path === '/stories' ? 'stories' : 'home'} />;
}

function HomePage({ getToken, isSignedIn = false, profileStatus = 'signed-out', profileError = '', page }) {
  const [destinations, setDestinations] = useState([]);
  const [category, setCategory] = useState('');
  const [destinationStatus, setDestinationStatus] = useState('loading');
  const [destinationError, setDestinationError] = useState('');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (page !== 'explore') return undefined;
    const controller = new AbortController();
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    setDestinationStatus('loading');
    setDestinationError('');

    fetch(`${apiBaseUrl}/api/destinations${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Could not load destinations.');
        return result.data || [];
      })
      .then((data) => {
        setDestinations(data);
        if (!category) setCategories([...new Set(data.map((place) => place.category))].sort());
        setDestinationStatus(data.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setDestinationError(error.message || 'Could not load destinations.');
        setDestinationStatus('error');
      });

    return () => controller.abort();
  }, [category, page]);

  return (
    <main className="page-shell">
      <Topbar getToken={getToken} isSignedIn={isSignedIn} active={page} />

      {page === 'home' && isSignedIn && <Suspense fallback={<p role="status">Loading…</p>}><Dashboard getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} /></Suspense>}

      {page === 'home' && !isSignedIn && <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">GOOD TRIPS, WELL PLANNED</p>
          <h1>More time<br />for <em>there.</em></h1>
          <p className="hero-text">Bring the places, plans, and costs for your next trip together in one easy-to-share itinerary.</p>
          <a className="primary-button" href="/trips?new=1">Create a trip <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-art" aria-label="Illustration of a coastal trip">
          <div className="sun" />
          <div className="ridge ridge-back" />
          <div className="ridge ridge-front" />
          <div className="sea" />
          <div className="art-label"><span>01</span> A little further, together</div>
        </div>
      </section>}

      {page === 'explore' && <section className="destinations" aria-labelledby="destinations-title">
        <div className="section-heading">
          <div><p className="eyebrow">A PLACE TO START</p><h2 id="destinations-title">Find your kind of away.</h2></div>
          <p>Curated ideas for your next shared adventure.</p>
        </div>
        <div className="category-filters" aria-label="Filter destinations by type">
          {['', ...categories].map((item) => (
            <button key={item || 'all'} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>
              {item || 'All'}
            </button>
          ))}
        </div>
        {destinationStatus === 'loading' && <p className="empty-state" role="status">Loading destination ideas…</p>}
        {destinationStatus === 'error' && <p className="empty-state error-state" role="alert">{destinationError}</p>}
        {destinationStatus === 'empty' && <p className="empty-state">No destination ideas in this category yet.</p>}
        {destinationStatus === 'ready' && <div className="destination-grid">
          {destinations.length ? destinations.map((place) => (
            <a className="destination-card" key={place.id} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery)}`} target="_blank" rel="noreferrer">
              <div className={`destination-art destination-${place.category.toLowerCase()}`}><span>{place.category}</span><b aria-hidden="true">↗</b></div>
              <div className="destination-meta"><h3>{place.name}</h3><span>{place.country}</span></div>
              <p>{place.summary}</p>
            </a>
          )) : null}
        </div>}
      </section>}

      {page === 'stories' && <Suspense fallback={<p role="status">Loading…</p>}><PostsFeed getToken={getToken} isSignedIn={isSignedIn} profileStatus={profileStatus} profileError={profileError} /></Suspense>}

      <footer><span>tripo</span><span>Plan a little. Enjoy a lot.</span></footer>
    </main>
  );
}
