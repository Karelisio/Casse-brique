// Génère les icônes PNG depuis public/icons/icon.svg (npm run icons)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icon.svg');
const out = 'public/icons/';
await sharp(svg).resize(192, 192).png().toFile(out + 'icon-192.png');
await sharp(svg).resize(512, 512).png().toFile(out + 'icon-512.png');
await sharp(svg).resize(180, 180).png().toFile(out + 'apple-touch-icon.png');
// maskable : marge de sécurité 10 %
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#07080c' } })
  .composite([{ input: await sharp(svg).resize(410, 410).png().toBuffer(), top: 51, left: 51 }])
  .png().toFile(out + 'icon-maskable-512.png');
console.log('icônes OK');
