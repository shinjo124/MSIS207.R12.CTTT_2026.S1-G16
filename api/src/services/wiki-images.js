// Find a freely licensed photo for a place on Vietnamese Wikipedia / Wikimedia Commons.
const fold = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
const words = (value) => fold(value).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((word) => word.length > 1);

// The article title must share most of its words with the place name (avoids a photo of something else).
export function isRelevantTitle(placeName, title) {
  const name = new Set(words(placeName));
  const titleWords = words(title.replace(/\s*\(.*\)$/, ''));
  if (!titleWords.length || !name.size) return false;
  const shared = titleWords.filter((word) => name.has(word)).length;
  return shared / titleWords.length >= 0.6 && shared / name.size >= 0.4;
}

export function wikiSearchUrl(text) {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: text, srlimit: '5', format: 'json', utf8: '1', origin: '*' });
  return `https://vi.wikipedia.org/w/api.php?${params}`;
}

export function pageImageUrl(title) {
  const params = new URLSearchParams({ action: 'query', titles: title, prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '900', format: 'json', origin: '*' });
  return `https://vi.wikipedia.org/w/api.php?${params}`;
}

export function commonsInfoUrl(fileName) {
  const params = new URLSearchParams({ action: 'query', titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'extmetadata|url', format: 'json', origin: '*' });
  return `https://commons.wikimedia.org/w/api.php?${params}`;
}

export function searchTitles(data) {
  return (data?.query?.search || []).map((item) => item.title).filter(Boolean);
}

export function pickPageImage(data) {
  const page = Object.values(data?.query?.pages || {})[0];
  if (!page?.thumbnail?.source || !page.pageimage) return null;
  return { thumbnail: page.thumbnail.source, fileName: page.pageimage };
}

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Only files on Commons with a free licence; returns the credit line the licence asks for.
export function pickCommonsInfo(data) {
  const page = Object.values(data?.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata;
  if (!info || !meta || page.missing !== undefined) return null;
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!license || /fair use|non-free/i.test(license)) return null;
  const artist = stripHtml(meta.Artist?.value).slice(0, 200) || 'Wikimedia Commons';
  return { credit: artist, license: license.slice(0, 100), pageUrl: info.descriptionurl || null };
}

// Pick the photo that best represents a province from its places: scenery first, food and shops last.
const CATEGORY_ORDER = ['Sightseeing', 'Nature', 'Beach', 'Culture', 'Shopping', 'Food'];
export function pickProvincePhoto(places) {
  const withPhoto = places.filter((place) => place.imageUrl);
  if (!withPhoto.length) return null;
  const rank = (place) => { const index = CATEGORY_ORDER.indexOf(place.category); return index === -1 ? CATEGORY_ORDER.length : index; };
  const best = [...withPhoto].sort((a, b) => rank(a) - rank(b) || Number(a.id) - Number(b.id))[0];
  return { placeName: best.name, url: best.imageUrl, credit: best.imageCredit || null, license: best.imageLicense || null, pageUrl: best.imagePageUrl || null };
}
