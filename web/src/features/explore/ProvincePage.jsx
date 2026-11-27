import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { getLanguage, t } from '../../lib/i18n.js';
import PlaceIdeas from '../trips/PlaceIdeas.jsx';
import ProvinceMap from './ProvinceMap.jsx';
import { placeCategories, provinceName, provinceSummary } from './explore-data.js';
import './explore.css';

// One province: its summary, the places worth visiting (catalogue), and more ideas from Google Maps.
export default function ProvincePage({ destinationId }) {
  const [province, setProvince] = useState(null);
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [ideas, setIdeas] = useState([]);
  const language = getLanguage();

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    Promise.all([
      apiRequest(`/destinations/${destinationId}`, { signal: controller.signal }),
      apiRequest(`/destinations/${destinationId}/places`, { signal: controller.signal }),
    ]).then(([destination, list]) => {
      setProvince(destination.data);
      setPlaces(list.data || []);
      setStatus('ready');
    }).catch((loadError) => {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setStatus('error');
    });
    return () => controller.abort();
  }, [destinationId]);

  if (status === 'loading') return <p className="empty-state" role="status">{t('Loading…')}</p>;
  if (status === 'error') return <section className="panel empty-panel"><h1>{t('Could not open this place.')}</h1><p>{error}</p><a className="primary-button" href="/explore">{t('Back to Explore')}</a></section>;

  const name = provinceName(province, language);
  const categories = placeCategories(places);
  const visible = category ? places.filter((place) => place.category === category) : places;

  return (
    <article className="province-page">
      <a className="back-link" href="/explore">{t('← Explore')}</a>
      <header className="province-hero">
        <p className="eyebrow">{t(province.region)} · {province.adminLevel === 'city' ? t('City') : t('Province')}</p>
        <h1>{name}</h1>
        <p>{provinceSummary(province, language)}</p>
        {province.mergedFrom && <p className="province-merged">{t('Since 2025 this includes the former provinces: {names}.', { names: province.mergedFrom })}</p>}
        <a className="primary-button" href={`/trips?new=1&destination=${encodeURIComponent(province.id)}`}>{t('Plan a trip to {name}', { name })} <span aria-hidden="true">↗</span></a>
      </header>

      {province.latitude != null && province.longitude != null && (
        <ProvinceMap center={{ latitude: Number(province.latitude), longitude: Number(province.longitude) }} places={visible} ideas={ideas} />
      )}

      <section className="province-places" aria-labelledby="places-title">
        <div className="province-places-heading">
          <h2 id="places-title">{t('Places worth visiting')}</h2>
          {categories.length > 1 && (
            <div className="category-filters" role="group" aria-label={t('Filter by type')}>
              {['', ...categories].map((item) => (
                <button key={item || 'all'} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item ? t(item) : t('All')}</button>
              ))}
            </div>
          )}
        </div>
        {!places.length && <p className="empty-state">{t('No places listed here yet.')}</p>}
        <ul className="province-place-grid">
          {visible.map((place) => (
            <li key={place.id} className="province-place has-photo">
              {!place.imageUrl && <div className={`province-place-photo is-empty tag-${place.category.toLowerCase()}`} aria-hidden="true"><span>{place.name.slice(0, 1)}</span></div>}
              {place.imageUrl && (
                <figure className="province-place-photo">
                  <img src={place.imageUrl} alt={place.name} loading="lazy" />
                  <figcaption>
                    <a href={place.imagePageUrl || 'https://commons.wikimedia.org/'} target="_blank" rel="noreferrer">
                      {t('Photo: {credit}', { credit: place.imageCredit || 'Wikimedia Commons' })}{place.imageLicense ? ` · ${place.imageLicense}` : ''}
                    </a>
                  </figcaption>
                </figure>
              )}
              <span className={`place-tag tag-${place.category.toLowerCase()}`}>{t(place.category)}</span>
              <h3>{place.name}</h3>
              {place.address && <small>{place.address}</small>}
              <p>{provinceSummary(place, language)}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery || `${place.name}, ${name}`)}`} target="_blank" rel="noreferrer">{t('Open in Google Maps ↗')}</a>
            </li>
          ))}
        </ul>
      </section>

      <PlaceIdeas key={province.id} destination={{ id: province.id, name }} onResults={setIdeas} />
    </article>
  );
}
