import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api.js';
import { categoryLabel } from './trip-format.js';
import { displayName, searchDestinations } from './destination-search.js';
import { filterPlacesByCategory } from './place-filters.js';
import { t } from '../../lib/i18n.js';


// Public place suggestions are catalog data. The picker skips this panel for custom destinations.
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
    <section className="place-suggestions" aria-label={t('Places in {name}', { name: destination.name })}>
      <h3>{t("Places to explore in {name}", { name: destination.name })}</h3>
      {status === 'loading' && <p className="form-hint" role="status">{t("Loading places…")}</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">{t("Could not load places for {name}.", { name: destination.name })}</p>}
      {status === 'empty' && <p className="form-hint">{t("No seeded places for this destination yet.")}</p>}
      {status === 'ready' && <>
        <label className="place-filter">{t("Filter by type")}
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{t("All types")}</option>
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
// Trip form: up to 10 destinations with place suggestions. Story composer: max={1}, showPlaces={false},
// and `options` reuses the destination list the composer already loaded.
export default function DestinationPicker({
  selected, onChange, max = 10, showPlaces = true, options, disabled = false, labelledBy, allowCustom = false,
  placeholder = 'Type a city or province…',
}) {
  const [fetched, setFetched] = useState([]);
  const [fetchStatus, setFetchStatus] = useState('loading');
  const all = options || fetched;
  const status = options ? (options.length ? 'ready' : 'empty') : fetchStatus;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [customName, setCustomName] = useState('');
  const [customCountry, setCustomCountry] = useState('');
  const inputRef = useRef(null);
  const countryRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (options) return undefined;
    const controller = new AbortController();
    apiRequest('/destinations?scope=all', { signal: controller.signal })
      .then((result) => {
        setFetched(result.data || []);
        setFetchStatus(result.data?.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setFetchStatus('error');
      });
    return () => controller.abort();
  }, [options]);

  const suggestions = useMemo(() => {
    const selectedIds = new Set(selected.map((destination) => destination.id));
    return searchDestinations(all.filter((destination) => !selectedIds.has(destination.id)), query);
  }, [all, query, selected]);
  const single = max === 1;
  const full = selected.length >= max;
  const canAddCustom = allowCustom && Boolean(query.trim());
  const optionCount = suggestions.length + Number(canAddCustom);
  const country = customCountry.trim();
  const duplicate = selected.some((destination) => destination.custom
    && destination.name.localeCompare(customName, undefined, { sensitivity: 'base' }) === 0
    && destination.country.localeCompare(country, undefined, { sensitivity: 'base' }) === 0);

  useEffect(() => {
    if (customName) countryRef.current?.focus();
  }, [customName]);

  function openCustom() {
    setCustomName(query.trim());
    setCustomCountry('');
    setOpen(false);
  }

  function closeCustom() {
    setCustomName('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Use a temporary key until the trip API saves the draft and returns a real destination ID.
  function addCustom() {
    if (!customName || !country || duplicate || full || disabled) return;
    onChange([...selected, { id: JSON.stringify([customName, country]), name: customName, country, custom: true, draft: true }]);
    setQuery('');
    setActive(0);
    closeCustom();
  }

  function choose(destination) {
    if (!destination || full) return;
    onChange([...selected, { id: destination.id, name: displayName(destination), country: destination.country, timeZone: destination.timeZone }]);
    setQuery('');
    setActive(0);
    setOpen(!single);
    if (!single) inputRef.current?.focus();
  }

  function remove(id) {
    onChange(selected.filter((destination) => destination.id !== id));
  }

  // Arrow keys move through both catalog results and the custom option. Enter selects instead of submitting the trip.
  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(0, Math.min(index + 1, optionCount - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && optionCount) {
      event.preventDefault(); // pick the suggestion instead of submitting the form
      if (canAddCustom && active >= suggestions.length) openCustom();
      else choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Backspace' && !query && selected.length) {
      remove(selected[selected.length - 1].id);
    }
  }

  const showList = open && (status === 'ready' || canAddCustom) && !full && !disabled && !customName;
  const activeId = suggestions[active] ? suggestions[active].id : canAddCustom ? 'custom' : null;

  return (
    <div className="destination-picker">
      {selected.length > 0 && <ol className="selected-destinations" aria-label={single ? t("Chosen destination") : t("Chosen destinations, in visiting order")}>
        {selected.map((destination, index) => (
          <li key={destination.id} className="chip chip-selected">
            {!single && <b>{index + 1}</b>}{destination.name}
            <button type="button" className="chip-remove" onClick={() => remove(destination.id)} aria-label={t('Remove {name}', { name: destination.name })}>×</button>
          </li>
        ))}
      </ol>}

      {showPlaces && selected.some((destination) => !destination.custom) && <div className="place-suggestions-list">
        {selected.filter((destination) => !destination.custom).map((destination) => <PlaceSuggestions key={destination.id} destination={destination} />)}
      </div>}

      {!(single && full) && <div className="combobox">
        <input
          ref={inputRef}
          role="combobox"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : t("Search destinations")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeId != null ? `${listId}-${activeId}` : undefined}
          value={query}
          disabled={disabled || full || Boolean(customName) || (status === 'error' && !allowCustom)}
          maxLength={allowCustom ? 120 : undefined}
          placeholder={full ? t('Up to {max} destinations', { max }) : t(placeholder)}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {showList && <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((destination, index) => (
                <li
                  key={destination.id}
                  role="presentation"
                ><button
                  type="button"
                  className="destination-suggestion"
                  id={`${listId}-${destination.id}`}
                  role="option"
                  aria-selected={index === active}
                  aria-label={t('Add {name}, {region}', { name: displayName(destination), region: t(destination.region) })}
                  // Keep the list open until the click handler adds this destination.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(destination)}
                  onMouseEnter={() => setActive(index)}
                >
                  <span className="destination-suggestion-name"><strong>{displayName(destination)}</strong><small>{t(destination.region)}</small></span>
                  <span className="destination-add-label">{t("+ Add")}</span>
                </button>
                </li>
              ))}
          {canAddCustom && <li role="presentation">
            <button className="destination-suggestion" id={`${listId}-custom`} type="button" role="option"
              aria-selected={active === suggestions.length} onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(suggestions.length)} onClick={openCustom}>
              {t("Use “{name}” as a custom destination", { name: query.trim() })}
            </button>
          </li>}
          {!optionCount && <li className="no-match" role="option" aria-disabled="true" aria-selected="false">{t("No destination matches “{query}”.", { query })}</li>}
        </ul>}
      </div>}

      {customName && <div className="field">
        <label className="field">{t("Country for {name}", { name: customName })}
          <input ref={countryRef} value={customCountry} maxLength={120} onChange={(event) => setCustomCountry(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }} />
        </label>
        {duplicate && <p className="form-hint" role="status">{t("This custom destination is already selected.")}</p>}
        <div className="form-actions">
          <button className="primary-button" type="button" disabled={!country || duplicate || disabled} onClick={addCustom}>{t("Add destination")}</button>
          <button className="text-button" type="button" onClick={closeCustom}>{t("Cancel")}</button>
        </div>
      </div>}

      {!options && status === 'loading' && <p className="form-hint" role="status">{t("Loading destinations…")}</p>}
      {status === 'error' && <p className="form-hint error-state" role="alert">{t("Could not load destinations. Refresh to try again.")}</p>}
      {!options && status === 'empty' && <p className="form-hint">{t("No destinations yet. Run the seed files first.")}</p>}
    </div>
  );
}
