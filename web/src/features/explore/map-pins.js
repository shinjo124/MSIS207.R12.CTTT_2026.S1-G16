// Pins for the province map: catalogue places and "More ideas" results that have coordinates.
const valid = (value) => value != null && value !== '' && Number.isFinite(Number(value));

export function mapPins(places = [], ideas = []) {
  const pins = [];
  for (const place of places) {
    if (!valid(place.latitude) || !valid(place.longitude)) continue;
    pins.push({ key: `p${place.id}`, kind: 'place', name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude),
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.mapQuery || place.name)}` });
  }
  for (const idea of ideas) {
    if (!valid(idea.latitude) || !valid(idea.longitude)) continue;
    pins.push({ key: `i${idea.id}`, kind: 'idea', name: idea.name, latitude: Number(idea.latitude), longitude: Number(idea.longitude),
      mapsUrl: idea.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(idea.name)}` });
  }
  return pins;
}
