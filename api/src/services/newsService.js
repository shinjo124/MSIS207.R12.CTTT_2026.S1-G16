import { XMLParser, XMLValidator } from 'fast-xml-parser';

const feeds = [
  { name: 'VnExpress', host: 'vnexpress.net', url: 'https://vnexpress.net/rss/du-lich.rss' },
  { name: 'Tuổi Trẻ', host: 'tuoitre.vn', url: 'https://tuoitre.vn/rss/du-lich.rss' },
];
const parser = new XMLParser({ processEntities: true, parseTagValue: false });
let cached;
let expiresAt = 0;

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim().slice(0, 240);
}

// Treat feed content as untrusted. Reject XML declarations that define entities and only keep links to the publisher.
export function parseFeed(xml, source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS');
  const items = parser.parse(xml)?.rss?.channel?.item || [];
  return (Array.isArray(items) ? items : [items]).flatMap((item) => {
    try {
      const url = new URL(String(item.link));
      if (url.protocol !== 'https:' || !(url.hostname === source.host || url.hostname.endsWith(`.${source.host}`)) || !item.title) return [];
      return [{ title: plainText(item.title), summary: plainText(item.description), url: url.href, source: source.name, publishedAt: Number.isFinite(Date.parse(item.pubDate)) ? new Date(item.pubDate).toISOString() : null }];
    } catch { return []; }
  });
}

// Cache briefly and collect results independently so one publisher can fail without hiding the other.
export async function getNews() {
  if (cached && Date.now() < expiresAt) return cached;
  const results = await Promise.allSettled(feeds.map(async (source) => {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(6000), redirect: 'error' });
    if (!response.ok || Number(response.headers.get('content-length') || 0) > 1000000) throw new Error('Feed unavailable');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1000000) { await reader.cancel(); throw new Error('Feed too large'); }
      chunks.push(value);
    }
    return parseFeed(Buffer.concat(chunks).toString('utf8'), source);
  }));
  const articles = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')).slice(0, 10);
  if (!articles.length) {
    cached = { status: 'unavailable', articles: [] };
    expiresAt = Date.now() + 600000;
    return cached;
  }
  cached = { status: 'live', articles };
  expiresAt = Date.now() + 600000;
  return cached;
}
