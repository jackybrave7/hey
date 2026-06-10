const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '../web/public');
const logo = path.join(pub, 'hey-logo.png');

function gradBg(w, h, r) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5F4080"/>
      <stop offset="60%" stop-color="#7c45c7"/>
      <stop offset="100%" stop-color="#a87ce4"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="${r}" fill="url(#g)"/>
</svg>`;
  return sharp(Buffer.from(svg));
}

async function compositeIcon(size, pad, radius, outName) {
  const mark = Math.round(size * (1 - pad * 2));
  const resized = await sharp(logo)
    .resize(mark, mark, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const left = Math.round((size - mark) / 2);
  const bg = await gradBg(size, size, radius);
  await bg
    .composite([{ input: resized, left, top: left }])
    .png()
    .toFile(path.join(pub, outName));
}

function svgWithBg(b64, size, markSize, markOffset, rx) {
  const rect = rx
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>`
    : `<rect width="${size}" height="${size}" fill="url(#bg)"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5F4080"/>
      <stop offset="60%" stop-color="#7c45c7"/>
      <stop offset="100%" stop-color="#a87ce4"/>
    </linearGradient>
  </defs>
  ${rect}
  <image href="data:image/png;base64,${b64}" x="${markOffset}" y="${markOffset}" width="${markSize}" height="${markSize}"/>
</svg>`;
}

async function main() {
  if (!fs.existsSync(logo)) throw new Error('hey-logo.png missing');

  await compositeIcon(192, 0.18, 28, 'icon-192.png');
  await compositeIcon(512, 0.18, 72, 'icon-512.png');
  fs.copyFileSync(path.join(pub, 'icon-512.png'), path.join(pub, 'icon-maskable-512.png'));

  const badgeMark = await sharp(logo)
    .resize(84, 84, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: badgeMark, left: 6, top: 6 }])
    .png()
    .toFile(path.join(pub, 'badge-96.png'));

  const b64 = fs.readFileSync(logo).toString('base64');

  fs.writeFileSync(path.join(pub, 'favicon.svg'), svgWithBg(b64, 64, 44, 10, 14));
  fs.writeFileSync(path.join(pub, 'icon-source.svg'), svgWithBg(b64, 512, 344, 84, 0));
  fs.writeFileSync(path.join(pub, 'apple-touch-icon.svg'), svgWithBg(b64, 180, 120, 30, 40));
  fs.writeFileSync(
    path.join(pub, 'logo-mark.svg'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="data:image/png;base64,${b64}" width="64" height="64"/></svg>`
  );
  fs.writeFileSync(
    path.join(pub, 'badge-source.svg'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image href="data:image/png;base64,${b64}" x="6" y="6" width="84" height="84"/></svg>`
  );
  fs.writeFileSync(
    path.join(pub, 'bimi-logo.svg'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>HEY</title><rect width="64" height="64" fill="#5F4080"/><image href="data:image/png;base64,${b64}" x="8" y="8" width="48" height="48"/></svg>`
  );

  fs.writeFileSync(
    path.join(pub, 'og-image.svg'),
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a1058"/>
      <stop offset="50%" stop-color="#5F4080"/>
      <stop offset="100%" stop-color="#7c45c7"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g opacity="0.25" fill="#F9F0F0">
    <circle cx="180" cy="120" r="3"/><circle cx="1050" cy="180" r="4"/>
    <circle cx="1100" cy="480" r="3"/><circle cx="120" cy="500" r="3"/>
    <circle cx="950" cy="80" r="2"/><circle cx="280" cy="540" r="2"/>
  </g>
  <g transform="translate(600 245)" filter="url(#glow)">
    <image href="data:image/png;base64,${b64}" x="-90" y="-90" width="180" height="180"/>
  </g>
  <text x="600" y="430" font-family="Comfortaa, system-ui, sans-serif" font-size="92" font-weight="700" fill="#F9F0F0" text-anchor="middle" letter-spacing="6">HEY</text>
  <text x="600" y="490" font-family="system-ui, sans-serif" font-size="28" font-weight="500" fill="#d8c5f5" text-anchor="middle" letter-spacing="2">мессенджер для близкого круга</text>
  <text x="600" y="555" font-family="system-ui, sans-serif" font-size="20" font-weight="400" fill="#b89de0" text-anchor="middle" letter-spacing="1">Чаты · Моменты · Голосовые</text>
</svg>`
  );

  console.log('Logo assets built from hey-logo.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
