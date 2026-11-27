import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPins } from '../src/features/explore/map-pins.js';

test('pins only places with coordinates, catalogue first then ideas', () => {
  const pins = mapPins(
    [{ id: 1, name: 'Chợ Đà Lạt', latitude: '11.942900', longitude: '108.436800', mapQuery: 'Chợ Đà Lạt' }, { id: 2, name: 'No coords', latitude: null, longitude: null }],
    [{ id: 'x', name: 'Quán A', latitude: 11.95, longitude: 108.44, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=A' }, { id: 'y', name: 'No coords' }],
  );
  assert.deepEqual(pins.map((pin) => [pin.key, pin.kind, pin.latitude]), [['p1', 'place', 11.9429], ['ix', 'idea', 11.95]]);
});
