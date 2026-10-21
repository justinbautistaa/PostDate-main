const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { extractMedia } = require('../utils/restoreMedia');
let root;
const filename = 'a'.repeat(32) + '.webp';
const reference = '/uploads/' + filename;
const bytes = Buffer.from('RIFF0000WEBPtest');
const data = () => ({ collections: [{ name: 'profiles', documents: [{ photos: [reference], avatar: reference }] }], media: [
  { path: reference, contentBase64: bytes.toString('base64'), sha256: crypto.createHash('sha256').update(bytes).digest('hex') },
] });
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'postdate-media-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
test('stages exact bytes with a manifest and refuses to overwrite an existing directory', async () => {
  const target = path.join(root, 'stage');
  expect(await extractMedia(data(), target)).toEqual({ photos: 1, bytes: bytes.length });
  expect(await fs.readFile(path.join(target, filename))).toEqual(bytes);
  expect(JSON.parse(await fs.readFile(path.join(target, 'manifest.json'), 'utf8')).files).toHaveLength(1);
  await expect(extractMedia(data(), target)).rejects.toMatchObject({ code: 'EEXIST' });
});
test.each(['checksum', 'missing', 'duplicate', 'traversal'])('refuses %s before writing any plaintext', async mode => {
  const archive = data();
  if (mode === 'checksum') archive.media[0].sha256 = '0'.repeat(64);
  if (mode === 'missing') archive.media = [];
  if (mode === 'duplicate') archive.media.push(archive.media[0]);
  if (mode === 'traversal') archive.media[0].path = '../outside.webp';
  const target = path.join(root, 'stage');
  await expect(extractMedia(archive, target)).rejects.toThrow();
  await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
});
