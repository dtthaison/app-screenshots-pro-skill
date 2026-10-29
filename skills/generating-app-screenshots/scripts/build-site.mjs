#!/usr/bin/env node
// Build the GitHub Pages showcase (docs/index.html + docs/shots/*.webp) from rendered examples.
// Usage: node scripts/build-site.mjs [--out ../../docs]   (run `npm run examples` first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LAYOUTS, LAYOUT_INFO } from './layouts.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EX = path.join(SKILL, 'examples');
const argOut = process.argv.indexOf('--out');
const OUT = path.resolve(argOut > 0 ? process.argv[argOut + 1] : path.join(SKILL, '../../docs'));
const SHOTS = path.join(OUT, 'shots');
const REPO = 'https://github.com/dtthaison/app-screenshots-pro-skill';

const TARGET_NAMES = {
  'ios-6.9': 'iPhone 6.9″', 'ipad-13': 'iPad 13″', 'android-phone': 'Android phone', 'play-feature-graphic': 'Play feature graphic',
  iphone: 'iPhone', ipad: 'iPad', wide: 'Landscape', mac: 'Mac App Store', windows: 'Microsoft Store',
  'watch-ultra': 'Apple Watch Ultra', 'wear-os': 'Wear OS', tablet: 'Android tablet',
};
const LOCALES = [['en-US', 'English'], ['vi', 'Tiếng Việt'], ['de', 'Deutsch'], ['ar', 'العربية'], ['ja', '日本語']];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const label = (id) => id.replace(/^\d+_/, '').replace(/-/g, ' ');

const manifest = (dir) => {
  const f = path.join(EX, dir, 'manifest.json');
  if (!fs.existsSync(f)) throw new Error(`Missing ${path.relative(SKILL, f)}: run \`npm run examples\` first`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).files.map((m) => ({ ...m, src: path.join(EX, dir, m.file) }));
};
const pick = (dir, target, locale = 'en-US') => manifest(dir).filter((m) => m.target === target && m.locale === locale);

// one webp pair per source: thumb (grid) + large (lightbox / wide strips)
let bytes = 0;
async function shot(src, key, { thumb = 420, large = 1100 } = {}) {
  const meta = await sharp(src).metadata();
  const land = meta.width > meta.height;
  const tw = land ? thumb * 2 : thumb, lw = land ? Math.round(large * 1.6) : large;
  const t = `shots/${key}-s.webp`, l = `shots/${key}-l.webp`;
  fs.mkdirSync(path.dirname(path.join(OUT, t)), { recursive: true });
  const a = await sharp(src).resize({ width: tw, withoutEnlargement: true }).webp({ quality: 74 }).toFile(path.join(OUT, t));
  const b = await sharp(src).resize({ width: lw, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, l));
  bytes += a.size + b.size;
  return { t, l, w: a.width, h: a.height, srcW: meta.width, srcH: meta.height };
}
async function strip(src, key) {
  const f = `shots/${key}.webp`;
  fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
  const r = await sharp(src).resize({ width: 2200, withoutEnlargement: true }).webp({ quality: 76 }).toFile(path.join(OUT, f));
  bytes += r.size;
  return { t: f, l: f, w: r.width, h: r.height };
}

const img = (s, alt, cls = '') => `<a class="shot ${cls}" href="${s.l}" data-full><img src="${s.t}" width="${s.w}" height="${s.h}" alt="${esc(alt)}" loading="lazy" decoding="async"></a>`;
const fig = (s, alt, cap, title = '') => `<figure${title ? ` title="${esc(title)}"` : ''}>${img(s, alt)}<figcaption>${esc(cap)}</figcaption></figure>`;
const proof = (name, s, body, cls = '') => `<div class="proof ${cls}"><p class="spec">${esc(name)} <span>${s.srcW} × ${s.srcH} px</span></p>${body}</div>`;

