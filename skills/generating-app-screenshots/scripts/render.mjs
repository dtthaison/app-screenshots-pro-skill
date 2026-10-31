#!/usr/bin/env node
// Render store screenshots from screenshots.config.json with headless Chromium.
// Usage: node render.mjs <config.json> [--out dir] [--locales en-US,vi] [--targets ios-6.9,ipad-13]
//                       [--slides id1,id2] [--format png|jpeg|webp] [--fastlane] [--no-preview]
//                       [--previews id1,id2] [--scenes id1,id2] [--no-previews] [--only-previews] [--check] [--supersample n] [--video-supersample n]
// --no-preview skips the QA contact sheets and index.html; --no-previews skips the app preview (video) pass.
// --check runs every preview validation (and the store checks) without capturing frames; it implies --only-previews.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { resolveTarget, storeLocale, isRtl, scriptFont, isVideoTarget, checkTargetFormat } from './targets.mjs';
import { renderDevice, screenRect, screenRadius, MODELS, kindOf } from './devices.mjs';
import { PRESETS } from './presets.mjs';
import { buildLayout, canvasClass, screenAspectError, stillMeta } from './layouts.mjs';
import { patternElements, sceneSvg } from './panorama.mjs';
import { splitWords, wordsHtml, wordCount, resolveCaptionMotion } from './kinetic.mjs';
import { frameDiffs } from './align.mjs';
import { idleRuns, rateCurve, frameMap, linearMap, fitMap, outputFrame } from './ramp.mjs';
import { sidecarPath, readSidecar, markSpan, tapsInSpan, activityInSpan, tapColor, TAP_FX, resolveTap } from './taps.mjs';
import { handover, forPreview, networkMoments } from './report.mjs';
import { storeChecks, iphoneOnly, isStillImagePath } from './storecheck.mjs';
import { buildTimeline, stateAt, sameState, posterTime, checkDuration, timeCode, findFfmpeg, probeClip, clipKey, captureScale, extractClip, encodeArgs, startEncoder, filmstrip, selectScenes, missingClipWarning, DEFAULT_DURATION } from './video.mjs';

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
// app previews (video): --previews / --scenes pick previews and scenes by id; --only-previews skips the screenshot pass
const PREVIEW_FILTER = list(flag('previews'));
const SCENE_FILTER = list(flag('scenes'));
const NO_PREVIEWS = has('no-previews'), CHECK = has('check'), ONLY_PREVIEWS = has('only-previews') || CHECK;
let checked = 0;   // --check: jobs that passed every validation and were skipped before the encoder
// the screenshot pass renders stills only; video targets belong to the video pass
const STILL_TARGETS = ONLY_PREVIEWS ? [] : TARGETS.filter((t) => !isVideoTarget(t));
let VIDEO_TARGETS = NO_PREVIEWS ? [] : TARGETS.filter(isVideoTarget);   // emptied when ffmpeg is missing
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
// app previews render at 1x by default (capture speed) and have their own flag: --supersample is for stills only, as a
// 3x video capture is several times slower. Clips are extracted at the screen height this gives
const VIDEO_SCALE = Number(flag('video-supersample', cfg.videoSupersample ?? 1));
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
  const kinetic = el.motion === 'words' || el.motion === 'lines', kx = kinetic ? 'class="kx" ' : '';
  const eyebrow = str(c.eyebrow, locale), title = str(c.title, locale), sub = str(c.subtitle, locale);
  const ts = (c.titleSize ?? 7) * S, ss = (c.subtitleSize ?? (c.titleSize ?? 7) * 0.5) * S, es = (c.eyebrowSize ?? (c.titleSize ?? 7) * 0.36) * S;
  if (eyebrow) parts.push(`<div ${kx}data-fs="${es}" style="${c.subtitleFont ? `font-family:${fontStack(c.subtitleFont, locale)};` : ''}font-size:${px(es)};font-weight:${c.eyebrowWeight ?? 700};letter-spacing:.12em;text-transform:uppercase;color:${c.eyebrowColor || c.accent || c.color || '#fff'};margin-bottom:${px(es * 0.7)}">${rich(eyebrow)}</div>`);
  if (title) parts.push(`<div data-fs="${ts}" style="font-size:${px(ts)};font-weight:${c.titleWeight ?? 800};line-height:${c.lineHeight ?? 1.08};letter-spacing:${c.letterSpacing ?? '-0.02em'};color:${c.color || '#fff'};${c.uppercase ? 'text-transform:uppercase;' : ''}${c.textShadow ? `text-shadow:${c.textShadow};` : ''}text-wrap:balance">${kinetic ? wordsHtml(splitWords(title), rich) : rich(title)}</div>`);
  if (sub) parts.push(`<div ${kx}data-fs="${ss}" style="${c.subtitleFont ? `font-family:${fontStack(c.subtitleFont, locale)};` : ''}font-size:${px(ss)};font-weight:${c.subtitleWeight ?? 500};line-height:1.3;color:${c.subtitleColor || c.color || '#fff'};opacity:${c.subtitleOpacity ?? 0.85};margin-top:${px(ss * 0.6)};text-wrap:balance">${rich(sub)}</div>`);
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
      // a full-page (scrolling) screen still gives the device its one-viewport shape (frameless / window frames use it)
      const shape = el.fullPage ? resolveScreen(el.screen, locale, el.screenModel || el.model, el.landscape) : src;
      const meta = shape ? imageMeta.get(shape) : null;
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
  if (s.layout === 'end-card') {
    if (cfg.app?.icon) s.appIcon = cfg.app.icon;
    else notes.push(`end-card "${s.id}": no app.icon in the config — showing the name only`);
    s.appName = cfg.app?.name;
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
  const play = target.store === 'play';
  // a frameless target (chromebook, android-tv, android-xr) falls back to the store's phone, so an HTML mock is rendered once,
  // at the viewport of the frame that will show it (a different model here would queue a second mock render that never runs)
  const fallback = play ? 'android' : 'iphone';
  const src = e.screen && resolveScreen(e.screen, locale, target.model === 'none' ? fallback : target.model, e.landscape);
  let a = src && imageMeta.get(src)?.aspect;
  if (a && e.landscape) a = 1 / a;
  if (!a) return target.model === 'none' ? fallback : target.model;
  if (a < 1.45) return play ? 'android-tablet' : 'ipad';
  if (a < 1.85) return play ? 'android-tablet' : 'iphone-home';
  return play ? 'android' : 'iphone';
}

