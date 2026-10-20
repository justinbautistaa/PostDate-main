const crypto = require('crypto');
const { cloudPhotoUrl } = require('./cloudPhotos');
async function collectMedia(data, { fetchImpl = fetch, maxBytes = 24 * 1024 * 1024 } = {}) {
  const profiles = data.collections.find(c => c.name === 'profiles')?.documents || [];
  const paths = new Set(profiles.flatMap(p => [...(p.photos || []), p.avatar].filter(Boolean)));
  const media = [];
  let total = 0;
  for (const path of paths) {
    const embedded = /^\/api\/photos\/([a-f0-9]{24})$/.exec(path);
    if (embedded) {
      const photo = data.collections.find(c => c.name === 'photos')?.documents.find(p => String(p._id) === embedded[1]);
      if (!photo?.data) throw new Error('Embedded photo missing from database snapshot');
      continue; // The database snapshot already preserves these binary photo bytes.
    }
    const match = /^\/uploads\/([a-f0-9]{32}\.webp)$/.exec(path);
    if (!match) throw new Error('Unrecognized media reference');
    const response = await fetchImpl(cloudPhotoUrl(match[1]), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error('Photo backup unavailable');
    const chunks = [];
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > maxBytes) throw new Error('Media backup size limit reached');
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Invalid photo response');
    media.push({ path, contentBase64: bytes.toString('base64'), sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  return media;
}
module.exports = { collectMedia };
