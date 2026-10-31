// Store-rule and concept checks for app preview videos. Every check name below has a section in
// references/video/store-rules.md ("Enforcing checks"), with its level and the targets it applies to.
// Levels never change the exit code except ERROR: WARN and NOTE exit 0.
import { CONCEPTS } from './concepts.mjs';
import { splitWords, wordCount } from './kinetic.mjs';
import { restLen } from './video.mjs';

const EPS = 1e-6;

// framed-device (WARN, preview-*)
export function framedDevice(target, dev) {
  if (!String(target?.id ?? '').startsWith('preview-') || !dev) return null;
  if (dev.model === 'none' && dev.style === 'frameless') return null;
  return 'device frames risk rejection under 2.3.4 — use full-screen or caption-band';
}

// price (WARN, Apple preview and creative targets): currency symbols and codes next to digits, and period words
const SYMBOLS = '$€£¥₩₫฿₹₱';
const CODES = 'USD|EUR|GBP|JPY|CNY|KRW|VND|THB|INR|PHP|MYR|IDR|AUD|CAD|CHF|BRL|MXN|SGD|HKD|TWD';
const PRICE = new RegExp([
  `[${SYMBOLS}]\\s?\\d`, `\\d\\s?[${SYMBOLS}]`,
  `(?<![\\p{L}])(?:RM|Rp|R\\$)\\s?\\d`,
  `\\b(?:${CODES})\\s?\\d`, `\\d\\s?(?:${CODES})\\b`,
  // a period word counts only right after an amount: a digit or a currency mark ("3x/week" is not a price)
  `(?:\\d|[${SYMBOLS}円元원])\\s?\\/\\s?(?:month|mo|year|yr|week|monat|mois|mes)(?![\\p{L}])`,
  `(?:\\d|[${SYMBOLS}円元원])\\s?\\/\\s?(?:月|tháng|年)`,
].join('|'), 'iu');
export function priceMatch(text) {
  const m = PRICE.exec(String(text ?? ''));
  return m ? `"${m[0].trim()}" looks like a price — prices and currencies vary by region (apple-prices)` : null;
}

// time-sensitive (NOTE, all video targets): a year, or a month name in the locale. Whole words, case-insensitive.
// An English "May" or "March" in ordinary prose is a false positive; acceptable because this check is only a NOTE.
const monthCache = new Map();
function monthNames(locale) {
  if (!monthCache.has(locale)) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat(locale, { month: 'long' }); } catch { fmt = new Intl.DateTimeFormat('en', { month: 'long' }); }
    monthCache.set(locale, [...new Set(Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2024, m, 15))))]);
  }
  return monthCache.get(locale);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function timeSensitive(text, locale = 'en') {
  const s = String(text ?? '');
  const year = /(?<!\d)(?:199\d|20\d\d)(?!\d)/.exec(s);
  if (year) return `"${year[0]}" dates the video — avoid years and seasons (apple-seasonal)`;
  for (const name of monthNames(locale)) {
    // CJK names ("10月") have no word breaks; elsewhere the name must stand alone
    const re = /\p{Script=Han}/u.test(name) ? new RegExp(escapeRe(name), 'iu')
      : new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, 'iu');
    if (re.test(s)) return `"${name}" dates the video — avoid months and seasons (apple-seasonal)`;
  }
  return null;
}

