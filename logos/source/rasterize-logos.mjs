// Rasterize the SVG suite to PNG exports, build favicons + .ico + app icons.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const svgDir = join(ROOT, 'svg');
for (const d of ['png/marks', 'png/wordmarks', 'png/lockups', 'png/emblem', 'png/banners', 'favicons', 'app-icons'])
  mkdirSync(join(ROOT, d), { recursive: true });

function loadSvg(id) { return readFileSync(join(svgDir, id + '.svg'), 'utf8'); }
async function renderPng(svgStr, out, w, h) {
  // re-render natively at target size by overriding intrinsic width/height
  const sized = svgStr.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
  await sharp(Buffer.from(sized), { density: 300 }).png().toFile(out);
}
const addManifest = (id, file, family, title, desc, type, ratio, dims) =>
  manifest.push({ id, family, title, desc, type, ratio, vb: dims, file });

// --- marks, wordmarks, lockups, emblem, banners --------------------------------
const markIds = manifest.filter(m => m.type === 'mark').map(m => m.id);
const wordIds = manifest.filter(m => m.type === 'wordmark').map(m => m.id);
const lockIds = manifest.filter(m => m.type === 'lockup').map(m => m.id);

for (const id of markIds) {
  const svg = loadSvg(id);
  await renderPng(svg, join(ROOT, 'png/marks', `${id}-512.png`), 512, 512);
  await renderPng(svg, join(ROOT, 'png/marks', `${id}-128.png`), 128, 128);
  manifest.find(m => m.id === id).png = [`png/marks/${id}-512.png`, `png/marks/${id}-128.png`];
}
for (const id of [...wordIds, ...lockIds]) {
  const svg = loadSvg(id);
  const m = manifest.find(x => x.id === id);
  const w = 1600, h = Math.round(1600 * m.vb[1] / m.vb[0]);
  const dir = m.type === 'wordmark' ? 'wordmarks' : 'lockups';
  await renderPng(svg, join(ROOT, 'png', dir, `${id}-1600.png`), w, h);
  m.png = [`png/${dir}/${id}-1600.png`];
}
{
  const svg = loadSvg('27-emblem-badge');
  await renderPng(svg, join(ROOT, 'png/emblem/27-emblem-badge-1024.png'), 1024, 1024);
  await renderPng(svg, join(ROOT, 'png/emblem/27-emblem-badge-256.png'), 256, 256);
  manifest.find(m => m.id === '27-emblem-badge').png = ['png/emblem/27-emblem-badge-1024.png', 'png/emblem/27-emblem-badge-256.png'];
}
await renderPng(loadSvg('28-banner-og-refined'), join(ROOT, 'png/banners/28-banner-og-refined-1200x630.png'), 1200, 630);
await renderPng(loadSvg('29-banner-og-centered'), join(ROOT, 'png/banners/29-banner-og-centered-1200x630.png'), 1200, 630);
await renderPng(loadSvg('30-banner-header'), join(ROOT, 'png/banners/30-banner-header-1500x500.png'), 1500, 500);
manifest.find(m => m.id === '28-banner-og-refined').png = ['png/banners/28-banner-og-refined-1200x630.png'];
manifest.find(m => m.id === '29-banner-og-centered').png = ['png/banners/29-banner-og-centered-1200x630.png'];
manifest.find(m => m.id === '30-banner-header').png = ['png/banners/30-banner-header-1500x500.png'];

// --- dedicated favicon designs (chunky strokes that survive 16px) --------------
// Y glyph path from Archivo 900 at a generous size, reused across designs.
import opentype from 'opentype.js';
opentype.Font.prototype.stringToGlyphs = function (s) { return [...s].map(ch => this.charToGlyph(ch)); };
const a900 = opentype.parse(readFileSync('C:/Users/jarin/AppData/Local/Temp/byu-logos-work/fonts/Archivo-900.ttf').buffer);
const yPath = a900.getPath('Y', 0, 0, 100).toPathData(2);
const yBB = a900.getPath('Y', 0, 0, 100).getBoundingBox();

