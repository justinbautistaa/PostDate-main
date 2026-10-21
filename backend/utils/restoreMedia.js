const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Extract to a new private staging folder only. Never contacts Cloudinary or
// writes to the application's live upload folder.
async function extractMedia(data, destination) {
  const expected = new Set();
  for (const profile of data.collections.find(c => c.name === 'profiles')?.documents || []) {
    for (const reference of [...(profile.photos || []), profile.avatar].filter(Boolean)) {
      if (/^\/api\/photos\/[a-f0-9]{24}$/.test(reference)) continue;
      if (!/^\/uploads\/[a-f0-9]{32}\.webp$/.test(reference)) throw new Error('Unknown photo reference');
      expected.add(reference);
    }
  }
  const verified = [];
  const seen = new Set();
  for (const entry of data.media || []) {
    if (!expected.has(entry.path) || seen.has(entry.path)) throw new Error('Unexpected or duplicate media');
    seen.add(entry.path);
    const bytes = Buffer.from(entry.contentBase64 || '', 'base64');
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== entry.sha256 || bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error('Invalid media checksum or format');
    }
    verified.push({ filename: path.posix.basename(entry.path), bytes, sha256: digest });
  }
  if (seen.size !== expected.size) throw new Error('Backup is missing photo bytes');
  // No recursive creation: the operator must first select a private parent.
  await fs.mkdir(destination, { mode: 0o700 });
  for (const entry of verified) await fs.writeFile(path.join(destination, entry.filename), entry.bytes, { flag: 'wx', mode: 0o600 });
  await fs.writeFile(path.join(destination, 'manifest.json'), JSON.stringify({
    files: verified.map(({ filename, bytes, sha256 }) => ({ filename, bytes: bytes.length, sha256 })),
  }, null, 2), { flag: 'wx', mode: 0o600 });
  return { photos: verified.length, bytes: verified.reduce((n, entry) => n + entry.bytes.length, 0) };
}
module.exports = { extractMedia };
