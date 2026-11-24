// An empty category represents the All types option rather than a filter value.
export function filterPlacesByCategory(places, category) {
  return category ? places.filter((place) => place.category === category) : places;
}