// ---------- previews (video) ----------
// One page per preview × video target × locale with every scene's DOM stacked (later scenes paint above), each in
// its own .slide so __fit's safe-area check measures it. Node computes stateAt(tl, t); window.__apply(state) shows it.
const isClip = (p) => /\.(mov|mp4|m4v|webm)$/i.test(p);
// elementHtml's default z-index for the animated roles: their wrappers get a transform/opacity (a stacking context),
// so the wrapper takes the element's z and the layering matches the still slide. 'other' wrappers get no z-index, so
// their children (blend shapes, two-part callouts) stack and blend in the scene exactly as on the still.
const ROLE_Z = { device: 2, caption: 3, label: 4 };

const clipFile = (src, locale) => { const c = screenCands(src.split('?')[0], locale).find((x) => fs.existsSync(abs(x.file))); return c ? abs(c.file) : null; };

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

// preview-brief.json next to the config (written by the recommend step); only owner.disclose is read here
const previewBrief = (() => { try { return JSON.parse(fs.readFileSync(path.join(BASE, 'preview-brief.json'), 'utf8')); } catch { return null; } })();

// -> [{ preview, target, locale, W, H, scenes: [{ scene, s, th, els, clip, overflow, labelEls }], timeline, warnings: Set }]
async function resolvePreviews({ ffmpeg }) {
  const jobs = [], vdef = theme.video || {};
  const picked = [cfg.previews ?? []].flat().filter((p) => !PREVIEW_FILTER || PREVIEW_FILTER.includes(p.id));
  for (const p0 of picked) for (const target of VIDEO_TARGETS.filter((t) => slideOn(p0, t))) for (const locale of LOCALES) {
    const W = target.w, H = target.h, warnSet = new Set();
    const preview = { transition: vdef.transition, ...specialize(p0, target, locale) };
    const tag = `${target.id}/${locale}/${preview.id}`;
    // concept previews are recorded on iPhone only in this release
    const iphoneMsg = preview.concept && iphoneOnly(target);
    if (iphoneMsg) { errors.push(`[${tag}] ${iphoneMsg}`); continue; }
    let list;
    try { list = selectScenes(p0.scenes, preview.scenes); } catch (e) { errors.push(`[${tag}] ${e.message}`); continue; }
    const { preset, ...pt } = preview.theme || {};
    const base = preview.theme ? layer(layer(theme, presetTheme(preset)), pt) : theme;
    const scenes = [], checkScenes = [], drafts = [], ramps = [];
    // --scenes: a preview without any of the named scenes is skipped, not an error
    const pick = list.filter((x) => slideOn(x, target) && (!SCENE_FILTER || SCENE_FILTER.includes(x?.id)));
    if (SCENE_FILTER && !pick.length) continue;
    for (const sc0 of pick) {
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
        } else if (isClip(src)) {
          // no recording yet: a draft still stands in, otherwise this is an error
          if (!scene.draft) throw new Error(`recording ${path.relative(BASE, abs(screenCands(src, locale)[0].file))} not found — run: node scripts/record.mjs ${path.relative(process.cwd(), path.resolve(configPath))} --preview ${preview.id}`);
          const draftHit = typeof scene.draft === 'string' && isStillImagePath(scene.draft) && screenCands(scene.draft, locale).some((c) => fs.existsSync(abs(c.file)));
          if (!draftHit) throw new Error(`draft ${scene.draft} for scene "${scene.id}" must be an existing still image`);
          scene.screen = scene.draft;
          drafts.push(scene.id);
        }
        await loadImageMeta([scene.screen, scene.screen2, scene.screen3, ...(scene.elements || []).map((e) => e.screen)], locale);
        const { s, th, els } = slideElements({ ...scene, labels: timed.length ? undefined : scene.labels }, target, locale, W, H, base);
        const dev = els.find((e) => e.type === 'device' && e.id === 'device');
        // full-screen / caption-band: judge the recording (or still) against the canvas
        // (HTML mock screens have no imageMeta and stay unchecked)
        const shownMeta = info ? imageMeta.get(scene.screen)
          : stillMeta(scene.screen, { cands: (f) => screenCands(f, locale), abs, exists: (f) => fs.existsSync(f), meta: imageMeta });
        const aspectMsg = shownMeta && screenAspectError(s.layout, shownMeta.w, shownMeta.h, W, H);
        if (aspectMsg) { if (s.layout === 'full-screen') throw new Error(aspectMsg); warnSet.add(aspectMsg); }
        let clip = null, overflow = 0, tapList = [], tapStyleUsed = null;
        if (info && dev) {
          const dur = Number.isFinite(scene.duration) ? scene.duration : DEFAULT_DURATION;
          const { speed = 1 } = scene.clip || {};
          const auto = speed === 'auto';
          // clip.from / clip.to name marks in the recording's sidecar; they replace clip.start / clip.end
          const named = scene.clip?.from != null || scene.clip?.to != null;
          if (named && (scene.clip.start != null || scene.clip.end != null)) throw new Error('clip.from/to and clip.start/end cannot be combined — use one or the other');
          let sidecar = null;
          try { sidecar = readSidecar(info.file); } catch (e) {
            if (named) throw e;
            warnSet.add(`${e.message} — taps skipped`);
          }
          // scene, then preview, then theme; ripple when none says otherwise. Only an explicit setting notes a missing sidecar.
          const { explicit, style: tapStyle } = resolveTap(scene.tap, preview.tap, vdef.tap);
          if (named && !sidecar) throw new Error(`clip marks need ${path.relative(BASE, sidecarPath(info.file))} — record with record.mjs`);
          if (explicit && tapStyle && !sidecar && !fs.existsSync(sidecarPath(info.file))) notes.push('taps skipped: no sidecar');
          const span = named ? markSpan(sidecar, scene.clip.from, scene.clip.to, info.duration) : { start: scene.clip?.start ?? 0, end: scene.clip?.end };
          const start = span.start;
          if (!auto && !(typeof speed === 'number' && speed > 0)) throw new Error(`clip.speed must be a number above 0 or "auto" (got ${JSON.stringify(speed)})`);
          // always extract at 1x: the map picks the frames. A number cuts at clip.end or the scene end; "auto" takes the whole span
          const end = auto ? Math.min(span.end ?? info.duration, info.duration) : Math.min(span.end ?? Infinity, info.duration, start + dur * speed);
          const height = Math.round(screenRect(dev, { W, H }).height * VIDEO_SCALE);
          const key = clipKey({ file: info.file, start, end, speed: 1, height });
          const ex = extractClip(ffmpeg, { file: info.file, start, end, speed: 1, height, dir: path.join(OUT, '.build', 'clips', key) });
          const rel = path.relative(BASE, info.file);
          if (!ex.count) throw new Error(`clip ${rel} gave no frames between ${start}s and ${end}s`);
          let map;
          if (!auto) map = linearMap(ex.count, speed);
          else {
            // diffs are computed once per extraction and cached next to the frames
            const cache = path.join(ex.dir, 'diffs.json');
            let diffs = fs.existsSync(cache) ? Float64Array.from(JSON.parse(fs.readFileSync(cache, 'utf8'))) : null;
            if (diffs?.length !== ex.count) { diffs = await frameDiffs(ex.files); fs.writeFileSync(cache, JSON.stringify([...diffs])); }
            // protected frames: taps and swipes of the sidecar, as source frames of this span
            const idle = idleRuns(diffs, ex.fps), taps = sidecar ? activityInSpan(sidecar, start, end).map((t) => Math.round((t - start) * ex.fps)) : [];
            if (Number.isFinite(scene.duration)) map = fitMap(diffs, ex.fps, { taps, targetFrames: Math.round(dur * ex.fps), idle, scene: scene.id }).map;
            else { map = frameMap(rateCurve(ex.count, ex.fps, { idle, taps })); scene.duration = map.length / ex.fps; }
          }
          const shown = scene.duration ?? dur;
          if (map.length / ex.fps < shown - 1 / ex.fps) warnSet.add(`clip ${rel} is ${(map.length / ex.fps).toFixed(1)}s but scene "${scene.id}" lasts ${shown}s — the last frame holds`);
          const ms = MODELS[dev.model]?.screen, want = dev.screenAspect || (ms && (dev.landscape ? 1 / ms : ms));
          if (want && Math.abs(info.height / info.width / want - 1) > 0.02) warnSet.add(`clip ${info.width}×${info.height} does not match the ${dev.model} screen (${want.toFixed(2)}:1) — it will be cropped`);
          // every element showing the clip (device2 / zoom / lens fall back to slide.screen, or name it) gets the first frame
          for (const e of els) if (e.screen === info.file || (typeof e.screen === 'string' && isClip(e.screen) && clipFile(e.screen, locale) === info.file)) e.screen = ex.files[0];
          dev.clipFrames = ex.files.map(fileUrl);
          imageMeta.set(ex.files[0], imageMeta.get(info.file));
          clip = { frames: map.length, fps: ex.fps, map };
          if (auto) ramps.push({ scene: scene.id, saved: Math.max(0, (ex.count - map.length) / ex.fps), from: start, to: end });   // fixed speeds are the author's choice
          // tap effects, in scene time: where the tap lands in the output after the ramp
          if (sidecar && tapStyle) {
            const accent = th.accent || '#ffcf5c';
            tapList = [];
            for (const e of tapsInSpan(sidecar, start, end)) {
              const src = Math.min(ex.count - 1, Math.max(0, Math.round((e.srcT - start) * ex.fps)));
              const at = outputFrame(map, src) / ex.fps;
              if (e.align === 'window') notes.push(`tap at ${e.srcT.toFixed(2)}s was timed from the command window (may be early or late)`);
              tapList.push({ at, x: e.x, y: e.y, kind: e.kind, ...(e.kind === 'swipe' && { x2: e.x2, y2: e.y2, dur: e.dur }), color: e.kind === 'tap' && tapStyle === 'spotlight' ? undefined : await tapColor(ex.files[src], e.x, e.y, accent) });
            }
            tapStyleUsed = tapStyle;
          }
        } else if (scene.motion === 'scroll' && dev) {
          // the whole mock / long capture pans inside the screen; overflow = how much taller than the screen it is
          // measured against the aspect the device shows: its screenAspect, the model's screen, else (frameless, windows)
          // the one-viewport render of the same screen
          dev.fullPage = true;
          const sm = dev.screenModel || dev.model;
          const full = resolveScreen(dev.screen, locale, sm, dev.landscape, { fullPage: true });
          const one = resolveScreen(dev.screen, locale, sm, dev.landscape);
          const a = full && imageMeta.get(full)?.aspect;
          const shown = dev.screenAspect || MODELS[dev.model]?.screen || (one && imageMeta.get(one)?.aspect);
          overflow = a && shown ? a / shown - 1 : 0;
        }
        for (const e of els) if (typeof e.screen === 'string' && isClip(e.screen)) throw new Error(`${e.screen}: a clip plays only on the scene's main device (id "device") — give ${e.id || e.type} a still`);
        // labels: badges under the caption (above a bottom caption), lined up with it, above the device edge (z 6)
        const cap = els.find((e) => e.type === 'caption');
        const capTitle = cap ? str(cap.title, locale) ?? '' : '';
        const captionMotion = resolveCaptionMotion(pick.indexOf(sc0), sp, preview, vdef, !!capTitle);
        let words = 1;
        if (cap) { cap.motion = captionMotion; words = Math.max(1, wordCount(splitWords(capTitle))); }
        const labelEls = timed.map((l, k) => ({ type: 'badge', id: `label-${k}`, text: l.text, x: cap?.x ?? 50, z: 6,
          y: !cap ? 6 : cap.y < 50 ? cap.y + (cap.h ?? 20) + 1 : cap.y - 6, size: 3.2, background: th.accent || '#ffcf5c', color: '#111', role: 'label', i: k }));
        scenes.push({ scene: { ...scene, labels: timed, captionMotion, words, taps: tapList, tapStyle: tapStyleUsed }, s, th, els, clip, overflow, labelEls });
        // texts the viewer reads, resolved for this locale; checked by storecheck.mjs
        checkScenes.push({ id: scene.id, layout: s.layout, dev, hasCaption: !!capTitle,
          texts: [scene.eyebrow, scene.title, scene.subtitle, ...timed.map((l) => l.text)].map((x) => str(x, locale)).filter((x) => typeof x === 'string' && x) });
      } catch (e) { errors.push(`[${tag}/${scene.id}] ${e.message}`); }
    }
    if (!scenes.length) { errors.push(`[${tag}] no scenes to render for this target`); continue; }
    // continuity: same layout and the main device in the same place as the scene before -> the device stays put
    const devOf = (e) => e.els.find((x) => x.type === 'device' && x.id === 'device');
    scenes.forEach((e, i) => {
      const p = scenes[i - 1], a = p && devOf(p), b = devOf(e);
      e.continuous = !!(a && b && (p.s.layout || 'text-top') === (e.s.layout || 'text-top')
        && ['x', 'y', 'w', 'model', 'landscape', 'rotate', 'tiltX', 'tiltY'].every((k) => (a[k] || 0) === (b[k] || 0)));
    });
    const timeline = buildTimeline(preview, scenes.map((e) => ({ ...e.scene, clip: e.clip || undefined, overflow: e.overflow, continuous: e.continuous })), { fps: target.video.fps });
    // a failed scene leaves the lists short; the build errors say why, so only check a complete set
    if (checkScenes.length === scenes.length && !timeline.errors.length) {
      const r = storeChecks({ target, locale, preview, scenes: checkScenes, timeline, disclose: previewBrief?.owner?.disclose });
      for (const w of r.warnings) warnSet.add(w);
      for (const n of r.notes) notes.push(`[${tag}] ${n}`);
    }
    if (drafts.length) notes.push(`[${tag}] draft stills stand in for missing recordings (${drafts.join(', ')}) — record the app for the final preview`);
    // moment: optional scene field naming a preview-brief.json moment id
    jobs.push({ preview, target, locale, W, H, scenes, timeline, warnings: warnSet, ramps, drafts, moments: scenes.map((e) => e.scene.moment).filter(Boolean) });
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

