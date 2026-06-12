import sharp from 'sharp';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = readFileSync(join(root, 'icon-app.svg'));
const mask = readFileSync(join(root, 'icon-maskable.svg'));
const mark = readFileSync(join(root, 'hey-logo.svg'));

await sharp(app).resize(512, 512).png().toFile(join(root, 'icon-512.png'));
await sharp(app).resize(192, 192).png().toFile(join(root, 'icon-192.png'));
await sharp(mask).resize(512, 512).png().toFile(join(root, 'icon-maskable-512.png'));
await sharp(mark).resize(150, 150).png().toFile(join(root, 'hey-logo.png'));

console.log('Icons generated: icon-192.png, icon-512.png, icon-maskable-512.png, hey-logo.png');
