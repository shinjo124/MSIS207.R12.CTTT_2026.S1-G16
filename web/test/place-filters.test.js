import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlacesByCategory } from '../src/features/trips/place-filters.js';

test('filters places by category and returns all places for the all option', () => {
  const places = [
    { id: 1, category: 'sightseeing' },
    { id: 2, category: 'food_drink' },
  ];

  assert.deepEqual(filterPlacesByCategory(places, 'food_drink'), [places[1]]);
  assert.deepEqual(filterPlacesByCategory(places, ''), places);
});
