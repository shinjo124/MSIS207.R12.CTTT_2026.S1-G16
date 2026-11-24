import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { uploadImage } from '../src/middleware/image-upload.js';

// Exercise the upload middleware over HTTP. Cloudinary is outside this byte-limit test.
test('multipart uploads accept exactly 4 MiB and reject one extra byte', async (t) => {
  const app = express();
  app.post('/', uploadImage, (req, res) => res.json(req.file.size));
  app.use((error, _req, res, _next) => res.status(413).json(error.code));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const limit = 4 * 1024 * 1024;
  for (const size of [limit, limit + 1]) {
    const form = new FormData();
    form.set('image', new Blob([new Uint8Array(size)]), 'test.png');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST', body: form });
    assert.equal(response.status, size === limit ? 200 : 413);
    assert.equal(await response.json(), size === limit ? limit : 'LIMIT_FILE_SIZE');
  }
});
