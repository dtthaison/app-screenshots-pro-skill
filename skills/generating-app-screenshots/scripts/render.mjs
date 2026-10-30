#!/usr/bin/env node
// Render store screenshots from screenshots.config.json with headless Chromium.
// Usage: node render.mjs <config.json> [--out dir] [--locales en-US,vi] [--targets ios-6.9,ipad-13]
//                       [--slides id1,id2] [--format png|jpeg|webp] [--fastlane] [--no-preview]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { resolveTarget, storeLocale, isRtl, scriptFont, isVideoTarget, checkTargetFormat } from './targets.mjs';
import { renderDevice, screenRect, MODELS, kindOf } from './devices.mjs';
import { PRESETS } from './presets.mjs';
import { buildLayout, canvasClass } from './layouts.mjs';
import { patternElements, sceneSvg } from './panorama.mjs';
import { buildTimeline, stateAt, findFfmpeg, probeClip, clipKey, extractClip, selectScenes, missingClipWarning, DEFAULT_DURATION } from './video.mjs';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);
const configPath = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) || 'screenshots.config.json';
if (!fs.existsSync(configPath)) { console.error(`Config not found: ${configPath}`); process.exit(2); }
const BASE = path.dirname(path.resolve(configPath));
const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const OUT = path.resolve(flag('out', path.resolve(BASE, cfg.output || 'out')));
const FORMAT = flag('format', cfg.format || 'png');
const list = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);
const defaultLocale = cfg.defaultLocale || (cfg.locales || ['en-US'])[0];
const LOCALES = list(flag('locales')) || cfg.locales || [defaultLocale];
// --targets filters by id; ids may name custom targets declared in the config
const CFG_TARGETS = (cfg.targets || ['ios-6.9']).map((t) => resolveTarget(t));
const TARGETS = list(flag('targets'))?.map((id) => CFG_TARGETS.find((t) => t.id === id) || resolveTarget(id)) || CFG_TARGETS;
// the screenshot pass renders stills only; video targets belong to the video pass
const STILL_TARGETS = TARGETS.filter((t) => !isVideoTarget(t));
const SLIDE_FILTER = list(flag('slides'));
// theme.preset (and slide.preset) start from a curated palette; explicit values win
function presetTheme(name) {
  if (!name) return {};
  if (!PRESETS[name]) throw new Error(`Unknown preset "${name}". Known: ${Object.keys(PRESETS).join(', ')}`);
  return JSON.parse(JSON.stringify(PRESETS[name]));
}
// background / highlight / card are whole designs: a later layer replaces them instead of deep-merging
const WHOLE = ['background', 'highlight', 'card'];
function layer(base, top) {
  const r = merge(base, top);
  for (const k of WHOLE) if (top[k] !== undefined) r[k] = top[k];
  return r;
}
const theme = (() => { const { preset, ...rest } = cfg.theme || {}; return layer(presetTheme(preset), rest); })();
const SUPERSAMPLE = Number(flag('supersample', cfg.supersample ?? 2));
// app previews render at 1x by default (capture speed); clips are extracted at the screen height this gives
const VIDEO_SCALE = Number(flag('supersample', cfg.videoSupersample ?? 1));
const warnings = [];
const notes = [];
const errors = [];
const warn = (m) => { warnings.push(m); };

