import test from 'node:test';
import assert from 'node:assert/strict';
import { isRelevantTitle, pickCommonsInfo, pickPageImage, searchTitles } from '../src/services/wiki-images.js';

test('only articles that match the place name are used', () => {
  assert.equal(isRelevantTitle('Dinh Độc Lập', 'Dinh Độc Lập'), true);
  assert.equal(isRelevantTitle('Chợ Bến Thành', 'Chợ Bến Thành'), true);
  assert.equal(isRelevantTitle('Hồ Xuân Hương', 'Hồ Xuân Hương (Đà Lạt)'), true);
  assert.equal(isRelevantTitle('Hồ Xuân Hương', 'Xuân Diệu'), false);
  assert.equal(isRelevantTitle('Chợ Đà Lạt', 'Đà Lạt'), true);
  assert.equal(isRelevantTitle('Bảo tàng Dân tộc học Việt Nam', 'Việt Nam'), false);
});

test('reads search results, page image and Commons licence', () => {
  assert.deepEqual(searchTitles({ query: { search: [{ title: 'Dinh Độc Lập' }] } }), ['Dinh Độc Lập']);
  assert.deepEqual(pickPageImage({ query: { pages: { 1: { thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' }, pageimage: 'X.jpg' } } } }),
    { thumbnail: 'https://upload.wikimedia.org/x.jpg', fileName: 'X.jpg' });
  assert.equal(pickPageImage({ query: { pages: { 1: {} } } }), null);
  const info = pickCommonsInfo({ query: { pages: { '-1': { imageinfo: [{ descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg', extmetadata: {
    Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:A">Nguyễn A</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] } } } });
  assert.deepEqual(info, { credit: 'Nguyễn A', license: 'CC BY-SA 4.0', pageUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg' });
  assert.equal(pickCommonsInfo({ query: { pages: { '-1': { imageinfo: [{ extmetadata: { LicenseShortName: { value: 'Fair use' } } }] } } } }), null);
});

test('province photo prefers scenery over food and markets', async () => {
  const { pickProvincePhoto } = await import('../src/services/wiki-images.js');
  const photo = pickProvincePhoto([
    { id: 1, name: 'Chợ Đà Lạt', category: 'Shopping', imageUrl: 'a.jpg' },
    { id: 2, name: 'Hồ Xuân Hương', category: 'Nature', imageUrl: 'b.jpg', imageCredit: 'A', imageLicense: 'CC BY-SA 4.0' },
    { id: 3, name: 'Quảng trường Lâm Viên', category: 'Sightseeing', imageUrl: null },
  ]);
  assert.deepEqual(photo, { placeName: 'Hồ Xuân Hương', url: 'b.jpg', credit: 'A', license: 'CC BY-SA 4.0', pageUrl: null });
  assert.equal(pickProvincePhoto([{ id: 1, category: 'Food', imageUrl: null }]), null);
});
