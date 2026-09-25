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

// Sources pour @capacitor/assets (icônes + splash natifs Android/iOS)
import { mkdirSync } from 'node:fs';
mkdirSync('assets', { recursive: true });
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon-only.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#07080c' } }).png().toFile('assets/icon-background.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(svg).resize(640, 640).png().toBuffer(), top: 192, left: 192 }])
  .png().toFile('assets/icon-foreground.png');
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#07080c' } })
  .composite([{ input: await sharp(svg).resize(600, 600).png().toBuffer(), top: 1066, left: 1066 }])
  .png().toFile('assets/splash.png');
await sharp('assets/splash.png').toFile('assets/splash-dark.png');
console.log('assets natifs OK');