// ---------- helpers ----------
const abs = (p) => (path.isAbsolute(p) ? p : path.join(BASE, p));
const fileUrl = (p) => pathToFileURL(abs(p)).href;
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v;
  return o;
}
// Apply byTarget / byLocale overrides (keys may be target id, base id, store, locale or language).
function specialize(o, target, locale) {
  if (!isObj(o)) return o;
  let r = { ...o };
  const lang = locale.split('-')[0];
  for (const k of [target.store, target.family, target.baseId, target.id]) if (k && o.byTarget?.[k]) r = merge(r, o.byTarget[k]);
  for (const k of [lang, locale]) if (o.byLocale?.[k]) r = merge(r, o.byLocale[k]);
  delete r.byTarget; delete r.byLocale;
  return r;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const px = (n) => `${Math.round(n * 100) / 100}px`;

// ---------- strings (marketing copy + translations) ----------
const STRINGS = {};
function addStrings(src) {
  if (!src) return;
  if (Array.isArray(src)) return src.forEach(addStrings);
  if (isObj(src)) { for (const [loc, kv] of Object.entries(src)) STRINGS[loc] = { ...(STRINGS[loc] || {}), ...kv }; return; }
  const p = abs(src);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (p.endsWith('.xcstrings')) {
    // Xcode String Catalog: strings[key].localizations[loc].stringUnit.value
    for (const [key, entry] of Object.entries(data.strings || {})) {
      const locs = entry.localizations || {};
      if (!locs[data.sourceLanguage]) (STRINGS[data.sourceLanguage] ||= {})[key] ??= key;
      for (const [loc, l] of Object.entries(locs)) if (l.stringUnit?.value != null) (STRINGS[loc] ||= {})[key] = l.stringUnit.value;
    }
  } else if (data.locale && data.strings) (STRINGS[data.locale] ||= {}, Object.assign(STRINGS[data.locale], data.strings));
  else addStrings(data);
}
addStrings(cfg.strings);

function str(v, locale) {
  if (v == null) return null;
  if (isObj(v)) return v[locale] ?? v[locale.split('-')[0]] ?? v[defaultLocale] ?? null;
  if (typeof v !== 'string' || !v.startsWith('@')) return v;
  const key = v.slice(1);
  const lang = locale.split('-')[0];
  const hit = STRINGS[locale]?.[key] ?? STRINGS[lang]?.[key];
  if (hit != null) return hit;
  warn(`[${locale}] missing translation "${key}" — fell back to ${defaultLocale}`);
  const fb = STRINGS[defaultLocale]?.[key];
  if (fb == null) errors.push(`string key "${key}" not found in any locale`);
  return fb ?? key;
}

// display text: pick: 'highlight' takes the **marked** words of a title (else the longest word), localized
function pickText(el, locale) {
  const v = str(el.text, locale) ?? '';
  if (el.pick !== 'highlight') return v;
  const m = v.match(/\*\*(.+?)\*\*/);
  return m ? m[1] : v.replace(/\*\*/g, '').split(/\s+/).sort((a, b) => b.length - a.length)[0] || v;
}
// rough width fit for one-line display type: shrink size so `len` glyphs fit `w`
function fitSize(text, el) {
  const cjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(text);
  const em = cjk ? 1.02 : el.upper ? 0.7 : 0.6;
  return Math.min(el.size ?? 4, ((el.w ?? 90) * 0.96) / Math.max(1, [...text].length * em + 0.2));
}

// **highlight**, \n line breaks, everything else escaped
function rich(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>').replace(/\\n|\n/g, '<br>');
}

// ---------- fonts ----------
const googleFamilies = new Map(); // family -> weights
const fontFaces = [];
function fontStack(font, locale) {
  const f = typeof font === 'string' ? { family: font } : font || {};
  const fams = [];
  if (f.family) {
    fams.push(`'${f.family}'`);
    if (f.src) fontFaces.push(`@font-face{font-family:"${f.family}";src:url("${fileUrl(f.src)}");font-weight:${f.weightRange || '100 900'};font-display:block}`);
    else if (f.google !== false) googleFamilies.set(f.family, f.weights || [400, 500, 600, 700, 800]);
  }
  const sf = scriptFont(locale);
  if (sf) { fams.push(`'${sf}'`); if (!googleFamilies.has(sf)) googleFamilies.set(sf, [400, 500, 700, 800]); }
  fams.push('-apple-system', "'SF Pro Display'", "'Helvetica Neue'", 'Arial', "'Apple Color Emoji'", 'sans-serif');
  return fams.join(',');
}
const googleLink = () => [...googleFamilies]
  .map(([f, w]) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${[...w].sort((a, b) => a - b).join(';')}&display=block">`)
  .join('');

// ---------- backgrounds ----------
function gradientCss(g) {
  if (typeof g === 'string') return g;
  const stops = (g.stops || []).join(',');
  if (g.type === 'radial') return `radial-gradient(${g.shape || 'circle'} at ${g.at || '50% 30%'},${stops})`;
  if (g.type === 'conic') return `conic-gradient(from ${g.angle ?? 0}deg at ${g.at || '50% 50%'},${stops})`;
  return `linear-gradient(${g.angle ?? 180}deg,${stops})`;
}
function backgroundHtml(bg, Wpx, Hpx) {
  if (!bg) return '';
  if (typeof bg === 'string') return `<div class="bg" style="background:${bg}"></div>`;
  const L = [];
  if (bg.color) L.push(`<div class="bg" style="background:${bg.color}"></div>`);
  if (bg.gradient) L.push(`<div class="bg" style="background:${gradientCss(bg.gradient)}"></div>`);
  for (const m of bg.mesh || []) {
    // mesh gradient = soft radial blobs: { color, x, y, size } (% of canvas)
    L.push(`<div class="bg" style="background:radial-gradient(circle at ${m.x}% ${m.y}%,${m.color} 0%,transparent ${m.size ?? 45}%);opacity:${m.opacity ?? 1}"></div>`);
  }
  if (bg.image) {
    const im = typeof bg.image === 'string' ? { src: bg.image } : bg.image;
    L.push(`<div class="bg" style="background:url('${fileUrl(im.src)}') ${im.position || 'center'}/${im.fit || 'cover'} no-repeat;filter:${im.blur ? `blur(${im.blur}px) ` : ''}brightness(${im.brightness ?? 1});opacity:${im.opacity ?? 1};${im.blur ? `inset:-${im.blur * 2}px` : ''}"></div>`);
  }
  if (bg.overlay) L.push(`<div class="bg" style="background:${gradientCss(bg.overlay)}"></div>`);
  if (bg.pattern) {
    const p = typeof bg.pattern === 'string' ? { type: bg.pattern } : bg.pattern;
    const c = p.color || 'rgba(255,255,255,.12)', s = p.size || Math.round(Wpx / 24);
    const css = {
      dots: `radial-gradient(${c} ${Math.max(1, s / 10)}px,transparent ${Math.max(1, s / 10) + 0.5}px) 0 0/${s}px ${s}px`,
      grid: `linear-gradient(${c} 1px,transparent 1px) 0 0/${s}px ${s}px,linear-gradient(90deg,${c} 1px,transparent 1px) 0 0/${s}px ${s}px`,
      diagonal: `repeating-linear-gradient(45deg,${c} 0 ${Math.max(1, s / 8)}px,transparent ${Math.max(1, s / 8)}px ${s / 2}px)`,
    }[p.type || 'dots'];
    L.push(`<div class="bg" style="background:${css};opacity:${p.opacity ?? 1}"></div>`);
  }
  if (bg.scene) L.push(`<div class="bg">${sceneSvg(bg.scene, Wpx, Hpx)}</div>`);
  if (bg.noise) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
    L.push(`<div class="bg" style="background:url(&quot;data:image/svg+xml;utf8,${encodeURIComponent(svg)}&quot;);opacity:${bg.noise};mix-blend-mode:overlay"></div>`);
  }
  return L.join('');
}

// ---------- screens: images, {locale} templating, html mock screens ----------
const imageMeta = new Map();
const htmlQueue = new Map(); // out -> { file, locale, out, vw, vh, query, fullPage }
const htmlDone = new Set();
// {locale} candidates in lookup order: the locale, its language, the default locale
const screenCands = (src, locale) => [locale, locale.split('-')[0], defaultLocale].map((l) => ({ file: src.replaceAll('{locale}', l), locale: l }));
// fullPage: an html mock is captured at its whole scroll height (for motion: "scroll" in previews)
function resolveScreen(src0, locale, model, landscape, { fullPage = false } = {}) {
  if (!src0) return null;
  // "screens/stats.html?state=before" — the query is passed to html mock screens
  const [src, query = ''] = src0.split('?');
  const cand = screenCands(src, locale).map((c) => c.file);
  const found = cand.find((c) => fs.existsSync(abs(c)));
  if (!found) { errors.push(`screen not found: ${src} (locale ${locale})`); return null; }
  if (found !== cand[0] && src.includes('{locale}')) warn(`[${locale}] no localized screen for ${src} — using ${found}`);
  if (/\.html?$/i.test(found)) {
    // HTML mock screen -> rendered to PNG at the device's logical viewport, @3x
    const m = MODELS[model] || MODELS.iphone;
    let [vw, vh] = m.viewport || [440, 956];
    if (landscape) [vw, vh] = [vh, vw];
    const tag = query ? `.${query.replace(/[^a-z0-9]+/gi, '_')}` : '';
    const out = path.join(OUT, '.build', 'screens', `${path.basename(found, path.extname(found))}${tag}${fullPage ? '.full' : ''}.${locale}.${vw}x${vh}.png`);
    if (!htmlDone.has(out)) htmlQueue.set(out, { file: abs(found), locale, out, vw, vh, query, ...(fullPage ? { fullPage } : {}) });
    return out;
  }
  return abs(found);
}

// ---------- elements -> html ----------
function captionHtml(el, ctx, locale) {
  const S = ctx.W / 100;
  const rtl = isRtl(locale);
  let align = el.align || 'center';
  if (rtl && align === 'left') align = 'right'; else if (rtl && align === 'right') align = 'left';
  const th = ctx.theme || theme;
  const c = { ...(th.caption || {}), accent: th.accent, ...el };
  const fam = fontStack(c.font || th.font, locale);
  const hl = c.highlight || th.highlight || {};
  const hlCss = hl.style === 'marker'
    ? `background:linear-gradient(transparent 55%,${hl.color || '#ffd60a'} 55%,${hl.color || '#ffd60a'} 92%,transparent 92%);padding:0 .08em;-webkit-box-decoration-break:clone;box-decoration-break:clone`
    : hl.style === 'gradient'
      ? `background:${gradientCss(hl.gradient || { angle: 90, stops: ['#ff6a88', '#ffb36b'] })};-webkit-background-clip:text;color:transparent`
      : hl.style === 'underline' ? `text-decoration:underline ${hl.color || 'currentColor'};text-decoration-thickness:.08em;text-underline-offset:.12em`
      : `color:${hl.color || c.accent || '#ffd60a'}`;
  const parts = [];
  const eyebrow = str(c.eyebrow, locale), title = str(c.title, locale), sub = str(c.subtitle, locale);
  const ts = (c.titleSize ?? 7) * S, ss = (c.subtitleSize ?? (c.titleSize ?? 7) * 0.5) * S, es = (c.eyebrowSize ?? (c.titleSize ?? 7) * 0.36) * S;
  if (eyebrow) parts.push(`<div data-fs="${es}" style="${c.subtitleFont ? `font-family:${fontStack(c.subtitleFont, locale)};` : ''}font-size:${px(es)};font-weight:${c.eyebrowWeight ?? 700};letter-spacing:.12em;text-transform:uppercase;color:${c.eyebrowColor || c.accent || c.color || '#fff'};margin-bottom:${px(es * 0.7)}">${rich(eyebrow)}</div>`);
  if (title) parts.push(`<div data-fs="${ts}" style="font-size:${px(ts)};font-weight:${c.titleWeight ?? 800};line-height:${c.lineHeight ?? 1.08};letter-spacing:${c.letterSpacing ?? '-0.02em'};color:${c.color || '#fff'};${c.uppercase ? 'text-transform:uppercase;' : ''}${c.textShadow ? `text-shadow:${c.textShadow};` : ''}text-wrap:balance">${rich(title)}</div>`);
  if (sub) parts.push(`<div data-fs="${ss}" style="${c.subtitleFont ? `font-family:${fontStack(c.subtitleFont, locale)};` : ''}font-size:${px(ss)};font-weight:${c.subtitleWeight ?? 500};line-height:1.3;color:${c.subtitleColor || c.color || '#fff'};opacity:${c.subtitleOpacity ?? 0.85};margin-top:${px(ss * 0.6)};text-wrap:balance">${rich(sub)}</div>`);
  const w = (el.w / 100) * ctx.W, h = ((el.h ?? 20) / 100) * ctx.H;
  const left = (el.x / 100) * ctx.W - w / 2, top = (el.y / 100) * ctx.H;
  const jc = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[el.valign || 'top'];
  // hyphenate only where long compounds are normal (de, nl, fi…); elsewhere a too-long word shrinks the caption instead of splitting it
  const hyph = c.hyphens ?? (/^(de|nl|fi|sv|da|nb|no|is|hu|et|ru|uk|pl|cs|sk|el|tr)\b/.test(locale) ? 'auto' : 'manual');
  return `<div class="el" data-fit data-id="${esc(ctx.slideId)}:${esc(el.id || 'caption')}" data-maxh="${h}" dir="${rtl ? 'rtl' : 'ltr'}" lang="${locale}"
    style="position:absolute;left:${px(left)};top:${px(top)};width:${px(w)};height:${px(h)};display:flex;flex-direction:column;justify-content:${jc};text-align:${align};font-family:${fam};z-index:${el.z ?? 3};hyphens:${hyph};overflow-wrap:${hyph === 'auto' ? 'break-word' : 'normal'}">
    <style>[data-id="${esc(ctx.slideId)}:${esc(el.id || 'caption')}"] .hl{${hlCss}}</style><div class="fit-inner">${parts.join('')}</div></div>`;
}

function elementHtml(el, ctx, locale) {
  const S = ctx.W / 100;
  // anchor: which point of the element sits at x — 'center' (default), 'left' or 'right'
  const k = { left: 0, center: 0.5, right: 1 }[el.anchor || 'center'];
  const box = (extra = '') => {
    const w = el.w != null ? (el.w / 100) * ctx.W : null;
    const left = (el.x / 100) * ctx.W - (w ?? 0) * k;
    return `position:absolute;left:${px(left)};top:${px((el.y / 100) * ctx.H)};${w != null ? `width:${px(w)};` : ''}${el.h != null ? `height:${px((el.h / 100) * ctx.H)};` : ''}z-index:${el.z ?? 4};opacity:${el.opacity ?? 1};transform:${el.w == null ? `translateX(${-k * 100}%) ` : ''}rotate(${el.rotate || 0}deg);${extra}`;
  };
  switch (el.type) {
    case 'caption': return captionHtml(el, ctx, locale);
    case 'device': {
      const src = resolveScreen(el.screen, locale, el.screenModel || el.model, el.landscape, { fullPage: !!el.fullPage });
      const meta = src ? imageMeta.get(src) : null;
      return renderDevice({ ...el, src: src ? pathToFileURL(src).href : null, imageAspect: meta?.aspect }, ctx);
    }
    case 'text': {
      const fam = fontStack(el.font || (ctx.theme || theme).font, locale);
      const txt = pickText(el, locale);
      const fs = (el.fit === 'width' ? fitSize(txt, el) : el.size ?? 4) * S;
      // display type: stroke = outline width (% of slide width), gradient = fill, nowrap, tracking (em), upper
      const deco = [
        el.stroke ? `-webkit-text-stroke:${px(el.stroke * S)} ${el.strokeColor || el.color || '#fff'};${el.color ? '' : 'color:transparent;'}` : '',
        el.gradient ? `background:${gradientCss(el.gradient)};-webkit-background-clip:text;background-clip:text;color:transparent;` : '',
        el.nowrap ? 'white-space:nowrap;' : '', el.tracking != null && !/^(ar|fa|ur|he|hi|bn|ta|te|th|km|my)\b/.test(locale) ? `letter-spacing:${el.tracking}em;` : '',
        el.upper ? 'text-transform:uppercase;' : '', el.italic ? 'font-style:italic;' : '',
      ].join('');
      return `<div class="el" ${el.h != null ? `data-fit data-id="${esc(ctx.slideId)}:${esc(el.id || 'text')}" data-maxh="${(el.h / 100) * ctx.H}"` : ''} dir="${isRtl(locale) ? 'rtl' : 'ltr'}" lang="${locale}" style="${box(`font-family:${fam};text-align:${el.align || 'center'};color:${el.color || '#fff'};font-weight:${el.weight ?? 600};line-height:${el.lineHeight ?? 1.2};text-wrap:balance`)}"><div class="fit-inner"><div data-fs="${fs}" style="font-size:${px(fs)};${deco}">${rich(txt)}</div></div></div>`;
    }
    case 'badge': {
      const fam = fontStack(el.font || (ctx.theme || theme).font, locale);
      const fs = (el.size ?? 3) * S;
      return `<div class="el" data-badge="${esc(ctx.slideId)}:${esc(el.id || 'badge')}" style="${box(`font-family:${fam};font-size:${px(fs)};font-weight:${el.weight ?? 700};color:${el.color || '#111'};background:${gradientCss(el.background || '#fff')};padding:${px(fs * 0.45)} ${px(fs * 0.9)};border-radius:${px(fs * 2)};white-space:nowrap;box-shadow:${el.shadow || 'none'}`)}">${rich(str(el.text, locale) ?? '')}</div>`;
    }
    case 'image': {
      const src = str(el.src, locale).replaceAll('{locale}', locale);
      return `<img class="el" src="${fileUrl(src)}" style="${box(`object-fit:${el.fit || 'contain'};border-radius:${px((el.radius || 0) * S)};box-shadow:${el.shadow || 'none'}`)}">`;
    }
    case 'shape': {
      const r = el.shape === 'circle' ? '50%' : typeof el.radius === 'string' ? el.radius : px((el.radius || 0) * S);
      const h = el.h != null ? (el.h / 100) * ctx.H : (el.w / 100) * ctx.W;
      // clip (CSS clip-path, e.g. a light-beam polygon) goes on an inner layer so blur still softens the clipped edge
      const fill = `border-radius:${r};background:${gradientCss(el.fill || '#fff')};border:${el.stroke || 'none'};box-shadow:${el.shadow || 'none'}`;
      const blend = el.blend ? `mix-blend-mode:${el.blend};` : '';
      if (el.clip) return `<div class="el" style="${box(`height:${px(h)};filter:${el.blur ? `blur(${el.blur * S}px)` : 'none'};${blend}`)}"><div style="position:absolute;inset:0;${fill};clip-path:${el.clip}"></div></div>`;
      return `<div class="el" style="${box(`height:${px(h)};${fill};filter:${el.blur ? `blur(${el.blur * S}px)` : 'none'};${blend}`)}"></div>`;
    }
    case 'zoom': {
      // magnified crop of a screen, as a floating card: crop = [x,y,w,h] in % of the screenshot
      const src = resolveScreen(el.screen, locale, el.model || ctx.model || 'iphone');
      const asp = imageMeta.get(src)?.aspect || 2.17;
      // focus [x,y] + span (% of screenshot width) = square crop around a point, for circle lenses
      const [cx, cy, cw, ch] = el.focus
        ? [el.focus[0] - (el.span ?? 34) / 2, el.focus[1] - (el.span ?? 34) / asp / 2, el.span ?? 34, (el.span ?? 34) / asp]
        : el.crop || [0, 0, 100, 30];
      const w = (el.w / 100) * ctx.W, h = el.circle ? w : w * (ch / cw) * asp;
      const tilt = el.tiltX || el.tiltY ? `perspective(${px(w * 4)}) rotateY(${el.tiltY || 0}deg) rotateX(${el.tiltX || 0}deg) ` : '';
      return `<div class="el" style="${box(`height:${px(h)};border-radius:${el.circle ? '50%' : px((el.radius ?? 3) * S)};${tilt ? `transform:${tilt}rotate(${el.rotate || 0}deg);` : ''}overflow:hidden;background:url('${src ? pathToFileURL(src).href : ''}') ${(-cx / cw) * w}px ${(-cy / ch) * h}px/${(100 / cw) * w}px ${(100 / ch) * h}px no-repeat;box-shadow:${el.shadow || `0 ${px(2 * S)} ${px(5 * S)} rgba(0,0,0,.35)`};border:${el.border || `${px(0.5 * S)} solid rgba(255,255,255,.9)`}`)}"></div>`;
    }
    case 'arrow': {
      // from [x,y] to [x,y] in % of slide; gentle curve
      const [x1, y1] = el.from, [x2, y2] = el.to;
      const X1 = (x1 / 100) * ctx.W, Y1 = (y1 / 100) * ctx.H, X2 = (x2 / 100) * ctx.W, Y2 = (y2 / 100) * ctx.H;
      const mx = (X1 + X2) / 2 + (Y2 - Y1) * (el.curve ?? 0.25), my = (Y1 + Y2) / 2 - (X2 - X1) * (el.curve ?? 0.25);
      const sw = (el.width ?? 0.7) * S, col = el.color || '#fff';
      const ang = Math.atan2(Y2 - my, X2 - mx), hl = sw * 4;
      const p = (a) => `${X2 - hl * Math.cos(ang + a)},${Y2 - hl * Math.sin(ang + a)}`;
      return `<svg class="el" style="position:absolute;left:0;top:0;width:${ctx.W}px;height:${ctx.H}px;overflow:visible;z-index:${el.z ?? 5}" viewBox="0 0 ${ctx.W} ${ctx.H}"><path d="M${X1},${Y1} Q${mx},${my} ${X2},${Y2}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"${el.dash ? ` stroke-dasharray="${el.dash.map((d) => d * S).join(' ')}"` : ''} opacity="${el.opacity ?? 1}"/>${el.head === false ? '' : `<polyline points="${p(0.5)} ${X2},${Y2} ${p(-0.5)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`}${el.dot ? `<circle cx="${X2}" cy="${Y2}" r="${el.dot * S}" fill="${el.dotColor || col}"/><circle cx="${X1}" cy="${Y1}" r="${el.dot * S}" fill="${el.dotColor || col}"/>` : ''}</svg>`;
    }
    case 'card': {
      // icon / number + value + title + text in a rounded card. Used by feature-grid, steps, stats, metric, review.
      const th = ctx.theme || theme;
      const c = { ...(th.card || {}), ...el };
      const fam = fontStack(c.font || th.font, locale);
      const dir = c.direction || 'column', align = c.align || 'left';
      const pad = (c.padding ?? 3.4) * S;
      const isz = (c.iconSize ?? 6) * S, tsz = (c.titleSize ?? 4) * S, xsz = (c.textSize ?? 3) * S, vsz = (c.valueSize ?? 10) * S;
      const accent = c.accent || th.accent || '#ffcf5c';
      const icon = str(c.icon, locale);
      const lead = c.number != null
        ? `<div data-fs="${isz * 0.5}" style="flex:none;width:${px(isz * 1.2)};height:${px(isz * 1.2)};border-radius:50%;background:${accent};color:${c.numberColor || '#111'};display:grid;place-items:center;font-weight:800;font-size:${px(isz * 0.5)}">${c.number}</div>`
        : icon ? (/[\/.]/.test(icon) && !/\s/.test(icon)
          ? `<img src="${fileUrl(icon)}" style="flex:none;width:${px(isz)};height:${px(isz)};object-fit:contain">`
          : `<div data-fs="${isz}" style="flex:none;font-size:${px(isz)};line-height:1">${esc(icon)}</div>`) : '';
      const value = str(c.value, locale), title = str(c.title, locale), text = str(c.text, locale);
      const valueCss = c.gradientValue ? `background:${gradientCss(c.gradientValue)};-webkit-background-clip:text;color:transparent` : `color:${c.valueColor || accent}`;
      const body = [
        value ? `<div data-fs="${vsz}" style="font-size:${px(vsz)};font-weight:850;line-height:1;letter-spacing:-.035em;${valueCss}">${rich(value)}</div>` : '',
        title ? `<div data-fs="${tsz}" style="font-size:${px(tsz)};font-weight:${c.titleWeight ?? (c.quote ? 600 : 700)};line-height:1.22;letter-spacing:-.01em;color:${c.color || '#fff'};${value ? 'margin-top:.25em;' : ''}text-wrap:balance">${c.quote ? `“${rich(title)}”` : rich(title)}</div>` : '',
        text ? `<div data-fs="${xsz}" style="font-size:${px(xsz)};font-weight:500;line-height:1.35;color:${c.muted || c.color || '#fff'};margin-top:.35em;text-wrap:pretty">${rich(text)}</div>` : '',
      ].join('');
      const H = el.h != null ? (el.h / 100) * ctx.H : null;
      const fit = H ? `data-fit data-id="${esc(ctx.slideId)}:${esc(el.id || 'card')}" data-maxh="${H - 2 * pad}"` : '';
      return `<div class="el" ${fit} dir="${isRtl(locale) ? 'rtl' : 'ltr'}" lang="${locale}" style="${box(`display:flex;flex-direction:column;justify-content:${c.valign || 'center'};padding:${px(pad)};border-radius:${px((c.radius ?? 4.5) * S)};background:${gradientCss(c.background || 'rgba(255,255,255,.12)')};border:${c.border || 'none'};box-shadow:${c.shadow || 'none'};font-family:${fam};text-align:${align};${c.backdrop !== false && /rgba/.test(c.background || 'rgba') ? `backdrop-filter:blur(${px(3 * S)});` : ''}`)}">
        <div class="fit-inner" style="display:flex;flex-direction:${dir};gap:${px(pad * (dir === 'row' ? 0.8 : 0.55))};align-items:${dir === 'row' ? 'center' : align === 'center' ? 'center' : 'flex-start'}">${lead}<div style="min-width:0;flex:1;width:100%">${body}</div></div></div>`;
    }
    case 'stars': {
      const n = el.count ?? 5, rating = el.rating ?? n, sz = (el.size ?? 6) * S, gap = sz * 0.16;
      const path = 'M12 1.6l3.1 6.6 7.3.9-5.4 5 1.4 7.2L12 17.8l-6.4 3.5 1.4-7.2-5.4-5 7.3-.9z';
      const stars = Array.from({ length: n }, (_, i) => {
        const f = Math.max(0, Math.min(1, rating - i));
        return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24"><defs><linearGradient id="sg${ctx.slideId}${i}"><stop offset="${f}" stop-color="${el.color || '#ffcc33'}"/><stop offset="${f}" stop-color="${el.emptyColor || 'rgba(255,255,255,.25)'}"/></linearGradient></defs><path d="${path}" fill="url(#sg${ctx.slideId}${i})" stroke="${el.color || '#ffcc33'}" stroke-width="${f < 1 ? 1 : 0}"/></svg>`;
      }).join('');
      return `<div class="el" style="${box(`display:flex;gap:${px(gap)};filter:drop-shadow(0 ${px(sz * 0.06)} ${px(sz * 0.12)} rgba(0,0,0,.18))`)}">${stars}</div>`;
    }
    case 'laurel': {
      // award wreath: two mirrored leafy branches along an ellipse, title + subtitle inside
      const w = (el.w / 100) * ctx.W, h = w * 0.62, col = el.color || '#fff';
      const cx = 100, cy = 64, rx = 86, ry = 56, N = 10;
      const P = (t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
      const leaves = [];
      for (let i = 0; i < N; i++) {
        const t = ((102 + i * 14.5) * Math.PI) / 180;
        const [x, y] = P(t);
        const a = (Math.atan2(ry * Math.cos(t), -rx * Math.sin(t)) * 180) / Math.PI;
        const sc = 1 - i * 0.035, nx = Math.cos(t), ny = Math.sin(t);
        for (const side of [1, -1]) {
          const lx = x + nx * 6 * side, ly = y + ny * 6 * side;
          leaves.push(`<ellipse cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" rx="${(8.5 * sc).toFixed(2)}" ry="${(3.6 * sc).toFixed(2)}" transform="rotate(${(a - 32 * side).toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})"/>`);
        }
      }
      const [x0, y0] = P((98 * Math.PI) / 180), [x1, y1] = P((240 * Math.PI) / 180);
      const branch = `<path d="M${x0.toFixed(2)},${y0.toFixed(2)} A${rx} ${ry} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/>${leaves.join('')}`;
      const svg = `<svg viewBox="0 0 200 124" width="${w}" height="${h}" style="position:absolute;inset:0" fill="${col}"><g>${branch}</g><g transform="translate(200,0) scale(-1,1)">${branch}</g></svg>`;
      const fam = fontStack(el.font || (ctx.theme || theme).font, locale);
      const t = str(el.title, locale), sub = str(el.subtitle, locale);
      return `<div class="el" style="${box(`height:${px(h)}`)}">${svg}<div style="position:absolute;left:24%;right:24%;top:6%;bottom:6%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;font-family:${fam};color:${col}">
        ${t ? `<div style="font-size:${px(w * 0.078)};font-weight:800;line-height:1.08;letter-spacing:-.01em;text-wrap:balance">${rich(t)}</div>` : ''}${sub ? `<div style="font-size:${px(w * 0.05)};font-weight:600;opacity:.8;margin-top:${px(w * 0.02)};line-height:1.2;text-wrap:balance">${rich(sub)}</div>` : ''}</div></div>`;
    }
    case 'band': {
      // ticker strip: a rotated full-bleed band of repeated text — y = band center (% of H), w = length (% of one slide)
      const fam = fontStack(el.font || (ctx.theme || theme).font, locale);
      const fs = (el.size ?? 4.4) * S, bh = fs * (el.height ?? 1.9);
      const len = ((el.w ?? 180) / 100) * ctx.W, cx = ((el.x ?? 50) / 100) * ctx.W, cy = ((el.y ?? 50) / 100) * ctx.H;
      const word = rich(pickText(el, locale));
      const sep = `<span style="opacity:.55;padding:0 ${px(fs * 0.55)}">${esc(el.separator ?? '✦')}</span>`;
      const reps = Math.ceil(len / (fs * 6)) + 2;
      return `<div class="el" style="position:absolute;left:${px(cx - len / 2)};top:${px(cy - bh / 2)};width:${px(len)};height:${px(bh)};z-index:${el.z ?? 1};opacity:${el.opacity ?? 1};transform:rotate(${el.rotate ?? -8}deg);background:${gradientCss(el.background || '#111')};overflow:hidden;display:flex;align-items:center;box-shadow:${el.shadow || `0 ${px(fs * 0.25)} ${px(fs)} rgba(0,0,0,.25)`}"><div style="white-space:nowrap;font-family:${fam};font-size:${px(fs)};font-weight:${el.weight ?? 800};letter-spacing:${el.tracking ?? 0.02}em;text-transform:${el.upper === false ? 'none' : 'uppercase'};color:${el.color || '#fff'};margin-left:${px(-fs * (el.offset ?? 2))};line-height:1">${Array.from({ length: reps }, () => word + sep).join('')}</div></div>`;
    }
    case 'ribbon': {
      // flowing band across the set: sine wave from x=from..to (global %), centered at y, amplitude amp (% of H)
      const x0 = ((el.from ?? 0) / 100) * ctx.W, x1 = ((el.to ?? (ctx.n || 1) * 100) / 100) * ctx.W;
      const y0 = ((el.y ?? 70) / 100) * ctx.H, A = ((el.amp ?? 6) / 100) * ctx.H, period = ((el.period ?? 160) / 100) * ctx.W;
      let d = '';
      for (let x = x0; x <= x1 + 1; x += ctx.W / 40) d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${(y0 + A * Math.sin(((x - x0) / period) * 2 * Math.PI + (el.phase ?? 0))).toFixed(1)} `;
      const gid = `rib${esc(ctx.slideId)}${el.id || ''}`.replace(/[^a-z0-9]/gi, '');
      const stops = (el.colors || ['#ffffff', '#ffffff']).map((c, i, a) => `<stop offset="${i / Math.max(1, a.length - 1)}" stop-color="${c}"/>`).join('');
      return `<svg class="el" style="position:absolute;left:0;top:0;width:${x1}px;height:${ctx.H}px;overflow:visible;z-index:${el.z ?? 1};opacity:${el.opacity ?? 0.9}"><defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0">${stops}</linearGradient></defs><path d="${d}" fill="none" stroke="url(#${gid})" stroke-width="${((el.width ?? 2.2) / 100) * ctx.W}" stroke-linecap="round"/></svg>`;
    }
    case 'callout': {
      // chip at (x, y) anchored left/right + a line and dot to `to` [x%, y%]
      const fs = (el.size ?? 3.2) * S, padY = fs * 0.5, padX = fs * 0.85;
      const chipH = fs * 1.2 + padY * 2;
      const ax = (el.x / 100) * ctx.W, ay = (el.y / 100) * ctx.H + chipH / 2;
      const tx = (el.to[0] / 100) * ctx.W, ty = (el.to[1] / 100) * ctx.H;
      const col = el.lineColor || el.background || '#fff';
      const fam = fontStack(el.font || (ctx.theme || theme).font, locale);
      return `<svg class="el" style="position:absolute;left:0;top:0;width:${ctx.W}px;height:${ctx.H}px;overflow:visible;z-index:${(el.z ?? 8) - 1}"><line x1="${ax}" y1="${ay}" x2="${tx}" y2="${ty}" stroke="${col}" stroke-width="${fs * 0.12}"/><circle cx="${tx}" cy="${ty}" r="${fs * 0.42}" fill="${el.dotColor || (ctx.theme || theme).accent || '#ffcf5c'}" stroke="${col}" stroke-width="${fs * 0.16}"/></svg>
        <div class="el" style="${box(`font-family:${fam};font-size:${px(fs)};font-weight:700;line-height:1.2;color:${el.color || '#111'};background:${gradientCss(el.background || '#fff')};padding:${px(padY)} ${px(padX)};border-radius:${px(fs * 2)};white-space:nowrap;box-shadow:0 ${px(fs * 0.3)} ${px(fs)} rgba(0,0,0,.25)`)}">${rich(str(el.text, locale) ?? '')}</div>`;
    }
    default:
      errors.push(`unknown element type "${el.type}" on slide ${ctx.slideId}`);
      return '';
  }
}

// ---------- slide assembly ----------
function slideTheme(s, base = theme) {
  return s.preset ? layer(base, presetTheme(s.preset)) : base;
}
// baseTheme: the theme to start from (a preview's own `theme` layered over cfg.theme)
function slideElements(slide, target, locale, W, H, baseTheme = theme) {
  const s = specialize(slide, target, locale);
  const th = slideTheme(s, baseTheme);
  if (target.raw) {
    // store rules (Wear OS, Apple Watch) want the app UI only: no frame, caption or background
    return { s: { ...s, background: '#000' }, th, els: [{ type: 'device', id: 'screen', model: 'none', style: 'frameless', screenModel: target.model, screen: s.screen,
      x: 50, y: 0, w: 100, radius: 0, screenAspect: H / W, shadow: false, fit: 'cover' }] };
  }
  const base = buildLayout(s, { W, H, theme: th, target, modelFor: (screen, landscape) => autoModel({ screen, landscape }, target, locale),
    aspectFor: (screen, model, landscape) => { const src = screen && resolveScreen(screen, locale, model, landscape); return (src && imageMeta.get(src)?.aspect) || undefined; } });
  const extra = (s.elements || []).map((e) => specialize(e, target, locale));
  // an extra element with the same id as a layout element overrides it
  const byId = new Map(base.map((e) => [e.id, e]));
  const out = [...base];
  for (const e of extra) {
    if (e.id && byId.has(e.id)) out[out.indexOf(byId.get(e.id))] = merge(byId.get(e.id), e);
    else out.push(e);
  }
  for (const e of out) {
    if (e.type === 'device') {
      e.model = e.model && e.model !== 'auto' ? e.model : autoModel(e, target, locale);
      if (e.color === undefined) e.color = th.device?.color;
    }
  }
  return { s, th, els: out.filter((e) => !e.hidden) };
}

// slide.targets / slide.skipTargets accept target ids, base ids or stores ("ios", "play", "social")
function slideOn(s, t) {
  const keys = [t.id, t.baseId, t.store, t.family];
  if (s.targets && !s.targets.some((k) => keys.includes(k))) return false;
  if (s.skipTargets && s.skipTargets.some((k) => keys.includes(k))) return false;
  return true;
}

// Pick a frame from the screenshot's own aspect ratio (so an iPhone capture is never stretched into an iPad frame).
function autoModel(e, target, locale) {
  // watches, laptops, desktops and windows keep the target's frame
  if (!['phone', 'tablet', 'none'].includes(kindOf(target.model))) return target.model;
  const src = e.screen && resolveScreen(e.screen, locale, target.model === 'none' ? 'iphone' : target.model, e.landscape);
  let a = src && imageMeta.get(src)?.aspect;
  if (a && e.landscape) a = 1 / a;
  if (!a) return target.model === 'none' ? 'iphone' : target.model;
  const play = target.store === 'play';
  if (a < 1.45) return play ? 'android-tablet' : 'ipad';
  if (a < 1.85) return play ? 'android-tablet' : 'iphone-home';
  return play ? 'android' : 'iphone';
}

// ---------- previews (video) ----------
// One page per preview × video target × locale with every scene's DOM stacked (later scenes paint above), each in
// its own .slide so __fit's safe-area check measures it. Node computes stateAt(tl, t); window.__apply(state) shows it.
const isClip = (p) => /\.(mov|mp4|m4v|webm)$/i.test(p);
// elementHtml's default z-index per type: each element sits in an animated wrapper (a stacking context), so the
// wrapper takes the element's z and the layering matches the still slide
const TYPE_Z = { caption: 3, device: 2, arrow: 5, band: 1, ribbon: 1, callout: 8 };

async function loadImageMeta(srcs, locale) {
  for (const src of srcs) {
    if (typeof src !== 'string') continue;
    for (const { file } of screenCands(src.split('?')[0], locale)) {
      const p = abs(file);
      if (imageMeta.has(p) || /\.html?$/i.test(p) || isClip(p) || !fs.existsSync(p)) continue;
      const m = await sharp(p).metadata();
      imageMeta.set(p, { w: m.width, h: m.height, aspect: m.height / m.width });
    }
  }
}

// -> [{ preview, target, locale, W, H, scenes: [{ scene, s, th, els, clip, overflow, labelEls }], timeline, warnings: Set }]
async function resolvePreviews({ ffmpeg }) {
  const jobs = [], vdef = theme.video || {};
  for (const p0 of [cfg.previews ?? []].flat()) for (const target of TARGETS.filter((t) => isVideoTarget(t) && slideOn(p0, t))) for (const locale of LOCALES) {
    const W = target.w, H = target.h, warnSet = new Set();
    const preview = { transition: vdef.transition, ...specialize(p0, target, locale) };
    const tag = `${target.id}/${locale}/${preview.id}`;
    let list;
    try { list = selectScenes(p0.scenes, preview.scenes); } catch (e) { errors.push(`[${tag}] ${e.message}`); continue; }
    const { preset, ...pt } = preview.theme || {};
    const base = preview.theme ? layer(layer(theme, presetTheme(preset)), pt) : theme;
    const scenes = [];
    for (const sc0 of list.filter((x) => slideOn(x, target))) {
      const sp = specialize(sc0, target, locale);
      const scene = { ...sp, in: sp.in ?? preview.in ?? vdef.entrance, scroll: merge(merge(vdef.scroll, preview.scroll), sp.scroll) };
      // timed labels are objects; before-after keeps its string labels for the layout
      const timed = (scene.labels || []).filter(isObj);
      try {
        // a clip resolves {locale} like a screen; its probed aspect picks the frame (autoModel) via imageMeta
        let info = null;
        const src = String(scene.screen ?? '').split('?')[0];
        const hit = isClip(src) && screenCands(src, locale).find((c) => fs.existsSync(abs(c.file)));
        if (hit) {
          const w = missingClipWarning(locale, src.includes('{locale}') ? hit.locale : locale, preview.clipLocale);
          if (w) warnSet.add(w);
          info = { file: abs(hit.file), ...probeClip(ffmpeg, abs(hit.file)) };
          imageMeta.set(info.file, { w: info.width, h: info.height, aspect: info.height / info.width });
          scene.screen = info.file;
        }
        await loadImageMeta([scene.screen, scene.screen2, scene.screen3, ...(scene.elements || []).map((e) => e.screen)], locale);
        const { s, th, els } = slideElements({ ...scene, labels: timed.length ? undefined : scene.labels }, target, locale, W, H, base);
        const dev = els.find((e) => e.type === 'device' && e.id === 'device');
        let clip = null, overflow = 0;
        if (info && dev) {
          const dur = Number.isFinite(scene.duration) ? scene.duration : DEFAULT_DURATION;
          const { start = 0, speed = 1 } = scene.clip || {};
          // cut at clip.end or the scene end, whichever comes first
          const end = Math.min(scene.clip?.end ?? Infinity, info.duration, start + dur * speed);
          const height = Math.round(screenRect(dev, { W, H }).height * VIDEO_SCALE);
          const key = clipKey({ file: info.file, start, end, speed, height });
          const ex = extractClip(ffmpeg, { file: info.file, start, end, speed, height, dir: path.join(OUT, '.build', 'clips', key) });
          const rel = path.relative(BASE, info.file);
          if (!ex.count) throw new Error(`clip ${rel} gave no frames between ${start}s and ${end}s`);
          if (ex.count / ex.fps < dur - 1 / ex.fps) warnSet.add(`clip ${rel} is ${(ex.count / ex.fps).toFixed(1)}s but scene "${scene.id}" lasts ${dur}s — the last frame holds`);
          const ms = MODELS[dev.model]?.screen, want = ms && (dev.landscape ? 1 / ms : ms);
          if (want && Math.abs(info.height / info.width / want - 1) > 0.02) warnSet.add(`clip ${info.width}×${info.height} does not match the ${dev.model} screen (${want.toFixed(2)}:1) — it will be cropped`);
          dev.screen = ex.files[0];
          dev.clipFrames = ex.files.map(fileUrl);
          imageMeta.set(ex.files[0], imageMeta.get(info.file));
          clip = { frames: ex.count, fps: ex.fps };
        } else if (scene.motion === 'scroll' && dev) {
          // the whole mock / long capture pans inside the screen; overflow = how much taller than the screen it is
          dev.fullPage = true;
          const full = resolveScreen(dev.screen, locale, dev.screenModel || dev.model, dev.landscape, { fullPage: true });
          const a = full && imageMeta.get(full)?.aspect, ms = MODELS[dev.model]?.screen;
          overflow = a && ms ? a / ms - 1 : 0;
        }
        // labels: badges under the caption (above a bottom caption), faded in and out by the timeline
        const cap = els.find((e) => e.type === 'caption');
        const labelEls = timed.map((l, k) => ({ type: 'badge', id: `label-${k}`, text: l.text, x: 50,
          y: !cap ? 6 : cap.y < 50 ? cap.y + (cap.h ?? 20) + 1 : cap.y - 6, size: 3.2, background: th.accent || '#ffcf5c', color: '#111', role: 'label', i: k }));
        scenes.push({ scene: { ...scene, labels: timed }, s, th, els, clip, overflow, labelEls });
      } catch (e) { errors.push(`[${tag}/${scene.id}] ${e.message}`); }
    }
    if (!scenes.length) { errors.push(`[${tag}] no scenes to render for this target`); continue; }
    const timeline = buildTimeline(preview, scenes.map((e) => ({ ...e.scene, clip: e.clip || undefined, overflow: e.overflow })), { fps: target.video.fps });
    jobs.push({ preview, target, locale, W, H, scenes, timeline, warnings: warnSet });
  }
  return jobs;
}

// resolving and building the pages discovers html mocks (incl. full-page ones for scroll, and zoom screens that only
// elementHtml asks for); render them, then resolve again with their real size — as buildSheets does for stills
async function previewJobs(browser, { ffmpeg }) {
  const e0 = errors.length, w0 = warnings.length;
  let jobs = await resolvePreviews({ ffmpeg });
  jobs.forEach(previewPage);
  if (htmlQueue.size) {
    await renderMocks(browser);
    htmlQueue.clear(); errors.length = e0; warnings.length = w0;
    jobs = await resolvePreviews({ ffmpeg });
  }
  return jobs;
}

function sceneHtml(job, { s, th, els, labelEls }, i) {
  const { W, H, locale } = job;
  const ctx = { W, H, slideId: s.id, theme: th, model: job.target.model };
  const bg = s.background ?? th.background;
  // fade-through and the loop fades go to the scene's background colour
  const veil = isObj(bg) && bg.color ? bg.color : typeof bg === 'string' && !/gradient|url\(/i.test(bg) ? bg : '#000';
  const wrap = (e, n) => {
    const role = e.role || (e.type === 'device' ? 'device' : e.type === 'caption' ? 'caption' : 'other');
    return `<div class="anim" data-role="${role}" data-i="${role === 'label' ? e.i : n}" style="position:absolute;inset:0;z-index:${e.z ?? TYPE_Z[e.type] ?? 4}">${elementHtml(e, ctx, locale)}</div>`;
  };
  return `<div class="scene" data-scene="${esc(s.id)}" data-n="${i}" style="position:absolute;inset:0;visibility:hidden;opacity:0">${backgroundHtml(bg, W, H)}${[...els, ...labelEls].map(wrap).join('')}<div class="veil" style="position:absolute;inset:0;background:${veil};opacity:0;z-index:9999"></div></div>`;
}

// Runs in the page (serialized with toString): show one stateAt() result; resolves once changed clip frames are decoded.
async function applyState(state) {
  const H = window.innerHeight, changed = [];
  for (const sc of state.scenes) {
    const root = document.querySelector(`.scene[data-scene="${CSS.escape(sc.id)}"]`);
    if (!root) continue;
    root.style.visibility = sc.visible ? 'visible' : 'hidden';
    root.style.opacity = sc.opacity;
    root.style.transform = `translateX(${sc.tx * 100}%)`;
    for (const role of ['device', 'caption']) {
      for (const a of root.querySelectorAll(`:scope > .anim[data-role="${role}"]`)) { a.style.opacity = sc[role].opacity; a.style.transform = `translateY(${sc[role].dy * H}px)`; }
    }
    sc.labels.forEach((l, k) => { const a = root.querySelector(`:scope > .anim[data-role="label"][data-i="${k}"]`); if (a) a.style.opacity = l.opacity; });
    const img = root.querySelector('[data-el="device"] .scr');
    if (img) {
      img.dataset.t0 ??= img.style.transform;          // landscape screens keep their rotation
      img.style.transform = `${img.dataset.t0} scale(${sc.screen.scale})`.trim();
      img.style.transformOrigin = 'center';
      img.style.objectPosition = `50% ${sc.screen.scrollY * 100}%`;
      const frames = window.__clips[sc.id];
      if (frames && sc.screen.frame != null && img.dataset.f !== String(sc.screen.frame)) {
        img.dataset.f = sc.screen.frame; img.src = frames[sc.screen.frame]; changed.push(img);
      }
    }
    const veil = root.querySelector(':scope > .veil');
    if (veil) veil.style.opacity = sc.veil;
  }
  await Promise.all(changed.map((i) => i.decode().catch(() => {})));
}

// pageHtml (fonts, __fit) + the stacked scenes + __apply; __timeline is there for debugging in a browser
function previewPageHtml(job, bodies, { W, H, safe }) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const clips = Object.fromEntries(job.scenes.map((e) => [e.s.id, e.els.find((x) => x.type === 'device' && x.id === 'device')?.clipFrames]).filter(([, f]) => f));
  const body = bodies.map((b) => `<div class="slide" style="left:0;width:${W}px">${b}</div>`).join('')
    + `<script>window.__clips = ${json(clips)};\nwindow.__timeline = ${json(job.timeline)};\nwindow.__apply = ${applyState.toString()};</script>`;
  return pageHtml({ locale: job.locale, W, H, h: H, panorama: false, body, safe });
}

function previewPage(job) {
  fontFaces.length = 0; googleFamilies.clear();
  const bodies = job.scenes.map((e, i) => sceneHtml(job, e, i));
  return previewPageHtml(job, bodies, { W: job.W, H: job.H, safe: job.target.family === 'creative' ? { x: 10, y: 10 } : null });
}

// fit checks per scene at its middle (entrance done), with the same warnings as screenshots
async function fitScenes(page, job) {
  for (const sc of job.timeline.scenes) {
    await page.evaluate((st) => window.__apply(st), stateAt(job.timeline, (sc.start + sc.end) / 2));
    const fit = await page.evaluate((sel) => window.__fit(sel), `.scene[data-scene="${sc.id}"]`);
    reportFit(fit, `${job.target.id}/${job.locale}/${job.preview.id}/${sc.id}`);
  }
}

function pageHtml(sheet) {
  return `<!doctype html><html lang="${sheet.locale}"><head><meta charset="utf-8">${googleLink()}
<style>${fontFaces.join('')}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:${sheet.W}px;height:${sheet.H}px;overflow:hidden;background:#000}
.slide{position:absolute;top:0;height:${sheet.h}px;overflow:${sheet.panorama ? 'visible' : 'hidden'}}
.bg{position:absolute;inset:0}.fit-inner{width:100%}img{display:block}
</style></head><body>${sheet.body}
<script>window.__pano = ${sheet.panorama ? JSON.stringify({ W: sheet.slideW, n: sheet.n }) : 'null'};
window.__safe = ${JSON.stringify(sheet.safe || null)};
// scope: optional CSS selector; every query then runs inside that element (the video pass fits one overlay at a time)
window.__fit = async (scope) => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return [];
  const report = [];
  for (const box of root.querySelectorAll('[data-fit]')) {
    const inner = box.querySelector('.fit-inner'); const maxH = +box.dataset.maxh;
    const nodes = [...box.querySelectorAll('[data-fs]')];
    let s = 1; const apply = () => nodes.forEach(n => n.style.fontSize = (n.dataset.fs * s) + 'px');
    const over = () => inner.scrollHeight > maxH + 1 || inner.scrollWidth > box.clientWidth + 1;
    while (over() && s > 0.5) { s -= 0.02; apply(); }
    if (s < 1) report.push({ id: box.dataset.id, scale: +s.toFixed(2), overflow: over() });
  }
  // text covered by a device/image painted above it: sample points along every text line and ask the
  // browser what is on top there (exact for rotated / 3D devices, unlike bounding boxes)
  const cover = 'html .el.device, html img.el';
  for (const box of root.querySelectorAll('[data-fit]')) {
    const r = document.createRange(); r.selectNodeContents(box.querySelector('.fit-inner'));
    const lines = [...r.getClientRects()].filter(l => l.width > 2);
    let hit = false;
    for (const l of lines) {
      for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        const stack = document.elementsFromPoint(l.left + l.width * fx, l.top + l.height / 2);
        const iText = stack.findIndex(e => box.contains(e));
        const iDev = stack.findIndex(e => e.closest(cover));
        if (iDev >= 0 && (iText < 0 || iDev < iText)) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit) report.push({ id: box.dataset.id, covered: true });
  }
  // panorama seams: the stores draw a gap between cards, so captions must stay clear; devices crossing are noted
  if (window.__pano) {
    const { W, n } = window.__pano, near = W * 0.035;
    for (const box of root.querySelectorAll('[data-fit]')) {
      const r = document.createRange(); r.selectNodeContents(box.querySelector('.fit-inner'));
      for (const l of [...r.getClientRects()].filter(l => l.width > 2)) {
        const k = [...Array(n - 1)].map((_, i) => (i + 1) * W).find(sx => l.left < sx + near && l.right > sx - near);
        if (k) { report.push({ id: box.dataset.id, seam: Math.round(k / W) }); break; }
      }
    }
    root.querySelectorAll('.el.device').forEach((d) => {
      const b = d.getBoundingClientRect();
      for (let k = 1; k < n; k++) if (b.left < k * W - W * 0.02 && b.right > k * W + W * 0.02)
        report.push({ deviceSeam: k, share: Math.round(Math.min(k * W - b.left, b.right - k * W) / b.width * 100) });
    });
  }
  // creative assets are cropped per device: text and badges must stay inside the central safe area of their slide
  if (window.__safe) {
    const { x, y } = window.__safe;
    for (const el of root.querySelectorAll('[data-fit], [data-badge]')) {
      const s = el.closest('.slide')?.getBoundingClientRect(); if (!s) continue;
      // captions: the text lines themselves (the box is wider than the words); badges: the badge box
      let b = el.getBoundingClientRect();
      if (el.matches('[data-fit]')) {
        // text nodes only: a block's own rect spans the whole box
        const ls = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) if (n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); ls.push(...[...r.getClientRects()].filter(l => l.width > 2)); }
        if (ls.length) b = { left: Math.min(...ls.map(l => l.left)), right: Math.max(...ls.map(l => l.right)), top: Math.min(...ls.map(l => l.top)), bottom: Math.max(...ls.map(l => l.bottom)) };
      }
      const bad = b.left < s.left + s.width * x / 100 - 1 || b.right > s.right - s.width * x / 100 + 1
        || b.top < s.top + s.height * y / 100 - 1 || b.bottom > s.bottom - s.height * y / 100 + 1;
      if (bad) report.push({ id: el.dataset.id || el.dataset.badge, outside: true });
    }
  }
  return report;
};
</script></body></html>`;
}

// ---------- browser ----------
async function launch() {
  const tries = [
    process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH },
    { channel: 'chrome' }, { channel: 'msedge' }, {},
  ].filter(Boolean);
  for (const opt of tries) {
    try { return await chromium.launch({ ...opt, headless: true }); } catch { /* next */ }
  }
  throw new Error('No Chromium found. Install Google Chrome, set CHROME_PATH, or run: npx playwright install chromium');
}

async function toStoreImage(buf, file, w, h) {
  // supersampled capture -> exact store size with a high-quality filter; stores reject alpha
  let img = sharp(buf).resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).flatten({ background: '#000000' }).removeAlpha();
  if (FORMAT === 'jpeg' || FORMAT === 'jpg') img = img.jpeg({ quality: 92, chromaSubsampling: '4:4:4' });
  else if (FORMAT === 'webp') img = img.webp({ quality: 92 });
  else img = img.png({ compressionLevel: 9 });
  await img.toFile(file);
}

// pre-render html mock screens (queued by resolveScreen) to PNG at the device viewport, @3x
async function renderMocks(browser) {
  for (const job of htmlQueue.values()) {
    const p = await browser.newPage({ viewport: { width: job.vw, height: job.vh }, deviceScaleFactor: 3, locale: job.locale });
    await p.goto(`${pathToFileURL(job.file).href}?locale=${encodeURIComponent(job.locale)}${job.query ? `&${job.query}` : ''}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(job.out), { recursive: true });
    await p.screenshot({ path: job.out, fullPage: job.fullPage });
    await p.close();
    const m = await sharp(job.out).metadata();
    imageMeta.set(job.out, { w: m.width, h: m.height, aspect: m.height / m.width });
    htmlDone.add(job.out);
  }
}

// __fit() report -> warnings / errors, tagged with where it happened ("ios-6.9/en-US")
function reportFit(fit, tag) {
  for (const f of fit) {
    if (f.seam) { warn(`[${tag}] caption touches seam ${f.seam}|${f.seam + 1}: ${f.id} — the store's card gap will cut it; keep text ≥6% from slide edges`); continue; }
    if (f.deviceSeam) { notes.push(`[${tag}] a device crosses seam ${f.deviceSeam}|${f.deviceSeam + 1} (${f.share}% on the smaller side) — check the store view preview`); continue; }
    if (f.outside) { warn(`[${tag}] caption leaves the safe area: ${f.id} — Apple crops creative assets per device; keep text inside the central 80%`); continue; }
    if (f.covered) { warn(`[${tag}] text is covered by a device or image: ${f.id} — move one of them`); continue; }
    if (f.overflow) errors.push(`[${tag}] text overflows its box even at 50%: ${f.id} — shorten the copy or enlarge h/w`);
    else if (f.scale < 0.9) warn(`[${tag}] text shrunk to ${Math.round(f.scale * 100)}%: ${f.id} — consider shorter copy`);
  }
}

// ---------- main ----------
async function main() {
  // TEMPORARY (Task 5): --only-previews builds the preview pages and runs their fit checks; Task 6 replaces this
  // block with the preview pass (capture, encode, poster).
  if (has('only-previews')) {
    fs.mkdirSync(path.join(OUT, '.build'), { recursive: true });
    let ffmpeg = null;
    try { ffmpeg = findFfmpeg(); } catch (e) { errors.push(e.message); }
    if (!ffmpeg && !errors.length) errors.push('previews need ffmpeg: npm install (ffmpeg-static), set FFMPEG_PATH, or brew install ffmpeg');
    if (ffmpeg) {
      const browser = await launch();
      const jobs = await previewJobs(browser, { ffmpeg });
      const page = await browser.newPage({ deviceScaleFactor: VIDEO_SCALE });
      for (const job of jobs) {
        const tag = `${job.target.id}/${job.locale}/${job.preview.id}`;
        const file = path.join(OUT, '.build', `preview.${job.target.id.replace('@', '_')}.${job.locale}.${job.preview.id}.html`);
        fs.writeFileSync(file, previewPage(job));
        await page.setViewportSize({ width: job.W, height: job.H });
        await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => warn(`load: ${e.message}`));
        await fitScenes(page, job);
        for (const w of job.warnings) warn(`[${tag}] ${w}`);
        for (const e of job.timeline.errors) errors.push(`[${tag}] ${e}`);
        console.log(`  page: ${file} (${job.timeline.total}s, ${job.scenes.length} scenes)`);
      }
      await browser.close();
    }
    for (const nt of [...new Set(notes)]) console.log(`  NOTE  ${nt}`);
    for (const w of [...new Set(warnings)]) console.log(`  WARN  ${w}`);
    for (const e of [...new Set(errors)]) console.log(`  ERROR ${e}`);
    process.exit(errors.length ? 1 : 0);
  }
  // wrong format for a target (e.g. PNG-only creative assets): fail before launching Chrome
  for (const t of STILL_TARGETS) { const e = checkTargetFormat(t, FORMAT); if (e) errors.push(e); }
  if (errors.length) { for (const e of errors) console.log(`  ERROR ${e}`); process.exit(1); }
  fs.mkdirSync(path.join(OUT, '.build'), { recursive: true });
  const slides = (cfg.slides || []).filter((s) => !SLIDE_FILTER || SLIDE_FILTER.includes(s.id));
  if (!slides.length) throw new Error('No slides to render');

  // collect image metadata for every referenced raster screen (aspect drives auto frames + zoom)
  const allScreens = new Set();
  for (const l of LOCALES) for (const t of STILL_TARGETS) for (const s of slides) {
    const sp = specialize(s, t, l);
    for (const src of [sp.screen, sp.screen2, ...(sp.elements || []).map((e) => e.screen)]) {
      if (!src) continue;
      for (const c of [src.replaceAll('{locale}', l), src.replaceAll('{locale}', l.split('-')[0]), src.replaceAll('{locale}', defaultLocale)])
        if (fs.existsSync(abs(c)) && !/\.html?$/i.test(c)) allScreens.add(abs(c));
    }
  }
  for (const p of allScreens) {
    const m = await sharp(p).metadata();
    imageMeta.set(p, { w: m.width, h: m.height, aspect: m.height / m.width });
  }

  const buildSheets = () => {
  const sheets = [];
  for (const target of STILL_TARGETS) for (const locale of LOCALES) {
    const W = target.w, H = target.h;
    const pano = !target.raw && cfg.panorama && (cfg.panorama === true || cfg.panorama.targets?.includes(target.baseId) || (!cfg.panorama.targets && cfg.panorama.enabled !== false));
    const groups = pano ? [slides] : slides.map((s) => [s]);
    for (const group0 of groups) {
      const group = group0.filter((s) => slideOn(s, target));
      if (!group.length) continue;
      fontFaces.length = 0; googleFamilies.clear();
      let body = '';
      const ctxBase = { W, H };
      const setBg = pano && specialize({ background: cfg.panorama.background, byTarget: cfg.panorama.byTarget, byLocale: cfg.panorama.byLocale }, target, locale).background;
      if (pano) body += `<div style="position:absolute;inset:0">${backgroundHtml(setBg || theme.background, W * group.length, H)}</div>`;
      const pattern = pano && cfg.panorama.pattern;
      group.forEach((slide0, i) => {
        // in pattern mode the pattern owns the devices; slides default to a caption band on top
        const slide = pattern && !slide0.layout ? { ...slide0, layout: 'caption-top' } : slide0;
        const { s, th, els } = slideElements(slide, target, locale, W, H);
        const ctx = { ...ctxBase, slideId: s.id, theme: th, model: target.model };
        const bg = s.background ?? (pano && !s.preset ? null : th.background);
        body += `<div class="slide" style="left:${i * W}px;width:${W}px">${backgroundHtml(bg, W, H)}${els.map((e) => elementHtml(e, ctx, locale)).join('')}</div>`;
      });
      const generated = pattern
        ? patternElements(pattern, { theme: specialize(theme, target, locale), app: cfg.app?.name, n: group.length, cls: canvasClass(W, H) === 'tablet' ? 'tablet' : 'tall', opts: specialize(cfg.panorama.patternOptions || {}, target, locale),
            screens: group.map((sl) => specialize(sl, target, locale).screen).map((sc, i, a) => sc || a.find(Boolean)) })
        : [];
      (pano ? [...generated, ...(cfg.panorama.elements || [])] : []).forEach((e0, i) => {
        // set-level elements: x is in % of ONE slide width and may run 0..(N*100) across the whole set.
        // Helpers: "seam": 2 centers the element on the border between slide 2 and 3 (dx nudges it);
        //          "slide": 3 makes x/from/to relative to slide 3.
        let e = { id: `pano${i + 1}`, ...specialize(e0, target, locale) };
        const off = e.slide != null ? (e.slide - 1) * 100 : 0;
        if (e.seam != null) e.x = e.seam * 100 + (e.dx || 0);
        else if (off) e.x = (e.x ?? 50) + off;
        if (off && e.from) { e.from = [e.from[0] + off, e.from[1]]; e.to = [e.to[0] + off, e.to[1]]; }
        if (e.type === 'device' && (!e.model || e.model === 'auto')) e.model = autoModel(e, target, locale);
        if (e.type === 'device' && e.color === undefined) e.color = theme.device?.color;
        if (e.type === 'device') e = { ...(theme.device || {}), ...e };
        body += elementHtml(e, { W, H, n: group.length, slideId: 'panorama', theme, model: target.model }, locale);
      });
      // freeze font list for this sheet
      const html = pageHtml({ locale, W: W * group.length, H, h: H, panorama: pano, slideW: W, n: group.length, body, safe: target.family === 'creative' ? { x: 10, y: 10 } : null });
      sheets.push({ target, locale, group, html, W, H });
    }
  }
  return sheets;
  };

  // building sheets discovers html mock screens; render those, then rebuild with their real aspect
  let sheets = buildSheets();
  const browser = await launch();
  // render at SUPERSAMPLE x and downsample: smoother frame edges, text and gradients.
  // Chrome caps textures near 16k px, so wide panorama sheets drop to a lower factor.
  const pages = {};
  const pageFor = async (scale) => (pages[scale] ||= await browser.newPage({ deviceScaleFactor: scale }));

  await renderMocks(browser);
  if (htmlQueue.size) {
    htmlQueue.clear(); errors.length = 0; warnings.length = 0;
    sheets = buildSheets();
  }

  const manifest = [];
  const counter = {};
  for (const sh of sheets) {
    const file = path.join(OUT, '.build', `${sh.target.id.replace('@', '_')}.${sh.locale}.${sh.group.map((s) => s.id).join('+')}.html`);
    fs.writeFileSync(file, sh.html);
    const scale = Math.max(1, Math.min(SUPERSAMPLE, Math.floor(16000 / Math.max(sh.W * sh.group.length, sh.H))));
    const page = await pageFor(scale);
    await page.setViewportSize({ width: sh.W * sh.group.length, height: sh.H });
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => warn(`load: ${e.message}`));
    reportFit(await page.evaluate(() => window.__fit()), `${sh.target.id}/${sh.locale}`);
    for (let i = 0; i < sh.group.length; i++) {
      const slide = sh.group[i];
      const key = `${sh.target.id}|${sh.locale}`;
      const n = (counter[key] = (counter[key] || 0) + 1);
      const dir = path.join(OUT, sh.target.id.replace('@', '_'), sh.locale);
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, `${String(n).padStart(2, '0')}_${slide.id}.${FORMAT === 'jpg' ? 'jpeg' : FORMAT}`);
      const buf = await page.screenshot({ clip: { x: i * sh.W, y: 0, width: sh.W, height: sh.H }, type: 'png' });
      await toStoreImage(buf, out, sh.W, sh.H);
      manifest.push({ target: sh.target.id, store: sh.target.store, locale: sh.locale, slide: slide.id, layout: specialize(slide, sh.target, sh.locale).layout || 'text-top', index: n, file: out });
    }
  }
  await browser.close();

  // ---------- validate ----------
  const byKey = {};
  for (const m of manifest) {
    const meta = await sharp(m.file).metadata();
    const t = STILL_TARGETS.find((x) => x.id === m.target);
    if (meta.width !== t.w || meta.height !== t.h) errors.push(`${m.file}: ${meta.width}x${meta.height}, expected ${t.w}x${t.h}`);
    if (meta.hasAlpha) errors.push(`${m.file}: has alpha channel`);
    const mb = t.maxMB ?? (t.store === 'msstore' ? 50 : 8);
    if (fs.statSync(m.file).size > mb * 1024 * 1024) warn(`${m.file}: larger than ${mb} MB`);
    if (t.store === 'msstore' && !/\.png$/i.test(m.file)) errors.push(`${m.file}: Microsoft Store needs PNG — use --format png`);
    (byKey[`${m.target}|${m.locale}`] ||= []).push(m);
  }
  for (const [k, arr] of Object.entries(byKey)) {
    const t = STILL_TARGETS.find((x) => x.id === k.split('|')[0]);
    if (arr.length > t.max) errors.push(`${k}: ${arr.length} screenshots, store max is ${t.max}`);
    if (t.min && arr.length < t.min) warn(`${k}: ${arr.length} screenshots, store minimum is ${t.min}`);
  }

  // ---------- fastlane layout (deliver / supply) ----------
  if (has('fastlane') || cfg.fastlane) {
    for (const m of manifest) {
      const t = STILL_TARGETS.find((x) => x.id === m.target);
      let dest;
      if (t.family === 'creative') {
        dest = path.join(OUT, 'fastlane', 'creative', storeLocale(m.locale, 'ios'), `${t.baseId}_${m.slide}${path.extname(m.file)}`);
        notes.push('creative assets (header, search, events) are not uploaded by deliver — add them in App Store Connect');
      } else if (t.store === 'ios') dest = path.join(OUT, 'fastlane', 'screenshots', storeLocale(m.locale, 'ios'), `${String(m.index).padStart(2, '0')}_${t.baseId}_${m.slide}.png`);
      else if (t.store === 'play') {
        const base = path.join(OUT, 'fastlane', 'metadata', 'android', storeLocale(m.locale, 'play'), 'images');
        dest = t.playDir === 'featureGraphic' ? path.join(base, 'featureGraphic.png') : path.join(base, t.playDir, `${m.index}_${m.locale}.png`);
      } else continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(m.file, dest);
    }
  }

  // ---------- previews: one contact sheet per target x locale ----------
  if (!has('no-preview')) {
    const pdir = path.join(OUT, '_preview');
    fs.mkdirSync(pdir, { recursive: true });
    const sections = [];
    for (const [k, arr] of Object.entries(byKey)) {
      // contact sheet (for agent QA): rows of up to 6, numbered
      const th = 1000, gap = 28, cols = Math.min(arr.length, 6);
      const thumbs = await Promise.all(arr.map((m) => sharp(m.file).resize({ height: th }).toBuffer({ resolveWithObject: true })));
      const tw = Math.max(...thumbs.map((t) => t.info.width));
      const rows = Math.ceil(thumbs.length / cols);
      const width = cols * (tw + gap) + gap, height = rows * (th + gap) + gap;
      const comps = thumbs.map((t, i) => ({ input: t.data, left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap) }));
      const name = `${k.replace('|', '__').replace('@', '_')}.jpg`;
      await sharp({ create: { width, height, channels: 3, background: '#d9d9de' } }).composite(comps).jpeg({ quality: 88 }).toFile(path.join(pdir, name));
      // gallery page (for humans): full-resolution files, click to open
      const t = STILL_TARGETS.find((x) => x.id === k.split('|')[0]);
      const figs = arr.map((m) => { const rel = path.relative(OUT, m.file); return `<figure><a href="${esc(rel)}" target="_blank"><img src="${esc(rel)}" loading="lazy"></a><figcaption><b>${String(m.index).padStart(2, '0')} · ${esc(m.slide)}</b><span>${esc(m.layout)}</span></figcaption></figure>`; }).join('');
      // panorama sets also get a seamless strip so the joined design can be judged as one image
      let strip = '';
      if (cfg.panorama && (cfg.panorama === true || !cfg.panorama.targets || cfg.panorama.targets.includes(t.baseId))) {
        const sh = 1200, parts = await Promise.all(arr.map((m) => sharp(m.file).resize({ height: sh }).toBuffer({ resolveWithObject: true })));
        const sw = parts.reduce((a, p) => a + p.info.width, 0);
        let x = 0;
        const sname = `${k.replace('|', '__').replace('@', '_')}__strip.jpg`;
        await sharp({ create: { width: sw, height: sh, channels: 3, background: '#000' } }).composite(parts.map((p) => { const c = { input: p.data, left: x, top: 0 }; x += p.info.width; return c; })).jpeg({ quality: 88 }).toFile(path.join(pdir, sname));
        // store view: separate rounded cards with a gap, the way the App Store / Play carousel shows them
        const gapPx = Math.round(parts[0].info.width * 0.045), rad = Math.round(parts[0].info.width * 0.05), pad = gapPx * 2;
        const vname = `${k.replace('|', '__').replace('@', '_')}__store.jpg`;
        const mask = (w, h) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${rad}" ry="${rad}"/></svg>`);
        const cards = await Promise.all(parts.map((p) => sharp(p.data).ensureAlpha().composite([{ input: mask(p.info.width, p.info.height), blend: 'dest-in' }]).png().toBuffer()));
        let vx = pad;
        const vw = sw + gapPx * (parts.length - 1) + pad * 2;
        await sharp({ create: { width: vw, height: sh + pad * 2, channels: 3, background: '#f2f2f7' } })
          .composite(cards.map((c, i) => { const o = { input: c, left: vx, top: pad }; vx += parts[i].info.width + gapPx; return o; })).jpeg({ quality: 88 }).toFile(path.join(pdir, vname));
        strip = `<p class="cap">Store view — separate cards with gaps, as shoppers swipe them</p><a href="_preview/${vname}" target="_blank"><img class="strip" src="_preview/${vname}"></a>
          <p class="cap">Joined view — the continuous design</p><a href="_preview/${sname}" target="_blank"><img class="strip" src="_preview/${sname}"></a><p class="cap">Individual uploads</p>`;
      }
      sections.push(`<section><h2>${esc(t.label || t.id)} <small>${esc(k.split('|')[1])} · ${t.w}×${t.h} · ${arr.length} files</small></h2>${strip}<div class="grid" style="--min:${t.w > t.h ? 420 : 230}px">${figs}</div></section>`);
    }
    fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(cfg.app?.name || 'Screenshots')}</title>
