// Build logos/index.html (review contact sheet) and logos/README.md.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'C:/Users/jarin/OneDrive/Desktop/VibeDev/BYUCalendar/logos';
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

// add 3d entries
try {
  const files = readdirSync(join(ROOT, '3d')).filter(f => f.endsWith('.png')).sort();
  for (const f of files) {
    const id = f.replace('.png', '');
    const titles = {
      '41-3d-y-tile-tilt': ['3D Y-tile — tilted', 'Blender render: calendar tile with beveled edges, blue band, ring posts, extruded Y, toon ink outlines.'],
      '42-3d-y-tile-appicon': ['3D Y-tile — app icon', 'Straight-on orthographic render: a modern, softly-lit app-icon take on the Y-tile.'],
      '43-3d-stack-pages': ['3D — one-calendar stack', 'Fanned calendar pages behind the front card; the product story in 3D.'],
      '44-3d-wordmark': ['3D wordmark', 'Extruded Archivo wordmark with a hard blue offset copy behind.'],
      '45-3d-cube-y': ['3D — event-cube Y', 'Isometric Y built from rounded palette cubes.'],
    };
    const [title, desc] = titles[id] || [id, 'Blender render.'];
    manifest.push({ id, family: 'L · 3D (Blender)', title, desc, type: '3d', ratio: 'render', file: `3d/${f}`, png: [`3d/${f}`] });
  }
} catch { /* no 3d dir */ }

const families = [...new Set(manifest.map(m => m.family))];

