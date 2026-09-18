// BYU Calendar logo suite generator.
// Emits path-only SVGs (text converted to outlines, no font dependency) into
// <project>/logos/svg plus a manifest.json describing every option.
import opentype from 'opentype.js';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const FONTS = 'C:/Users/jarin/AppData/Local/Temp/byu-logos-work/fonts';
mkdirSync(join(ROOT, 'svg'), { recursive: true });

// Newer Google Fonts GSUB tables hit unsupported lookups in opentype's bidi
// pipeline for some letters; bypass it with direct char→glyph mapping.
opentype.Font.prototype.stringToGlyphs = function (s) {
  return [...s].map(ch => this.charToGlyph(ch));
};

// --- palette (mirrors app/globals.css) ---------------------------------------
const C = {
  ink: '#202124', grey: '#5f6368', line: '#dadce0', white: '#ffffff', surface: '#f8f9fa',
  blue: '#1a73e8', blueDark: '#174aa6', green: '#188038', purple: '#7627bb',
  orange: '#e8710a', teal: '#00796b',
  paleBlue: '#e8f0fe', paleGreen: '#e6f4ea', palePurple: '#f3e8fd', paleOrange: '#fef0df', paleTeal: '#e0f2f1',
};
const TONES = { blue: C.blue, green: C.green, purple: C.purple, orange: C.orange, teal: C.teal };
const PALES = { blue: C.paleBlue, green: C.paleGreen, purple: C.palePurple, orange: C.paleOrange, teal: C.paleTeal };

// --- fonts ---------------------------------------------------------------------
const F = {};
for (const spec of [
  ['a500', 'Archivo-500.ttf'], ['a600', 'Archivo-600.ttf'], ['a700', 'Archivo-700.ttf'],
  ['a800', 'Archivo-800.ttf'], ['a900', 'Archivo-900.ttf'],
  ['r400', 'Roboto-400.ttf'], ['r500', 'Roboto-500.ttf'], ['r700', 'Roboto-700.ttf'], ['r900', 'Roboto-900.ttf'],
  ['m400', 'RobotoMono-400.ttf'], ['m500', 'RobotoMono-500.ttf'], ['m700', 'RobotoMono-700.ttf'],
]) F[spec[0]] = opentype.parse(readFileSync(join(FONTS, spec[1])).buffer);

// --- svg helpers ----------------------------------------------------------------
const manifest = [];
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Text as pure paths. opentype getPath already returns y-down (SVG-ready)
// coordinates: baseline at y, ascenders at negative y. No flip needed.
function textEl(font, text, x, baseline, size, fill, opts = {}) {
  const o = { kerning: true, letterSpacing: opts.ls || 0 };
  const p = font.getPath(text, 0, 0, size, o);
  const d = p.toPathData(2);
  return { w: font.getAdvanceWidth(text, size, o), d, bb: p.getBoundingBox(),
    svg: `<g transform="translate(${round(x)},${round(baseline)})"><path d="${d}" fill="${fill}"/></g>` };
}
function textWidth(font, text, size, ls = 0) { return font.getAdvanceWidth(text, size, { kerning: true, letterSpacing: ls }); }
function textBB(font, text, size, ls = 0) { return font.getPath(text, 0, 0, size, { kerning: true, letterSpacing: ls }).getBoundingBox(); }
function round(n) { return Math.round(n * 100) / 100; }

// Vertical optical centering helper: glyph spans [baseline+y1, baseline+y2]
// with y1 negative, so the baseline sits half-height ABOVE cy.
function baselineFor(font, text, size, cy, ls = 0) {
  const bb = textBB(font, text, size, ls);
  return cy - (bb.y1 + bb.y2) / 2;
}

function saveSvg(name, vb, body, meta) {
  const [w, h] = vb;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
  writeFileSync(join(ROOT, 'svg', name + '.svg'), svg);
  manifest.push({ id: name, family: meta.family, title: meta.title, desc: meta.desc,
    type: meta.type, ratio: meta.ratio, vb: [w, h], file: `svg/${name}.svg` });
  return svg;
}

