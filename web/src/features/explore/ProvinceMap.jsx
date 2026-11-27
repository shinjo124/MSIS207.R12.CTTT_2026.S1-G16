import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { mapPins } from './map-pins.js';

// Leaflet (open-source map library) loads from a CDN only when a province page opens; tiles come from OpenStreetMap.
const LEAFLET_VERSION = '1.9.4';
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      document.head.append(css);
      const script = document.createElement('script');
      script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      script.async = true;
      script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet missing')));
      script.onerror = () => { leafletPromise = null; reject(new Error('Leaflet failed to load')); };
      document.head.append(script);
    });
  }
  return leafletPromise;
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Map of the province: teal pins for "Places worth visiting", coral pins for the current "More ideas" results.
export default function ProvinceMap({ center, places = [], ideas = [] }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const pins = mapPins(places, ideas);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !boxRef.current || mapRef.current) return;
      const map = L.map(boxRef.current, { scrollWheelZoom: false }).setView([center.latitude, center.longitude], 10);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setStatus('ready');
    }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; mapRef.current?.remove(); mapRef.current = null; };
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (status !== 'ready' || !L || !map) return;
    layerRef.current.clearLayers();
    for (const pin of pins) {
      L.circleMarker([pin.latitude, pin.longitude], {
        radius: pin.kind === 'idea' ? 7 : 9, weight: 2, color: '#fff',
        fillColor: pin.kind === 'idea' ? '#e96e51' : '#0b7475', fillOpacity: 0.95,
      }).bindPopup(`<strong>${escapeHtml(pin.name)}</strong><br><a href="${escapeHtml(pin.mapsUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t('Open in Google Maps ↗'))}</a>`)
        .addTo(layerRef.current);
    }
    if (pins.length > 1) map.fitBounds(pins.map((pin) => [pin.latitude, pin.longitude]), { padding: [30, 30], maxZoom: 13 });
    else if (pins.length === 1) map.setView([pins[0].latitude, pins[0].longitude], 13);
  }, [status, pins.map((pin) => pin.key).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'error') return null;
  return (
    <section className="province-map" aria-label={t('Map')}>
      <div ref={boxRef} className="province-map-canvas" />
      <p className="province-map-legend">
        <span className="pin pin-place" /> {t('Places worth visiting')}
        {ideas.length > 0 && <><span className="pin pin-idea" /> {t('More ideas')}</>}
        {status === 'loading' && <span role="status"> · {t('Loading map…')}</span>}
      </p>
    </section>
  );
}
