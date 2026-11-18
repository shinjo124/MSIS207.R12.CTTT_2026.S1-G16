import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/services/newsService.js';

test('extracts plain summaries and only links to the named newspaper', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Đà Lạt &amp; mùa hoa</title><link>https://vnexpress.net/du-lich/bai-viet-1.html</link><description><![CDATA[<p>Điểm đến <b>đẹp</b>.</p>]]></description><pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Bad link</title><link>https://evil.example/article</link></item></channel></rss>`;
  const articles = parseFeed(xml, { name: 'VnExpress', host: 'vnexpress.net' });
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Đà Lạt & mùa hoa');
  assert.equal(articles[0].summary, 'Điểm đến đẹp.');
  assert.equal(articles[0].source, 'VnExpress');
  assert.equal(articles[0].url, 'https://vnexpress.net/du-lich/bai-viet-1.html');
});

test('rejects feeds containing document type declarations', () => {
  assert.throws(() => parseFeed('<!DOCTYPE rss><rss/>', { name: 'VnExpress', host: 'vnexpress.net' }));
});
