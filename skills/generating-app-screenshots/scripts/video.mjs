// Timeline math for app previews: scenes -> timings, and "what does every scene look
// like at time t". Pure (no DOM, no ffmpeg) so it is unit-testable; the renderer
// applies stateAt() to a page that has every scene stacked (later scenes paint above).
export const FPS = 30;
export const TRANSITIONS = { crossfade: 0.5, push: 0.6, cut: 0, 'fade-through': 0.6 };
export const ENTRANCES = {
  rise: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0.06 },
  fade: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0 },
  none: null,
};
const DEFAULT_DURATION = 4, FADE_IN = 0.4, FADE_OUT = 0.6, LABEL_FADE = 0.3, DRIFT = 1.03, SCROLL_MIN = 0.05;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (p) => 1 - (1 - clamp01(p)) ** 3;                 // ease-out cubic
const prog = (t, from, len) => (len > 0 ? ease((t - from) / len) : t >= from ? 1 : 0);
const entranceLen = (e) => (e ? e.delay + e.caption : 0);      // device (0.6) ends with the caption (0.1 + 0.5)

export function buildTimeline(preview = {}, scenes = [], { fps = FPS } = {}) {
  const errors = [];
  const soft = (preview.loop ?? 'soft') !== 'hard';
  let cursor = 0;
  const out = scenes.map((s, index) => {
    const duration = Number.isFinite(s.duration) ? s.duration : DEFAULT_DURATION;
    if (!s.id) errors.push(`scene ${index + 1}: missing id`);
    if (duration <= 0) errors.push(`scene "${s.id ?? index + 1}": duration must be above 0 (got ${duration}s)`);
    const kind = index === 0 ? 'cut' : s.transition ?? preview.transition ?? 'crossfade';
    const start = cursor; cursor += duration;
    const entrance = s.in in ENTRANCES ? s.in : 'rise';
    const motion = s.clip ? 'none' : s.motion === 'scroll' && !(s.overflow >= SCROLL_MIN) ? 'drift' : s.motion ?? 'drift';
    return {
      id: s.id, index, start, end: cursor, duration, transition: { kind, dur: TRANSITIONS[kind] ?? 0 },
      entrance, motion, clip: s.clip ?? null, overflow: s.overflow ?? 0,
      labels: (s.labels ?? []).map((l) => ({ at: l.at ?? 0, until: l.until ?? duration, text: l.text })),
      fadeIn: 0, fadeOut: 0,
    };
  });
  if (soft && out.length) { out[0].fadeIn = FADE_IN; out.at(-1).fadeOut = FADE_OUT; }
  // a transition needs room inside both scenes it joins
  out.forEach((s, i) => {
    const mine = s.transition, next = out[i + 1]?.transition;
    for (const tr of [i > 0 && mine, next]) {
      if (tr && tr.dur > 0 && s.duration < tr.dur) errors.push(`scene "${s.id}": duration ${s.duration}s is shorter than its ${tr.kind} transition (${tr.dur}s)`);
    }
  });
  return { fps, total: cursor, frames: Math.round(cursor * fps), scenes: out, errors };
}

