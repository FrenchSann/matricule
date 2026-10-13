// Génère les icônes PNG de la PWA à partir d'un SVG unique (pas de police : rendu identique partout).
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const mark = (scale = 1) => {
  const s = (v) => (256 + (v - 256) * scale).toFixed(1);
  const chevron = (y, color) =>
    `<path d="M${s(150)} ${s(y)} L${s(256)} ${s(y + 62)} L${s(362)} ${s(y)} L${s(362)} ${s(y + 34)} L${s(256)} ${s(y + 96)} L${s(150)} ${s(y + 34)} Z" fill="${color}"/>`;
  return `
  <path d="M${s(132)} ${s(96)} H${s(380)} L${s(404)} ${s(120)} V${s(392)} L${s(380)} ${s(416)} H${s(132)} L${s(108)} ${s(392)} V${s(120)} Z" fill="none" stroke="#A88A4A" stroke-width="${(6 * scale).toFixed(1)}"/>
  <rect x="${s(150)}" y="${s(136)}" width="${(212 * scale).toFixed(1)}" height="${(20 * scale).toFixed(1)}" fill="#A88A4A"/>
  ${chevron(184, '#A8141F')}
  ${chevron(254, '#6E0E16')}
  <rect x="${s(240)}" y="${s(372)}" width="${(32 * scale).toFixed(1)}" height="${(8 * scale).toFixed(1)}" fill="#A88A4A"/>`;
};

const svg = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="96"' : ''} fill="#060507"/>
  ${mark(scale)}
</svg>`;

const out = async (file, size, scale) =>
  sharp(Buffer.from(svg(scale, false))).resize(size, size).png().toFile(`public/${file}`);

await out('icon-192.png', 192, 1);
await out('icon-512.png', 512, 1);
await out('icon-maskable-512.png', 512, 0.78);
await out('apple-touch-icon.png', 180, 0.92);
await writeFile('public/favicon.svg', svg(1, true));
console.log('icônes générées');
