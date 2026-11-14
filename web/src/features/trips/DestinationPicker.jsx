import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel } from './trip-format.js';
import { displayName, searchDestinations } from './destination-search.js';
import { filterPlacesByCategory } from './place-filters.js';

const MAX_DESTINATIONS = 10;

function PlaceSuggestions({ destination }) {
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('loading');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/destinations/${destination.id}/places`, { signal: controller.signal })
      .then((result) => {
        setPlaces(result.data || []);
        setStatus(result.data?.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [destination.id]);

  const categories = [...new Set(places.map((place) => place.category))].sort();
  const visiblePlaces = filterPlacesByCategory(places, category);

  return (
    <section className="place-suggestions" aria-label={`Places in ${destination.name}`}>
      <h3>Places to explore in {destination.name}</h3>
      {status === 'loading' && <p className="form-hint" role="status">Loading places…</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">Could not load places for {destination.name}.</p>}
      {status === 'empty' && <p className="form-hint">No seeded places for this destination yet.</p>}
      {status === 'ready' && <>
        <label className="place-filter">Filter by type
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All types</option>
            {categories.map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}
          </select>
        </label>
        <ul className="place-suggestion-list">
          {visiblePlaces.map((place) => (
            <li key={place.id}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery || place.name)}`} target="_blank" rel="noreferrer">{place.name}</a>
              <span>{categoryLabel(place.category)}</span>
              {place.address && <small>{place.address}</small>}
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}

// Type-ahead picker. All destinations (~50 rows) load once and are filtered in the browser,
// so typing does not send a request per keystroke (the API is rate limited).
export default function DestinationPicker({ selected, onChange }) {
  const [all, setAll] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/destinations?scope=all', { signal: controller.signal })
      .then((result) => {
        setAll(result.data || []);
        setStatus(result.data?.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const suggestions = useMemo(() => {
    const selectedIds = new Set(selected.map((destination) => destination.id));
    return searchDestinations(all.filter((destination) => !selectedIds.has(destination.id)), query);
  }, [all, query, selected]);
  const full = selected.length >= MAX_DESTINATIONS;

  function choose(destination) {
    if (!destination || full) return;
    onChange([...selected, { id: destination.id, name: displayName(destination) }]);
    setQuery('');
    setActive(0);
    setOpen(true);
    inputRef.current?.focus();
  }

  function remove(id) {
    onChange(selected.filter((destination) => destination.id !== id));
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && suggestions.length) {
      event.preventDefault(); // pick the suggestion instead of submitting the form
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1].id);
    }
  }

  const showList = open && status === 'ready' && !full;

  return (
    <div className="destination-picker">
      {selected.length > 0 && <ol className="selected-destinations" aria-label="Chosen destinations, in visiting order">
        {selected.map((destination, index) => (
          <li key={destination.id} className="chip chip-selected">
            <b>{index + 1}</b>{destination.name}
            <button type="button" className="chip-remove" onClick={() => remove(destination.id)} aria-label={`Remove ${destination.name}`}>×</button>
          </li>
        ))}
      </ol>}

      {selected.length > 0 && <div className="place-suggestions-list">
        {selected.map((destination) => <PlaceSuggestions key={destination.id} destination={destination} />)}
      </div>}

      <div className="combobox">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && suggestions[active] ? `${listId}-${suggestions[active].id}` : undefined}
          value={query}
          disabled={full || status === 'error'}
          placeholder={full ? 'Up to 10 destinations' : 'Type a city or province, e.g. Đà Lạt, da lat, H…'}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {showList && <ul className="suggestions" id={listId} role="listbox">
          {suggestions.length
            ? suggestions.map((destination, index) => (
                <li
                  key={destination.id}
                  id={`${listId}-${destination.id}`}
                  role="option"
                  aria-selected={index === active}
                  // mousedown fires before the input's blur closes the list
                  onMouseDown={(event) => { event.preventDefault(); choose(destination); }}
                  onMouseEnter={() => setActive(index)}
                >
                  <strong>{displayName(destination)}</strong>
                  <span>{destination.region}</span>
                </li>
              ))
            : <li className="no-match" role="option" aria-disabled="true" aria-selected="false">No destination matches “{query}”.</li>}
        </ul>}
      </div>

      {status === 'loading' && <p className="form-hint" role="status">Loading destinations…</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">Could not load destinations. Refresh to try again.</p>}
      {status === 'empty' && <p className="form-hint">No destinations yet. Run the seed files first.</p>}
    </div>
  );
}
