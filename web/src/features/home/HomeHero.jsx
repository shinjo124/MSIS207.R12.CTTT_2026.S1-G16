import { useEffect, useState } from 'react';
import { getLanguage, t } from '../../lib/i18n.js';
import { loadCatalogue } from './catalogue.js';
import { heroPhotos } from './home-data.js';
import './home.css';

function goTo(url) {
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

// Signed-out home hero: search box into Explore, quick facts, and a photo collage.
export default function HomeHero() {
  const [photos, setPhotos] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((items) => { if (alive) setPhotos(heroPhotos(items)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  function search(event) {
    event.preventDefault();
    const text = query.trim();
    goTo(text ? `/explore?q=${encodeURIComponent(text)}` : '/explore');
  }

  const language = getLanguage();
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy">
        <p className="home-pill"><span aria-hidden="true">✦</span> {t('Plan together, travel lighter')}</p>
        <h1 id="home-hero-title">{t('Your next trip,')} <em>{t('planned in one place.')}</em></h1>
        <p className="home-hero-text">{t('Bring the places, plans, and costs for your next trip together in one easy-to-share itinerary.')}</p>
        <form className="home-search" role="search" onSubmit={search}>
          <label className="visually-hidden" htmlFor="home-search-input">{t('Where do you want to go?')}</label>
          <span aria-hidden="true" className="home-search-icon">⌕</span>
          <input id="home-search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Where do you want to go?')} />
          <button type="submit">{t('Explore')}</button>
        </form>
        <div className="home-hero-actions">
          <a className="home-cta" href="/trips?new=1">{t('Create a trip')} <span aria-hidden="true">→</span></a>
          <a className="home-link" href="/stories">{t('Read travel stories')}</a>
        </div>
        <ul className="home-stats" aria-label={t('Tripo in numbers')}>
          <li><strong>34</strong><span>{t('provinces and cities')}</span></li>
          <li><strong>200+</strong><span>{t('places worth visiting')}</span></li>
          <li><strong>AI</strong><span>{t('Tribot travel assistant')}</span></li>
        </ul>
      </div>
      <div className={`home-collage${photos.length >= 3 ? '' : ' is-empty'}`} aria-hidden="true">
        {photos.map((photo, index) => (
          <figure key={photo.id} className={`home-collage-item item-${index}`}>
            <img src={photo.imageUrl} alt="" loading={index ? 'lazy' : 'eager'} />
            <figcaption>{language === 'vi' ? photo.localName || photo.name : photo.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
