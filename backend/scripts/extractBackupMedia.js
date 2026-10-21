require('dotenv').config({ path: require('path').join(__dirname, '../.env.backup'), quiet: true });
const fs = require('fs/promises');
const { decrypt, keyFromEnvironment } = require('../utils/backup');
const { extractMedia } = require('../utils/restoreMedia');
(async () => {
  if (process.argv.length !== 4) throw new Error('Provide encrypted archive and new private staging folder');
  const data = decrypt(await fs.readFile(process.argv[2]), keyFromEnvironment());
  console.log(JSON.stringify(await extractMedia(data, process.argv[3])));
})().catch(() => {
  console.error('Media extraction failed. Check the archive, key and new private staging folder. No live media was changed.');
  process.exitCode = 1;
});
