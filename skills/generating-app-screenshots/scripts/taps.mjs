// The recording's tap sidecar (<id>.taps.json, written by record.mjs): reading it, picking a clip span by named marks,
// and the timing and colour of tap effects. Pure apart from readSidecar and tapColor.
import fs from 'node:fs';
import sharp from 'sharp';

// Tap effect values (references/video/motion.md#tap-effects). Radii are fractions of the screen width.
export const TAP_FX = {
  ripple: { dur: 0.6, r0: 0.03, r1: 0.12, a0: 0.5 },
  ring: { dur: 0.6, stroke: 3 },
  spotlight: { in: 0.2, hold: 0.6, out: 0.3, radius: 0.09, dim: 0.25 },
  swipe: { extra: 0.3 },
};
export const TAP_STYLES = ['ripple', 'ring', 'spotlight', 'none'];
export const SWIPE_DUR = 0.4;      // when a swipe event carries no dur

// scene, then preview, then theme, then ripple. style: null for "none"; explicit: whether anything set it (a missing
// sidecar is worth a NOTE only then). Throws on an unknown value.
export function resolveTap(...levels) {
  const explicit = levels.find((v) => v != null);
  if (explicit != null && !TAP_STYLES.includes(explicit)) throw new Error(`unknown tap "${explicit}" (${TAP_STYLES.join(', ')})`);
  return { explicit: explicit != null, style: explicit === 'none' ? null : explicit ?? 'ripple' };
}

export const sidecarPath = (mov) => mov.replace(/\.[^./\\]+$/, '') + '.taps.json';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const KINDS = ['tap', 'swipe', 'type'], ALIGNS = ['frame', 'window'];

// -> messages (empty when the sidecar has the shape record.mjs writes). A tap without x/y is valid: the step had no box.
export function validateSidecar(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ['not an object'];
  const bad = [];
  if (o.version == null) bad.push('missing version');
  else if (o.version !== 1) bad.push(`unsupported version ${JSON.stringify(o.version)} (this renderer reads version 1)`);
  for (const k of ['fps', 'width', 'height']) if (!(num(o[k]) && o[k] > 0)) bad.push(`${k} must be a positive number`);
  if (o.syncOffset != null && !num(o.syncOffset)) bad.push('syncOffset must be a number');
  if (o.marks == null || typeof o.marks !== 'object' || Array.isArray(o.marks)) bad.push('marks must be an object');
  else for (const [k, v] of Object.entries(o.marks)) if (!(num(v) && v >= 0)) bad.push(`mark "${k}" must be a time in seconds`);
  if (!Array.isArray(o.events)) { bad.push('events must be an array'); return bad; }
  o.events.forEach((e, i) => {
    const at = `events[${i}]`;
    if (!e || typeof e !== 'object') return bad.push(`${at} is not an object`);
    if (!(num(e.t) && e.t >= 0)) bad.push(`${at}.t must be a time in seconds`);
    if (!KINDS.includes(e.kind)) bad.push(`${at}.kind must be one of ${KINDS.join(', ')}`);
    if (e.align != null && !ALIGNS.includes(e.align)) bad.push(`${at}.align must be frame or window`);
    for (const k of ['x', 'y', 'x2', 'y2']) {
      if (e[k] == null) continue;
      if (!num(e[k]) || e[k] < 0 || e[k] > 1) bad.push(`${at}.${k} must be between 0 and 1 (got ${JSON.stringify(e[k])})`);
    }
    if (e.dur != null && !(num(e.dur) && e.dur >= 0)) bad.push(`${at}.dur must be a number of seconds`);
  });
  return bad;
}

// null when there is no sidecar; throws when it is unreadable or invalid.
export function readSidecar(mov) {
  const file = sidecarPath(mov);
  if (!fs.existsSync(file)) return null;
  let o;
  try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`invalid sidecar ${file}: ${e.message}`); }
  const bad = validateSidecar(o);
  if (bad.length) throw new Error(`invalid sidecar ${file}: ${bad.join('; ')}`);
  return o;
}

