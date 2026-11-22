import assert from 'node:assert/strict';
import test from 'node:test';
import { runViewTransition } from '../src/lib/view-transition.js';

test('updates immediately when view transitions are unavailable', () => {
  let updated = false;
  runViewTransition(() => { updated = true; });
  assert.equal(updated, true);
});

test('uses view transitions when reduced motion is requested', () => {
  const previousDocument = globalThis.document;
  const previousMatchMedia = globalThis.matchMedia;
  let started = false;
  let updated = false;
  globalThis.document = { startViewTransition: (update) => { started = true; update(); } };
  globalThis.matchMedia = () => ({ matches: true });

  try {
    runViewTransition(() => { updated = true; });
    assert.equal(started, true);
    assert.equal(updated, true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previousMatchMedia;
  }
});
