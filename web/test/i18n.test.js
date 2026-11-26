import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguage, setLanguage, t } from '../src/lib/i18n.js';
import vi from '../src/lib/i18n-vi.js';

test('switches between English and Vietnamese and fills values', () => {
  setLanguage('en');
  assert.equal(t('Day {n}', { n: 2 }), 'Day 2');
  setLanguage('vi');
  assert.equal(getLanguage(), 'vi');
  assert.equal(t('Day {n}', { n: 2 }), 'Ngày 2');
  assert.equal(t('Text without a translation'), 'Text without a translation');
  setLanguage('fr');
  assert.equal(getLanguage(), 'vi');
  setLanguage('en');
});

test('every Vietnamese entry keeps the same placeholders as its English key', () => {
  const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const [en, text] of Object.entries(vi)) assert.equal(names(text), names(en), en);
});
