// Timeline math for app previews: scenes -> timings, and "what does every scene look
// like at time t". Pure (no DOM, no ffmpeg) so it is unit-testable; the renderer
// applies stateAt() to a page that has every scene stacked (later scenes paint above).
import { CAPTION_MOTIONS, unitProgress, popValue, motionLength } from './kinetic.mjs';
import { tapProgress } from './taps.mjs';
export const FPS = 30;
export const TRANSITIONS = { crossfade: 0.5, push: 0.6, cut: 0, 'fade-through': 0.6 };
export const ENTRANCES = {
  rise: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0.06 },
  fade: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0 },
  none: null,
};
export const DEFAULT_DURATION = 4;
const FADE_IN = 0.4, FADE_OUT = 0.6, LABEL_FADE = 0.3, DRIFT = 1.03, SCROLL_MIN = 0.02;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (p) => 1 - (1 - clamp01(p)) ** 3;                 // ease-out cubic
const prog = (t, from, len) => (len > 0 ? ease((t - from) / len) : t >= from ? 1 : 0);
const entranceLen = (e) => (e ? e.delay + e.caption : 0);      // device (0.6) ends with the caption (0.1 + 0.5)
export const restLen = (s) => Math.max(entranceLen(ENTRANCES[s.entrance]), s.captionMotion === 'rise' ? 0 : (ENTRANCES[s.entrance]?.delay ?? 0) + motionLength(s.captionMotion, s.words));
const ms = (x) => Math.round(x * 1000) / 1000;                 // 3 + 3.4 + 11.8 + 11.8 is 30.000000000000004 in floats
const secs = (x) => `${+x.toFixed(2)}s`;                       // for messages: at most two decimals