// [from, to) in seconds. `from` defaults to the start of the file; `to` to the next mark after `from`, else the end of the file.
// A mark may carry an offset, "start+2" or "swap-0.5": a mark sits on its tap, a scene often starts once the screen has loaded.
export function markSpan(sidecar, from, to, fileDuration) {
  const marks = sidecar.marks || {};
  const parse = (ref) => {
    const [, name, off] = /^(.*?)([+-]\d+(?:\.\d+)?)?$/.exec(ref);
    if (!Object.hasOwn(marks, name)) throw new Error(`unknown mark "${name}" (marks: ${Object.keys(marks).join(', ') || 'none'})`);
    return { at: marks[name], t: Math.round((marks[name] + Number(off || 0)) * 1000) / 1000 };
  };
  const look = (ref) => parse(ref).t;
  const start = from == null ? 0 : look(from);
  if (to != null) {
    const end = look(to);
    if (!(end > start)) throw new Error(`mark "${to}" (${end}s) is not after "${from ?? 'start'}" (${start}s)`);
    return { start, end };
  }
  // the next mark after the named one: "reorder-0.5" runs past the reorder mark, not up to it
  const after = from == null ? start : Math.max(start, parse(from).at);
  const next = Object.values(marks).filter((t) => t > after);
  return { start, end: next.length ? Math.min(...next) : fileDuration };
}

const inSpan = (e, start, end) => e.t >= start && e.t < end;

// Times (video seconds) of the taps and swipes in the span, with or without a position: the ramp keeps them at 1x.
export const activityInSpan = (sidecar, start, end) =>
  sidecar.events.filter((e) => (e.kind === 'tap' || e.kind === 'swipe') && inSpan(e, start, end)).map((e) => e.t);

// The events to draw. A tap without x/y (its step had no box or point) and a swipe without both ends are skipped.
export function tapsInSpan(sidecar, start, end) {
  const out = [];
  for (const e of sidecar.events) {
    if (!inSpan(e, start, end) || !num(e.x) || !num(e.y)) continue;
    if (e.kind === 'tap') out.push({ srcT: e.t, x: e.x, y: e.y, kind: 'tap', align: e.align });
    else if (e.kind === 'swipe' && num(e.x2) && num(e.y2)) out.push({ srcT: e.t, x: e.x, y: e.y, kind: 'swipe', x2: e.x2, y2: e.y2, dur: e.dur ?? SWIPE_DUR, align: e.align });
  }
  return out;
}

// 0..1 while the effect is on screen (linear in time over its whole life), otherwise -1. `at` and `t` share a clock.
export function tapProgress(at, t, kind, style, dur = SWIPE_DUR) {
  const fx = TAP_FX;
  const len = kind === 'swipe' ? dur + fx.swipe.extra : style === 'spotlight' ? fx.spotlight.in + fx.spotlight.hold + fx.spotlight.out : fx[style]?.dur;
  if (!(len > 0)) return -1;
  const p = (t - at) / len;
  return p < -1e-9 || p > 1 + 1e-9 ? -1 : Math.min(1, Math.max(0, p));
}

// White over dark screens, the accent over light ones: the mean luminance of the area around the tap (10% of the width).
export async function tapColor(frameFile, x, y, accent) {
  const { width, height } = await sharp(frameFile).metadata();
  const r = Math.max(1, Math.round(width * 0.05));
  const left = Math.min(width - 1, Math.max(0, Math.round(x * width) - r)), top = Math.min(height - 1, Math.max(0, Math.round(y * height) - r));
  const { data } = await sharp(frameFile).extract({ left, top, width: Math.min(2 * r, width - left), height: Math.min(2 * r, height - top) })
    .grayscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const v of data) sum += v;
  return sum / data.length < 128 ? '#ffffff' : accent;
}