async function main() {
  fs.rmSync(SHOTS, { recursive: true, force: true });
  fs.mkdirSync(SHOTS, { recursive: true });
  await sharp(path.join(SKILL, '../../.claude-plugin/icon.png')).resize(64).png().toFile(path.join(SHOTS, 'icon.png'));

  // hero: the demo set + the config that produced it
  const cfg = JSON.parse(fs.readFileSync(path.join(EX, 'demo/screenshots.config.json'), 'utf8'));
  const first = cfg.slides[0];
  const j = (v) => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ');
  const slideLines = cfg.slides.slice(0, 3).map((x) => `    ${j({ id: x.id, layout: x.layout, screen: x.screen })}`);
  const snippet = ['{',
    `  "locales": ${j(cfg.locales)},`, `  "targets": ${j(cfg.targets)},`, `  "strings": ${j(cfg.strings)},`,
    `  "theme": {`, `    "font": ${j(cfg.theme.font)},`, `    "highlight": ${j(cfg.theme.highlight)},`, `    "device": ${j(cfg.theme.device)}`, '  },',
    '  "slides": [', slideLines.join(',\n') + ',', '    …', '  ]', '}'].join('\n');

  // languages: same set in every demo locale
  const locSets = [];
  for (const [loc, name] of LOCALES) {
    const shots = await Promise.all(pick('demo/out', 'ios-6.9', loc).map((m) => shot(m.src, `demo/${loc}/${m.slide}`)));
    locSets.push({ loc, name, shots, slides: pick('demo/out', 'ios-6.9', loc) });
  }
  const hero = locSets[0];

  const layouts = [];
  for (const [dir, target] of [['gallery/out', 'iphone'], ['gallery/out', 'wide']])
    for (const m of pick(dir, target)) layouts.push({ name: m.slide, s: await shot(m.src, `layouts/${target}-${m.slide}`) });
  const signature = [];
  for (const m of pick('signature/out', 'iphone')) signature.push({ name: m.slide, s: await shot(m.src, `signature/${m.slide}`) });

  const patterns = [];
  const pdir = path.join(EX, 'panorama-patterns/out');
  const order = ['wave-ride', 'timeline', 'giant-word', 'constellation', 'stage', 'ticker', 'flow', 'peek', 'cascade', 'zigzag', 'bridge', 'crossing', 'landscape-lay', 'scatter', 'giant'];
  for (const p of order) {
    const f = path.join(pdir, p, '_preview/iphone__en-US__strip.jpg');
    if (fs.existsSync(f)) patterns.push({ name: p, s: await strip(f, `panorama/${p}`) });
  }
  const storeView = await strip(path.join(EX, 'demo/out-panorama/_preview/ios-6.9__en-US__store.jpg'), 'panorama/store-view');

  const devices = [];
  for (const target of ['iphone', 'tablet', 'mac', 'windows', 'watch-ultra', 'wear-os'])
    for (const m of pick('devices/out', target)) devices.push({ target, name: m.slide, s: await shot(m.src, `devices/${target}-${m.slide}`) });

  const sizes = [];
  for (const target of ['ipad-13', 'android-phone', 'play-feature-graphic']) {
    const ms = pick('demo/out', target).slice(0, target === 'play-feature-graphic' ? 1 : 2);
    sizes.push({ target, shots: await Promise.all(ms.map((m) => shot(m.src, `sizes/${target}-${m.slide}`))) });
  }

  const layoutCount = LAYOUTS.length;
  const html = page({ snippet, hero, locSets, layouts, signature, patterns, storeView, devices, sizes, layoutCount });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  const n = fs.readdirSync(SHOTS, { recursive: true }).filter((f) => f.endsWith('.webp')).length;
  console.log(`Site → ${path.join(OUT, 'index.html')} (${n} images, ${(bytes / 1048576).toFixed(1)} MB)`);
}

