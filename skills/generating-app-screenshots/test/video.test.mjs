import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { buildTimeline, stateAt, sameState, posterTime, checkDuration, timeCode, findFfmpeg, probeClip, clipKey, extractClip, encodeArgs, startEncoder, filmstrip, selectScenes, missingClipWarning } from '../scripts/video.mjs';

const __filename = fileURLToPath(import.meta.url);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'asp-video-'));

test('starts accumulate and default duration is 4', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 7 }, { id: 'c' }]);
  assert.deepEqual(tl.scenes.map((s) => [s.start, s.end]), [[0, 4], [4, 11], [11, 15]]);
  assert.equal(tl.total, 15); assert.equal(tl.frames, 450);
});
test('transition shorter than scene is an error naming the scene', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 0.4 }, { id: 'b' }]);
  assert.match(tl.errors[0], /scene "a".*0\.4s.*crossfade.*0\.5s/);
});
test('crossfade: next scene fades in over the last 0.5s of the previous one', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b' }]);
  const s = stateAt(tl, 3.75).scenes;
  assert.equal(s[0].opacity, 1); assert.ok(s[1].visible && s[1].opacity > 0.4 && s[1].opacity < 0.95);
  assert.equal(stateAt(tl, 3.0).scenes[1].visible, false);
});
test('push moves both scenes horizontally', () => {
  const tl = buildTimeline({ transition: 'push' }, [{ id: 'a' }, { id: 'b' }]);
  const s = stateAt(tl, 3.7).scenes; assert.ok(s[0].tx < 0 && s[1].tx > 0 && s[1].tx < 1);
});
test('rise entrance: device starts 6% low and lands by 0.6s', () => {
  const tl = buildTimeline({}, [{ id: 'a' }]);
  assert.equal(stateAt(tl, 0).scenes[0].device.dy, 0.06);
  assert.equal(stateAt(tl, 0.6).scenes[0].device.dy, 0);
  assert.equal(stateAt(tl, 0.05).scenes[0].caption.opacity, 0);   // 0.1 s delay
});
test('loop fades: veil 1 at t=0, 0 at 0.4; veil 1 at the very end', () => {
  const tl = buildTimeline({}, [{ id: 'a' }]);
  assert.equal(stateAt(tl, 0).scenes[0].veil, 1); assert.equal(stateAt(tl, 0.4).scenes[0].veil, 0);
  assert.ok(stateAt(tl, 3.99).scenes[0].veil > 0.9);
  assert.equal(stateAt(buildTimeline({ loop: 'hard' }, [{ id: 'a' }]), 0).scenes[0].veil, 0);
});
test('drift scales 1 → 1.03 across the scene; scroll with overflow pans 0 → 1; scroll without overflow drifts', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'scroll', overflow: 0.8 }, { id: 'b', motion: 'scroll', overflow: 0.01 }]);
  assert.equal(stateAt(tl, 0).scenes[0].screen.scrollY, 0); assert.equal(stateAt(tl, 4).scenes[0].screen.scrollY, 1);
  assert.equal(tl.scenes[1].motion, 'drift'); assert.ok(stateAt(tl, 6).scenes[1].screen.scale > 1);
});
test('clip frames advance at fps and hold the last frame', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 4, clip: { frames: 60, fps: 30 } }]);
  assert.equal(stateAt(tl, 1).scenes[0].screen.frame, 30);
  assert.equal(stateAt(tl, 3.5).scenes[0].screen.frame, 59);
});
test('labels fade in at `at` and out at `until`', () => {
  const tl = buildTimeline({}, [{ id: 'a', labels: [{ at: 1, until: 2, text: 'X' }] }]);
  assert.equal(stateAt(tl, 0.9).scenes[0].labels[0].opacity, 0);
  assert.equal(stateAt(tl, 1.3).scenes[0].labels[0].opacity, 1);
  assert.equal(stateAt(tl, 2.3).scenes[0].labels[0].opacity, 0);
});
test('sameState detects rest frames', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none' }]);
  assert.ok(sameState(stateAt(tl, 1), stateAt(tl, 1.5))); assert.ok(!sameState(stateAt(tl, 0.1), stateAt(tl, 0.2)));
});
test('poster: default 5, scene id → rest time, inside a transition warns', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 8 }]);
  assert.equal(posterTime(tl).time, 5);
  assert.equal(posterTime(tl, 'b').time, 4 + 0.5 + 0.6);        // crossfade 0.5 + entrance 0.6 (0.1 delay + 0.5 caption) over, then rest
  assert.match(posterTime(tl, 3.8).warnings[0], /transition/);
  assert.match(posterTime(tl, 0.2).warnings[0], /entrance|fade/);
});
test('checkDuration against target.video', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 10 }]);
  assert.match(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } })[0], /10s.*15.*30/);
  assert.deepEqual(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } }, { sceneFilter: true }), []);
});
test('timeCode', () => {
  assert.equal(timeCode(5), '00:00:05:00');
  assert.equal(timeCode(65.5), '00:01:05:50');
});
test('scroll keeps scroll from 2% overflow, drifts below', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'scroll', overflow: 0.03 }, { id: 'b', motion: 'scroll', overflow: 0.015 }]);
  assert.deepEqual(tl.scenes.map((s) => s.motion), ['scroll', 'drift']);
});
test('poster is clamped to the preview and to the scene, with a warning', () => {
  const short = buildTimeline({}, [{ id: 'a', duration: 3 }]);
  const d = posterTime(short); assert.equal(d.time, 3); assert.match(d.warnings[0], /outside/);
  const tl = buildTimeline({}, [{ id: 'a', duration: 0.5 }, { id: 'b' }]);
  const p = posterTime(tl, 'a'); assert.equal(p.time, 0.5); assert.match(p.warnings[0], /outside/);
});
test('poster rest time uses the entrance length: in none rests right after the transition', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', in: 'none', duration: 8 }]);
  assert.equal(posterTime(tl, 'b').time, 4.5);
});
test('unknown transition or entrance and bad clips are reported', () => {
  const tl = buildTimeline({}, [{ id: 'a', transition: 'wipe', in: 'zoom', clip: { frames: 10 } }, { id: 'b', transition: 'crossfde' }]);
  assert.ok(tl.errors.some((e) => e === 'scene "a": unknown transition "wipe"'));
  assert.ok(tl.errors.some((e) => e === 'scene "a": unknown entrance "zoom"'));
  assert.ok(tl.errors.some((e) => e === 'scene "b": unknown transition "crossfde"'));
  assert.ok(tl.errors.some((e) => e === 'scene "a": clip needs frames and fps'));
  assert.equal(tl.scenes[1].transition.kind, 'crossfade'); assert.equal(stateAt(tl, 1).scenes[0].screen.frame, null);
});

