import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { getLanguage, t } from '../../lib/i18n.js';
import { REGIONS, filterProvinces, groupByRegion, provinceName, provinceSummary } from './explore-data.js';
import './explore.css';

// Explore: every province and centrally run city, grouped by region. A card opens /explore/:id.
export default function ExplorePage({ active = true, search = '' }) {
  const [provinces, setProvinces] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const language = getLanguage();

  // The home page search sends people here as /explore?q=…
  useEffect(() => {
    const q = new URLSearchParams(search).get('q');
    if (q !== null) setQuery(q);
  }, [search]);

  useEffect(() => {
    if (!active || status === 'ready') return undefined;
    const controller = new AbortController();
    apiRequest('/destinations?scope=provinces', { signal: controller.signal })
      .then((result) => { setProvinces(result.data || []); setStatus(result.data?.length ? 'ready' : 'empty'); })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('error'); });
    return () => controller.abort();
  }, [active, status]);

  const groups = groupByRegion(filterProvinces(provinces, { query, region }), language);
  const count = groups.reduce((sum, group) => sum + group.provinces.length, 0);

  return (
    <section className="explore" aria-labelledby="explore-title">
      <div className="section-heading">
        <div><p className="eyebrow">{t('34 PROVINCES AND CITIES')}</p><h2 id="explore-title">{t('Explore Vietnam')}</h2></div>
        <p>{t('Pick a province to see places worth visiting there.')}</p>
      </div>

      <div className="explore-tools">
        <label className="explore-search">
          <span className="visually-hidden">{t('Search provinces')}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search a province or a former province…')} />
        </label>
        <div className="category-filters" role="group" aria-label={t('Filter by region')}>
          {['', ...REGIONS].map((item) => (
            <button key={item || 'all'} type="button" aria-pressed={region === item} onClick={() => setRegion(item)}>{item ? t(item) : t('All')}</button>
          ))}
        </div>
      </div>

      {status === 'loading' && <p className="empty-state" role="status">{t('Loading provinces…')}</p>}
      {status === 'error' && <p className="empty-state error-state" role="alert">{t('Could not load provinces.')} <button type="button" className="text-button" onClick={() => setStatus('loading')}>{t('Try again')}</button></p>}
      {status === 'empty' && <p className="empty-state">{t('No provinces yet. Run migration 019 and seed 005 first.')}</p>}
      {status === 'ready' && !count && <p className="empty-state">{t('No province matches “{query}”.', { query })}</p>}

      {groups.map((group) => (
        <section key={group.region} className="explore-region" aria-labelledby={`region-${group.region}`}>
          <h3 id={`region-${group.region}`}>{t(group.region)} <span>{group.provinces.length}</span></h3>
          <ul className="province-grid">
            {group.provinces.map((province) => (
              <li key={province.id}>
                <a className={`province-card region-${REGIONS.indexOf(province.region)}${province.imageUrl ? ' has-photo' : ''}`} href={`/explore/${province.id}`}>
                  {province.imageUrl && (
                    <span className="province-card-photo">
                      <img src={province.imageUrl} alt="" loading="lazy" />
                      {province.imageCredit && <small>{t('Photo: {credit}', { credit: province.imageCredit })}{province.imageLicense ? ` · ${province.imageLicense}` : ''}</small>}
                    </span>
                  )}
                  <span className="province-kind">{province.adminLevel === 'city' ? t('City') : t('Province')}</span>
                  <strong>{provinceName(province, language)}</strong>
                  {province.mergedFrom && <small>{t('Includes {names}', { names: province.mergedFrom })}</small>}
                  <p>{provinceSummary(province, language)}</p>
                  <span className="province-more">{t('See places to visit')} <span aria-hidden="true">→</span></span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
