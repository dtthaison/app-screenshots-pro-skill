// Speed ramps: idle stretches of a screen recording play faster, taps and activity play at 1x.
// Everything works on source frames (the 1x extraction) and yields a map: output frame -> source frame.
// Pure; the diffs come from align.mjs frameDiffs.

// walk.mp4 (880x1912, 30 fps): the still tail's frames differ by 0-0.7 (alternating 0.7 / 0.1, encoder noise) while any
// motion starts at 1.2 and above, so 1.5 sits 2x over the noise. Starting value; AptusFIT tuning follows in Task 13.
export const IDLE_MAD = 1.5;

// Source frame ranges [from, to) that stay still for at least minSec. d[0] is 0 by definition and never counts.
export function idleRuns(diffs, fps, { threshold = IDLE_MAD, minSec = 0.5 } = {}) {
  const runs = [], min = Math.ceil(minSec * fps - 1e-9);
  let from = -1;
  for (let i = 1; i <= diffs.length; i++) {
    const still = i < diffs.length && diffs[i] < threshold;
    if (still && from < 0) from = i;
    else if (!still && from >= 0) { if (i - from >= min) runs.push([from, i]); from = -1; }
  }
  return runs;
}

// Playback rate per source frame: `max` deep inside idle runs, 1 elsewhere and from `before` s ahead of a tap to
// `after` s behind it. The rate moves to and from 1 over edgeSec, so a ramp never jumps.
export function rateCurve(n, fps, { idle, taps = [], max = 4, edgeSec = 0.3, before = 0.4, after = 0.8 }) {
  const slow = new Uint8Array(n).fill(1);                     // 1 = must stay at 1x
  for (const [a, b] of idle) for (let i = Math.max(0, a); i < Math.min(n, b); i++) slow[i] = 0;
  for (const t of taps) for (let i = Math.max(0, Math.ceil(t - before * fps)); i <= Math.min(n - 1, Math.floor(t + after * fps)); i++) slow[i] = 1;
  const edge = Math.max(1, Math.round(edgeSec * fps)), dist = new Float64Array(n);
  let d = Infinity;
  for (let i = 0; i < n; i++) { d = slow[i] ? 0 : d + 1; dist[i] = d; }
  d = Infinity;
  for (let i = n - 1; i >= 0; i--) { d = slow[i] ? 0 : d + 1; dist[i] = Math.min(dist[i], d); }
  return Float64Array.from(dist, (x) => 1 + (max - 1) * Math.min(1, x / edge));
}

// Source frame shown at each output frame; monotone, ends when the source position reaches n.
export function frameMap(rate) {
  const n = rate.length, out = [];
  for (let pos = 0; pos < n; pos += rate[Math.floor(pos)]) out.push(Math.floor(pos));
  return Int32Array.from(out);
}

export function linearMap(n, speed) {
  return Int32Array.from({ length: Math.ceil(n / speed - 1e-9) }, (_, k) => Math.min(n - 1, Math.floor(k * speed + 1e-9)));
}

// The smallest top speed in [1, 4] whose map fits the scene; at 1x it may fall short (the caller warns that the last frame holds).
export function fitMap(diffs, fps, { taps = [], targetFrames, idle, scene = '?' }) {
  const n = diffs.length, at = (max) => frameMap(rateCurve(n, fps, { idle, taps, max }));
  if (n <= targetFrames) return { map: at(1), max: 1 };
  let hi = 4, best = at(hi);
  if (best.length > targetFrames) throw new Error(`clip span is ${(n / fps).toFixed(1)}s at 4× but scene "${scene}" lasts ${(targetFrames / fps).toFixed(1)}s`);
  let lo = 1;
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2, m = at(mid);
    if (m.length <= targetFrames) { hi = mid; best = m; } else lo = mid;
  }
  return { map: best, max: hi };
}

// The first output frame showing source frame `srcFrame` or later (where a tap lands in the output).
export function outputFrame(map, srcFrame) {
  const i = map.findIndex((s) => s >= srcFrame);
  return i < 0 ? map.length : i;
}
