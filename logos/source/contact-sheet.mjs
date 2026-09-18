// Build labeled contact sheets (cache-busting unique names) for visual verification.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const OUT = 'C:/Users/jarin/AppData/Local/Temp/byu-logos-work';
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

async function sheet(name, entries, cols, cellW, cellH) {
  const labelH = 44;
  const rows = Math.ceil(entries.length / cols);
  const W = cols * cellW + (cols + 1) * 24;
  const H = rows * (cellH + labelH) + 24 * (rows + 1);
  const comps = [];
  const svgTexts = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const col = i % cols, row = Math.floor(i / cols);
    const cx = 24 + col * (cellW + 24), cy = 24 + row * (cellH + labelH + 24);
    const buf = await sharp(join(ROOT, e.png)).resize(cellW - 16, cellH - 16, { fit: 'inside' }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    comps.push({ input: buf, left: cx + Math.round((cellW - meta.width) / 2), top: cy + Math.round((cellH - meta.height) / 2) });
    svgTexts.push(`<text x="${cx + 12}" y="${cy + cellH + 26}" font-family="Arial" font-size="24" font-weight="700" fill="#111">${e.label}</text>`);
  }
  const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${svgTexts.join('')}</svg>`;
  const base = await sharp(Buffer.from(labelSvg)).png().toBuffer();
  await sharp(base).composite(comps).png().toFile(join(OUT, name));
  console.log('sheet', name, W + 'x' + H);
}

const pngOf = id => manifest.find(m => m.id === id)?.png?.[0];
const pick = ids => ids.map(id => ({ png: pngOf(id), label: id.slice(0, 2) + ' ' + manifest.find(m => m.id === id).title }));

await sheet('sheet-marks-v3.png', pick(['01-mark-y-tile-blue', '06-mark-y-tile-solid-blue', '07-mark-y-tile-mono', '08-mark-y-tile-dark', '09-mark-y-date-blue', '10-mark-y-date-orange']), 3, 340, 340);
await sheet('sheet-marks2-v3.png', pick(['11-mark-y-date-green', '12-mark-bc-lettermark', '13-mark-byu-lettermark', '14-mark-dot-y', '15-mark-dot-y-tile', '16-mark-stack-pages']), 3, 340, 340);
await sheet('sheet-text-v3.png', pick(['17-wordmark-byu-calendar', '19-wordmark-caps-period', '20-wordmark-terminal', '21-wordmark-stacked', '22-lockup-horizontal', '24-lockup-stacked']), 2, 760, 260);
await sheet('sheet-misc-v3.png', [
  { png: pngOf('25-lockup-stacked-pages'), label: '25 stacked pages lockup' },
  { png: pngOf('26-lockup-mono'), label: '26 mono lockup' },
  { png: pngOf('27-emblem-badge'), label: '27 emblem badge' },
  { png: 'app-icons/37-appicon-card-512.png', label: '37 app icon card' },
  { png: 'app-icons/39-appicon-light-512.png', label: '39 app icon light' },
  { png: 'favicons/35-favicon-headerline-48.png', label: '35 favicon 48' },
], 3, 380, 380);
await sheet('sheet-banners-v3.png', [
  { png: pngOf('28-banner-og-refined'), label: '28 og refined' },
  { png: pngOf('29-banner-og-centered'), label: '29 og centered' },
  { png: pngOf('30-banner-header'), label: '30 header 1500x500' },
], 1, 1300, 700);