test('encodeArgs: H.264 High 4.0 yuv420p 30fps 11M, faststart, silent stereo AAC 48k when no music', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20, music: null }).join(' ');
  for (const s of ['-f image2pipe', '-framerate 30', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-c:v libx264', '-profile:v high', '-level 4.0', '-pix_fmt yuv420p', '-b:v 11M', '-maxrate 12M', '-bufsize 24M', '-r 30', '-c:a aac', '-b:a 256k', '-ar 48000', '-ac 2', '-movflags +faststart', '-t 20', 'x.mp4']) assert.ok(a.includes(s), s);
  assert.ok(!a.includes('-vf') && !a.includes('afade'));
});
test('encodeArgs with music trims to total and fades out', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20, music: { src: 'm.mp3', volume: 0.8, fadeOut: 1.5 } }).join(' ');
  assert.ok(a.includes('-i m.mp3') && a.includes('volume=0.8') && a.includes('afade=t=out:st=18.5:d=1.5'));
});
test('encodeArgs scaleTo adds a lanczos scale filter', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 2, music: null, scaleTo: { w: 443, h: 960 } }).join(' ');
  assert.ok(a.includes('-vf scale=443:960:flags=lanczos'));
});
test('clipKey changes with params', () => assert.notEqual(clipKey({ file: __filename, start: 0, end: 1, speed: 1, height: 600 }), clipKey({ file: __filename, start: 0, end: 2, speed: 1, height: 600 })));
test('probeClip and extractClip on a generated test clip', { skip: !findFfmpeg() }, () => {
  const ff = findFfmpeg(), d = tmp();
  try {
    const clip = path.join(d, 'clip.mp4');
    const r = spawnSync(ff, ['-f', 'lavfi', '-i', 'testsrc=size=320x640:rate=30:duration=2', '-pix_fmt', 'yuv420p', '-y', clip], { stdio: 'pipe' });
    assert.equal(r.status, 0);
    const p = probeClip(ff, clip);
    assert.deepEqual([p.width, p.height, Math.round(p.duration)], [320, 640, 2]);
    assert.equal(p.fps, 30);
    const dir = path.join(d, 'frames');
    const x = extractClip(ff, { file: clip, start: 0.5, end: 1.5, speed: 1, height: 320, dir });
    assert.equal(x.count, 30); assert.ok(fs.existsSync(x.files[29]));
    assert.equal(extractClip(ff, { file: clip, start: 0.5, end: 1.5, speed: 1, height: 320, dir }).count, 30); // cached
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('startEncoder writes a valid mp4', { skip: !findFfmpeg() }, async () => {
  const ff = findFfmpeg(), d = tmp();
  try {
    const out = path.join(d, 'o.mp4');
    const jpg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#3366cc' } }).jpeg().toBuffer();
    const enc = startEncoder(ff, encodeArgs({ fps: 30, width: 64, height: 64, out, total: 10 / 30, music: null }));
    for (let i = 0; i < 10; i++) await enc.write(jpg);
    await enc.end();
    assert.ok(fs.statSync(out).size > 0);
    const p = probeClip(ff, out);
    assert.equal(p.width, 64); assert.ok(Math.abs(p.duration - 0.33) < 0.1, String(p.duration));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('startEncoder rejects with the log tail on failure', { skip: !findFfmpeg() }, async () => {
  const enc = startEncoder(findFfmpeg(), ['-i', '/nonexistent/x.mp4', '-y', '/nonexistent/o.mp4']);
  await assert.rejects(enc.end(), (e) => /ffmpeg exited 1: /.test(e.message) && e.message.includes(enc.log.slice(-10).join('\n')) && enc.log.length > 0);
});
test('startEncoder write after ffmpeg exited rejects instead of hanging', { skip: !findFfmpeg() }, async () => {
  const enc = startEncoder(findFfmpeg(), ['-i', '/nonexistent/x.mp4', '-y', '/nonexistent/o.mp4']); // exits at once
  const big = Buffer.alloc(1 << 20, 1);
  const run = (async () => { for (let i = 0; i < 50; i++) await enc.write(big); })();
  await assert.rejects(Promise.race([run, new Promise((_, r) => setTimeout(() => r(new Error('write hung')), 5000))]), /ffmpeg exited/);
  await assert.rejects(enc.write(big), /ffmpeg exited/);
  await enc.kill();
});
test('startEncoder exercises back-pressure with large writes, and kill() stops ffmpeg', { skip: !findFfmpeg() }, async () => {
  const jpg = await sharp({ create: { width: 1500, height: 1500, channels: 3, background: '#123456' } }).jpeg({ quality: 100 }).toBuffer();
  const enc = startEncoder(findFfmpeg(), encodeArgs({ fps: 30, width: 1500, height: 1500, out: path.join(os.tmpdir(), `asp-bp-${process.pid}.mp4`), total: 1, music: null }));
  const big = Buffer.concat([jpg, Buffer.alloc(4 << 20)]); // trailing zeros after the JPEG are tolerated
  let drained = false;
  for (let i = 0; i < 3; i++) { await enc.write(big); drained = true; }
  assert.ok(drained);
  await enc.kill();
  fs.rmSync(path.join(os.tmpdir(), `asp-bp-${process.pid}.mp4`), { force: true });
});
test('findFfmpeg throws when FFMPEG_PATH is set but missing', () => {
  const old = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = '/nonexistent/ffmpeg';
  try { assert.throws(() => findFfmpeg(), /FFMPEG_PATH is set but not found: \/nonexistent\/ffmpeg/); }
  finally { old === undefined ? delete process.env.FFMPEG_PATH : (process.env.FFMPEG_PATH = old); }
});
test('probeClip swaps width/height for a display-rotated clip', { skip: !findFfmpeg() }, () => {
  const ff = findFfmpeg(), d = tmp();
  try {
    const a = path.join(d, 'a.mp4'), b = path.join(d, 'b.mp4');
    spawnSync(ff, ['-f', 'lavfi', '-i', 'testsrc=size=320x640:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-y', a], { stdio: 'pipe' });
    const r = spawnSync(ff, ['-display_rotation', '90', '-i', a, '-c', 'copy', '-y', b], { stdio: 'pipe' });
    assert.equal(r.status, 0);
    const p = probeClip(ff, b);
    assert.deepEqual([p.width, p.height], [640, 320]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('extractClip re-extracts a dir without the completion marker', { skip: !findFfmpeg() }, () => {
  const ff = findFfmpeg(), d = tmp();
  try {
    const clip = path.join(d, 'clip.mp4'), dir = path.join(d, 'frames');
    spawnSync(ff, ['-f', 'lavfi', '-i', 'testsrc=size=320x640:rate=30:duration=1', '-pix_fmt', 'yuv420p', '-y', clip], { stdio: 'pipe' });
    fs.mkdirSync(dir); for (const n of ['00001', '00002', '00003']) fs.writeFileSync(path.join(dir, `${n}.jpg`), 'stale');
    fs.mkdirSync(`${dir}.tmp`); fs.writeFileSync(path.join(`${dir}.tmp`, 'junk.jpg'), 'x');
    const x = extractClip(ff, { file: clip, start: 0, end: 1, speed: 1, height: 320, dir });
    assert.equal(x.count, 30); assert.ok(fs.statSync(x.files[0]).size > 100); assert.ok(!fs.existsSync(`${dir}.tmp`));
    assert.throws(() => extractClip(ff, { file: path.join(d, 'missing.mp4'), start: 0, end: 1, speed: 1, height: 320, dir: path.join(d, 'f2') }), /ffmpeg exited/);
    assert.ok(!fs.existsSync(path.join(d, 'f2')) && !fs.existsSync(path.join(d, 'f2.tmp')));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('filmstrip picks one frame per second: 60 frames at 30 fps over 2 s -> 2 tiles', async () => {
  const d = tmp();
  try {
    const buf = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#00ff00' } }).png().toBuffer();
    const frames = Array.from({ length: 60 }, (_, i) => ({ t: i / 30, buf }));
    const r = await filmstrip(frames, path.join(d, 'f.jpg'));
    assert.deepEqual([r.w, r.h], [8 + 2 * (120 + 8), 8 + 1 * (240 + 28 + 8)]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
test('filmstrip tiles one frame per second', async () => {
  const d = tmp();
  try {
    const buf = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const frames = Array.from({ length: 25 }, (_, i) => ({ t: i, buf }));
    const r = await filmstrip(frames, path.join(d, 'f.jpg'));
    const m = await sharp(r.file).metadata();
    assert.deepEqual([m.width, m.height], [r.w, r.h]);
    const tw = 120; // 100x200 source scaled to 240 high
    assert.deepEqual([r.w, r.h], [8 + 10 * (tw + 8), 8 + 3 * (240 + 28 + 8)]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('selectScenes: an array of ids picks base scenes in that order; unknown ids throw naming them', () => {
  const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(selectScenes(base.slice(0, 2), ['b']), [{ id: 'b' }]);
  assert.deepEqual(selectScenes(base, ['c', 'a']).map((s) => s.id), ['c', 'a']);
  assert.throws(() => selectScenes(base, ['b', 'nope']), /"nope"/);
});
test('selectScenes: no override or scene objects keep their scenes', () => {
  const base = [{ id: 'a' }];
  assert.equal(selectScenes(base, undefined), base);
  const own = [{ id: 'x', title: 'X' }];
  assert.equal(selectScenes(base, own), own);
});
test('missingClipWarning: silent for the own locale, its language, or a declared clipLocale', () => {
  assert.equal(missingClipWarning('de-DE', 'de-DE'), null);
  assert.equal(missingClipWarning('de-DE', 'de'), null);                 // language-level recording is the locale's own
  assert.equal(missingClipWarning('ja', 'en-US', 'en-US'), null);        // declared: recordings are English
  assert.equal(missingClipWarning('de-DE', 'en-US', 'de'), null);        // clipLocale = the locale's language
  assert.equal(missingClipWarning('de-DE', 'en-US', 'de-DE'), null);
  assert.equal(missingClipWarning('ja', 'en-US'), '[ja] no recording for this locale — using en-US; UI language in the recording does not match');
  assert.match(missingClipWarning('ja', 'en-US', 'fr'), /^\[ja\] no recording/);
});
test('missingClipWarning in a per-job Set warns once per locale however many scenes fall back', () => {
  const seen = new Set();
  for (const scene of ['a', 'b', 'c']) { const w = missingClipWarning('vi', 'en-US'); if (w) seen.add(w); void scene; }
  assert.equal(seen.size, 1);
});
