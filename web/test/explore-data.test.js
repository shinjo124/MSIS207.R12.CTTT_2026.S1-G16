import test from 'node:test';
import assert from 'node:assert/strict';
import { filterProvinces, foldText, groupByRegion } from '../src/features/explore/explore-data.js';

const provinces = [
  { id: 1, name: 'Tuyen Quang', localName: 'Tuyên Quang', region: 'Northern Vietnam', mergedFrom: 'Hà Giang, Tuyên Quang' },
  { id: 2, name: 'Lam Dong', localName: 'Lâm Đồng', region: 'Central Vietnam', mergedFrom: 'Đắk Nông, Bình Thuận, Lâm Đồng' },
  { id: 3, name: 'Hanoi', localName: 'Hà Nội', region: 'Northern Vietnam', mergedFrom: null },
];

test('search ignores accents and finds former province names', () => {
  assert.equal(foldText('Đắk Nông'), 'dak nong');
  assert.deepEqual(filterProvinces(provinces, { query: 'ha giang' }).map((p) => p.id), [1]);
  assert.deepEqual(filterProvinces(provinces, { query: 'binh thuan' }).map((p) => p.id), [2]);
  assert.deepEqual(filterProvinces(provinces, { region: 'Northern Vietnam' }).map((p) => p.id), [1, 3]);
});

test('groups by region in north to south order, sorted by name', () => {
  const groups = groupByRegion(provinces, 'vi');
  assert.deepEqual(groups.map((g) => g.region), ['Northern Vietnam', 'Central Vietnam']);
  assert.deepEqual(groups[0].provinces.map((p) => p.id), [3, 1]);
});
