import test from 'node:test';
import assert from 'node:assert/strict';
import { feedImageSources } from '../src/lib/cloudinary-image.js';

test('generates responsive derivatives only for ordinary versioned Cloudinary image uploads', () => {
  const original = 'https://res.cloudinary.com/example/image/upload/v123/tripo/post-photos/example.jpg';
  const result = feedImageSources(original);
  assert.equal(result.src, 'https://res.cloudinary.com/example/image/upload/c_scale,w_768/q_auto/f_auto/v123/tripo/post-photos/example.jpg');
  assert.match(result.srcSet, /c_scale,w_480\/q_auto\/f_auto\/v123\/tripo\/post-photos\/example\.jpg 480w/);
  assert.match(result.srcSet, /c_scale,w_1600\/q_auto\/f_auto\/v123\/tripo\/post-photos\/example\.jpg 1600w/);
  assert.match(result.sizes, /max-width/);
});

test('leaves external, signed, private and already transformed URLs untouched', () => {
  for (const url of [
    'https://example.com/example.jpg',
    'http://res.cloudinary.com/demo/image/upload/v1/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/s--signed--/v1/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/c_fill,w_100/v1/a.jpg',
    'https://res.cloudinary.com/demo/image/private/v1/a.jpg',
    'https://res.cloudinary.com/demo/image/authenticated/v1/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1/a.jpg?token=secret',
    'https://res.cloudinary.com/demo/image/upload/v1/a,b.jpg',
    'not a url', null,
  ]) assert.equal(feedImageSources(url), null);
});