export function stateAt(tl, t) {
  return {
    scenes: tl.scenes.map((s, i) => {
      const { kind, dur } = s.transition, next = tl.scenes[i + 1]?.transition ?? { kind: 'cut', dur: 0 };
      const a = s.start - dur;                                  // incoming window [a, start]
      const b = s.end - next.dur;                               // outgoing window [b, end]
      const thru = kind === 'fade-through', nThru = next.kind === 'fade-through';
      const visible = t >= (thru ? a + dur / 2 : a) && t <= (nThru ? b + next.dur / 2 : s.end);

      let opacity = visible ? 1 : 0, tx = 0, veil = 0;
      if (kind === 'crossfade') opacity *= prog(t, a, dur);
      if (kind === 'push' && t < s.start) tx = 1 - prog(t, a, dur);
      if (next.kind === 'push' && t > b) tx = -prog(t, b, next.dur);
      if (thru) veil = Math.max(veil, 1 - prog(t, a + dur / 2, dur / 2));
      if (nThru) veil = Math.max(veil, prog(t, b, next.dur / 2));
      if (s.fadeIn) veil = Math.max(veil, 1 - prog(t, 0, s.fadeIn));
      if (s.fadeOut) veil = Math.max(veil, prog(t, tl.total - s.fadeOut, s.fadeOut));

      // entrance is timed from the start of the transition into the scene
      const e = ENTRANCES[s.entrance];
      const dev = e ? prog(t, a, e.device) : 1, cap = e ? prog(t, a + e.delay, e.caption) : 1;
      const rise = e?.rise ?? 0;

      const p = prog(t, s.start, s.duration);
      const frame = s.clip ? Math.min(s.clip.frames - 1, Math.max(0, Math.floor((t - s.start) * s.clip.fps))) : null;
      return {
        id: s.id, visible, opacity, tx, veil,
        device: { opacity: dev, dy: rise * (1 - dev) },
        caption: { opacity: cap, dy: rise * (1 - cap) },
        screen: { scale: s.motion === 'drift' ? 1 + (DRIFT - 1) * p : 1, scrollY: s.motion === 'scroll' ? p : 0, frame },
        labels: s.labels.map((l) => ({
          opacity: Math.min(prog(t, s.start + l.at, LABEL_FADE), 1 - prog(t, s.start + l.until - LABEL_FADE, LABEL_FADE)),
        })),
      };
    }),
  };
}

// Rest frames (nothing moving) are identical, so the renderer can reuse the last screenshot.
export const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Poster frame: seconds, a scene id (its rest time) or the default 5 s. Warns when the frame is mid-motion.
export function posterTime(tl, poster) {
  const warnings = [];
  let time = 5;
  if (typeof poster === 'number') {
    time = Math.min(tl.total, Math.max(0, poster));
    if (time !== poster) warnings.push(`poster ${poster.toFixed(2)}s is outside the preview (0–${tl.total}s); using ${time}s`);
  } else if (typeof poster === 'string') {
    const s = tl.scenes.find((x) => x.id === poster);
    if (s) time = s.start + s.transition.dur + 0.6;
    else warnings.push(`poster scene "${poster}" not found; using ${time}s`);
  }
  const f = `${time.toFixed(2)}s`;
  for (const s of tl.scenes) {
    if (s.transition.dur > 0 && time >= s.start - s.transition.dur && time < s.start) warnings.push(`poster ${f} falls inside the transition into scene "${s.id}"`);
  }
  for (const s of tl.scenes) {
    const from = s.start - s.transition.dur;
    if (ENTRANCES[s.entrance] && time >= from && time < from + entranceLen(ENTRANCES[s.entrance])) warnings.push(`poster ${f} falls inside the entrance of scene "${s.id}"`);
  }
  const first = tl.scenes[0], last = tl.scenes.at(-1);
  if ((first?.fadeIn && time < first.fadeIn) || (last?.fadeOut && time > tl.total - last.fadeOut)) warnings.push(`poster ${f} falls inside the loop fade`);
  return { time, warnings };
}

// Apple wants 15–30 s; a --scene render is a partial preview, so skip the check.
export function checkDuration(tl, target, { sceneFilter = false } = {}) {
  const v = target.video;
  if (sceneFilter || !v) return [];
  const bad = tl.total < v.minSec || (Number.isFinite(v.maxSec) && tl.total > v.maxSec);
  if (!bad) return [];
  const range = Number.isFinite(v.maxSec) ? `${v.minSec}–${v.maxSec}s` : `at least ${v.minSec}s`;
  return [`preview is ${tl.total}s; ${target.id} wants ${range}`];
}

export const timeCode = (s) => {
  const cs = Math.round(s * 100), p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(cs / 360000))}:${p(Math.floor(cs / 6000) % 60)}:${p(Math.floor(cs / 100) % 60)}:${p(cs % 100)}`;
};
