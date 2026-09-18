// Rasterize batch-2 (big-Y) SVGs to PNG and update manifest png fields.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

function loadSvg(id) { return readFileSync(join(ROOT, 'svg', id + '.svg'), 'utf8'); }
async function renderPng(svgStr, out, w, h) {
  const sized = svgStr.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
  await sharp(Buffer.from(sized), { density: 300 }).png().toFile(out);
}

const batch = manifest.filter(m => parseInt(m.id) >= 46);
for (const m of batch) {
  const svg = loadSvg(m.id);
  if (m.type === 'mark') {
    m.png = [`png/marks/${m.id}-512.png`, `png/marks/${m.id}-128.png`];
    await renderPng(svg, join(ROOT, m.png[0]), 512, 512);
    await renderPng(svg, join(ROOT, m.png[1]), 128, 128);
  } else {
    const w = 1600, h = Math.round(1600 * m.vb[1] / m.vb[0]);
    m.png = [`png/lockups/${m.id}-1600.png`];
    await renderPng(svg, join(ROOT, m.png[0]), w, h);
  }
}
writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('batch 2 rasterized:', batch.length, 'options');
