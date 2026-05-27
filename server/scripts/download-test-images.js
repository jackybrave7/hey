// Pre-download all images referenced by test users from picsum.photos
// and save them as static files. Solves third-party CDN blocking by
// privacy browsers (Yandex.Browser, Firefox, Brave).
//
// Run once:  node server/scripts/download-test-images.js
// Re-run later only if image pool changes in testUsersData.js.

const fs   = require('fs');
const path = require('path');
const https = require('https');

// Все picsum ID из IMAGE_POOLS + IMAGE_POOL_UNIVERSAL (testUsersData.js)
const IDS = Array.from(new Set([
  // artist, musician, filmmaker, actor, poet, photographer, dancer, writer, sculptor, designer
  102, 103, 145, 167, 175, 250, 367,
  145, 250, 277, 326, 428, 549, 626,
  1015, 1018, 1019, 1036, 1043, 1058,
  177, 219, 338, 433, 491, 627, 823,
  24, 365, 411, 459, 466, 538, 590,
  29, 110, 122, 152, 200, 218, 1015,
  177, 219, 338, 1003, 1012, 1027, 1074,
  24, 365, 459, 538, 590, 866, 916,
  177, 219, 250, 326, 367, 472, 663,
  180, 250, 367, 428, 549, 626, 866,
  // universal
  100, 200, 300, 400, 500, 600, 700, 800, 900,
])).sort((a, b) => a - b);

const OUT_DIR = path.join(__dirname, '..', 'data', 'test-images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function download(id) {
  const dest = path.join(OUT_DIR, `${id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    return Promise.resolve({ id, status: 'cached' });
  }
  const url = `https://picsum.photos/id/${id}/640/800`;
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl, hopsLeft) => {
      if (hopsLeft <= 0) return reject(new Error('too many redirects'));
      https.get(currentUrl, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doRequest(res.headers.location, hopsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const tmp = dest + '.tmp';
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on('finish', () => file.close(() => {
          fs.renameSync(tmp, dest);
          resolve({ id, status: 'downloaded', size: fs.statSync(dest).size });
        }));
        file.on('error', err => { try { fs.unlinkSync(tmp); } catch {} reject(err); });
      }).on('error', reject);
    };
    doRequest(url, 5);
  });
}

(async () => {
  console.log(`Downloading ${IDS.length} test images to ${OUT_DIR}…`);
  let ok = 0, cached = 0, failed = 0;
  for (const id of IDS) {
    try {
      const r = await download(id);
      if (r.status === 'cached') { cached++; }
      else { ok++; console.log(`✓ id=${id} (${(r.size/1024).toFixed(0)}KB)`); }
    } catch (e) {
      failed++;
      console.error(`✗ id=${id}: ${e.message}`);
    }
  }
  console.log(`\nDone. Downloaded: ${ok}, cached: ${cached}, failed: ${failed}.`);
  if (failed > 0) process.exit(1);
})();