function page(d) {
  const locRadios = d.locSets.map((x, i) => `<input type="radio" name="loc" id="loc-${x.loc}" value="${x.loc}"${i ? '' : ' checked'}><label for="loc-${x.loc}" lang="${x.loc}">${esc(x.name)}</label>`).join('');
  const locRows = d.locSets.map((x) => `<div class="row set" data-loc="${x.loc}" ${x.loc === 'ar' ? 'dir="rtl"' : ''}>${x.shots.map((s, i) => img(s, `${x.name} screenshot ${i + 1}`)).join('')}</div>`).join('');
  const grid = (items) => items.map((x) => fig(x.s, `${label(x.name)} layout`, label(x.name), LAYOUT_INFO[x.name] || '')).join('');
  const groups = {};
  for (const x of d.devices) (groups[x.target] ||= []).push(x);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App Screenshots Pro Skill</title>
<meta name="description" content="A Claude Code skill that renders App Store and Google Play screenshots from your app's code: captions in every language, CSS device frames, ${d.layoutCount} layouts, panoramas, exact store sizes.">
<meta property="og:title" content="App Screenshots Pro Skill">
<meta property="og:description" content="Store screenshots, rendered from your code.">
<meta property="og:image" content="${d.hero.shots[0].l}">
<link rel="icon" href="shots/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{--board:#E4E5EA;--paper:#F2F3F6;--ink:#1B1D23;--muted:#585D69;--rule:#C4C7CF;--mark:#E5007E;--code:#1B1D23;--code-ink:#DADCE3;--code-key:#FF7AC0;--code-str:#9FE0B4}
@media (prefers-color-scheme:dark){:root{--board:#16171B;--paper:#1E2026;--ink:#ECEDF1;--muted:#A3A7B2;--rule:#353840;--code:#0C0D10;--code-ink:#DADCE3}}
*{box-sizing:border-box;margin:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--board);color:var(--ink);font:400 1rem/1.6 'IBM Plex Sans',system-ui,sans-serif;font-feature-settings:'tnum'}
a{color:inherit}
:focus-visible{outline:3px solid var(--mark);outline-offset:3px;border-radius:4px}
.wrap{max-width:1240px;margin:0 auto;padding:0 clamp(16px,4vw,40px)}
header.top{display:flex;align-items:center;gap:20px;padding:20px 0}
header.top b{font:700 1.05rem/1 'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;margin-right:auto}
header.top a{text-decoration:none;font-weight:500;font-size:.95rem}
header.top a:hover{text-decoration:underline;text-decoration-color:var(--mark);text-underline-offset:4px}
h1,h2,h3{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.025em;line-height:1.02}
h1{font-size:clamp(2.6rem,6.4vw,5.4rem);font-weight:800;max-width:13ch}
h2{font-size:clamp(1.9rem,3.6vw,2.9rem);font-weight:800}
h3{font-size:1.15rem;font-weight:700;letter-spacing:-.01em}
.lede{font-size:clamp(1.05rem,1.6vw,1.2rem);color:var(--muted);max-width:58ch;margin-top:20px}
.intro>*{min-width:0}
.intro{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(24px,5vw,64px);align-items:end;padding:clamp(24px,6vw,72px) 0 clamp(24px,4vw,40px)}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.btn{display:inline-flex;align-items:center;height:46px;padding:0 20px;border-radius:999px;font-weight:600;text-decoration:none;border:1.5px solid var(--ink)}
.btn.solid{background:var(--ink);color:var(--board)}
.btn:hover{border-color:var(--mark)}
pre{white-space:pre-wrap;font:400 .82rem/1.55 'JetBrains Mono',ui-monospace,monospace;background:var(--code);color:var(--code-ink);padding:18px 20px;border-radius:14px;overflow:auto;max-height:420px}
pre .k{color:var(--code-key)}pre .s{color:var(--code-str)}
.file{font-size:.85rem;color:var(--muted);margin-bottom:8px}
/* proof board: crop marks at the four corners, spec line with the real pixel size */
.proof{--m:var(--mark);position:relative;padding:34px clamp(14px,2.4vw,28px) 28px;margin-top:18px;
  background:
    linear-gradient(var(--m),var(--m)) left 0 top 14px/16px 1.5px,linear-gradient(var(--m),var(--m)) left 14px top 0/1.5px 16px,
    linear-gradient(var(--m),var(--m)) right 0 top 14px/16px 1.5px,linear-gradient(var(--m),var(--m)) right 14px top 0/1.5px 16px,
    linear-gradient(var(--m),var(--m)) left 0 bottom 14px/16px 1.5px,linear-gradient(var(--m),var(--m)) left 14px bottom 0/1.5px 16px,
    linear-gradient(var(--m),var(--m)) right 0 bottom 14px/16px 1.5px,linear-gradient(var(--m),var(--m)) right 14px bottom 0/1.5px 16px;
  background-repeat:no-repeat}
.spec{position:absolute;left:40px;top:6px;font-size:.8rem;color:var(--muted)}
.spec span{margin-left:8px;color:var(--ink);font-weight:500}
.row{display:flex;gap:clamp(8px,1.2vw,14px);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;scrollbar-width:thin}
.row .shot{flex:0 0 auto;width:clamp(150px,17vw,210px);scroll-snap-align:start}
.shot{display:block;border-radius:10px;overflow:hidden;background:var(--paper);line-height:0}
.shot img{width:100%;height:auto;display:block}
.shot:hover img{filter:brightness(1.04)}
section{padding:clamp(48px,8vw,96px) 0 0}
.head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:end;margin-bottom:20px}
.head p{color:var(--muted);max-width:56ch}
.switch{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:999px;background:var(--paper);border:1px solid var(--rule);margin-top:20px}
.switch input{position:absolute;opacity:0;pointer-events:none}
.switch label{padding:7px 16px;border-radius:999px;cursor:pointer;font-weight:500;font-size:.95rem}
.switch input:checked+label{background:var(--ink);color:var(--board)}
.switch input:focus-visible+label{outline:3px solid var(--mark);outline-offset:2px}
.set{display:none}
${d.locSets.map((x) => `.hero:has(#loc-${x.loc}:checked) .set[data-loc="${x.loc}"]`).join(',')}{display:flex}
.hero .row .shot{flex:1 1 0;width:auto;min-width:150px;max-width:300px}
.hero .switch{margin:0 0 16px}
.note{color:var(--muted);max-width:72ch;margin-top:14px;font-size:.95rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:clamp(12px,1.6vw,20px) clamp(10px,1.4vw,16px)}
.grid.wide{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
figure{min-width:0}
figcaption{font-size:.85rem;color:var(--muted);margin-top:6px}
.strips{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:clamp(24px,3vw,36px) clamp(16px,2vw,28px)}
.strips .all{grid-column:1/-1}
.strips h3{margin-bottom:10px}
.strip{display:block;border-radius:10px;overflow:hidden;line-height:0}
.strip img{width:100%;height:auto}
.devs{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:clamp(12px,2vw,24px)}
.devs .proof{grid-column:span 12}
.devs .proof.half{grid-column:span 6}
.devs .proof.third{grid-column:span 4}
.devs .row .shot{width:clamp(140px,15vw,180px)}
.devs .land .row .shot{width:clamp(260px,34vw,440px)}
.devs .watch .row .shot{width:clamp(120px,12vw,160px)}
.sizes .row .shot.l{width:clamp(280px,48vw,620px)}
.sizes .half .row .shot{width:auto;flex:1 1 0;min-width:130px;max-width:260px}
.install{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px;margin-top:24px}
.install h3{margin-bottom:10px}
.install p{color:var(--muted);font-size:.95rem;margin-top:10px}
footer{margin-top:clamp(64px,10vw,120px);padding:28px 0 40px;border-top:1px solid var(--rule);color:var(--muted);font-size:.88rem}
footer p+p{margin-top:6px}
dialog{border:0;padding:0;background:transparent;max-width:min(96vw,1600px);max-height:94vh}
dialog::backdrop{background:rgb(10 11 14 / .86)}
dialog img{display:block;max-width:min(96vw,1600px);max-height:90vh;width:auto;height:auto;border-radius:12px}
dialog button{position:fixed;top:14px;right:18px;width:44px;height:44px;border-radius:50%;border:0;background:#fff;color:#000;font:600 1.4rem/1 system-ui;cursor:pointer}
@media (prefers-reduced-motion:no-preference){.hero .set[data-loc="en-US"] .shot{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}${d.hero.shots.map((_, i) => `.hero .set .shot:nth-child(${i + 1}){animation-delay:${0.08 * i}s}`).join('')}}
@keyframes rise{from{opacity:0;transform:translateY(24px)}}
@media (max-width:820px){.intro,.head{grid-template-columns:1fr}.devs .proof.half,.devs .proof.third{grid-column:span 12}pre{max-height:300px}}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><b>App Screenshots Pro Skill</b><a href="#install">Install</a><a href="${REPO}">GitHub</a></header>

<div class="intro">
  <div>
    <h1>Store screenshots, rendered from your code</h1>
    <p class="lede">A Claude Code skill. Claude reads your app, writes the captions in every language you ship, and renders App Store and Google Play images at exact store sizes. Free, local and open source.</p>
    <div class="cta"><a class="btn solid" href="#install">Install the plugin</a><a class="btn" href="${REPO}">View on GitHub</a></div>
  </div>
  <div><p class="file">screenshots.config.json</p><pre>${highlightJson(d.snippet)}</pre></div>
</div>
<div class="hero">
  ${proof(`${TARGET_NAMES['ios-6.9']}, rendered from that config`, d.hero.shots[0], `<div class="switch" role="radiogroup" aria-label="Language">${locRadios}</div>${locRows}`)}
  <p class="note">Same config, five languages. Captions are translated and fitted per locale: Arabic flips right to left, Japanese gets a matching font, and long German words shrink the caption instead of breaking it.</p>
</div>

<section id="layouts">
  <div class="head"><h2>${d.layoutCount} layouts</h2><p>Single device, tilted, multi-device, callouts, proof and stats slides. Every layout takes any preset, background and device color. Click any image to see it full size.</p></div>
  ${proof('iPhone', d.layouts[0].s, `<div class="grid">${grid(d.layouts.filter((x) => x.s.w < x.s.h))}</div>`)}
  ${proof('Landscape', d.layouts.find((x) => x.s.w > x.s.h)?.s || d.layouts[0].s, `<div class="grid wide">${grid(d.layouts.filter((x) => x.s.w > x.s.h))}</div>`)}
</section>

<section id="signature">
  <div class="head"><h2>Signature layouts</h2><p>Nine compositions you won't find in template packs: a stage spotlight, giant type, a ticker band, an arch portal, orbiting badges, a magnifier lens, stacked layers, notification stacks and a fanned deck.</p></div>
  ${proof('iPhone', d.signature[0].s, `<div class="grid">${grid(d.signature)}</div>`)}
</section>

<section id="panoramas">
  <div class="head"><h2>Panoramas</h2><p>Slides that join into one picture when they sit side by side in the store. Phones can cross the gap between two slides; the renderer warns when a caption falls on a seam.</p></div>
  <div class="strips">
    ${d.patterns.map((p) => `<div><h3>${esc(label(p.name))}</h3><a class="strip" href="${p.s.l}" data-full><img src="${p.s.t}" width="${p.s.w}" height="${p.s.h}" alt="${esc(label(p.name))} panorama pattern, all slides side by side" loading="lazy" decoding="async"></a></div>`).join('\n    ')}
    <div class="all"><h3>How it looks in the App Store</h3><a class="strip" href="${d.storeView.l}" data-full><img src="${d.storeView.t}" width="${d.storeView.w}" height="${d.storeView.h}" alt="Panorama set shown as separate App Store cards with gaps" loading="lazy" decoding="async"></a></div>
  </div>
</section>

<section id="devices">
  <div class="head"><h2>Beyond the phone</h2><p>Every frame is drawn in CSS, in any color: notch and Home-button iPhones, Android phones and tablets, Apple Watch and Wear OS, MacBook, desktop monitor, and Mac, Windows and browser windows.</p></div>
  <div class="devs">
    ${proof(TARGET_NAMES.iphone, groups.iphone[0].s, `<div class="row">${groups.iphone.map((x) => img(x.s, label(x.name))).join('')}</div>`)}
    ${proof(TARGET_NAMES.mac, groups.mac[0].s, `<div class="row">${groups.mac.map((x) => img(x.s, label(x.name))).join('')}</div>`, 'land')}
    ${proof(TARGET_NAMES.windows, groups.windows[0].s, `<div class="row">${groups.windows.map((x) => img(x.s, label(x.name))).join('')}</div>`, 'land')}
    ${proof(TARGET_NAMES.tablet, groups.tablet[0].s, `<div class="row">${groups.tablet.map((x) => img(x.s, label(x.name))).join('')}</div>`, 'third')}
    ${proof(TARGET_NAMES['watch-ultra'], groups['watch-ultra'][0].s, `<div class="row">${groups['watch-ultra'].map((x) => img(x.s, 'Apple Watch screen')).join('')}</div>`, 'watch third')}
    ${proof(TARGET_NAMES['wear-os'], groups['wear-os'][0].s, `<div class="row">${groups['wear-os'].map((x) => img(x.s, 'Wear OS screen')).join('')}</div>`, 'watch third')}
  </div>
</section>

<section id="sizes" class="sizes">
  <div class="head"><h2>Every store size from one config</h2><p>35 targets: all current App Store and Play sizes, Mac App Store, Microsoft Store, watches, the Play feature graphic and social formats. Output is checked for exact size, alpha and per-store limits.</p></div>
  <div class="devs">${d.sizes.map((z) => proof(TARGET_NAMES[z.target], z.shots[0], `<div class="row">${z.shots.map((s, i) => img(s, `${TARGET_NAMES[z.target]} screenshot ${i + 1}`, s.w > s.h ? 'l' : '')).join('')}</div>`, z.target === 'play-feature-graphic' ? '' : 'half')).join('\n  ')}</div>
</section>

<section id="install">
  <h2>Install</h2>
  <div class="install">
    <div><h3>Claude Code plugin</h3><pre>/plugin marketplace add dtthaison/app-screenshots-pro-skill
/plugin install app-screenshots-pro-skill@app-screenshots-pro-skill</pre><p>Then ask: “Make App Store and Play screenshots for this app in English and German.”</p></div>
    <div><h3>Run the renderer yourself</h3><pre>git clone ${REPO}.git
cd app-screenshots-pro-skill/skills/generating-app-screenshots
npm install
node scripts/render.mjs path/to/screenshots.config.json</pre><p>Needs Node.js 18.17+ and Chrome or Edge. <a href="${REPO}#readme">Full documentation</a></p></div>
  </div>
</section>

<footer>
  <p>MIT licensed. Every image on this page was rendered by the skill from the example configs in the repository.</p>
  <p>Apple, iPhone, iPad, Mac, Apple Watch, App Store, Google Play, Android, Wear OS and Windows are trademarks of their owners. This project is not affiliated with or endorsed by any of them.</p>
</footer>
</div>

<dialog id="lb" aria-label="Full-size image"><button type="button" aria-label="Close">×</button><img alt=""></dialog>
<script>
const lb = document.getElementById('lb'), lbImg = lb.querySelector('img');
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-full]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  lbImg.src = a.href; lbImg.alt = a.querySelector('img')?.alt || '';
  lb.showModal();
});
lb.addEventListener('click', (e) => { if (e.target !== lbImg) lb.close(); });
lb.addEventListener('close', () => { lbImg.removeAttribute('src'); });
</script>
</body>
</html>
`;
}

function highlightJson(s) {
  return esc(s).replace(/(&quot;[^&]*?&quot;)(\s*:)?/g, (m, str, colon) => colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
