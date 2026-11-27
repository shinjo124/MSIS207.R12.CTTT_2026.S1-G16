import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { getLanguage, t } from '../../lib/i18n.js';
import './trips.css';

const TYPES = [
  ['sights', 'Top sights'],
  ['food', 'Local food'],
  ['cafe', 'Cafés'],
  ['nature', 'Nature'],
  ['culture', 'History & museums'],
  ['shopping', 'Markets & shopping'],
];

// Ask the API once whether place ideas are set up; the box stays hidden until they are.
let statusPromise = null;
function placeIdeasEnabled() {
  if (!statusPromise) {
    statusPromise = apiRequest('/destinations/place-ideas/status').then((result) => Boolean(result.data?.enabled)).catch(() => { statusPromise = null; return false; });
  }
  return statusPromise;
}

// More places near a destination (OpenStreetMap data via Geoapify). Nothing loads until a type is picked.
export default function PlaceIdeas({ destination, onResults }) {
  const [enabled, setEnabled] = useState(false);
  const [type, setType] = useState('');
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    placeIdeasEnabled().then((value) => { if (alive) setEnabled(value); });
    return () => { alive = false; };
  }, []);

  async function load(nextType) {
    setType(nextType); setStatus('loading'); setError('');
    try {
      const result = await apiRequest(`/destinations/${destination.id}/place-ideas?type=${nextType}&lang=${getLanguage()}`);
      setPlaces(result.data || []);
      onResults?.(result.data || []);
      setStatus(result.data?.length ? 'ready' : 'empty');
    } catch (loadError) {
      if (loadError.code === 'PLACE_IDEAS_NOT_CONFIGURED') { setEnabled(false); return; }
      setError(loadError.message);
      setStatus('error');
    }
  }

  if (!enabled) return null;
  return (
    <div className="google-places place-ideas">
      <div className="google-places-heading">
        <strong>{t('More ideas')}</strong>
        <span className="google-attribution">
          Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
        </span>
      </div>
      <div className="google-places-types" role="group" aria-label={t('More ideas for {name}', { name: destination.name })}>
        {TYPES.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={type === value} disabled={status === 'loading'} onClick={() => load(value)}>{t(label)}</button>
        ))}
      </div>
      {status === 'idle' && <p className="form-hint">{t('Pick a type to see more places nearby.')}</p>}
      {status === 'loading' && <p className="form-hint" role="status">{t('Searching nearby…')}</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">{error} <button type="button" className="text-button" onClick={() => load(type)}>{t('Try again')}</button></p>}
      {status === 'empty' && <p className="form-hint">{t('No places of this type found nearby.')}</p>}
      {status === 'ready' && (
        <ul className="place-suggestion-list google-place-list">
          {places.map((place) => (
            <li key={place.id}>
              <a href={place.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer">{place.name}</a>
              {typeof place.distanceKm === 'number' ? <span>{t('{km} km', { km: place.distanceKm.toLocaleString(getLanguage() === 'vi' ? 'vi-VN' : 'en-US') })}</span> : <span />}
              {place.address && <small>{place.address}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
