import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('navigation identifies the current trip area and exposes dashboard', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { Topbar } = await server.ssrLoadModule('/src/App.jsx');
  const html = renderToStaticMarkup(React.createElement(Topbar, { active: 'trips', isSignedIn: true }));
  assert.match(html, /href="\/"[^>]*><span[^>]*>Dashboard<\/span><\/a>/);
  assert.match(html, /href="\/trips"[^>]*aria-current="page"/);
  const detail = renderToStaticMarkup(React.createElement(Topbar, { active: 'trip-detail' }));
  assert.match(detail, /href="\/trips"[^>]*aria-current="location"/);
  assert.equal((html.match(/aria-current=/g) || []).length, 1);
  const guest = renderToStaticMarkup(React.createElement(Topbar, { active: 'home', isSignedIn: false }));
  assert.match(guest, /href="\/"[^>]*aria-current="page"[^>]*><span[^>]*>Home<\/span><\/a>/);
});

test('sign in from a protected trip returns to the requested trip and query', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { default: ProfileGate } = await server.ssrLoadModule('/src/features/trips/ProfileGate.jsx');
  globalThis.window = { location: { href: 'https://tripo.example/trips?new=1' } };
  t.after(() => { delete globalThis.window; });
  const html = renderToStaticMarkup(React.createElement(ProfileGate, { isSignedIn: false, action: 'plan a trip' }));
  const href = html.match(/href="([^"]+)"/)[1];
  const url = new URL(href, 'https://tripo.example');
  assert.equal(url.pathname, '/sign-in');
  assert.equal(url.searchParams.get('redirect_url'), 'https://tripo.example/trips?new=1');
});