export function buildTimeline(preview = {}, scenes = [], { fps = FPS } = {}) {
  const errors = [];
  // hard loop by default: the store shows the poster, then autoplays from frame 0, so a fade-in from dark reads as a blink
  const soft = (preview.loop ?? 'hard') === 'soft';
  let cursor = 0;
  const out = scenes.map((s, index) => {
    const numeric = s.duration === undefined || Number.isFinite(s.duration);
    const duration = Number.isFinite(s.duration) ? s.duration : DEFAULT_DURATION;
    if (!s.id) errors.push(`scene ${index + 1}: missing id`);
    if (!numeric) errors.push(`scene "${s.id ?? index + 1}": duration must be a number of seconds`);
    else if (duration <= 0) errors.push(`scene "${s.id ?? index + 1}": duration must be above 0 (got ${secs(duration)})`);
    const want = s.transition ?? preview.transition;
    if (want != null && !Object.hasOwn(TRANSITIONS, want)) errors.push(`scene "${s.id}": unknown transition "${want}"`);
    const kind = index === 0 ? 'cut' : Object.hasOwn(TRANSITIONS, want) ? want : 'crossfade';
    const start = cursor; cursor = ms(cursor + duration);
    if (s.in != null && !Object.hasOwn(ENTRANCES, s.in)) errors.push(`scene "${s.id}": unknown entrance "${s.in}"`);
    // scene 1 starts complete by default (the video opens on it and loops back to it); later scenes rise in
    const entrance = Object.hasOwn(ENTRANCES, s.in) ? s.in : index === 0 ? 'none' : 'rise';
    if (s.captionMotion != null && !CAPTION_MOTIONS.includes(s.captionMotion)) errors.push(`scene "${s.id}": unknown captionMotion "${s.captionMotion}" (${CAPTION_MOTIONS.join(', ')})`);
    const clipOk = s.clip && s.clip.frames > 0 && s.clip.fps > 0;
    if (s.clip && !clipOk) errors.push(`scene "${s.id}": clip needs frames and fps`);
    const motion = clipOk ? 'none' : s.motion === 'scroll' && !(s.overflow >= SCROLL_MIN) ? 'drift' : s.motion ?? 'drift';
    return {
      id: s.id, index, start, end: cursor, duration, transition: { kind, dur: TRANSITIONS[kind] ?? 0 },
      entrance, motion, captionMotion: CAPTION_MOTIONS.includes(s.captionMotion) ? s.captionMotion : 'rise', words: s.words ?? 1,
      clip: clipOk ? s.clip : null,
      // taps arrive in scene time (seconds from the scene start, already mapped through the speed ramp); the timeline keeps them absolute
      taps: (s.taps ?? []).map((x) => ({ ...x, at: ms(start + x.at) })), tapStyle: s.tapStyle ?? null,
      overflow: s.overflow ?? 0,
      continuous: index > 0 && !!s.continuous,                 // same layout and device as the scene before: the device stays put
      labels: (s.labels ?? []).map((l) => ({ at: l.at ?? 0, until: l.until ?? duration, text: l.text })),
      fadeIn: 0, fadeOut: 0,
    };
  });
  if (soft && out.length) { out[0].fadeIn = FADE_IN; out.at(-1).fadeOut = FADE_OUT; }
  // a transition needs room inside both scenes it joins
  out.forEach((s, i) => {
    const mine = s.transition, next = out[i + 1]?.transition;
    for (const tr of [i > 0 && mine, next]) {
      if (tr && tr.dur > 0 && s.duration < tr.dur) errors.push(`scene "${s.id}": duration ${secs(s.duration)} is shorter than its ${tr.kind} transition (${secs(tr.dur)})`);
    }
  });
  return { fps, total: cursor, frames: Math.round(cursor * fps), scenes: out, errors };   // starts, ends and total are whole ms
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
      const dev = e && !s.continuous ? prog(t, a, e.device) : 1, cap = e ? prog(t, a + e.delay, e.caption) : 1;
      const rise = e?.rise ?? 0;
      // kinetic caption: units start where the rise would, the caption box itself stays put and opaque
      const ck = s.captionMotion, kinetic = ck === 'words' || ck === 'lines' || ck === 'pop';
      let units = [], pop = null;
      if (kinetic) {
        const tc = Math.min(motionLength(ck, s.words), Math.max(0, t - (a + (e?.delay ?? 0))));
        if (ck === 'pop') pop = popValue(tc); else units = unitProgress(ck, tc, s.words);
      }

      const p = prog(t, s.start, s.duration);
      // a speed-ramped clip carries a map (output frame -> source frame); otherwise one source frame per output frame
      // starts are rounded to whole ms, so nudge by 1 ms to keep the frame index from lagging one frame
      const k = s.clip ? Math.max(0, Math.floor((t - s.start) * s.clip.fps + 1e-3 * s.clip.fps)) : 0;
      const frame = !s.clip ? null : s.clip.map ? s.clip.map[Math.min(s.clip.map.length - 1, k)] : Math.min(s.clip.frames - 1, k);
      return {
        id: s.id, visible, opacity, tx, veil,
        device: { opacity: dev, dy: s.continuous ? 0 : rise * (1 - dev) },
        caption: kinetic ? { opacity: 1, dy: 0, units, pop } : { opacity: cap, dy: rise * (1 - cap), units, pop },
        // one progress per tap, always the same length: 0-1 while its effect shows, -1 otherwise
        taps: s.taps.map((x) => (visible ? tapProgress(x.at, t, x.kind, s.tapStyle, x.dur) : -1)),
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
  let want = 5, lo = 0, hi = tl.total, scene = null;
  if (typeof poster === 'number') want = poster;
  else if (typeof poster === 'string') {
    scene = tl.scenes.find((x) => x.id === poster);
    if (scene) {
      // the entrance starts with the transition into the scene; rest = entrance over, and the scene fully in
      const s = scene, next = tl.scenes[s.index + 1]?.transition.dur ?? 0;
      want = ms(Math.max(s.start, s.start - s.transition.dur + restLen(s)));
      lo = s.start; hi = Math.min(hi, ms(s.end - next));  // before the next scene covers it
    } else warnings.push(`poster scene "${poster}" not found; using ${want}s`);
  }
  const time = Math.min(hi, Math.max(lo, want));      // never past the end, where every scene is invisible
  if (time !== want) warnings.push(`poster ${want.toFixed(2)}s is outside the ${scene ? `scene "${poster}"` : 'preview'} (${+lo.toFixed(2)}–${secs(hi)}); using ${secs(time)}`);
  const f = `${time.toFixed(2)}s`;
  for (const s of tl.scenes) {
    if (s.transition.dur > 0 && time >= s.start - s.transition.dur && time < s.start) warnings.push(`poster ${f} falls inside the transition into scene "${s.id}"`);
  }
  for (const s of tl.scenes) {
    const from = s.start - s.transition.dur;
    if ((ENTRANCES[s.entrance] || s.captionMotion !== 'rise') && time >= from && time < from + restLen(s)) warnings.push(`poster ${f} falls inside the entrance of scene "${s.id}"`);
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
  return [`preview is ${secs(tl.total)}; ${target.id} wants ${range}`];
}

// HH:MM:SS:FF, the last field in frames (App Store Connect's preview_frame_time_code)
export const timeCode = (s, fps = 30) => {
  const p = (n) => String(n).padStart(2, '0');
  const f = Math.max(1, Math.round(fps)), total = Math.round(s * f);   // whole frames; the carry into seconds falls out of the division
  const sec = Math.floor(total / f);
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}:${p(total % f)}`;
};

// byTarget.scenes: ["a", "b"] picks (and orders) the preview's own scenes by id; scene objects replace them.
export function selectScenes(previewScenes = [], override) {
  if (!Array.isArray(override) || !override.every((x) => typeof x === 'string')) return override ?? previewScenes;
  return override.map((id) => {
    const s = previewScenes.find((x) => x?.id === id);
    if (!s) throw new Error(`unknown scene "${id}" (scenes: ${previewScenes.map((x) => x?.id).join(', ')})`);
    return s;
  });
}

// A recording resolved from another locale shows the wrong UI language, unless the author declared it
// (`clipLocale` on the preview) or the file is the locale's own (locale or language level).
export function missingClipWarning(locale, usedLocale, clipLocale) {
  const lang = locale.split('-')[0];
  if (usedLocale === locale || usedLocale === lang) return null;
  if (clipLocale && [locale, lang, usedLocale].includes(clipLocale)) return null;
  return `[${locale}] no recording for this locale — using ${usedLocale}; UI language in the recording does not match`;
}

// ---------- ffmpeg ----------
// Everything below shells out to ffmpeg (found by findFfmpeg) and knows nothing about Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// FFMPEG_PATH (must exist, else throws), then the ffmpeg-static binary, then ffmpeg on PATH; null when none is
// found. Only file existence is checked, not that the binary runs.
export function findFfmpeg() {
  const env = process.env.FFMPEG_PATH;
  if (env) {
    if (!fs.existsSync(env)) throw new Error(`FFMPEG_PATH is set but not found: ${env}`);
    return env;
  }
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static');
    if (p && fs.existsSync(p)) return p;
  } catch { /* optional dependency not installed */ }
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim().split(/\r?\n/)[0] : null;
}

// ffmpeg-static has no ffprobe, so read `ffmpeg -i` (which exits non-zero with no output file).
export function probeClip(ffmpeg, file) {
  const err = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr || '';
  const d = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const v = err.split('\n').find((l) => /Stream #.*Video:/.test(l)) || '';
  const sz = v.replace(/\b0x[0-9a-f]+/gi, '').match(/(\d{2,5})x(\d{2,5})/);
  const fps = v.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (!d || !sz) throw new Error(`cannot read video info from ${file}: ${err.trim().split('\n').slice(-3).join(' | ')}`);
  // phone recordings carry a display rotation; extractClip autorotates, so report the displayed size
  const rot = err.match(/displaymatrix: rotation of (-?[\d.]+) degrees/) || err.match(/\brotate\s*:\s*(-?\d+)/);
  const swap = rot && Math.round(Math.abs(+rot[1]) / 90) % 2 === 1;
  const [w, h] = swap ? [+sz[2], +sz[1]] : [+sz[1], +sz[2]];
  return { duration: +d[1] * 3600 + +d[2] * 60 + +d[3], width: w, height: h, fps: fps ? +fps[1] : null };
}

export function clipKey({ file, start, end, speed, height }) {
  const st = fs.statSync(file);
  // 'pts': clips cut before clipArgs (input seek, dts-guessed timestamps) may be seconds off on simulator takes
  return crypto.createHash('sha1').update(['pts', st.size, st.mtimeMs, start, end, speed, height].join('|')).digest('hex').slice(0, 12);
}

// ffmpeg args that cut [start,end] into 30 fps JPEGs on the recording's presentation timeline, the one record.mjs times
// marks on. simctl .mov files reorder frames by up to ~7 s; there ffmpeg's dts-based timestamp guess put 987 of 2815
// frames up to 3.4 s off (AptusFIT), and `-ss` before `-i` mislabelled frames by a 7 s still gap. So: ignore dts (matches
// AVFoundation to 1 ms) and cut with trim after fps, never an input seek.
export function clipArgs({ file, start = 0, end, speed = 1, height, out }) {
  const vf = [`fps=${FPS}`, `trim=start=${start}${end != null ? `:end=${end}` : ''}`, 'setpts=PTS-STARTPTS',
    speed !== 1 ? `setpts=PTS/${speed},fps=${FPS}` : null, height ? `scale=-2:${height}` : null].filter(Boolean).join(',');
  return ['-hide_banner', '-loglevel', 'error', '-fflags', '+igndts', '-i', file, '-vf', vf, '-q:v', '2', '-y', out];
}

// Cut [start,end] of a screen recording into 30 fps JPEGs (see clipArgs).
// Extracts into `dir.tmp` and renames on success; a `.done` marker is the only cache hit, so partial runs re-extract.
export function extractClip(ffmpeg, { file, start = 0, end, speed = 1, height, dir }) {
  const list = () => fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(dir, f));
  if (!fs.existsSync(path.join(dir, '.done'))) {
    const tmp = `${dir}.tmp`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const r = spawnSync(ffmpeg, clipArgs({ file, start, end, speed, height, out: path.join(tmp, '%05d.jpg') }), { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw new Error(`ffmpeg exited ${r.status}: ${(r.stderr || '').trim().split('\n').slice(-10).join('\n')}`);
    }
    fs.writeFileSync(path.join(tmp, '.done'), '');
    fs.renameSync(tmp, dir);
  }
  const files = list();
  return { dir, files, count: files.length, fps: FPS };
}

// JPEG frames on stdin -> H.264 High (level 4.0 up to 8192 macroblocks) yuv420p + AAC (silent, or music trimmed to `total` with a fade-out).
export function encodeArgs({ fps, width, height, out, total, music, scaleTo }) {
  const a = ['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];  // mjpeg: probing a pipe can miss the stream
  a.push(...(music ? ['-i', music.src] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']));
  a.push('-map', '0:v', '-map', '1:a');
  if (scaleTo) a.push('-vf', `scale=${scaleTo.w}:${scaleTo.h}:flags=lanczos`);
  // Level 4.0 (Apple's app-preview spec) allows 8192 macroblocks per frame; bigger frames (the 4K creative targets) get
  // no -level (libx264 picks one that fits) and a higher bitrate
  const ow = scaleTo?.w ?? width, oh = scaleTo?.h ?? height;
  const big = Math.ceil(ow / 16) * Math.ceil(oh / 16) > 8192;
  a.push('-c:v', 'libx264', '-profile:v', 'high', ...(big ? [] : ['-level', '4.0']), '-pix_fmt', 'yuv420p', '-r', String(fps));
  a.push(...(big ? ['-b:v', '20M', '-maxrate', '24M', '-bufsize', '48M'] : ['-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M']));
  a.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2');
  if (music) {
    const f = [];
    if (music.volume != null) f.push(`volume=${music.volume}`);
    // a fade longer than the video starts at 0 (ffmpeg rejects a negative st)
    if (music.fadeOut > 0) f.push(`afade=t=out:st=${+Math.max(0, total - music.fadeOut).toFixed(3)}:d=${+Math.min(music.fadeOut, total).toFixed(3)}`);
    if (f.length) a.push('-af', f.join(','));
  }
  a.push('-t', String(total), '-movflags', '+faststart', '-y', out);
  return a;
}

// Spawn the encoder; write() honours back-pressure and rejects once ffmpeg has exited; end() resolves on exit 0
// else rejects with the log tail; kill() stops it (for a caller that throws mid-capture).
export function startEncoder(ffmpeg, args) {
  const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['pipe', 'ignore', 'pipe'] });
  const log = [];
  let rest = '', exited = false, failure = null;
  p.stderr.on('data', (d) => {
    const lines = (rest + d).split(/\r?\n|\r/); rest = lines.pop();
    log.push(...lines.filter(Boolean)); if (log.length > 50) log.splice(0, log.length - 50);
  });
  const done = new Promise((res, rej) => {
    const finish = (err) => { exited = true; if (rest) { log.push(rest); rest = ''; } failure = err; err ? rej(err) : res(); };
    p.on('error', finish);
    p.on('close', (code, sig) => finish(code === 0 ? null : new Error(`ffmpeg exited ${code ?? sig}: ${log.slice(-10).join('\n')}`)));
  });
  done.catch(() => {}); // surfaced by write()/end()
  p.stdin.on('error', () => {});  // EPIPE when ffmpeg died; the exit status reports it
  return {
    log,
    write: (buf) => new Promise((res, rej) => {
      if (exited) return rej(failure || new Error('ffmpeg already exited'));
      if (p.stdin.write(buf)) return res();
      const off = () => { p.stdin.off('drain', onDrain); p.stdin.off('close', onClose); };
      const onDrain = () => { off(); res(); };
      const onClose = () => { off(); done.then(() => rej(new Error('ffmpeg exited before all frames were written')), rej); };
      p.stdin.once('drain', onDrain); p.stdin.once('close', onClose);
      done.then(onClose, onClose);
    }),
    end: () => { p.stdin.end(); return done; },
    kill: () => { if (!exited) p.kill('SIGKILL'); return done.catch(() => {}); },
  };
}

// QA contact sheet: the frame nearest every `step` seconds (max 30 tiles), 10 per row, 240 px high, second number underneath.
export async function filmstrip(frames, out, step = 1) {
  const H = 240, GAP = 8, LABEL = 28, COLS = 10;
  const pick = [];
  for (let i = 0; i < 30; i++) {
    const k = i * step, f = frames.find((x) => x.t >= k && x.t < k + step);
    if (f) pick.push({ k, buf: f.buf });
  }
  if (!pick.length) throw new Error('filmstrip: no frames');
  const tiles = await Promise.all(pick.map(async (p) => {
    const { data, info } = await sharp(p.buf).resize({ height: H }).png().toBuffer({ resolveWithObject: true });
    return { ...p, data, w: info.width };
  }));
  const rows = Math.ceil(tiles.length / COLS), colW = Math.max(...tiles.map((t) => t.w));
  const w = GAP + Math.min(COLS, tiles.length) * (colW + GAP), h = GAP + rows * (H + LABEL + GAP);
  const comp = [];
  tiles.forEach((t, i) => {
    const x = GAP + (i % COLS) * (colW + GAP), y = GAP + Math.floor(i / COLS) * (H + LABEL + GAP);
    comp.push({ input: t.data, left: x + Math.round((colW - t.w) / 2), top: y });
    comp.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${colW}" height="${LABEL}"><text x="${colW / 2}" y="20" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#333" text-anchor="middle">${t.k}</text></svg>`), left: x, top: y + H });
  });
  await sharp({ create: { width: w, height: h, channels: 3, background: '#e6e6e6' } }).composite(comp).jpeg({ quality: 88 }).toFile(out);
  return { file: out, w, h };
}
