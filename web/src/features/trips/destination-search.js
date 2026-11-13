// Accent-insensitive matching for Vietnamese place names: "Đà Lạt", "da lat" and "dalat" all match.

export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compact = (text) => text.replace(/ /g, '');

export const displayName = (destination) => destination.localName || destination.name;

function candidates(destination) {
  const aliases = (destination.aliases || '').split(',');
  return [destination.localName, destination.name, ...aliases].map(normalize).filter(Boolean);
}

// Lower is better: 0 = the main name starts with the query, 1 = an alias or old name starts with it,
// 2 = the query typed without spaces ("dalat"), 3 = a later word starts with it ("lat").
function score(destination, query) {
  const names = candidates(destination);
  const main = normalize(displayName(destination));
  if (main.startsWith(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => compact(name).startsWith(compact(query)))) return 2;
  if (query.length >= 2 && names.some((name) => ` ${name}`.includes(` ${query}`))) return 3;
  return null;
}

export function searchDestinations(destinations, rawQuery, limit = 10) {
  const query = normalize(rawQuery);
  if (!query) {
    // Empty box: suggest the featured (curated) destinations first.
    return [...destinations]
      .sort((a, b) => Number(b.featured) - Number(a.featured) || displayName(a).localeCompare(displayName(b), 'vi'))
      .slice(0, limit);
  }
  return destinations
    .map((destination) => ({ destination, rank: score(destination, query) }))
    .filter((item) => item.rank !== null)
    .sort((a, b) => a.rank - b.rank
      || Number(b.destination.featured) - Number(a.destination.featured)
      || displayName(a.destination).localeCompare(displayName(b.destination), 'vi'))
    .slice(0, limit)
    .map((item) => item.destination);
}
