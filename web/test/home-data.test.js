import test from 'node:test';
import assert from 'node:assert/strict';
import { HIGHLIGHTS, SEASON_PICKS, heroPhotos, highlightCards, seasonCards } from '../src/features/home/home-data.js';

const catalogue = [
  { id: 1, name: 'Lam Dong', region: 'Central Vietnam', adminLevel: 'province', imageUrl: null },
  { id: 2, name: 'Da Lat', featured: true, imageUrl: 'https://images.unsplash.com/dalat.jpg' },
  { id: 3, name: 'Hanoi', region: 'Northern Vietnam', adminLevel: 'city', featured: true, imageUrl: 'https://images.unsplash.com/hanoi.jpg' },
];

test('every month has four picks and highlights name real seed rows', () => {
  for (let month = 1; month <= 12; month += 1) assert.equal(SEASON_PICKS[month].length, 4);
  assert.ok(HIGHLIGHTS.length >= 6);
});

test('highlights borrow the photo of a famous spot in the province', () => {
  const cards = highlightCards(catalogue);
  assert.deepEqual(cards.map((card) => [card.id, card.photo]), [[3, 'https://images.unsplash.com/hanoi.jpg'], [1, 'https://images.unsplash.com/dalat.jpg']]);
});

test('season picks link to provinces when they exist', () => {
  const picks = seasonCards(catalogue, 12);
  assert.equal(picks[0].spot, 'Đà Lạt');
  assert.equal(picks[0].province.id, 1);
  assert.equal(picks[2].province, null);
  assert.equal(heroPhotos(catalogue).length, 2);
});