function rrect(x, y, w, h, rx, attrs) { return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${rx}" ${attrs}/>`; }
function circle(cx, cy, r, attrs) { return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" ${attrs}/>`; }
function line(x1, y1, x2, y2, attrs) { return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" ${attrs}/>`; }

// =============================================================================
// MARK A — "Y-tile": calendar card, hard offset shadow, header band, big Y.
// =============================================================================
function markA({ header = C.blue, glyph = C.ink, card = C.white, shadow = C.ink, rings = true } = {}) {
  const W = 512, m = 56, w = W - 2 * m - 16; // 16px room for shadow
  const x = m, y = m, h = w, sw = 18, rx = 64, off = 16;
  const headerH = h * 0.3;
  let b = '';
  // calendar ring posts
  if (rings) {
    for (const px of [x + w * 0.28, x + w * 0.72]) {
      b += rrect(px - 15, y - 26, 30, 64, 15, `fill="${card}" stroke="${C.ink}" stroke-width="${sw * 0.8}"`);
    }
  }
  // hard offset shadow, then card
  b += rrect(x + off, y + off, w, h, rx, `fill="${shadow}"`);
  b += rrect(x, y, w, h, rx, `fill="${card}" stroke="${C.ink}" stroke-width="${sw}"`);
  // header band clipped to card top corners
  b += `<clipPath id="cardclip"><rect x="${x + sw / 2}" y="${y + sw / 2}" width="${w - sw}" height="${h - sw}" rx="${rx - sw / 2}"/></clipPath>`;
  b += `<g clip-path="url(#cardclip)">`;
  b += rrect(x, y, w, headerH + sw, 8, `fill="${header}"`);
  b += `</g>`;
  b += line(x + sw / 2, y + headerH + sw / 2, x + w - sw / 2, y + headerH + sw / 2, `stroke="${C.ink}" stroke-width="${sw * 0.75}"`);
  // small white dots on the header like weekday row? keep clean: two ring shadows only.
  // big Y centered in the body
  const t = textEl(F.a900, 'Y', 0, 0, w * 0.6, glyph);
  const bb = textBB(F.a900, 'Y', w * 0.6);
  const gx = x + w / 2 - (bb.x1 + bb.x2) / 2;
  const bodyTop = y + headerH + sw, bodyH = h - headerH - sw;
  const gy = baselineFor(F.a900, 'Y', w * 0.6, y + headerH + sw + bodyH * 0.55);
  b += `<g transform="translate(${round(gx)},${round(gy)})"><path d="${t.d}" fill="${glyph}"/></g>`;
  return { body: b, vb: [W, W] };
}

function emitMarkA(id, opts, meta) { const { body, vb } = markA(opts); saveSvg(id, vb, body, meta); }

emitMarkA('01-mark-y-tile-blue', { header: C.blue, glyph: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — blue', desc: 'White calendar card, blue header band, ink Y. Closest evolution of the current favicon.', type: 'mark', ratio: '1:1' });
emitMarkA('02-mark-y-tile-green', { header: C.green, glyph: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — green', desc: 'Green header accent variant.', type: 'mark', ratio: '1:1' });
emitMarkA('03-mark-y-tile-purple', { header: C.purple, glyph: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — purple', desc: 'Purple header accent variant.', type: 'mark', ratio: '1:1' });
emitMarkA('04-mark-y-tile-orange', { header: C.orange, glyph: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — orange', desc: 'Orange header accent variant.', type: 'mark', ratio: '1:1' });
emitMarkA('05-mark-y-tile-teal', { header: C.teal, glyph: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — teal', desc: 'Teal header accent variant.', type: 'mark', ratio: '1:1' });
emitMarkA('06-mark-y-tile-solid-blue', { header: C.blueDark, glyph: C.white, card: C.blue, shadow: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — solid blue', desc: 'Full blue card with white Y. Direct refresh of today\'s favicon.', type: 'mark', ratio: '1:1' });
emitMarkA('07-mark-y-tile-mono', { header: C.ink, glyph: C.ink, card: C.white, shadow: C.ink }, { family: 'A · Y-tile', title: 'Y-tile — mono', desc: 'Single-color repro version: ink header, ink Y, ink shadow.', type: 'mark', ratio: '1:1' });
emitMarkA('08-mark-y-tile-dark', { header: C.blue, glyph: C.white, card: C.ink, shadow: C.blueDark }, { family: 'A · Y-tile', title: 'Y-tile — dark mode', desc: 'Inverted card for dark backgrounds; blue header, white Y.', type: 'mark', ratio: '1:1' });

// =============================================================================
// MARK B — "Y-date": calendar page where Y is the date. SEP header, event chip.
// =============================================================================
function markB({ accent = C.blue, pale = C.paleBlue } = {}) {
  const W = 512, m = 56, w = W - 2 * m - 14, x = m, y = m, h = w, sw = 16, rx = 56, off = 14;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let b = '';
  b += rrect(x + off, y + off, w, h, rx, `fill="${accent}"`);
  b += rrect(x, y, w, h, rx, `fill="${C.white}" stroke="${C.ink}" stroke-width="${sw}"`);
  // header row: month label left, event chip right
  const ls = 0.28;
  const month = months[8]; // SEP
  const mw = textWidth(F.m700, month, 44, ls);
  const hy = y + sw + 66;
  b += textEl(F.m700, month, x + sw + 44, hy, 44, C.grey, { ls }).svg;
  b += rrect(x + w - sw - 44 - 36, hy - 36, 36, 36, 11, `fill="${accent}"`);
  // dotted separator
  b += line(x + sw + 26, y + 142, x + w - sw - 26, y + 142, `stroke="${C.line}" stroke-width="7" stroke-dasharray="2 16" stroke-linecap="round"`);
  // giant Y as the date, breathing room above/below
  const size = w * 0.5;
  const bb = textBB(F.a900, 'Y', size);
  const gx = x + w / 2 - (bb.x1 + bb.x2) / 2;
  const gy = y + 160 + (h - 160 - sw) / 2 - (bb.y1 + bb.y2) / 2;
  const t = F.a900.getPath('Y', 0, 0, size).toPathData(2);
  b += `<g transform="translate(${round(gx)},${round(gy)})"><path d="${t}" fill="${C.ink}"/></g>`;
  // notification dot tucked into the bottom-right corner above the border
  b += circle(x + w - sw - 34, y + h - sw - 34, 13, `fill="${C.orange}" stroke="${C.white}" stroke-width="6"`);
  return { body: b, vb: [W, W] };
}
saveSvg('09-mark-y-date-blue', ...((() => { const r = markB({ accent: C.blue }); return [r.vb, r.body, { family: 'B · Y-date', title: 'Y-date — blue', desc: 'Calendar page where the Y is the date; SEP header, event chip, notification dot.', type: 'mark', ratio: '1:1' }]; })()));
{ const r = markB({ accent: C.orange }); saveSvg('10-mark-y-date-orange', r.vb, r.body, { family: 'B · Y-date', title: 'Y-date — orange', desc: 'Orange accent variant of the Y-date page.', type: 'mark', ratio: '1:1' }); }
{ const r = markB({ accent: C.green }); saveSvg('11-mark-y-date-green', r.vb, r.body, { family: 'B · Y-date', title: 'Y-date — green', desc: 'Green accent variant of the Y-date page.', type: 'mark', ratio: '1:1' }); }

// =============================================================================
// MARK C — lettermarks with dog-ear folded corner.
// =============================================================================
function markC(letters, accentArr) {
  const W = 512, m = 56, w = W - 2 * m - 14, x = m, y = m, h = w, sw = 16, rx = 48, off = 14;
  const fold = 96;
  let b = '';
  b += rrect(x + off, y + off, w, h, rx, `fill="${C.ink}"`);
  // card with dog-ear: path
  const p = `M ${x + rx} ${y} H ${x + w - fold} L ${x + w} ${y + fold} V ${y + h - rx} Q ${x + w} ${y + h} ${x + w - rx} ${y + h} H ${x + rx} Q ${x} ${y + h} ${x} ${y + h - rx} V ${y + rx} Q ${x} ${y} ${x + rx} ${y} Z`;
  b += `<path d="${p}" fill="${C.white}" stroke="${C.ink}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  b += `<path d="M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold}" fill="none" stroke="${C.line}" stroke-width="8" stroke-dasharray="2 14" stroke-linecap="round"/>`;
  b += `<path d="M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold} Z" fill="${accentArr}"/>`;
  // letters centered, last letter gets no special color; small accent dot after text
  const size = w * 0.44;
  const ls = letters.length > 2 ? -0.02 : 0;
  const tw = textWidth(F.a900, letters, size, ls);
  const bb = textBB(F.a900, letters, size, ls);
  const gx = x + w / 2 - (bb.x1 + bb.x2) / 2;
  const gy = baselineFor(F.a900, letters, size, y + h / 2 + size * 0.06, ls);
  const d = F.a900.getPath(letters, 0, 0, size, { kerning: true, letterSpacing: ls }).toPathData(2);
  b += `<g transform="translate(${round(gx)},${round(gy)})"><path d="${d}" fill="${C.ink}"/></g>`;
  return { body: b, vb: [W, W] };
}
{ const r = markC('BC', C.paleBlue); saveSvg('12-mark-bc-lettermark', r.vb, r.body, { family: 'C · Lettermark', title: 'BC lettermark', desc: '"BC" monogram on a page with folded calendar corner.', type: 'mark', ratio: '1:1' }); }
{ const r = markC('BYU', C.paleBlue); saveSvg('13-mark-byu-lettermark', r.vb, r.body, { family: 'C · Lettermark', title: 'BYU lettermark', desc: '"BYU" on a page with folded calendar corner.', type: 'mark', ratio: '1:1' }); }

// =============================================================================
// MARK D — "event-dot Y": mosaic Y built from palette dots.
// =============================================================================
function markD({ tile = false } = {}) {
  const W = 512, cell = 88, gx0 = (W - 5 * cell) / 2, gy0 = (W - 5 * cell) / 2, r = 40;
  const cells = [
    [0, 0, C.blue], [4, 0, C.green],
    [1, 1, C.purple], [3, 1, C.orange],
    [2, 2, C.teal], [2, 3, C.blue], [2, 4, C.ink],
  ];
  let b = '';
  if (tile) {
    b += rrect(28, 28, W - 56 - 12, W - 56 - 12, 64, `fill="${C.ink}" transform="translate(12,12)"`);
    b += rrect(28, 28, W - 56 - 12, W - 56 - 12, 64, `fill="${C.white}" stroke="${C.ink}" stroke-width="16"`);
  }
  for (const [cx, cy, col] of cells) {
    b += circle(gx0 + cx * cell + cell / 2, gy0 + cy * cell + cell / 2, r, `fill="${col}" stroke="${C.white}" stroke-width="10"`);
  }
  return { body: b, vb: [W, W] };
}
{ const r = markD(); saveSvg('14-mark-dot-y', r.vb, r.body, { family: 'D · Event-dot Y', title: 'Event-dot Y', desc: 'Y assembled from calendar event dots in the five accent colors. Transparent background.', type: 'mark', ratio: '1:1' }); }
{ const r = markD({ tile: true }); saveSvg('15-mark-dot-y-tile', r.vb, r.body, { family: 'D · Event-dot Y', title: 'Event-dot Y — on card', desc: 'Dot-mosaic Y on a bordered white card.', type: 'mark', ratio: '1:1' }); }

// =============================================================================
// MARK E — "one calendar" stack: scattered pages behind one calendar card.
// =============================================================================
function markE({ front = C.blue } = {}) {
  const W = 512;
  let b = '';
  const card = (x, y, w, h, rot, fill, dots) => {
    let s = `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">`;
    s += rrect(x, y, w, h, 48, `fill="${fill}" stroke="${C.ink}" stroke-width="14"`);
    if (dots) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        s += circle(x + w * 0.3 + c * w * 0.2, y + h * 0.34 + r * h * 0.2, 10, `fill="${C.line}"`);
    }
    s += `</g>`;
    return s;
  };
  b += card(96, 60, 300, 300, -14, C.paleBlue, true);
  b += card(150, 110, 290, 290, 10, C.paleOrange, true);
  // front card: reuse mark A proportions without its own margin
  const x = 118, y = 148, w = 280, h = 280, sw = 14, rx = 48, off = 14, headerH = h * 0.3;
  for (const px of [x + w * 0.28, x + w * 0.72]) b += rrect(px - 11, y - 20, 22, 48, 11, `fill="${C.white}" stroke="${C.ink}" stroke-width="11"`);
  b += rrect(x + off, y + off, w, h, rx, `fill="${C.ink}"`);
  b += rrect(x, y, w, h, rx, `fill="${C.white}" stroke="${C.ink}" stroke-width="${sw}"`);
  b += `<clipPath id="eclip"><rect x="${x + sw / 2}" y="${y + sw / 2}" width="${w - sw}" height="${h - sw}" rx="${rx - sw / 2}"/></clipPath>`;
  b += `<g clip-path="url(#eclip)">${rrect(x, y, w, headerH + sw, 8, `fill="${front}"`)}</g>`;
  b += line(x + sw / 2, y + headerH + sw / 2, x + w - sw / 2, y + headerH + sw / 2, `stroke="${C.ink}" stroke-width="${sw * 0.75}"`);
  const size = w * 0.5, bb = textBB(F.a900, 'Y', size);
  const gx = x + w / 2 - (bb.x1 + bb.x2) / 2, gy = baselineFor(F.a900, 'Y', size, y + headerH + sw + (h - headerH - sw) * 0.55);
  const d = F.a900.getPath('Y', 0, 0, size).toPathData(2);
  b += `<g transform="translate(${round(gx)},${round(gy)})"><path d="${d}" fill="${C.ink}"/></g>`;
  return { body: b, vb: [W, W] };
}
{ const r = markE(); saveSvg('16-mark-stack-pages', r.vb, r.body, { family: 'E · One-calendar stack', title: 'One-calendar stack', desc: 'Scattered event pages collapsing into one calendar card — the product story as a mark.', type: 'mark', ratio: '1:1' }); }

// =============================================================================
// WORDMARKS
// =============================================================================
function wordmark1(color1 = C.ink, color2 = C.blue) {
  const size = 160, t1 = 'BYU', t2 = ' Calendar';
  const w1 = textWidth(F.a800, t1, size), w2 = textWidth(F.a800, t2, size);
  const bb = textBB(F.a800, t1 + t2, size);
  const W = Math.ceil(w1 + w2) + 40, H = size * 1.42;
  const y = baselineFor(F.a800, t1 + t2, size, H / 2);
  let b = textEl(F.a800, t1, 20, y, size, color1).svg + textEl(F.a800, t2, 20 + w1, y, size, color2).svg;
  return { body: b, vb: [W, H], w: W, h: H, baseline: y };
}
{ const r = wordmark1(); saveSvg('17-wordmark-byu-calendar', r.vb, r.body, { family: 'F · Wordmark', title: 'Wordmark — two-tone', desc: 'Archivo ExtraBold: ink "BYU" + blue "Calendar".', type: 'wordmark', ratio: 'wide' }); }
{ const r = wordmark1(C.white, C.paleBlue); saveSvg('18-wordmark-byu-calendar-dark', r.vb, r.body, { family: 'F · Wordmark', title: 'Wordmark — dark mode', desc: 'White/pale-blue wordmark for dark backgrounds.', type: 'wordmark', ratio: 'wide' }); }

function wordmark2() {
  // All caps with orange period.
  const size = 150, ls = -0.015;
  const txt = 'BYU CALENDAR';
  const w1 = textWidth(F.a900, txt, size, ls), wDot = textWidth(F.a900, '.', size);
  const W = Math.ceil(w1 + wDot) + 40, H = size * 1.42;
  const y = baselineFor(F.a900, txt, size, H / 2, ls);
  let b = textEl(F.a900, txt, 20, y, size, C.ink, { ls }).svg + textEl(F.a900, '.', 20 + w1, y, size, C.orange).svg;
  return { body: b, vb: [W, H] };
}
{ const r = wordmark2(); saveSvg('19-wordmark-caps-period', r.vb, r.body, { family: 'F · Wordmark', title: 'Wordmark — caps + period', desc: 'Archivo Black caps with an orange full-stop.', type: 'wordmark', ratio: 'wide' }); }

function wordmark3() {
  // Terminal style: roboto mono lowercase + block cursor.
  const size = 130, txt = 'byu calendar';
  const w1 = textWidth(F.m500, txt, size);
  const bb = textBB(F.m500, txt, size);
  const W = Math.ceil(w1 + size * 0.9) + 40, H = size * 1.5;
  const y = baselineFor(F.m500, txt, size, H / 2);
  let b = textEl(F.m500, txt, 20, y, size, C.ink).svg;
  b += rrect(20 + w1 + 18, y - bb.y2, size * 0.55, bb.y2 - bb.y1, 8, `fill="${C.blue}"`);
  b += `<path d="${''}"/>`;
  return { body: b, vb: [W, H] };
}
{ const r = wordmark3(); saveSvg('20-wordmark-terminal', r.vb, r.body, { family: 'F · Wordmark', title: 'Wordmark — terminal', desc: 'Roboto Mono lowercase with a blue block cursor. Nods to the app\'s mono labels.', type: 'wordmark', ratio: 'wide' }); }

function wordmark4(colorTop = C.ink, colorSub = C.blue) {
  // Stacked: BYU huge, CALENDAR tracked out below with dotted rules.
  const size1 = 200, size2 = 54, ls2 = 0.55;
  const t1 = 'BYU', t2 = 'CALENDAR';
  const w1 = textWidth(F.a900, t1, size1), w2 = textWidth(F.m700, t2, size2, ls2);
  const W = Math.ceil(Math.max(w1, w2)) + 60, H = size1 * 1.05 + 130;
  const y1 = baselineFor(F.a900, t1, size1, size1 * 0.62);
  const y2 = y1 + 84;
  let b = textEl(F.a900, t1, W / 2 - w1 / 2, y1, size1, colorTop).svg;
  const rl = W / 2 - w2 / 2 - 44, rr = W / 2 + w2 / 2 + 44;
  b += textEl(F.m700, t2, W / 2 - w2 / 2, y2, size2, colorSub, { ls: ls2 }).svg;
  b += line(20, y2 - 20, rl, y2 - 20, `stroke="${C.line}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"`);
  b += line(rr, y2 - 20, W - 20, y2 - 20, `stroke="${C.line}" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round"`);
  return { body: b, vb: [W, H] };
}
{ const r = wordmark4(); saveSvg('21-wordmark-stacked', r.vb, r.body, { family: 'F · Wordmark', title: 'Wordmark — stacked', desc: 'Big Archivo Black BYU over tracked-out mono CALENDAR with dotted rules.', type: 'wordmark', ratio: 'square-ish' }); }

// =============================================================================
// LOCKUPS (mark + wordmark)
// =============================================================================
function lockupH(markSvgFn, markVb, textFn) {
  const t = textFn();
  const markH = 200;
  const scale = markH / markVb[1], markW = markVb[0] * scale;
  const gap = 56;
  const W = Math.ceil(markW + gap + t.w - 40), H = Math.max(markH, t.h) + 20;
  const my = (H - markH) / 2, ty = baselineFor(F.a800, 'BYU Calendar', 160, H / 2);
  // textFn already built with its own canvas; re-render text at H/2 centering via its generator? Simpler: compose from parts.
  return { markW, markH, t, gap, W, H, scale };
}
// Horizontal lockup 1: Y-tile blue + two-tone wordmark
{
  const { body: mb, vb } = markA({ header: C.blue, glyph: C.ink });
  const size = 150, t1 = 'BYU', t2 = ' Calendar';
  const w1 = textWidth(F.a800, t1, size), w2 = textWidth(F.a800, t2, size);
  const tw = w1 + w2, th = size * 1.3;
  const markH = 216, sc = markH / vb[1], markW = vb[0] * sc;
  const gap = 64, pad = 30;
  const W = Math.ceil(pad + markW + gap + tw + pad), H = Math.ceil(markH + pad);
  const y = baselineFor(F.a800, t1 + t2, size, H / 2 + 6);
  let b = `<g transform="translate(${pad},${(H - markH) / 2}) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="l1')}</g>`;
  b += textEl(F.a800, t1, pad + markW + gap, y, size, C.ink).svg;
  b += textEl(F.a800, t2, pad + markW + gap + w1, y, size, C.blue).svg;
  b += circle(pad + markW + gap + tw + 26, y - size * 0.72, 16, `fill="${C.orange}"`);
  saveSvg('22-lockup-horizontal', [W, H], b, { family: 'G · Lockup', title: 'Horizontal lockup', desc: 'Y-tile + two-tone wordmark + orange event dot. Primary header lockup candidate.', type: 'lockup', ratio: 'wide' });
}
// Horizontal lockup 2: solid blue Y-tile + dark-mode wordmark
{
  const { body: mb, vb } = markA({ header: C.blueDark, glyph: C.white, card: C.blue, shadow: C.ink });
  const size = 150, t1 = 'BYU', t2 = ' Calendar';
  const w1 = textWidth(F.a800, t1, size), w2 = textWidth(F.a800, t2, size);
  const tw = w1 + w2;
  const markH = 216, sc = markH / vb[1], markW = vb[0] * sc;
  const gap = 64, pad = 30;
  const W = Math.ceil(pad + markW + gap + tw + pad), H = Math.ceil(markH + pad);
  const y = baselineFor(F.a800, t1 + t2, size, H / 2 + 6);
  let b = `<g transform="translate(${pad},${(H - markH) / 2}) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="l2')}</g>`;
  b += textEl(F.a800, t1, pad + markW + gap, y, size, C.white).svg;
  b += textEl(F.a800, t2, pad + markW + gap + w1, y, size, C.paleBlue).svg;
  saveSvg('23-lockup-horizontal-dark', [W, H], b, { family: 'G · Lockup', title: 'Horizontal lockup — dark', desc: 'Solid-blue tile + light wordmark for dark surfaces.', type: 'lockup', ratio: 'wide' });
}
// Stacked lockup 1: Y-tile + wordmark centered below
{
  const { body: mb, vb } = markA({ header: C.blue, glyph: C.ink });
  const size = 96, t1 = 'BYU', t2 = ' Calendar';
  const w1 = textWidth(F.a800, t1, size), w2 = textWidth(F.a800, t2, size);
  const tw = w1 + w2;
  const markH = 300, sc = markH / vb[1], markW = vb[0] * sc;
  const W = Math.ceil(Math.max(markW, tw) + 80), H = Math.ceil(markH + 40 + size * 1.3 + 40);
  const y = markH + 40 + size * 1.02;
  let b = `<g transform="translate(${(W - markW) / 2},20) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="s1')}</g>`;
  b += textEl(F.a800, t1, W / 2 - tw / 2, y, size, C.ink).svg;
  b += textEl(F.a800, t2, W / 2 - tw / 2 + w1, y, size, C.blue).svg;
  saveSvg('24-lockup-stacked', [W, H], b, { family: 'G · Lockup', title: 'Stacked lockup', desc: 'Y-tile over centered wordmark. Square-ish footprint for splash screens.', type: 'lockup', ratio: 'square-ish' });
}
// Stacked lockup 2: one-calendar stack mark + stacked wordmark
{
  const { body: mb, vb } = markE();
  const markH = 330, sc = markH / vb[1], markW = vb[0] * sc;
  const size1 = 104, size2 = 34, ls2 = 0.5;
  const w2 = textWidth(F.m700, 'CALENDAR', size2, ls2);
  const W = Math.ceil(Math.max(markW, w2) + 80), H = Math.ceil(markH + 30 + size1 * 1.15 + 56);
  let b = `<g transform="translate(${(W - markW) / 2},10) scale(${round(sc)})">${mb}</g>`;
  const y1 = markH + 20 + size1 * 0.82;
  b += textEl(F.a900, 'BYU', W / 2 - textWidth(F.a900, 'BYU', size1) / 2, y1, size1, C.ink).svg;
  b += textEl(F.m700, 'CALENDAR', W / 2 - w2 / 2, y1 + 46, size2, C.blue, { ls: ls2 }).svg;
  saveSvg('25-lockup-stacked-pages', [W, H], b, { family: 'G · Lockup', title: 'Stacked lockup — story mark', desc: 'One-calendar stack over big BYU + tracked CALENDAR.', type: 'lockup', ratio: 'square-ish' });
}
// Mono lockup (single color repro)
{
  const { body: mb, vb } = markA({ header: C.ink, glyph: C.ink, card: C.white, shadow: C.ink });
  const size = 150, txt = 'BYU CALENDAR';
  const tw = textWidth(F.a800, txt, size);
  const markH = 216, sc = markH / vb[1], markW = vb[0] * sc;
  const gap = 64, pad = 30;
  const W = Math.ceil(pad + markW + gap + tw + pad), H = Math.ceil(markH + pad);
  const y = baselineFor(F.a800, txt, size, H / 2 + 6);
  let b = `<g transform="translate(${pad},${(H - markH) / 2}) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="m1')}</g>`;
  b += textEl(F.a800, txt, pad + markW + gap, y, size, C.ink).svg;
  saveSvg('26-lockup-mono', [W, H], b, { family: 'G · Lockup', title: 'Mono lockup', desc: 'All-ink version for single-color printing or embroidery.', type: 'lockup', ratio: 'wide' });
}

// =============================================================================
// EMBLEM — circular badge with text around the ring.
// =============================================================================
{
  const W = 1024, cx = W / 2, cy = W / 2;
  let b = '';
  b += circle(cx, cy, 470, `fill="${C.white}" stroke="${C.ink}" stroke-width="16"`);
  b += circle(cx, cy, 428, `fill="none" stroke="${C.ink}" stroke-width="6" stroke-dasharray="2 20" stroke-linecap="round"`);
  // center mark (mini Y-tile, no shadow)
  const { body: mb, vb } = markA({ header: C.blue, glyph: C.ink });
  const mw = 360, sc = mw / vb[0];
  b += `<g transform="translate(${cx - mw / 2},${cy - mw / 2 + 6}) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="em')}</g>`;
  // ring text
  function ringText(text, font, size, radius, fill, bottom = false, ls = 0.32) {
    const lsPx = ls * size;
    const widths = [...text].map(ch => font.getAdvanceWidth(ch, size));
    const total = widths.reduce((a, w) => a + w + lsPx, -lsPx);
    const angleSpan = (total / radius) * 180 / Math.PI;
    let s = '';
    let angle = bottom ? 90 + angleSpan / 2 : -90 - angleSpan / 2; // degrees, y-down coords
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const chw = widths[i];
      const half = (chw / 2 / radius) * 180 / Math.PI;
      angle += bottom ? -half : half;
      const a = angle * Math.PI / 180;
      const px = cx + radius * Math.cos(a), py = cy + radius * Math.sin(a);
      const rot = bottom ? angle - 90 : angle + 90;
      const p = font.getPath(ch, 0, 0, size);
      s += `<g transform="translate(${round(px)},${round(py)}) rotate(${round(rot)})"><path d="${p.toPathData(2)}" fill="${fill}"/></g>`;
      angle += bottom ? -half : half;
    }
    return s;
  }
  b += ringText('BYU CALENDAR', F.a800, 84, 330, C.ink);
  b += ringText('EST · 2026', F.m500, 56, 348, C.grey, true, 0.4);
  // side diamonds
  for (const a of [0, 180]) {
    const rad = a * Math.PI / 180;
    const px = cx + 449 * Math.cos(rad), py = cy + 449 * Math.sin(rad);
    b += `<rect x="-14" y="-14" width="28" height="28" fill="${C.orange}" transform="translate(${round(px)},${round(py)}) rotate(45)"/>`;
  }
  saveSvg('27-emblem-badge', [W, W], b, { family: 'H · Emblem', title: 'Badge emblem', desc: 'Circular badge: Y-tile center, BYU CALENDAR around the ring, EST·2026 at bottom. Sticker/merch vibe.', type: 'emblem', ratio: '1:1' });
}

// =============================================================================
// BANNERS
// =============================================================================
// OG banner 1 — refined version of the current og-image with real fonts.
{
  const W = 1200, H = 630;
  let b = rrect(0, 0, W, H, 0, `fill="${C.surface}"`);
  b += rrect(0, 0, W, 10, 0, `fill="${C.ink}"`);
  // left column
  b += textEl(F.m500, 'LESS SEARCHING. MORE SHOWING UP.', 84, 150, 30, C.grey, { ls: 0.06 }).svg;
  b += textEl(F.a900, 'BYU', 84, 292, 148, C.ink).svg;
  b += textEl(F.a800, 'Calendar', 84 + textWidth(F.a900, 'BYU', 148) + 28, 292, 148, C.blue).svg;
  b += line(84, 348, 84 + 640, 348, `stroke="${C.line}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"`);
  b += textEl(F.m500, 'EVERY DEPARTMENT, CLUB & EMPLOYER EVENT IN ONE PLACE', 84, 402, 26, C.grey, { ls: 0.04 }).svg;
  // url block
  b += rrect(84, 470, 300, 64, 12, `fill="${C.paleBlue}" stroke="${C.blue}" stroke-width="3"`);
  b += textEl(F.m700, 'byucalendar.com', 104, 512, 30, C.blueDark).svg;
  b += textEl(F.m400, 'INDEPENDENT STUDENT PROJECT · NOT AFFILIATED WITH BYU', 84, 584, 20, C.grey, { ls: 0.03 }).svg;
  // right calendar card
  const cx0 = 812, cy0 = 120, cw = 300;
  b += rrect(cx0 + 14, cy0 + 14, cw, cw, 24, `fill="${C.blue}"`);
  b += rrect(cx0, cy0, cw, cw, 24, `fill="${C.white}" stroke="${C.ink}" stroke-width="5"`);
  b += `<clipPath id="ogc"><rect x="${cx0 + 2.5}" y="${cy0 + 2.5}" width="${cw - 5}" height="${cw - 5}" rx="22"/></clipPath>`;
  b += `<g clip-path="url(#ogc)">${rrect(cx0, cy0, cw, 66, 6, `fill="${C.blue}"`)}</g>`;
  b += textEl(F.m700, 'THIS WEEK', cx0 + 22, cy0 + 44, 24, C.white, { ls: 0.08 }).svg;
  const events = [
    [0, C.blue, 'AIS SOCIAL'], [1, C.green, 'DEV NIGHT'], [2, C.purple, 'career fair'],
    [4, C.orange, 'ACCOUNTING'], [5, C.teal, 'OPEN LAB'], [7, C.blue, 'CLUB NIGHT'],
  ];
  const cell = (cw - 44) / 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const idx = r * 3 + c, ev = events.find(e => e[0] === idx);
    const x = cx0 + 22 + c * cell, y = cy0 + 84 + r * 70;
    if (ev) {
      b += rrect(x, y, cell - 10, 56, 10, `fill="${PALES[Object.keys(TONES).find(k => TONES[k] === ev[1])]}"`);
      b += rrect(x, y, 7, 56, 4, `fill="${ev[1]}"`);
      const label = ev[2].length > 9 ? ev[2].slice(0, 8) + '…' : ev[2];
      b += textEl(F.m500, label, x + 16, y + 36, 17, C.ink).svg;
    } else {
      b += circle(x + (cell - 10) / 2, y + 28, 8, `fill="${C.line}"`);
    }
  }
  saveSvg('28-banner-og-refined', [W, H], b, { family: 'I · Banner', title: 'OG banner — product', desc: '1200×630 social preview: headline, URL chip, and a this-week calendar card with real fonts.', type: 'banner', ratio: '1200×630' });
}
// OG banner 2 — centered, framed.
{
  const W = 1200, H = 630;
  let b = rrect(0, 0, W, H, 0, `fill="${C.white}"`);
  b += rrect(24, 24, W - 48, H - 48, 28, `fill="none" stroke="${C.ink}" stroke-width="5"`);
  b += rrect(24, 24, W - 48, H - 48, 28, `fill="none" stroke="${C.ink}" stroke-width="5" stroke-dasharray="2 16" stroke-linecap="round" transform="translate(10,10)"`);
  const { body: mb, vb } = markA({ header: C.blue, glyph: C.ink });
  const mw = 250, sc = mw / vb[0];
  b += `<g transform="translate(${(W - mw) / 2 - 10},92) scale(${round(sc)})">${mb.replace(/clipPath id="/g, 'clipPath id="b2')}</g>`;
  const size = 100, t1 = 'BYU', t2 = ' Calendar';
  const w1 = textWidth(F.a800, t1, size), w2 = textWidth(F.a800, t2, size);
  const y = 502;
  b += textEl(F.a800, t1, W / 2 - (w1 + w2) / 2, y, size, C.ink).svg;
  b += textEl(F.a800, t2, W / 2 - (w1 + w2) / 2 + w1, y, size, C.blue).svg;
  b += textEl(F.m500, 'CAMPUS EVENTS IN ONE PLACE', W / 2 - textWidth(F.m500, 'CAMPUS EVENTS IN ONE PLACE', 26, 0.3) / 2, 566, 26, C.grey, { ls: 0.3 }).svg;
  saveSvg('29-banner-og-centered', [W, H], b, { family: 'I · Banner', title: 'OG banner — centered', desc: '1200×630 framed centered lockup with dotted offset frame.', type: 'banner', ratio: '1200×630' });
}
// Social header 1500×500.
{
  const W = 1500, H = 500;
  let b = rrect(0, 0, W, H, 0, `fill="${C.white}"`);
  b += rrect(0, 0, W, H, 0, `fill="${C.surface}"`);
  b += rrect(18, 18, W - 36, H - 36, 20, `fill="${C.white}" stroke="${C.ink}" stroke-width="4"`);
  // event dot strip
  const dots = [C.blue, C.green, C.purple, C.orange, C.teal, C.blue, C.green];
  for (let i = 0; i < dots.length; i++) b += circle(W / 2 - (dots.length - 1) * 26 + i * 52, 108, 16, `fill="${dots[i]}"`);
  const size = 150, txt = 'BYU CALENDAR';
  const tw = textWidth(F.a900, txt, size, -0.01);
  const y = 316;
  b += textEl(F.a900, txt, W / 2 - tw / 2, y, size, C.ink, { ls: -0.01 }).svg;
  b += textEl(F.a900, '.', W / 2 + tw / 2, y, size, C.orange).svg;
  b += textEl(F.m500, 'byucalendar.com', W / 2 - textWidth(F.m500, 'byucalendar.com', 28) / 2, 388, 28, C.grey).svg;
  saveSvg('30-banner-header', [W, H], b, { family: 'I · Banner', title: 'Social header', desc: '1500×500 centered wordmark with event-dot strip. Twitter/X or LinkedIn cover.', type: 'banner', ratio: '1500×500' });
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} svgs`);
