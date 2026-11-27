import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { getLanguage, t } from '../../lib/i18n.js';
import { provinceName, provinceSummary } from '../explore/explore-data.js';
import { loadCatalogue } from './catalogue.js';
import { highlightCards, seasonCards } from './home-data.js';
import './home.css';

// Lively suggestions under the home hero and the dashboard: highlights, this month's picks, newest stories.
export default function HomeSuggestions() {
  const [catalogue, setCatalogue] = useState(null);
  const [stories, setStories] = useState(null);
  const stripRef = useRef(null);
  const language = getLanguage();
  const month = new Date().getMonth() + 1;

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((items) => { if (alive) setCatalogue(items); }).catch(() => { if (alive) setCatalogue([]); });
    const controller = new AbortController();
    apiRequest('/posts?limit=3', { signal: controller.signal })
      .then((result) => { if (alive) setStories((result.data || []).slice(0, 3)); })
      .catch((error) => { if (alive && error.name !== 'AbortError') setStories([]); });
    return () => { alive = false; controller.abort(); };
  }, []);

  const highlights = catalogue ? highlightCards(catalogue) : [];
  const picks = catalogue ? seasonCards(catalogue, month) : [];
  const scroll = (direction) => stripRef.current?.scrollBy({ left: direction * Math.min(640, stripRef.current.clientWidth * 0.8), behavior: 'smooth' });

  return (
    <div className="home-sections">
      {highlights.length > 0 && (
        <section className="home-section" aria-labelledby="highlights-title">
          <div className="home-section-heading">
            <div><p className="eyebrow">{t('WHERE TO NEXT')}</p><h2 id="highlights-title">{t('Featured destinations')}</h2></div>
            <div className="home-strip-controls">
              <button type="button" onClick={() => scroll(-1)} aria-label={t('Previous')}>←</button>
              <button type="button" onClick={() => scroll(1)} aria-label={t('Next')}>→</button>
              <a href="/explore">{t('See all 34')}</a>
            </div>
          </div>
          <ul className="home-strip" ref={stripRef}>
            {highlights.map((item) => (
              <li key={item.id}>
                <a className="home-place-card" href={`/explore/${item.id}`}>
                  {item.photo ? <img src={item.photo} alt="" loading="lazy" /> : <span className={`home-place-fallback region-${['Northern Vietnam', 'Central Vietnam', 'Southern Vietnam'].indexOf(item.region)}`} />}
                  <span className="home-place-shade" />
                  <span className="home-place-region">{t(item.region)}</span>
                  <span className="home-place-text">
                    <strong>{provinceName(item, language)}</strong>
                    <small>{provinceSummary(item, language)}</small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {picks.length > 0 && (
        <section className="home-section" aria-labelledby="season-title">
          <div className="home-section-heading">
            <div><p className="eyebrow">{t('IN SEASON')}</p><h2 id="season-title">{t('Best places to go in month {month}', { month })}</h2></div>
          </div>
          <ul className="home-season">
            {picks.map((pick, index) => {
              const content = <>
                <span className="home-season-index">{String(index + 1).padStart(2, '0')}</span>
                <strong>{pick.spot}</strong>
                {pick.province && <small>{provinceName(pick.province, language)}</small>}
                <p>{language === 'vi' ? pick.vi : pick.en}</p>
                <span className="home-season-link">{t('See places to visit')} →</span>
              </>;
              return <li key={pick.spot}>{pick.province ? <a className="home-season-card" href={`/explore/${pick.province.id}`}>{content}</a> : <div className="home-season-card">{content}</div>}</li>;
            })}
          </ul>
        </section>
      )}

      {stories?.length > 0 && (
        <section className="home-section" aria-labelledby="stories-title">
          <div className="home-section-heading">
            <div><p className="eyebrow">{t('FROM THE COMMUNITY')}</p><h2 id="stories-title">{t('Latest travel stories')}</h2></div>
            <a className="home-section-link" href="/stories">{t('All stories')} →</a>
          </div>
          <ul className="home-stories">
            {stories.map((story) => {
              const photo = story.photos?.[0];
              const where = story.place?.destination?.name || story.place?.name;
              return (
                <li key={story.id}>
                  <a className="home-story-card" href="/stories">
                    {photo ? <img src={photo.imageUrl} alt={photo.altText || ''} loading="lazy" /> : <span className="home-story-quote" aria-hidden="true">“</span>}
                    <span className="home-story-body">
                      <span className="home-story-meta">
                        {story.authorAvatar ? <img src={story.authorAvatar} alt="" /> : <b aria-hidden="true">{(story.author || '?').slice(0, 1)}</b>}
                        <span>{story.author}{where ? ` · ${where}` : ''}</span>
                      </span>
                      <p>{story.body}</p>
                      <small>♥ {story.likesCount} · 💬 {story.commentsCount}</small>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
