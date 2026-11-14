export function filterPlacesByCategory(places, category) {
  return category ? places.filter((place) => place.category === category) : places;
}
