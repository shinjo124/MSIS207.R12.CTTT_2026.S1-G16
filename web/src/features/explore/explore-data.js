// Helpers for the Explore page (the 34 provinces and centrally run cities).
export const REGIONS = ['Northern Vietnam', 'Central Vietnam', 'Southern Vietnam'];

// Lowercase, no Vietnamese accents, so "ha giang" finds "Hà Giang".
export function foldText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().trim();
}

export function provinceName(province, language) {
  return language === 'vi' ? province.localName || province.name : province.name;
}

export function provinceSummary(item, language) {
  return language === 'vi' ? item.summaryVi || item.summary : item.summary;
}

// Match the current or former names, so searching an old province finds the unit it joined.
export function filterProvinces(provinces, { query = '', region = '' } = {}) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  return provinces.filter((province) => {
    if (region && province.region !== region) return false;
    if (!words.length) return true;
    const haystack = foldText([province.localName, province.name, province.aliases, province.mergedFrom].filter(Boolean).join(' '));
    return words.every((word) => haystack.includes(word));
  });
}

export function groupByRegion(provinces, language) {
  const collator = new Intl.Collator(language === 'vi' ? 'vi' : 'en');
  return REGIONS.map((region) => ({
    region,
    provinces: provinces.filter((province) => province.region === region)
      .sort((a, b) => collator.compare(provinceName(a, language), provinceName(b, language))),
  })).filter((group) => group.provinces.length);
}

export function placeCategories(places) {
  return [...new Set(places.map((place) => place.category))].sort();
}
