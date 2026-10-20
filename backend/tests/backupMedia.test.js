const { collectMedia } = require('../utils/backupMedia');
jest.mock('../utils/cloudPhotos', () => ({ cloudPhotoUrl: () => 'https://api.cloudinary.com/test' }));
const path = '/uploads/' + 'a'.repeat(32) + '.webp';
const data = { collections: [{ name: 'profiles', documents: [{ photos: [path], avatar: path }] }] };
const bytes = Buffer.from('RIFF0000WEBPtest');
test('deduplicates gallery/avatar references and preserves media bytes', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(new Response(bytes));
  const result = await collectMedia(data, { fetchImpl });
  expect(result).toHaveLength(1);
  expect(Buffer.from(result[0].contentBase64, 'base64')).toEqual(bytes);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test('retains database-backed photos through the snapshot and rejects broken references', async () => {
  const id = 'b'.repeat(24);
  const embedded = { collections: [{ name: 'profiles', documents: [{ photos: ['/api/photos/' + id] }] }, { name: 'photos', documents: [{ _id: id, data: Buffer.from('photo') }] }] };
  expect(await collectMedia(embedded)).toEqual([]);
  embedded.collections.pop();
  await expect(collectMedia(embedded)).rejects.toThrow('Embedded photo missing');
});
test('refuses missing, oversized and unrecognized media rather than claiming a complete backup', async () => {
  await expect(collectMedia(data, { fetchImpl: async () => new Response('', { status: 404 }) })).rejects.toThrow();
  await expect(collectMedia(data, { fetchImpl: async () => new Response(bytes), maxBytes: 1 })).rejects.toThrow('size limit');
  await expect(collectMedia({ collections: [{ name: 'profiles', documents: [{ photos: ['https://example.com/private'] }] }] })).rejects.toThrow('Unrecognized');
});