// Tap effects: a layer over the device's screen (clipped to its corners) with one child per tap, in tap order.
// applyState moves them; here they are placed at the tap, hidden, with everything applyState needs in data-*.
function tapsHtml(sc, dev, { W, H }) {
  if (!sc?.taps.length || !sc.tapStyle || !dev) return '';
  const r = screenRect(dev, { W, H }), fx = TAP_FX, f = (n) => Math.round(n * 100) / 100;
  const kids = sc.taps.map((t) => {
    const at = `data-kind="${t.kind}" data-x="${t.x}" data-y="${t.y}" data-x2="${t.x2 ?? ''}" data-y2="${t.y2 ?? ''}" data-dur="${t.dur ?? ''}"`;
    const base = 'position:absolute;opacity:0;pointer-events:none;';
    if (t.kind === 'swipe') {
      const d = r.width * 0.08;
      return `<div class="tap" ${at} style="${base}left:${f(t.x * r.width - d / 2)}px;top:${f(t.y * r.height - d / 2)}px;width:${f(d)}px;height:${f(d)}px;border-radius:50%;background:${t.color}"></div>`;
    }
    if (sc.tapStyle === 'spotlight') {
      const R = fx.spotlight.radius * r.width;
      return `<div class="tap" ${at} style="${base}inset:0;background:radial-gradient(circle at ${f(t.x * r.width)}px ${f(t.y * r.height)}px,transparent ${f(R)}px,rgba(0,0,0,${fx.spotlight.dim}) ${f(R + 1)}px)"></div>`;
    }
    const d = fx.ripple.r1 * 2 * r.width, paint = sc.tapStyle === 'ring' ? `border:${fx.ring.stroke}px solid ${t.color};box-sizing:border-box` : `background:${t.color}`;
    return `<div class="tap" ${at} style="${base}left:${f(t.x * r.width - d / 2)}px;top:${f(t.y * r.height - d / 2)}px;width:${f(d)}px;height:${f(d)}px;border-radius:50%;${paint}"></div>`;
  }).join('');
  return `<div class="taps" data-style="${sc.tapStyle}" style="position:absolute;left:${f(r.left)}px;top:${f(r.top)}px;width:${f(r.width)}px;height:${f(r.height)}px;overflow:hidden;border-radius:${f(screenRadius(dev, { W, H }))}px;z-index:2;pointer-events:none">${kids}</div>`;
}