function yGroup(cx, cy, height, fill) {
  const s = height / (yBB.y2 - yBB.y1);
  const gx = cx - (yBB.x1 + yBB.x2) / 2 * s;
  const gy = cy + (yBB.y1 + yBB.y2) / 2 * s; // baseline; getPath coords are y-down
  return `<g transform="translate(${gx.toFixed(2)},${gy.toFixed(2)})"><path d="${yPath}" fill="${fill}"/></g>`;
}
function faviconSvg({ bg, y, header, border, rings }) {
  let b = `<rect x="2" y="2" width="60" height="60" rx="13" fill="${bg}"`;
  b += border ? ` stroke="${border}" stroke-width="4"/>` : '/>';
  if (header) b += `<path d="M8 15 H56" stroke="${header}" stroke-width="5" stroke-linecap="round"/>`;
  if (rings) {
    b += `<rect x="17" y="5" width="6" height="12" rx="3" fill="${border || '#fff'}"/>`;
    b += `<rect x="41" y="5" width="6" height="12" rx="3" fill="${border || '#fff'}"/>`;
  }
  b += yGroup(32, header ? 39 : 33, header ? 34 : 40, y);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${b}</svg>`;
}
const favVariants = [
  ['31-favicon-blue', { bg: '#1a73e8', y: '#ffffff', header: '#174aa6', rings: false }, 'Favicon — blue', 'Blue tile, white Y. The workhorse favicon.'],
  ['32-favicon-blue-rings', { bg: '#1a73e8', y: '#ffffff', header: '#174aa6', rings: true }, 'Favicon — blue + rings', 'Blue tile with calendar ring posts.'],
  ['33-favicon-ink', { bg: '#202124', y: '#1a73e8', header: null, rings: false }, 'Favicon — ink', 'Dark tile with blue Y.'],
  ['34-favicon-light', { bg: '#ffffff', y: '#1a73e8', header: null, border: '#202124', rings: false }, 'Favicon — light', 'White tile, ink border, blue Y (light browser themes).'],
  ['35-favicon-headerline', { bg: '#ffffff', y: '#202124', header: '#1a73e8', border: '#202124', rings: true }, 'Favicon — outline', 'White tile, blue header band, rings, ink Y.'],
];
for (const [id, opts, title, desc] of favVariants) {
  const svg = faviconSvg(opts);
  writeFileSync(join(svgDir, id + '.svg'), svg);
  for (const size of [16, 32, 48]) {
    await sharp(Buffer.from(svg), { density: 384 }).resize(size, size, { kernel: 'lanczos3' }).png().toFile(join(ROOT, 'favicons', `${id}-${size}.png`));
  }
  addManifest(id, `favicons/${id}.svg` ? `svg/${id}.svg` : '', 'J · Favicon', title, desc + ' 16/32/48 PNG + SVG in favicons/.', 'favicon', '1:1', [64, 64]);
  manifest[manifest.length - 1].png = [16, 32, 48].map(s => `favicons/${id}-${s}.png`);
}

// multi-size ICO (PNG-embedded) from the blue favicon
{
  const bufs = [];
  for (const size of [16, 32, 48]) {
    bufs.push({ size, buf: readFileSync(join(ROOT, 'favicons/31-favicon-blue-' + size + '.png')) });
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(bufs.length, 4);
  const entries = [];
  let offset = 6 + 16 * bufs.length;
  const dirs = [];
  for (const { size, buf } of bufs) {
    const d = Buffer.alloc(16);
    d[0] = size >= 256 ? 0 : size; d[1] = size >= 256 ? 0 : size;
    d[2] = 0; d[3] = 0;
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12);
    dirs.push(d); offset += buf.length;
  }
  writeFileSync(join(ROOT, 'favicons/favicon.ico'), Buffer.concat([header, ...dirs, ...bufs.map(b => b.buf)]));
  addManifest('36-favicon-ico', 'favicons/favicon.ico', 'J · Favicon', 'favicon.ico (multi-size)', 'Classic multi-resolution ICO built from the blue favicon (16/32/48).', 'favicon', '1:1', [48, 48]);
}

// --- app icons ------------------------------------------------------------------
// Full-bleed blue with white calendar card + event chips (refined current style).
function appIconCard(bg) {
  const s = 512, x = 106, y = 106, w = 300, h = 300, sw = 10, rx = 44, off = 14, headerH = 86;
  let b = `<rect width="${s}" height="${s}" fill="${bg}"/>`;
  b += `<rect x="${x + off}" y="${y + off}" width="${w}" height="${h}" rx="${rx}" fill="#174aa6"/>`;
  b += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#ffffff" stroke="#202124" stroke-width="${sw}"/>`;
  b += `<clipPath id="aic"><rect x="${x + sw / 2}" y="${y + sw / 2}" width="${w - sw}" height="${h - sw}" rx="${rx - sw / 2}"/></clipPath>`;
  b += `<g clip-path="url(#aic)"><rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="#1a73e8"/></g>`;
  b += `<path d="M ${x + 30} ${y + 48} H ${x + w - 30}" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 22"/>`;
  const chip = (cx, cy, tone, pale, label) => `
    <rect x="${cx}" y="${cy}" width="200" height="52" rx="12" fill="${pale}"/>
    <rect x="${cx}" y="${cy}" width="10" height="52" rx="5" fill="${tone}"/>`;
  b += chip(x + 42, y + headerH + 24, '#1a73e8', '#e8f0fe');
  b += chip(x + 42, y + headerH + 92, '#e8710a', '#fef0df');
  b += `<circle cx="${x + 250}" cy="${y + headerH + 152}" r="12" fill="#dadce0"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${b}</svg>`;
}
// Maskable: same design shrunk into the 66% safe zone.
function maskableCard(bg) {
  const inner = appIconCard(bg).replace(/width="512" height="512"/, 'width="339" height="339"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${bg}"/><g transform="translate(86.5,86.5)">${inner.replace(/<\?xml[^>]*\?>/, '')}</g></svg>`;
}
// Light tile app icon: mark A on pale blue.
async function lightTileIcon() {
  const svg = loadSvg('01-mark-y-tile-blue');
  const inner = svg.replace(/width="\d+" height="\d+"/, 'width="300" height="300"');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#e8f0fe"/>${inner}</svg>`;
  return out;
}
{
  const cardSvg = appIconCard('#1a73e8');
  writeFileSync(join(svgDir, '37-appicon-card.svg'), cardSvg);
  for (const size of [192, 512]) await sharp(Buffer.from(cardSvg)).resize(size, size).png().toFile(join(ROOT, 'app-icons', `37-appicon-card-${size}.png`));
  const mask = maskableCard('#1a73e8');
  writeFileSync(join(svgDir, '38-appicon-card-maskable.svg'), mask);
  await sharp(Buffer.from(mask)).resize(512, 512).png().toFile(join(ROOT, 'app-icons', '38-appicon-card-maskable-512.png'));
  const light = await lightTileIcon();
  writeFileSync(join(svgDir, '39-appicon-light.svg'), light);
  for (const size of [192, 512]) await sharp(Buffer.from(light)).resize(size, size).png().toFile(join(ROOT, 'app-icons', `39-appicon-light-${size}.png`));
  // apple touch: opaque white bg, mark A1
  const a1 = loadSvg('01-mark-y-tile-blue').replace(/width="\d+" height="\d+"/, 'width="360" height="360"');
  const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/>${a1}</svg>`;
  writeFileSync(join(svgDir, '40-appicon-appletouch.svg'), apple);
  await sharp(Buffer.from(apple)).resize(180, 180).png().toFile(join(ROOT, 'app-icons', '40-appicon-appletouch-180.png'));

  addManifest('37-appicon-card', 'svg/37-appicon-card.svg', 'K · App icon', 'App icon — calendar card', 'Full-bleed blue with white event-card mark (refined current style). 192/512.', 'app-icon', '1:1', [512, 512]);
  manifest[manifest.length - 1].png = ['app-icons/37-appicon-card-512.png', 'app-icons/37-appicon-card-192.png'];
  addManifest('38-appicon-card-maskable', 'svg/38-appicon-card-maskable.svg', 'K · App icon', 'App icon — maskable', 'Same card design inside the Android maskable safe zone. 512.', 'app-icon', '1:1', [512, 512]);
  manifest[manifest.length - 1].png = ['app-icons/38-appicon-card-maskable-512.png'];
  addManifest('39-appicon-light', 'svg/39-appicon-light.svg', 'K · App icon', 'App icon — light', 'Y-tile mark on pale-blue field. Light-theme launcher icon. 192/512.', 'app-icon', '1:1', [512, 512]);
  manifest[manifest.length - 1].png = ['app-icons/39-appicon-light-512.png', 'app-icons/39-appicon-light-192.png'];
  addManifest('40-appicon-appletouch', 'svg/40-appicon-appletouch.svg', 'K · App icon', 'App icon — Apple touch', 'Y-tile on white, 180×180 for iOS home screens.', 'app-icon', '1:1', [512, 512]);
  manifest[manifest.length - 1].png = ['app-icons/40-appicon-appletouch-180.png'];
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('rasterization complete:', manifest.length, 'manifest entries');
