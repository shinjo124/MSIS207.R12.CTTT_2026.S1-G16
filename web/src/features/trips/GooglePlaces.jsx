import { useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { getLanguage, t } from '../../lib/i18n.js';

const TYPES = [
  ['sights', 'Top sights'],
  ['food', 'Local food'],
  ['cafe', 'Cafés'],
  ['nature', 'Nature'],
  ['culture', 'History & museums'],
  ['shopping', 'Markets & shopping'],
];

// Live ideas from Google Maps. Nothing is fetched until the user picks a type, and results are not saved.
export default function GooglePlaces({ destination, getToken }) {
  const [type, setType] = useState('');
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function load(nextType) {
    setType(nextType); setStatus('loading'); setError('');
    try {
      const result = await apiRequest(`/destinations/${destination.id}/google-places?type=${nextType}&lang=${getLanguage()}`, { getToken });
      setPlaces(result.data || []);
      setStatus(result.data?.length ? 'ready' : 'empty');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('error');
    }
  }

  return (
    <div className="google-places">
      <div className="google-places-heading">
        <strong>{t('More ideas')}</strong>
        <span className="google-attribution" translate="no">Google Maps</span>
      </div>
      <div className="google-places-types" role="group" aria-label={t('Google suggestions for {name}', { name: destination.name })}>
        {TYPES.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={type === value} disabled={status === 'loading'} onClick={() => load(value)}>{t(label)}</button>
        ))}
      </div>
      {status === 'idle' && <p className="form-hint">{t('Pick a type to see popular places on Google Maps.')}</p>}
      {status === 'loading' && <p className="form-hint" role="status">{t('Searching Google Maps…')}</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">{error} <button type="button" className="text-button" onClick={() => load(type)}>{t('Try again')}</button></p>}
      {status === 'empty' && <p className="form-hint">{t('Google Maps has no results for this type.')}</p>}
      {status === 'ready' && (
        <ul className="place-suggestion-list google-place-list">
          {places.map((place) => (
            <li key={place.id}>
              <a href={place.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer">{place.name}</a>
              {typeof place.rating === 'number'
                ? <span className="google-rating" aria-label={t('Rated {rating} out of 5 from {count} reviews', { rating: place.rating, count: place.ratingCount ?? 0 })}>★ {place.rating.toFixed(1)}{place.ratingCount ? ` (${place.ratingCount.toLocaleString(getLanguage() === 'vi' ? 'vi-VN' : 'en-US')})` : ''}</span>
                : <span />}
              {(place.type || place.address) && <small>{[place.type, place.address].filter(Boolean).join(' · ')}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