<style>:root{color-scheme:light dark}body{font:15px/1.4 -apple-system,system-ui,sans-serif;margin:0;padding:28px 32px;background:#f3f3f6;color:#111}
h1{margin:0 0 4px}p{margin:0 0 20px;color:#666}h2{margin:36px 0 14px;font-size:20px}h2 small{font-weight:500;color:#777;margin-left:8px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--min),1fr));gap:22px}figure{margin:0}
img{width:100%;display:block;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.10);background:#ddd}
img.strip{border-radius:10px;margin-bottom:6px}.cap{margin:10px 0 8px;font-size:13px;font-weight:600;color:#777}
figcaption{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:13px}figcaption span{color:#777;font-family:ui-monospace,monospace}
@media (prefers-color-scheme:dark){body{background:#111214;color:#eee}figcaption span,h2 small,p{color:#999}}</style>
<h1>${esc(cfg.app?.name || 'Screenshots')}</h1><p>${manifest.length} files · click any image for full resolution</p>${sections.join('')}`);
  }

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), files: manifest.map((m) => ({ ...m, file: path.relative(OUT, m.file) })), warnings, errors }, null, 2));
  console.log(`Rendered ${manifest.length} screenshots → ${OUT}`);
  console.log(`  targets: ${STILL_TARGETS.map((t) => t.id).join(', ')} | locales: ${LOCALES.join(', ')} | slides: ${slides.length}`);
  if (!has('no-preview')) console.log(`  previews: ${path.join(OUT, '_preview')} (open ${path.join(OUT, 'index.html')})`);
  for (const nt of [...new Set(notes)]) console.log(`  NOTE  ${nt}`);
  for (const w of [...new Set(warnings)]) console.log(`  WARN  ${w}`);
  for (const e of [...new Set(errors)]) console.log(`  ERROR ${e}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(2); });
