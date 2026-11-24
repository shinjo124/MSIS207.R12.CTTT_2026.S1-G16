import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Render the actual components so the checks cover the attributes delivered to the browser.
test('feed image preserves alt text and exposes responsive delivery', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { StoryImage } = await server.ssrLoadModule('/src/features/posts/PostsFeed.jsx');
  const html = renderToStaticMarkup(React.createElement(StoryImage, { photo: { imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', altText: 'A mountain' }, priority: false }));
  assert.match(html, /alt="A mountain"/);
  assert.match(html, /srcSet="[^"]+480w/);
  assert.match(html, /loading="lazy"/);
});

test('gallery renders every photo with its own description', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { StoryGallery } = await server.ssrLoadModule('/src/features/posts/PostsFeed.jsx');
  const html = renderToStaticMarkup(React.createElement(StoryGallery, { photos: [{ imageUrl: '/one.jpg', altText: 'Coast' }, { imageUrl: '/two.jpg', altText: 'Hills' }] }));
  assert.match(html, /alt="Coast"/);
  assert.match(html, /alt="Hills"/);
  assert.match(html, /aria-label="Story photos"/);
  assert.match(html, /1 \/ 2/);
  assert.match(html, /aria-label="Next photo"/);
  const single = renderToStaticMarkup(React.createElement(StoryGallery, { photos: [{ imageUrl: '/one.jpg', altText: 'Coast' }] }));
  assert.doesNotMatch(single, /Next photo|1 \/ 1/);
});

test('gallery tracks the nearest visible photo and clamps scroll positions', async (t) => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  t.after(() => server.close());
  const { galleryPhotoIndex } = await server.ssrLoadModule('/src/features/posts/PostsFeed.jsx');
  assert.equal(galleryPhotoIndex(320, 320, 3), 1);
  assert.equal(galleryPhotoIndex(10000, 320, 3), 2);
  assert.equal(galleryPhotoIndex(-10, 320, 3), 0);
  assert.equal(galleryPhotoIndex(0, 0, 3), 0);
});