function sceneHtml(job, { s, th, els, labelEls }, i) {
  const { W, H, locale } = job;
  const ctx = { W, H, slideId: s.id, theme: th, model: job.target.model };
  const bg = s.background ?? th.background;
  // fade-through and the loop fades go to the scene's background colour
  const veil = isObj(bg) && bg.color ? bg.color : typeof bg === 'string' && !/gradient|url\(/i.test(bg) ? bg : '#000';
  const wrap = (e, n) => {
    const role = e.role || (e.type === 'device' ? 'device' : e.type === 'caption' ? 'caption' : 'other');
    const z = role === 'other' ? '' : `;z-index:${e.z ?? ROLE_Z[role]}`;
    return `<div class="anim" data-role="${role}" data-i="${role === 'label' ? e.i : n}" style="position:absolute;inset:0${z}">${elementHtml(e, ctx, locale)}</div>`;
  };
  return `<div class="scene" data-scene="${esc(s.id)}" data-n="${i}" style="position:absolute;inset:0;visibility:hidden;opacity:0">${backgroundHtml(bg, W, H)}${[...els, ...labelEls].map(wrap).join('')}${tapsHtml(job.timeline.scenes[i], els.find((e) => e.type === 'device' && e.id === 'device'), { W, H })}<div class="veil" style="position:absolute;inset:0;background:${veil};opacity:0;z-index:9999"></div></div>`;
}

// Runs in the page (serialized with toString): show one stateAt() result; resolves once changed clip frames are decoded,
// with the number of frames that failed to decode.
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
    // kinetic caption: words (or lines, grouped by offsetTop) rise out of their clipping boxes; eyebrow and subtitle follow the last unit
    const { units, pop } = sc.caption;
    const kws = [...root.querySelectorAll('.kw')];
    if (units.length && kws.length) {
      const tops = [...new Set(kws.map((k) => k.offsetTop))].sort((x, y) => x - y);
      const byLine = window.__timeline.scenes.find((x) => x.id === sc.id)?.captionMotion === 'lines';
      kws.forEach((k, i) => {
        const p = units[byLine ? tops.indexOf(k.offsetTop) : i] ?? 1;
        k.firstElementChild.style.transform = `translateY(calc(${(1 - p) * 110}% + ${(1 - p) * 0.4}em))`;   // + the clipping box's padding, so a unit starts fully hidden
      });
      const last = units[byLine ? tops.length - 1 : kws.length - 1] ?? 1;
      for (const x of root.querySelectorAll('.kx')) { x.dataset.o0 ??= x.style.opacity || '1'; x.style.opacity = x.dataset.o0 * last; }
    }
    if (pop) {
      for (const f of root.querySelectorAll(':scope > .anim[data-role="caption"] .fit-inner')) { f.style.transform = `scale(${pop.scale})`; f.style.opacity = pop.opacity; }
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
    // tap effects (progress p per tap, -1 when off); the easing is written out here because this function is serialized
    const fxLayer = root.querySelector(':scope > .taps');
    if (fxLayer) {
      const fx = window.__tapfx, style = fxLayer.dataset.style, w = fxLayer.clientWidth;
      fxLayer.querySelectorAll(':scope > .tap').forEach((el, i) => {
        const p = sc.taps[i] ?? -1, d = el.dataset;
        if (!(p >= 0)) { el.style.opacity = 0; return; }
        const ease = 1 - 2 ** (-10 * p);                                  // expo-out
        if (d.kind === 'swipe') {
          const len = +d.dur + fx.swipe.extra, el_ = p * len, m = Math.min(1, el_ / +d.dur);
          const dx = ((+d.x2 - +d.x) * m) * w, dy = ((+d.y2 - +d.y) * m) * fxLayer.clientHeight;
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.opacity = 0.45 * (el_ <= +d.dur ? 1 : 1 - (el_ - +d.dur) / fx.swipe.extra);
        } else if (style === 'spotlight') {
          const s = fx.spotlight, e = p * (s.in + s.hold + s.out);
          el.style.opacity = e < s.in ? e / s.in : e < s.in + s.hold ? 1 : 1 - (e - s.in - s.hold) / s.out;
        } else if (style === 'ring') {
          // the stroke stays 3 px, so the ring grows by width/height, not by scale
          const r = (fx.ripple.r0 + (fx.ripple.r1 - fx.ripple.r0) * ease) * w;
          el.style.width = el.style.height = `${2 * r}px`;
          el.style.left = `${+d.x * w - r}px`; el.style.top = `${+d.y * fxLayer.clientHeight - r}px`;
          el.style.opacity = 1 - p;
        } else {
          el.style.transform = `scale(${(fx.ripple.r0 + (fx.ripple.r1 - fx.ripple.r0) * ease) / fx.ripple.r1})`;
          el.style.opacity = fx.ripple.a0 * (1 - p);
        }
      });
    }
    const veil = root.querySelector(':scope > .veil');
    if (veil) veil.style.opacity = sc.veil;
  }
  const failed = await Promise.all(changed.map((i) => i.decode().then(() => 0, () => 1)));
  return failed.reduce((a, b) => a + b, 0);
}