const cards = manifest.map(m => {
  const imgs = (m.png || []).slice();
  const main = imgs[0] || (m.file && m.file.endsWith('.png') ? m.file : null);
  const mainCss = m.type === 'banner' ? 'max-height:260px' : 'max-height:230px';
  return `<figure class="card" id="${m.id}">
  <div class="imgwrap">${main ? `<img src="${main}" loading="lazy" style="${mainCss}" alt="${m.title}">` : '<div style="font-size:12px;color:#5f6368">container file — see files below</div>'}</div>
  <figcaption>
    <div class="name"><span class="num">${m.id.slice(0, 2)}</span> ${m.title}</div>
    <div class="desc">${m.desc}</div>
    <div class="files">${[m.file, ...imgs].filter((v, i, a) => a.indexOf(v) === i).map(f => `<code>${f}</code>`).join(' ')}</div>
  </figcaption>
</figure>`;
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BYU Calendar — logo options</title>
<style>
  :root { --ink:#202124; --grey:#5f6368; --line:#dadce0; --blue:#1a73e8; --surface:#f8f9fa; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Roboto, Arial, sans-serif; color: var(--ink); background:var(--surface); }
  header { padding:28px 36px 10px; }
  h1 { font-family: Arial, sans-serif; margin:0 0 6px; font-size:28px; }
  header p { margin:0; color:var(--grey); max-width:70ch; }
  .toggle { position:sticky; top:0; z-index:5; background:var(--surface); padding:10px 36px; border-bottom:1.5px solid var(--line); display:flex; gap:12px; align-items:center; }
  .toggle button { font:600 13px Roboto,Arial; padding:7px 14px; border:1.5px solid var(--ink); background:#fff; border-radius:10px; cursor:pointer; box-shadow:2px 2px 0 var(--ink); }
  .toggle button.active { background:var(--blue); color:#fff; border-color:var(--ink); }
  .toggle span { color:var(--grey); font-size:13px; }
  main { padding: 20px 36px 60px; }
  h2 { font-family: Arial, sans-serif; font-size:15px; letter-spacing:.12em; text-transform:uppercase; color:var(--grey); margin:34px 0 12px; border-bottom:1.5px dotted var(--line); padding-bottom:6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:22px; }
  .card { margin:0; background:#fff; border:1.5px solid var(--ink); border-radius:12px; overflow:hidden; box-shadow:3px 3px 0 var(--ink); display:flex; flex-direction:column; }
  .imgwrap { min-height:250px; display:flex; align-items:center; justify-content:center; padding:18px; background:
     repeating-conic-gradient(#f1f3f4 0% 25%, #fff 0% 50%) 50% / 22px 22px; }
  body.dark .imgwrap { background:
     repeating-conic-gradient(#2a2b2f 0% 25%, #232427 0% 50%) 50% / 22px 22px; }
  figcaption { padding:12px 14px 14px; border-top:1.5px dotted var(--line); }
  .name { font-weight:700; font-size:14.5px; }
  .num { display:inline-block; background:var(--blue); color:#fff; border-radius:6px; padding:1px 7px; font-family:'Roboto Mono',monospace; font-size:12.5px; margin-right:4px; }
  .desc { color:var(--grey); font-size:12.5px; line-height:1.45; margin-top:5px; }
  .files { margin-top:8px; font-size:10.5px; color:var(--grey); word-break:break-all; }
  .files code { font-family:'Roboto Mono',monospace; background:var(--surface); border:1px solid var(--line); border-radius:4px; padding:1px 4px; margin:2px 3px 0 0; display:inline-block; }
  img { max-width:100%; }
</style>
</head>
<body>
<header>
  <h1>BYU Calendar — logo options</h1>
  <p>Every option as vector SVG plus PNG exports, generated from the app palette (ink #202124, blue #1a73e8, green #188038, purple #7627bb, orange #e8710a, teal #00796b) with Archivo / Roboto / Roboto Mono text converted to outlines. Tell me the numbers you like and any tweaks.</p>
</header>
<div class="toggle">
  <button id="light" class="active">Light preview</button>
  <button id="dark">Dark preview</button>
  <span>Checkerboard = transparent background. Numbers match the file names.</span>
</div>
<main>
${families.map(fam => `<h2>${fam}</h2>\n<div class="grid">\n${cards.filter((_, i) => manifest[i].family === fam).join('\n')}\n</div>`).join('\n')}
</main>
<script>
  const b = document.body;
  light.onclick = () => { b.classList.remove('dark'); light.classList.add('active'); dark.classList.remove('active'); };
  dark.onclick = () => { b.classList.add('dark'); dark.classList.add('active'); light.classList.remove('active'); };
</script>
</body>
</html>`;
writeFileSync(join(ROOT, 'index.html'), html);

const md = `# BYU Calendar — logo options

Generated September 15, 2026 from the app palette (ink #202124, blue #1a73e8, green #188038, purple #7627bb, orange #e8710a, teal #00796b, plus pale counterparts) and type system (Archivo display / Roboto UI / Roboto Mono labels). All text in SVGs is converted to outlines, so the files render identically without the fonts installed. Fonts are OFL-licensed (Google Fonts); copies live in \`source/fonts/\`.

Open **index.html** in a browser to review everything with a light/dark preview toggle.

| Family | What it is |
| --- | --- |
${families.map(fam => {
  const items = manifest.filter(m => m.family === fam);
  return `| ${fam} | ${items.map(m => `**${m.id.slice(0, 2)}** ${m.title}`).join(' · ')} |`;
}).join('\n')}

## Folder map

- \`svg/\` — vector masters (transparent backgrounds unless noted)
- \`png/marks\` — 512 + 128 px exports of each mark
- \`png/wordmarks\`, \`png/lockups\` — 1600 px wide exports
- \`png/emblem\`, \`png/banners\` — badge, 1200×630 OG banners, 1500×500 header
- \`favicons/\` — 16/32/48 px PNGs per design + \`favicon.ico\` (16/32/48 multi-size)
- \`app-icons/\` — 180/192/512 app icons incl. maskable + Apple touch
- \`3d/\` — Blender 5.2 renders (Cycles, transparent film)
- \`source/\` — the generator scripts and fonts that produce everything here (reproducible)

## Regenerating

\`\`\`powershell
# from source/ — needs the two npm packages from the original scratch install
npm install sharp opentype.js   # in this folder
node generate-logos.mjs         # writes ../svg + ../manifest.json
node rasterize-logos.mjs        # writes ../png, ../favicons, ../app-icons, favicon.ico
# 3D renders
blender -b -P blender-logos.py -- --scene=tiletilt   # tiletilt | appicon | stack | wordmark | cubey
\`\`\`

Numbers are stable: telling me "I like 01, 22, and 44" maps directly to file names.
`;
writeFileSync(join(ROOT, 'README.md'), md);
console.log('index.html + README.md written;', manifest.length, 'options');