// play-phrases (WARN, play-promo)
export function playPhrase(text) {
  const m = /(?<![\p{L}\p{N}])(?:install now|download now|best|#1)(?![\p{L}\p{N}])/iu.exec(String(text ?? ''));
  return m ? `"${m[0]}" — Google Play asks for no calls to action or superlatives (play-phrases)` : null;
}

// reading-time (WARN): a caption stays up at least 0.5 s + 0.3 s per word
export const readingTime = (words) => 0.5 + 0.3 * words;

// iphone-only (ERROR): concept previews are recorded on iPhone in this release
export function iphoneOnly(target) {
  const id = String(target?.id ?? '');
  return id.startsWith('preview-') && id !== 'preview-iphone' ? 'iPhone only in this release (preview-iphone)' : null;
}

// hook-timing, beat-length, end-card (WARN, previews with a concept)
const LONG_OK = new Set(['hero-moment', 'ask-answer']);   // one beat of 5-8 s
export function conceptWarnings(conceptId, timeline, { hookVisibleAt = null, endCardIds = [] } = {}) {
  const out = [], scenes = timeline?.scenes ?? [];
  if (hookVisibleAt != null && hookVisibleAt > 1 + EPS) out.push(`hook-timing: the first caption is fully visible at ${hookVisibleAt.toFixed(1)}s — it should be by 1.0s`);
  const ends = new Set(endCardIds);
  // the end card comes last; without one the last scene is not judged as a beat
  let beatScenes = scenes;
  if (!ends.size && scenes.length) {
    out.push(`end-card: concept "${conceptId}": no end card — the last scene should use layout end-card`);
    beatScenes = scenes.slice(0, -1);
  }
  const allowLong = LONG_OK.has(conceptId) && CONCEPTS.some((c) => c.id === conceptId);
  let longSeen = false;
  for (const s of beatScenes) {
    if (ends.has(s.id)) continue;
    const d = s.duration ?? s.end - s.start;
    if (d < 2 - EPS) out.push(`beat-length: scene "${s.id}" lasts ${d}s — beats last 2-5s`);
    else if (d > 8 + EPS) out.push(`beat-length: scene "${s.id}" lasts ${d}s — even a hero beat stops at 8s`);
    else if (d > 5 + EPS) {
      if (allowLong && !longSeen) longSeen = true;
      else out.push(`beat-length: scene "${s.id}" lasts ${d}s — beats last 2-5s${allowLong ? ' (one beat may run to 8s)' : ''}`);
    }
  }
  scenes.forEach((s, i) => {
    if (!ends.has(s.id)) return;
    const d = s.duration ?? s.end - s.start;
    if (i !== scenes.length - 1) out.push(`end-card: scene "${s.id}" is not the last scene`);
    if (d < 1.5 - EPS || d > 3 + EPS) out.push(`end-card: scene "${s.id}" lasts ${d}s — the end card lasts 1.5-3s`);
  });
  return out;
}

// Every check for one preview × target × locale.
// scenes: [{ id, layout, dev, texts: [string], hasCaption }], in timeline order. -> { warnings, notes, errors }
export function storeChecks({ target, locale, preview, scenes, timeline, disclose = null }) {
  const warnings = [], notes = [], errors = [];
  const id = target.id;
  const applePreview = id.startsWith('preview-'), creative = target.family === 'creative';
  scenes.forEach((sc, i) => {
    const tl = timeline.scenes[i], at = `scene "${sc.id}"`;
    const fd = framedDevice(target, sc.dev);
    if (fd) warnings.push(`${at}: ${fd}`);
    for (const text of sc.texts) {
      const t = (msg, list) => msg && list.push(`${at}: ${msg}`);
      if (applePreview || (target.store === 'ios' && creative)) t(priceMatch(text), warnings);
      if (id === 'play-promo') t(playPhrase(text), warnings);
      t(timeSensitive(text, locale), notes);
    }
    if (sc.hasCaption && tl) {
      const need = readingTime(tl.words), nextDur = timeline.scenes[i + 1]?.transition?.dur ?? 0;
      // same model as the hook check: the caption is at rest from visibleAt and the next transition starts covering it at end - nextDur
      const visibleAt = Math.max(tl.start, tl.start - (tl.transition?.dur ?? 0) + restLen(tl)), shown = (tl.end - nextDur) - visibleAt;
      if (shown < need - EPS) warnings.push(`${at}: caption is fully visible for ${shown.toFixed(1)}s but ${tl.words} words need ${need.toFixed(1)}s to read`);
    }
    for (const l of tl?.labels ?? []) {
      const n = Math.max(1, wordCount(splitWords(l.text))), need = readingTime(n), shown = l.until - l.at;
      if (shown < need - EPS) warnings.push(`${at}: label "${l.text}" is up for ${shown.toFixed(1)}s but ${n} words need ${need.toFixed(1)}s to read`);
    }
  });
  if (preview.concept) {
    const first = scenes.findIndex((s) => s.hasCaption);
    const f = first >= 0 ? timeline.scenes[first] : null;
    // the entrance starts with the transition into the scene; restLen covers its delay and the caption motion
    const hookVisibleAt = f ? Math.max(f.start, f.start - (f.transition?.dur ?? 0) + restLen(f)) : null;
    const endCardIds = scenes.filter((s) => s.layout === 'end-card').map((s) => s.id);
    warnings.push(...conceptWarnings(preview.concept, timeline, { hookVisibleAt, endCardIds }));
    if (disclose && !endCardIds.length) notes.push(`owner.disclose is set ("${disclose}") but the preview has no end-card scene — show it in the footage or add an end card (apple-disclose)`);
  }
  return { warnings, notes, errors };
}

// A draft stands in for a missing recording: it must be a still image, never a clip or an html mock.
export const isStillImagePath = (p) => /\.(png|jpe?g|webp|gif|avif)$/i.test(String(p ?? '').split('?')[0]);