// pageHtml (fonts, __fit) + the stacked scenes + __apply; __timeline is there for debugging in a browser
function previewPageHtml(job, bodies, { W, H, safe }) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const clips = Object.fromEntries(job.scenes.map((e) => [e.s.id, e.els.find((x) => x.type === 'device' && x.id === 'device')?.clipFrames]).filter(([, f]) => f));
  const body = bodies.map((b) => `<div class="slide" style="left:0;width:${W}px">${b}</div>`).join('')
    + `<script>window.__clips = ${json(clips)};\nwindow.__timeline = ${json(job.timeline)};\nwindow.__tapfx = ${json(TAP_FX)};\nwindow.__apply = ${applyState.toString()};</script>`;
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
    const fit = await page.evaluate((id) => window.__fit(`.scene[data-scene="${CSS.escape(id)}"]`), sc.id);
    reportFit(fit, `${job.target.id}/${job.locale}/${job.preview.id}/${sc.id}`);
  }
}

// Capture: every frame's stateAt() -> __apply -> JPEG screenshot -> ffmpeg stdin; a frame whose state equals the last
// one re-sends the last buffer. Then the poster PNG and the QA filmstrip (one kept frame per second).
// -> [{ job, tag, index, file, poster, posterTime, posterWarnings, filmstrip, stills }]
async function renderPreviews(browser, jobs, ffmpeg) {
  const done = [], pages = {}, counter = {};
  const pageFor = async (scale) => (pages[scale] ||= await browser.newPage({ deviceScaleFactor: scale }));
  // store count per target × locale before capture: the extras (config order) are not rendered
  const perKey = {};
  for (const job of jobs) (perKey[`${job.target.id}|${job.locale}`] ||= []).push(job);
  for (const [k, arr] of Object.entries(perKey)) if (arr.length > arr[0].target.max) errors.push(`${k}: ${arr.length} previews, store max is ${arr[0].target.max}`);
  for (const job of jobs) {
    const { target: t, locale, W, H, preview, timeline: tl } = job;
    const tag = `${t.id}/${locale}/${preview.id}`, slug = t.id.replace('@', '_');
    for (const w of job.warnings) warn(`[${tag}] ${w}`);
    if (perKey[`${t.id}|${locale}`].indexOf(job) >= t.max) continue;
    if (tl.errors.length) { for (const e of tl.errors) errors.push(`[${tag}] ${e}`); continue; }
    // duration out of the target's range: error before capture (a --scenes run is partial, so it is not checked)
    const long = checkDuration(tl, t, { sceneFilter: !!SCENE_FILTER });
    if (long.length) { for (const e of long) errors.push(`[${tag}] ${e}`); continue; }
    const music = typeof preview.music === 'string' ? { src: preview.music } : preview.music;
    if (music && !fs.existsSync(abs(music.src))) { errors.push(`[${tag}] music not found: ${music.src}`); continue; }
    // renderScale (custom video targets, or byTarget on the preview) renders smaller and lets ffmpeg upscale
    const rs = Number(preview.renderScale ?? t.renderScale ?? 1), scale = captureScale(VIDEO_SCALE * rs, W, H);
    if (rs !== 1) notes.push(`[${tag}] rendered at ${rs}× — drafts only`);
    const html = path.join(OUT, '.build', `preview.${slug}.${locale}.${preview.id}.html`);
    fs.writeFileSync(html, previewPage(job));
    const page = await pageFor(scale);
    await page.setViewportSize({ width: W, height: H });
    // a page that did not load would encode a blank video
    const failedLoad = await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 60000 }).then(() => null, (e) => e);
    if (failedLoad) { errors.push(`[${tag}] page failed to load: ${failedLoad.message.split('\n')[0]}`); continue; }
    await fitScenes(page, job);
    if (CHECK) { checked++; continue; }   // everything validated; no frames, no encoder

    const index = (counter[`${t.id}|${locale}`] = (counter[`${t.id}|${locale}`] || 0) + 1);
    const dir = path.join(OUT, slug, locale), base = `${String(index).padStart(2, '0')}_${preview.id}`;
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${base}.mp4`), poster = path.join(dir, `${base}.poster.png`);
    const fps = tl.fps, step = Math.max(1, Math.round(tl.frames / 10)), frames = [];
    const enc = startEncoder(ffmpeg, encodeArgs({ fps, width: W, height: H, out: file, total: tl.total,
      music: music && { ...music, src: abs(music.src) }, scaleTo: scale !== 1 ? { w: W, h: H } : undefined }));
    const t0 = Date.now();
    let prev = null, buf = null, failed = 0;
    try {
      for (let f = 0; f < tl.frames; f++) {
        const st = stateAt(tl, f / fps);
        if (!prev || !sameState(st, prev)) {
          failed += await page.evaluate((x) => window.__apply(x), st);
          buf = await page.screenshot({ type: 'jpeg', quality: 95 });
        }
        await enc.write(buf);
        if (f % fps === 0) frames.push({ t: f / fps, buf });
        prev = st;
        if ((f + 1) % step === 0) console.log(`  [${tag}] ${Math.round(((f + 1) / tl.frames) * 100)}% (${f + 1}/${tl.frames} frames)`);
      }
      await enc.end();
    } catch (e) {
      await enc.kill(); fs.rmSync(file, { force: true });
      errors.push(`[${tag}] ${e.message}`); continue;
    }
    const secs = (Date.now() - t0) / 1000;
    if (failed) warn(`[${tag}] ${failed} frames failed to decode — check the clip extraction`);

    const pt = posterTime(tl, preview.poster);
    await page.evaluate((x) => window.__apply(x), stateAt(tl, pt.time));
    await toStoreImage(await page.screenshot({ type: 'png' }), poster, W, H, 'png');
    let strip = null;
    if (!has('no-preview')) {
      strip = path.join(OUT, '_preview', `${slug}__${locale}__${preview.id}.jpg`);
      fs.mkdirSync(path.dirname(strip), { recursive: true });
      await filmstrip(frames, strip);
    }
    console.log(`  ${tag}: ${tl.total.toFixed(1)}s video in ${Math.round(secs)}s → ${path.relative(OUT, file)} (poster ${timeCode(pt.time, fps)})`);
    done.push({ job, tag, index, file, poster, posterTime: pt.time, posterWarnings: pt.warnings, filmstrip: strip, stills: !job.scenes.some((e) => e.clip) });
  }
  for (const p of Object.values(pages)) await p.close();
  return done;
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

async function toStoreImage(buf, file, w, h, format = FORMAT) {
  // supersampled capture -> exact store size with a high-quality filter; stores reject alpha
  let img = sharp(buf).resize(w, h, { kernel: 'lanczos3', fit: 'fill' }).flatten({ background: '#000000' }).removeAlpha();
  if (format === 'jpeg' || format === 'jpg') img = img.jpeg({ quality: 92, chromaSubsampling: '4:4:4' });
  else if (format === 'webp') img = img.webp({ quality: 92 });
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
  // wrong format for a target (e.g. PNG-only creative assets): fail before launching Chrome
  for (const t of STILL_TARGETS) { const e = checkTargetFormat(t, FORMAT); if (e) errors.push(e); }
  // video targets need a previews entry, ffmpeg, and --previews / --scenes ids that exist
  let ffmpeg = null, noFfmpeg = null;
  if (VIDEO_TARGETS.length) {
    const prevs = [cfg.previews ?? []].flat();
    if (!prevs.length) errors.push(`no "previews" in the config, but video target ${VIDEO_TARGETS.map((t) => t.id).join(', ')} was requested`);
    else {
      const ids = prevs.map((p) => p.id);
      for (const id of PREVIEW_FILTER || []) if (!ids.includes(id)) errors.push(`--previews: unknown preview "${id}" (previews: ${ids.join(', ')})`);
      const sceneIds = new Set(prevs.flatMap((p) => [p.scenes, ...[p.byTarget, p.byLocale].flatMap((o) => Object.values(o || {}).map((v) => v?.scenes))]).flat().filter(isObj).map((x) => x.id));
      for (const id of SCENE_FILTER || []) if (!sceneIds.has(id)) errors.push(`--scenes: no preview has a scene "${id}"`);
      try {
        ffmpeg = findFfmpeg();
        if (!ffmpeg) noFfmpeg = 'previews need ffmpeg: npm install (ffmpeg-static), set FFMPEG_PATH, or brew install ffmpeg';
      } catch (e) { noFfmpeg = e.message; }   // FFMPEG_PATH set but missing
      // no ffmpeg: the screenshot pass still renders, the video targets are dropped, and the run exits 1 at the end
      if (noFfmpeg) {
        noFfmpeg += ' — or run with --no-previews';
        if (!STILL_TARGETS.length) errors.push(noFfmpeg);
        VIDEO_TARGETS = [];
      }
    }
  }
  if (ONLY_PREVIEWS && !VIDEO_TARGETS.length) warn('--only-previews: no video targets in this run (add preview-iphone, … to "targets")');
  if (errors.length) { for (const e of errors) console.log(`  ERROR ${e}`); process.exit(1); }
  fs.mkdirSync(path.join(OUT, '.build'), { recursive: true });
  const slides = (cfg.slides || []).filter((s) => !SLIDE_FILTER || SLIDE_FILTER.includes(s.id));
  if (!slides.length && STILL_TARGETS.length) throw new Error('No slides to render');

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
  for (const p of Object.values(pages)) await p.close();

  // ---------- app previews (video) ----------
  if (noFfmpeg) errors.push(noFfmpeg);   // after the mock re-render, which resets errors
  const previews = ffmpeg ? await renderPreviews(browser, await previewJobs(browser, { ffmpeg }), ffmpeg) : [];
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
  // duration and count were checked before capture (renderPreviews); a file over the size limit is an error and is
  // left out of the fastlane copies and the manifest
  const pvKey = {};
  for (const p of previews) {
    const { target: t, locale, preview } = p.job;
    if (fs.statSync(p.file).size > t.video.maxMB * 1024 * 1024) { errors.push(`${p.file}: larger than ${t.video.maxMB} MB`); p.failed = true; }
    if (preview.music && t.baseId === 'search-video') warn(`[${p.tag}] search results videos cannot be unmuted — music is wasted bytes`);
    if (p.stills && t.family === 'creative') notes.push(`[${t.id}/${locale}/${preview.id}] ${preview.id}.mp4 is a draft: every scene is a still; Apple wants the main flow recorded (see reading-the-app.md §2b)`);
    else if (p.stills && t.asc) notes.push(`[${p.tag}] every scene is a still — fine for a draft; record the app for the final preview`);
    for (const w of p.posterWarnings) warn(`[${p.tag}] ${w}`);
    (pvKey[`${t.id}|${locale}`] ||= []).push(p);
  }
  if (SCENE_FILTER && previews.length) notes.push('--scenes given: duration check skipped');
  const shipped = previews.filter((p) => !p.failed);

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
        if (!t.playDir) { notes.push(`${t.id}: Play Console has no fastlane folder for this form factor — upload by hand (out/${t.id.replace('@', '_')}/)`); continue; }
        dest = ['featureGraphic', 'tvBanner'].includes(t.playDir) ? path.join(base, `${t.playDir}.png`) : path.join(base, t.playDir, `${m.index}_${m.locale}.png`);
      } else continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(m.file, dest);
    }
    // deliver uploads app previews from app-previews/<locale>/, device type from the filename (IPHONE_67, ...)
    for (const p of shipped) {
      const t = p.job.target, loc = storeLocale(p.job.locale, 'ios');
      let dest;
      if (t.asc) dest = path.join(OUT, 'fastlane', 'app-previews', loc, `${String(p.index).padStart(2, '0')}_${t.asc}_${p.job.preview.id}.mp4`);
      else if (t.family === 'creative') {
        dest = path.join(OUT, 'fastlane', 'creative', loc, `${t.baseId}_${p.job.preview.id}.mp4`);
        notes.push('creative assets (header, search, events) are not uploaded by deliver — add them in App Store Connect');
      } else continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(p.file, dest);
    }
    // deliver sets one poster time (preview_frame_time_code, default 5 s) for the whole upload
    const codes = [...new Set(shipped.filter((p) => p.job.target.asc).map((p) => timeCode(p.posterTime, p.job.timeline.fps)))];
    if (codes.length > 1) warn(`previews in this run have different poster times (${codes.join(', ')}) — deliver takes one preview_frame_time_code for the whole upload`);
    const code = shipped.filter((p) => p.job.target.asc).map((p) => timeCode(p.posterTime, p.job.timeline.fps)).find((c, i, all) => c !== timeCode(5, shipped.filter((q) => q.job.target.asc)[i].job.timeline.fps));
    if (code) notes.push(`deliver: pass preview_frame_time_code "${code}"`);
  }

  // ---------- previews: one contact sheet per target x locale ----------
  if (!has('no-preview')) {
    const pdir = path.join(OUT, '_preview');
    fs.mkdirSync(pdir, { recursive: true });
    const sections = [];
    // app previews first, as on the store: the video, its filmstrip and the poster time to set in App Store Connect
    for (const [k, arr] of Object.entries(pvKey)) {
      const t = arr[0].job.target, rel = (f) => esc(path.relative(OUT, f));
      const vids = arr.map((p) => `<div class="pv"><video controls loop muted playsinline src="${rel(p.file)}"></video><div><b>${String(p.index).padStart(2, '0')} · ${esc(p.job.preview.id)}</b> <span class="cap">${p.job.timeline.total}s · poster at ${p.posterTime.toFixed(2)} s</span>${p.filmstrip ? `<a href="${rel(p.filmstrip)}" target="_blank"><img class="strip" src="${rel(p.filmstrip)}"></a>` : ''}</div></div>`).join('');
      sections.push(`<section><h2>Preview · ${esc(t.label || t.id)} <small>${esc(k.split('|')[1])} · ${t.w}×${t.h} · ${arr.length} videos</small></h2>${vids}</section>`);
    }
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
.pv{display:grid;grid-template-columns:minmax(200px,280px) 1fr;gap:22px;align-items:start;margin-bottom:22px}.pv video{width:100%;border-radius:14px;background:#000}.pv img.strip{margin-top:10px}
@media (max-width:700px){.pv{grid-template-columns:1fr}}
figcaption{display:flex;justify-content:space-between;gap:8px;margin-top:8px;font-size:13px}figcaption span{color:#777;font-family:ui-monospace,monospace}
@media (prefers-color-scheme:dark){body{background:#111214;color:#eee}figcaption span,h2 small,p{color:#999}}</style>
<h1>${esc(cfg.app?.name || 'Screenshots')}</h1><p>${manifest.length} files${previews.length ? ` · ${previews.length} previews` : ''} · click any image for full resolution</p>${sections.join('')}`);
  }

  // hand-over report per preview (not under --check: nothing was rendered)
  if (!CHECK && shipped.length) {
    const rdir = path.join(OUT, '_preview');
    for (const id of [...new Set(shipped.map((p) => p.job.preview.id))]) {
      try {
      fs.mkdirSync(rdir, { recursive: true });
      const mine = shipped.filter((p) => p.job.preview.id === id), first = mine[0].job;   // ramps depend on the clip, not on caption or locale, so Cut and the beats come from the first job
      const pw = forPreview(warnings, id), pn = forPreview(notes, id);
      const results = mine.map((p) => ({ tag: p.tag, file: path.relative(process.cwd(), p.file), length: p.job.timeline.total, posterTime: p.posterTime, fps: p.job.timeline.fps,
        warnings: new Set(pw.filter((w) => w.startsWith(`[${p.tag}`))).size }));
      const beats = first.timeline.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end }));
      const md = handover({ preview: first.preview, concept: first.preview.concept, results, beats, ramps: first.ramps, warnings: [...new Set(pw)], notes: [...new Set(pn)],
        locales: LOCALES, moments: networkMoments(previewBrief, [...new Set(mine.flatMap((p) => p.job.moments))]), drafts: [...new Set(mine.flatMap((p) => p.job.drafts))] });
      const rf = path.join(rdir, `${id}.report.md`);
      fs.writeFileSync(rf, md);
      const saved = first.ramps.reduce((a, r) => a + r.saved, 0), nw = results.reduce((a, r) => a + r.warnings, 0);
      console.log(`  report ${path.relative(OUT, rf)}: ${results.length} files, ${nw ? `${nw} WARN` : 'clean'}${saved ? `, ${saved.toFixed(1)}s cut` : ''}`);
      } catch (e) { warn(`report ${id} not written: ${e.message}`); }
    }
  }

  // previews: JSON-safe fields only (target.video can hold Infinity)
  const pvJson = shipped.map((p) => ({ id: p.job.preview.id, target: p.job.target.id, locale: p.job.locale, index: p.index,
    file: path.relative(OUT, p.file), poster: path.relative(OUT, p.poster), posterTime: p.posterTime, duration: p.job.timeline.total }));
  if (CHECK) {
    for (const nt of [...new Set(notes)]) console.log(`  NOTE  ${nt}`);
    for (const w of [...new Set(warnings)]) console.log(`  WARN  ${w}`);
    for (const e of [...new Set(errors)]) console.log(`  ERROR ${e}`);
    console.log(`checked ${checked} previews (no frames captured)`);
    process.exit(errors.length ? 1 : 0);
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), files: manifest.map((m) => ({ ...m, file: path.relative(OUT, m.file) })), previews: pvJson, warnings, errors }, null, 2));
  console.log(`Rendered ${manifest.length} screenshots + ${previews.length} previews → ${OUT}`);
  console.log(`  targets: ${[...STILL_TARGETS, ...VIDEO_TARGETS].map((t) => t.id).join(', ')} | locales: ${LOCALES.join(', ')} | slides: ${STILL_TARGETS.length ? slides.length : 0}${previews.length ? ` | previews: ${[...new Set(previews.map((p) => p.job.preview.id))].join(', ')}` : ''}`);
  if (!has('no-preview')) console.log(`  previews: ${path.join(OUT, '_preview')} (open ${path.join(OUT, 'index.html')})`);
  for (const nt of [...new Set(notes)]) console.log(`  NOTE  ${nt}`);
  for (const w of [...new Set(warnings)]) console.log(`  WARN  ${w}`);
  for (const e of [...new Set(errors)]) console.log(`  ERROR ${e}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(2); });
