// How render.mjs refers to things: locales, files, screens, CSS urls, fastlane paths. Pure (render.mjs parses argv on import, this does not).
import path from 'node:path';
import { createHash } from 'node:crypto';
import { storeLocale } from './targets.mjs';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// ---------- locales ----------
// lookup order for one locale: itself, then its language ("en-US" finds strings stored under "en", e.g. an .xcstrings sourceLanguage)
export const localeChain = (locale, def) => [...new Set([locale, locale.split('-')[0], ...(def ? [def, def.split('-')[0]] : [])])];

// Marketing copy for a locale. Inline { locale: text } objects and "@key" strings look up the locale, its language, then the
// default locale and its language. `strings` is { locale: { key: text } }; a missing key warns, a key in no locale is an error.
export function localize(v, locale, { strings, defaultLocale, warn, error }) {
  if (v == null) return null;
  if (isObj(v)) return localeChain(locale, defaultLocale).map((l) => v[l]).find((x) => x != null) ?? null;
  if (typeof v !== 'string' || !v.startsWith('@')) return v;
  const key = v.slice(1);
  const hit = (chain) => chain.map((l) => strings[l]?.[key]).find((x) => x != null);
  const own = hit(localeChain(locale));
  if (own != null) return own;
  warn(`[${locale}] missing translation "${key}" — fell back to ${defaultLocale}`);
  const fb = hit(localeChain(defaultLocale));
  if (fb == null) error(`string key "${key}" not found in any locale`);
  return fb ?? key;
}

// ---------- html mock screens ----------
// File name of a rendered html mock in .build/screens. The hash of the source path (and query) keeps screens/one/index.html
// and screens/two/index.html apart; the rest stays readable.
export function mockOutName({ found, query = '', fullPage = false, locale, vw, vh }) {
  const tag = query ? `.${query.replace(/[^a-z0-9]+/gi, '_')}` : '';
  const id = createHash('sha1').update(`${path.resolve(found)}?${query}`).digest('hex').slice(0, 6);
  return `${path.basename(found, path.extname(found))}${tag}${fullPage ? '.full' : ''}.${id}.${locale}.${vw}x${vh}.png`;
}

// ---------- CSS ----------
// A file URL that is safe inside url('…'): pathToFileURL leaves ' ( ) raw, so "~/Son's Apps/bg.png" ended the url early.
// The percent forms name the same file.
export const cssUrl = (href) => href.replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// ---------- screens ----------
// Every image a slide (or preview scene) can show, for the metadata pass that picks frames and sizes zoom crops.
// layouts.mjs reads screen/screen2/screen3, screens[] (mosaic tiles) and the zoom sources of pop-out, lens and layers.
export function screenRefs(s) {
  const arr = (a) => (Array.isArray(a) ? a : []);
  const all = [s.screen, s.screen2, s.screen3, ...arr(s.screens), ...arr(s.popouts).map((p) => p?.screen), s.lens?.screen, ...arr(s.layers).map((l) => l?.screen), ...arr(s.elements).map((e) => e?.screen)];
  return [...new Set(all.filter((x) => typeof x === 'string' && x))];
}

// ---------- fastlane ----------
// Destination of one rendered still in out/fastlane (deliver / supply), or null when the store has no folder for it.
// The file keeps its own extension: --format jpeg writes .jpeg, and JPEG bytes in a .png name are a broken upload.
export function fastlanePath(out, t, m) {
  const ext = path.extname(m.file);
  if (t.family === 'creative') return path.join(out, 'fastlane', 'creative', storeLocale(m.locale, 'ios'), `${t.baseId}_${m.slide}${ext}`);
  if (t.store === 'ios') return path.join(out, 'fastlane', 'screenshots', storeLocale(m.locale, 'ios'), `${String(m.index).padStart(2, '0')}_${t.baseId}_${m.slide}${ext}`);
  if (t.store !== 'play' || !t.playDir) return null;
  const base = path.join(out, 'fastlane', 'metadata', 'android', storeLocale(m.locale, 'play'), 'images');
  return ['featureGraphic', 'tvBanner'].includes(t.playDir) ? path.join(base, `${t.playDir}${ext}`) : path.join(base, t.playDir, `${m.index}_${m.locale}${ext}`);
}
