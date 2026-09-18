// BYU Calendar logo suite, batch 2: BIG-Y directions (families M-P, options 46-64).
// The Y is the hero. Aesthetics: flat app glyphs, constructed marks, playful, compact lockups.
import opentype from 'opentype.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const FONTS = 'C:/Users/jarin/AppData/Local/Temp/byu-logos-work/fonts';

opentype.Font.prototype.stringToGlyphs = function (s) { return [...s].map(ch => this.charToGlyph(ch)); };

const C = {
  ink: '#202124', grey: '#5f6368', line: '#dadce0', white: '#ffffff',
  blue: '#1a73e8', blueDark: '#174aa6', green: '#188038', purple: '#7627bb',
  orange: '#e8710a', teal: '#00796b',
  paleBlue: '#e8f0fe', paleGreen: '#e6f4ea', paleOrange: '#fef0df', paleTeal: '#e0f2f1',
};

const F = {};
for (const [k, f] of [['a800', 'Archivo-800.ttf'], ['a900', 'Archivo-900.ttf'], ['m500', 'RobotoMono-500.ttf'], ['m700', 'RobotoMono-700.ttf']])
  F[k] = opentype.parse(readFileSync(join(FONTS, f)).buffer);

function round(n) { return Math.round(n * 100) / 100; }
function textWidth(font, text, size, ls = 0) { return font.getAdvanceWidth(text, size, { kerning: true, letterSpacing: ls }); }
function textPath(font, text, size) { return font.getPath(text, 0, 0, size).toPathData(2); }
function textBB(font, text, size) { return font.getPath(text, 0, 0, size).getBoundingBox(); }
function textAt(font, text, cx, cy, size, fill, ls = 0) {
  const bb = textBB(font, text, size);
  const x = cx - (bb.x1 + bb.x2) / 2;
  const baseline = cy - (bb.y1 + bb.y2) / 2;
  const d = font.getPath(text, 0, 0, size, { kerning: true, letterSpacing: ls }).toPathData(2);
  return `<g transform="translate(${round(x)},${round(baseline)})"><path d="${d}" fill="${fill}"/></g>`;
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
// idempotent reruns: drop any previous batch-2 entries before regenerating
for (let i = manifest.length - 1; i >= 0; i--) if (parseInt(manifest[i].id) >= 46) manifest.splice(i, 1);
function saveSvg(name, vb, body, meta) {
  const [w, h] = vb;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
  writeFileSync(join(ROOT, 'svg', name + '.svg'), svg);
  manifest.push({ id: name, family: meta.family, title: meta.title, desc: meta.desc, type: meta.type, ratio: meta.ratio, vb: [w, h], file: `svg/${name}.svg` });
}

// Big Archivo-900 Y, centered in a WxW canvas, cap height = `ch` fraction of canvas.
function bigY(W, ch = 0.66, fontKey = 'a900') {
  const size = W * ch / 0.72; // Archivo cap height ~0.72em
  const bb = textBB(F[fontKey], 'Y', size);
  const x = W / 2 - (bb.x1 + bb.x2) / 2;
  const baseline = W / 2 - (bb.y1 + bb.y2) / 2;
  const d = textPath(F[fontKey], 'Y', size);
  return { d: `<g transform="translate(${round(x)},${round(baseline)})"><path d="${d}"/></g>`, bb };
}
// Capsule Y built from three round-cap strokes meeting at a junction.
function capsuleY(W, stroke, colors = {}, opts = {}) {
  const s = { arm: C.ink, arm2: null, stem: C.ink, ...colors };
  const jx = W / 2, jy = W * (opts.junction ?? 0.52);
  const topY = W * 0.14, botY = W * 0.88;
  const spread = W * (opts.spread ?? 0.30);
  const la = `<path d="M ${jx - spread} ${topY} L ${jx} ${jy}" stroke="${s.arm}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`;
  const ra = s.arm2 ? `<path d="M ${jx + spread} ${topY} L ${jx} ${jy}" stroke="${s.arm2}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>` : '';
  const stem = `<path d="M ${jx} ${jy} L ${jx} ${botY}" stroke="${s.stem}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>`;
  return { svg: la + ra + stem, jx, jy, topY, spread, stroke };
}

// ============================ FAMILY M — big-Y glyphs ============================
function glyphField(id, field, title, desc) {
  const W = 512;
  let b = `<rect x="6" y="6" width="${W - 12}" height="${W - 12}" rx="118" fill="${field}"/>`;
  b += bigY(W, 0.62).d.replace('<path ', '<path fill="#ffffff" ');
  saveSvg(id, [W, W], b, { family: 'M · Big-Y glyph', title, desc, type: 'mark', ratio: '1:1' });
}
glyphField('46-glyph-y-ink', C.ink, 'Big Y — ink field', 'Chunky Archivo Y in white on a near-black rounded square. Favicon-proof at any size.');
glyphField('47-glyph-y-blue', C.blue, 'Big Y — blue field', 'White Y on the app blue. Simple, ownable, unmistakably an app icon.');
glyphField('48-glyph-y-orange', C.orange, 'Big Y — orange field', 'White Y on orange — the friendliest accent in the palette.');
glyphField('49-glyph-y-teal', C.teal, 'Big Y — teal field', 'White Y on teal. Cooler, calmer read than blue.');
{
  // Hollow outline Y
  const W = 512, y = bigY(W, 0.68);
  const b = y.d.replace('<path ', '<path fill="none" stroke="' + C.ink + '" stroke-width="14" stroke-linejoin="round" ');
  saveSvg('50-glyph-y-outline', [W, W], b, { family: 'M · Big-Y glyph', title: 'Big Y — hollow outline', desc: 'Outlined Y, no fill. Sporty, light, works on photos.', type: 'mark', ratio: '1:1' });
}
{
  // Split-tone Y
  const W = 512, y = bigY(W, 0.68).d;
  const b = `<defs>
    <clipPath id="spl"><rect x="0" y="0" width="${W / 2}" height="${W}"/></clipPath>
    <clipPath id="spr"><rect x="${W / 2}" y="0" width="${W / 2}" height="${W}"/></clipPath>
  </defs>
  <g clip-path="url(#spl)">${y.replace('<path ', '<path fill="' + C.blue + '" ')}</g>
  <g clip-path="url(#spr)">${y.replace('<path ', '<path fill="' + C.teal + '" ')}</g>`;
  saveSvg('51-glyph-y-split', [W, W], b, { family: 'M · Big-Y glyph', title: 'Big Y — split tone', desc: 'Y split straight down the middle: blue left, teal right.', type: 'mark', ratio: '1:1' });
}
{
  // Gradient Y
  const W = 512, y = bigY(W, 0.68).d;
  const b = `<defs><linearGradient id="gy" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.teal}"/>
  </linearGradient></defs>` + y.replace('<path ', '<path fill="url(#gy)" ');
  saveSvg('52-glyph-y-gradient', [W, W], b, { family: 'M · Big-Y glyph', title: 'Big Y — gradient', desc: 'Blue→teal diagonal gradient. Modern-SaaS take, furthest from collegiate.', type: 'mark', ratio: '1:1' });
}

// ============================ FAMILY N — constructed Ys ============================
{
  // Capsule Y (built from strokes, not a font)
  const W = 512;
  const b = capsuleY(W, 118).svg;
  saveSvg('53-built-y-capsule', [W, W], b, { family: 'N · Constructed Y', title: 'Capsule Y', desc: 'Y drawn as three fat rounded strokes — friendly, geometric, font-free.', type: 'mark', ratio: '1:1' });
}
{
  // Event-bar Y: the app's week-view chips arranged as a Y
  const W = 512;
  const chip = (len, wd, pale, tone) => `<rect x="0" y="0" width="${len}" height="${wd}" rx="${wd * 0.28}" fill="${pale}"/><rect x="0" y="0" width="${wd * 0.24}" height="${wd}" rx="${wd * 0.12}" fill="${tone}"/>`;
  const wd = 108, armLen = 226, stemLen = 250;
  const cx = W / 2, jy = W * 0.52, topY = W * 0.13, botY = W * 0.89, spread = W * 0.315;
  let b = '';
  // left arm: from top-left down to junction, rotated to point there
  {
    const dx = -spread, dy = jy - topY, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    b += `<g transform="translate(${cx - spread},${topY}) rotate(${round(ang - 180)})">${chip(armLen, wd, C.paleOrange, C.orange)}</g>`;
  }
  {
    const dx = spread, dy = jy - topY, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    b += `<g transform="translate(${cx + spread},${topY}) rotate(${round(ang)})">${chip(armLen, wd, C.paleGreen, C.green)}</g>`;
  }
  b += `<g transform="translate(${cx - wd / 2},${jy - 10})">${chip(stemLen, wd, C.paleBlue, C.blue)}</g>`;
  saveSvg('54-built-y-eventbars', [W, W], b, { family: 'N · Constructed Y', title: 'Event-bar Y', desc: 'The Y built from the app\'s own week-view event chips — pale cards with color tabs. Calendar-coded without drawing a calendar.', type: 'mark', ratio: '1:1' });
}
{
  // Binder-ring Y: capsule Y whose arms end in calendar rings
  const W = 512, stroke = 108;
  const cy = capsuleY(W, stroke, { arm: C.ink, stem: C.ink });
  let b = cy.svg;
  const ring = (cx2, cy2, col) => `<circle cx="${round(cx2)}" cy="${round(cy2)}" r="46" fill="#fff" stroke="${col}" stroke-width="26"/>`;
  b += ring(cy.jx - cy.spread, cy.topY, C.blue);
  b += ring(cy.jx + cy.spread, cy.topY, C.green);
  saveSvg('55-built-y-rings', [W, W], b, { family: 'N · Constructed Y', title: 'Binder-ring Y', desc: 'Capsule Y with calendar binder rings riding the arm tips. Playful calendar cue.', type: 'mark', ratio: '1:1' });
}
{
  // Notification-chip Y
  const W = 512, y = bigY(W, 0.68).d.replace('<path ', '<path fill="' + C.ink + '" ');
  const chipX = W * 0.70, chipY = W * 0.20;
  const b = y + `<rect x="${chipX}" y="${chipY}" width="96" height="66" rx="20" fill="${C.orange}" stroke="#fff" stroke-width="10"/><circle cx="${chipX + 48}" cy="${chipY + 33}" r="13" fill="#fff"/>`;
  saveSvg('56-built-y-chip', [W, W], b, { family: 'N · Constructed Y', title: 'Notification Y', desc: 'Giant ink Y with an orange notification chip riding its shoulder. Events live here.', type: 'mark', ratio: '1:1' });
}
{
  // Halftone grid Y
  const W = 512, n = 7, cell = 62, gap = 6, ox = (W - (n * cell + (n - 1) * gap)) / 2;
  const cells = [];
  for (let r = 0; r < n; r++) {
    if (r === 0) cells.push([0, r], [n - 1, r]);
    else if (r === 1) cells.push([1, r], [n - 2, r]);
    else if (r === 2) cells.push([2, r], [n - 3, r]);
    else cells.push([3, r]);
  }
  const accents = { '0,0': C.blue, '6,0': C.green, '3,6': C.orange };
  let b = '';
  for (const [cix, r] of cells) {
    const col = accents[`${cix},${r}`] || C.ink;
    b += `<rect x="${round(ox + cix * (cell + gap))}" y="${round(ox + r * (cell + gap))}" width="${cell}" height="${cell}" rx="16" fill="${col}"/>`;
  }
  saveSvg('57-built-y-grid', [W, W], b, { family: 'N · Constructed Y', title: 'Grid Y', desc: 'Y as a 7×7 grid of rounded tiles with three accent tiles — calendar cells forming the letter.', type: 'mark', ratio: '1:1' });
}

// ============================ FAMILY O — playful Ys ============================
{
  // Sticker Y
  const W = 512;
  const inner = `<rect x="66" y="66" width="380" height="380" rx="46" fill="${C.white}" stroke="${C.ink}" stroke-width="14"/>`
    + bigY(W, 0.52).d.replace('<path ', '<path fill="' + C.blue + '" ')
    + `<path d="M ${66 + 54} ${66 + 120} l 26 -44 l 26 44 l -26 -12 Z" fill="${C.orange}"/>`;
  const b = `<g transform="rotate(-6 ${W / 2} ${W / 2})">`
    + `<rect x="78" y="78" width="380" height="380" rx="46" fill="${C.blue}"/>${inner}</g>`;
  saveSvg('58-playful-y-sticker', [W, W], b, { family: 'O · Playful Y', title: 'Sticker Y', desc: 'Tilted sticker with hard blue shadow and an orange sparkle. Laptop-sticker energy.', type: 'mark', ratio: '1:1' });
}
{
  // Squiggle underline Y
  const W = 512, y = bigY(W * 0.94, 0.58).d.replace('<path ', '<path fill="' + C.ink + '" ');
  const b = `<g transform="translate(${W * 0.03},${W * 0.01})">${y}</g>`
    + `<path d="M ${W * 0.18} ${W * 0.80} q ${W * 0.08} ${-W * 0.07} ${W * 0.16} 0 t ${W * 0.16} 0 t ${W * 0.16} 0 t ${W * 0.16} 0" fill="none" stroke="${C.orange}" stroke-width="17" stroke-linecap="round"/>`;
  saveSvg('59-playful-y-squiggle', [W, W], b, { family: 'O · Playful Y', title: 'Squiggle Y', desc: 'Hand-drawn orange squiggle under the Y — a highlighter swipe.', type: 'mark', ratio: '1:1' });
}
{
  // Tri-color capsule Y
  const W = 512;
  const b = capsuleY(W, 112, { arm: C.blue, arm2: C.green, stem: C.orange }).svg;
  saveSvg('60-playful-y-tricolor', [W, W], b, { family: 'O · Playful Y', title: 'Tri-color capsule Y', desc: 'Capsule Y in blue / green / orange — the event-palette as the letter itself.', type: 'mark', ratio: '1:1' });
}

// ============================ FAMILY P — big-Y lockups ============================
{
  // Y + mono wordmark, stacked
  const W = 680, H = 680;
  const capY = capsuleY(340, 84, { arm: C.blue, stem: C.blue });
  let b = `<g transform="translate(${(W - 340) / 2},36)">${capY.svg}</g>`;
  b += textAt(F.m500, 'byu calendar', W / 2, 500, 58, C.ink);
  b += `<line x1="${W / 2 - 150}" y1="556" x2="${W / 2 + 150}" y2="556" stroke="${C.line}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/>`;
  b += textAt(F.m500, 'CAMPUS EVENTS', W / 2, 614, 26, C.grey, 0.3);
  saveSvg('61-lockup-y-mono', [W, H], b, { family: 'P · Big-Y lockup', title: 'Lockup — capsule Y + mono', desc: 'Blue capsule Y over lowercase mono wordmark with dotted rule. Square-ish splash footprint.', type: 'lockup', ratio: 'square-ish' });
}
{
  // "Unofficial" lockup — owns the independence
  const W = 900, H = 460;
  const y = bigY(H * 0.9, 0.72).d.replace('<path ', '<path fill="' + C.ink + '" ');
  let b = `<g transform="translate(30,10)">${y}</g>`;
  const tx = H * 0.95 + 30 + 56;
  b += textAt(F.a900, 'BYU', tx + 8, 148, 118, C.ink);
  b += textAt(F.m700, 'CALENDAR', tx + 8, 236, 50, C.blue, 0.34);
  const tag = 'THE UNOFFICIAL ONE';
  const tw = textWidth(F.m500, tag, 26, 0.12);
  b += `<rect x="${tx}" y="${288}" width="${tw + 56}" height="58" rx="16" fill="${C.paleOrange}" stroke="${C.orange}" stroke-width="3.5"/>`;
  b += textAt(F.m500, tag, tx + (tw + 56) / 2, 317, 26, C.ink, 0.12);
  b += textAt(F.m500, 'every event · one calendar', tx + 8, 404, 27, C.grey);
  saveSvg('62-lockup-y-unofficial', [W, H], b, { family: 'P · Big-Y lockup', title: 'Lockup — “the unofficial one”', desc: 'Big Y + wordmark with an honest orange tag: THE UNOFFICIAL ONE. Directly answers “not BYU themselves”.', type: 'lockup', ratio: 'wide' });
}
{
  // Minimal circle badge
  const W = 512;
  let b = `<circle cx="${W / 2}" cy="${W / 2}" r="238" fill="none" stroke="${C.ink}" stroke-width="20"/>`;
  b += bigY(W, 0.5).d.replace('<path ', '<path fill="' + C.blue + '" ');
  b += `<circle cx="${W / 2 + 238 * Math.cos(-Math.PI / 4)}" cy="${W / 2 + 238 * Math.sin(-Math.PI / 4)}" r="14" fill="${C.orange}"/>`;
  b += `<circle cx="${W / 2 + 238 * Math.cos(Math.PI - Math.PI / 4)}" cy="${W / 2 + 238 * Math.sin(Math.PI - Math.PI / 4)}" r="14" fill="${C.green}"/>`;
  saveSvg('63-badge-y-circle', [W, W], b, { family: 'P · Big-Y lockup', title: 'Circle badge Y', desc: 'Thick ink ring, big blue Y, two accent dots. Minimal stamp-style badge.', type: 'mark', ratio: '1:1' });
}
{
  // Horizontal: capsule Y + two-line text
  const W = 980, H = 380;
  const capY = capsuleY(300, 76, { arm: C.blue, stem: C.blue });
  let b = `<g transform="translate(24,40)">${capY.svg}</g>`;
  const tx = 380;
  b += `<line x1="${tx - 36}" y1="72" x2="${tx - 36}" y2="308" stroke="${C.line}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"/>`;
  b += textAt(F.a800, 'BYU Calendar', tx + 84, 168, 96, C.ink).replace('fill="#202124"', `fill="${C.ink}"`);
  b += textAt(F.m500, 'the unofficial campus calendar', tx + 86, 252, 34, C.grey);
  b += `<rect x="${tx + 86}" y="286" width="14" height="14" rx="4" fill="${C.orange}"/><rect x="${tx + 110}" y="286" width="14" height="14" rx="4" fill="${C.green}"/><rect x="${tx + 134}" y="286" width="14" height="14" rx="4" fill="${C.purple}"/>`;
  saveSvg('64-lockup-y-horizontal', [W, H], b, { family: 'P · Big-Y lockup', title: 'Lockup — capsule Y horizontal', desc: 'Blue capsule Y, dotted divider, wordmark with quiet “unofficial” note and event dots.', type: 'lockup', ratio: 'wide' });
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`batch 2 written: ${manifest.length} total manifest entries`);
