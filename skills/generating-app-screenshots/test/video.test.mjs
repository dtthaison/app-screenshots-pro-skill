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
test('rise entrance: device starts 6% low and lands by 0.6s (scene 1 defaults to none; later scenes rise)', () => {
  const first = buildTimeline({}, [{ id: 'z' }, { id: 'a' }]);
  assert.equal(first.scenes[0].entrance, 'none'); assert.equal(first.scenes[1].entrance, 'rise');
  assert.deepEqual(stateAt(first, 0).scenes[0].device, { opacity: 1, dy: 0 });
  const tl = buildTimeline({}, [{ id: 'a', in: 'rise' }]);
  assert.equal(stateAt(tl, 0).scenes[0].device.dy, 0.06);
  assert.equal(stateAt(tl, 0.6).scenes[0].device.dy, 0);
  assert.equal(stateAt(tl, 0.05).scenes[0].caption.opacity, 0);   // 0.1 s delay
});
test('loop: hard by default (no veil at the ends); soft fades in over 0.4 s and out at the very end', () => {
  const hard = buildTimeline({}, [{ id: 'a' }]);
  assert.equal(stateAt(hard, 0).scenes[0].veil, 0); assert.equal(stateAt(hard, 3.99).scenes[0].veil, 0);
  assert.deepEqual([hard.scenes[0].fadeIn, hard.scenes[0].fadeOut], [0, 0]);
  const tl = buildTimeline({ loop: 'soft' }, [{ id: 'a' }]);
  assert.equal(stateAt(tl, 0).scenes[0].veil, 1); assert.equal(stateAt(tl, 0.4).scenes[0].veil, 0);
  assert.ok(stateAt(tl, 3.99).scenes[0].veil > 0.9);
});
test('drift scales 1 → 1.03 across the scene; scroll with overflow pans 0 → 1; scroll without overflow drifts', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'scroll', overflow: 0.8 }, { id: 'b', motion: 'scroll', overflow: 0.01 }]);
  assert.equal(stateAt(tl, 0).scenes[0].screen.scrollY, 0); assert.equal(stateAt(tl, 4).scenes[0].screen.scrollY, 1);
  assert.equal(tl.scenes[1].motion, 'drift'); assert.ok(stateAt(tl, 6).scenes[1].screen.scale > 1);
});
test('stateAt uses clip.map when present', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 1, clip: { frames: 4, fps: 30, map: Int32Array.from([0, 0, 5, 9]) } }]);
  assert.equal(stateAt(tl, 2 / 30).scenes[0].screen.frame, 5);
  assert.equal(stateAt(tl, 0.9).scenes[0].screen.frame, 9);             // past the map: its last entry
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
test('continuous scene: the device skips its entrance, caption and labels still animate', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', continuous: true, labels: [{ at: 1, text: 'X' }] }, { id: 'c' }]);
  assert.deepEqual(tl.scenes.map((s) => s.continuous), [false, true, false]);
  for (const t of [3.5, 3.6, 3.8, 4, 4.3, 6]) assert.deepEqual(stateAt(tl, t).scenes[1].device, { opacity: 1, dy: 0 }, `t=${t}`);
  const s = stateAt(tl, 3.7).scenes[1];
  assert.ok(s.caption.opacity < 1 && s.caption.dy > 0);           // caption rises in as usual
  assert.equal(stateAt(tl, 4.9).scenes[1].labels[0].opacity, 0); assert.equal(stateAt(tl, 5.4).scenes[1].labels[0].opacity, 1);
  assert.ok(s.opacity > 0 && s.opacity < 1);                       // the scene itself still crossfades
  assert.ok(stateAt(tl, 7.7).scenes[2].device.dy > 0);             // a scene without the flag rises
  assert.equal(buildTimeline({}, [{ id: 'a', continuous: true }]).scenes[0].continuous, false);  // scene 1 has nothing to continue
});
test('sameState detects rest frames', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none', in: 'rise' }]);
  assert.ok(sameState(stateAt(tl, 1), stateAt(tl, 1.5))); assert.ok(!sameState(stateAt(tl, 0.1), stateAt(tl, 0.2)));
  const still = buildTimeline({}, [{ id: 'a', motion: 'none' }]);                 // scene 1 at rest from frame 0
  assert.ok(sameState(stateAt(still, 0), stateAt(still, 0.5)));
});
test('poster: default 5, scene id → rest time, inside a transition warns', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 8 }]);
  assert.equal(posterTime(tl).time, 5);
  assert.equal(posterTime(tl, 'b').time, 4.1);                  // the entrance (0.1 delay + 0.5 caption) starts with the 0.5 crossfade: 4 + 0.6 − 0.5
  assert.deepEqual(posterTime(tl, 'b').warnings, []);
  assert.match(posterTime(tl, 3.8).warnings[0], /transition/);
  assert.deepEqual(posterTime(tl, 0.2).warnings, []);                                   // scene 1 has no entrance by default
  const rising = buildTimeline({}, [{ id: 'a', in: 'rise' }, { id: 'b' }]);
  assert.match(posterTime(rising, 0.2).warnings[0], /entrance/);
});
test('checkDuration against target.video', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 10 }]);
  assert.match(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } })[0], /10s.*15.*30/);
  assert.deepEqual(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } }, { sceneFilter: true }), []);
});
test('timeCode', () => {
  assert.equal(timeCode(5), '00:00:05:00');
  assert.equal(timeCode(65.5), '00:01:05:15');
  assert.equal(timeCode(5.5), '00:00:05:15');
  assert.equal(timeCode(59.99), '00:01:00:00');
  assert.equal(timeCode(3599.99), '01:00:00:00');
  assert.equal(timeCode(4.1, 24), '00:00:04:02');
});
test('stateAt: ms-rounded scene starts do not lag the clip frame index', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 2.0667, in: 'none' }, { id: 'c', duration: 3, in: 'none', clip: { frames: 90, fps: 30 } }]);
  const exact = 2.0667;
  for (const t of [2.51, 3.02, 3.31, 4.01, 4.45]) {
    const want = Math.floor((t - exact) * 30);
    assert.equal(stateAt(tl, t).scenes[1].screen.frame, want, `t=${t}`);
  }
});
test('scroll keeps scroll from 2% overflow, drifts below', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'scroll', overflow: 0.03 }, { id: 'b', motion: 'scroll', overflow: 0.015 }]);
  assert.deepEqual(tl.scenes.map((s) => s.motion), ['scroll', 'drift']);
});
test('poster is clamped to the preview and to the scene, with a warning', () => {
  const short = buildTimeline({}, [{ id: 'a', duration: 3 }]);
  const d = posterTime(short); assert.equal(d.time, 3); assert.match(d.warnings[0], /outside/);
  const tl = buildTimeline({}, [{ id: 'a', duration: 0.5, in: 'rise' }, { id: 'b' }]);
  const p = posterTime(tl, 'a'); assert.equal(p.time, 0); assert.match(p.warnings[0], /outside/);   // rest 0.6 s > 0.5 s end − 0.5 s crossfade out = 0
});
test('poster rest time uses the entrance length: in none rests at the scene start, once the transition is over', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', in: 'none', duration: 8 }]);
  assert.equal(posterTime(tl, 'b').time, 4);
});
test('poster by scene id stays inside the scene, before the next scene covers it, and names the scene range', () => {
  const p = posterTime(buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 1 }, { id: 'c' }]), 'b');
  assert.equal(p.time, 4.1); assert.deepEqual(p.warnings, []);
  // b is 4–4.6 and c pushes in over its last 0.6 s, so b is fully shown only at 4.0; its rest time 4.1 is clamped
  const w = posterTime(buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 0.6 }, { id: 'c', transition: 'push' }]), 'b');
  assert.equal(w.time, 4);
  assert.match(w.warnings[0], /^poster 4\.10s is outside the scene "b" \(4–4s\); using 4s$/);
});
test('durations sum to whole milliseconds: 3 + 3.4 + 11.8 + 11.8 is a valid 30 s preview', () => {
  const tl = buildTimeline({}, [3, 3.4, 11.8, 11.8].map((duration, i) => ({ id: `s${i}`, duration })));
  assert.equal(tl.total, 30); assert.equal(tl.frames, 900);
  assert.deepEqual(tl.scenes.map((s) => s.end), [3, 6.4, 18.2, 30]);
  assert.deepEqual(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } }), []);
  assert.equal(checkDuration(buildTimeline({}, [{ id: 'a', duration: 35.1234 }]), { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } })[0], 'preview is 35.12s; preview-iphone wants 15–30s');
});
test('a duration that is not a number is an error; only a missing duration defaults to 4', () => {
  const tl = buildTimeline({}, [{ id: 'x', duration: '7' }, { id: 'y', duration: null }, { id: 'z' }]);
  assert.deepEqual(tl.errors, ['scene "x": duration must be a number of seconds', 'scene "y": duration must be a number of seconds']);
  assert.equal(tl.scenes[2].duration, 4);
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
test('encodeArgs: level 4.0 and 11M up to 8192 macroblocks; above, no -level and 20M', () => {
  const small = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20 });
  assert.equal(small[small.indexOf('-level') + 1], '4.0'); assert.equal(small[small.indexOf('-b:v') + 1], '11M');
  const big = encodeArgs({ fps: 30, width: 3840, height: 1646, out: 'x.mp4', total: 20 });
  assert.ok(!big.includes('-level'));
  assert.deepEqual(['-b:v', '-maxrate', '-bufsize'].map((k) => big[big.indexOf(k) + 1]), ['20M', '24M', '48M']);
  // the output size is scaleTo's when given (a 0.25x render of the 4K header still encodes at 4K)
  assert.ok(!encodeArgs({ fps: 30, width: 960, height: 412, out: 'x.mp4', total: 5, scaleTo: { w: 3840, h: 1646 } }).includes('-level'));
});
test('encodeArgs with music trims to total and fades out', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20, music: { src: 'm.mp3', volume: 0.8, fadeOut: 1.5 } }).join(' ');
  assert.ok(a.includes('-i m.mp3') && a.includes('volume=0.8') && a.includes('afade=t=out:st=18.5:d=1.5'));
});
test('encodeArgs: a music fadeOut longer than the video starts at 0 and lasts the video', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 2, music: { src: 'm.mp3', fadeOut: 4 } }).join(' ');
  assert.ok(a.includes('afade=t=out:st=0:d=2'), a);
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
test('filmstrip step reaches late frames: seconds 60-89 fall outside the 30 tiles at step 1, and fill 10 tiles at step 3', async () => {
  const d = tmp();
  try {
    const buf = await sharp({ create: { width: 100, height: 200, channels: 3, background: '#00ff00' } }).png().toBuffer();
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: 60 + i, buf }));
    await assert.rejects(filmstrip(frames, path.join(d, 'a.jpg')), /no frames/);
    const r = await filmstrip(frames, path.join(d, 'b.jpg'), 3);
    assert.deepEqual([r.w, r.h], [8 + 10 * (120 + 8), 8 + 1 * (240 + 28 + 8)]);
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

test('scene 1 keeps a complete caption at frame 0 (no units) unless it sets captionMotion itself', () => {
  const tl = buildTimeline({}, [{ id: 'a', captionMotion: 'rise', words: 3 }, { id: 'b' }]);
  const c = stateAt(tl, 0).scenes[0].caption;
  assert.equal(c.opacity, 1); assert.equal(c.dy, 0); assert.deepEqual(c.units, []); assert.equal(c.pop, null);
  const own = stateAt(buildTimeline({}, [{ id: 'a', captionMotion: 'words', words: 3 }]), 0).scenes[0].caption;
  assert.deepEqual(own.units, [0, 0, 0]);
});
test('kinetic units start at the entrance start (a + delay); the caption box stays opaque', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none' }, { id: 'b', motion: 'none', captionMotion: 'words', words: 3 }]);
  const start = 4 - 0.5 + 0.1;                                   // crossfade window + entrance delay
  assert.deepEqual(stateAt(tl, start).scenes[1].caption.units, [0, 0, 0]);
  const c = stateAt(tl, start + 0.2).scenes[1].caption;
  assert.ok(c.units[0] > c.units[1] && c.units[1] > c.units[2] && c.units[2] > 0);
  assert.equal(c.opacity, 1); assert.equal(c.dy, 0);
});
test('caption units freeze after motionLength (rest frames compare equal)', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none' }, { id: 'b', motion: 'none', captionMotion: 'words', words: 3 }]);
  const done = 4 - 0.5 + 0.1 + 0.59;
  assert.ok(sameState(stateAt(tl, done + 0.2), stateAt(tl, done + 0.9)));
  assert.deepEqual(stateAt(tl, done).scenes[1].caption.units, [1, 1, 1]);
});
test('pop: caption.pop runs then freezes; units stay empty', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none' }, { id: 'b', motion: 'none', captionMotion: 'pop', words: 2 }]);
  const mid = stateAt(tl, 3.6 + 0.2).scenes[1].caption;
  assert.deepEqual(mid.units, []); assert.ok(mid.pop.scale > 0.92 && mid.pop.opacity > 0);
  assert.ok(sameState(stateAt(tl, 3.6 + 0.8), stateAt(tl, 3.6 + 1.2)));
});
test('unknown captionMotion is an error naming the scene', () => {
  assert.match(buildTimeline({}, [{ id: 'a', captionMotion: 'spin' }]).errors[0], /scene "a".*captionMotion "spin"/);
});
test('posterTime: a kinetic scene rests after motionLength; rise is unchanged', () => {
  const mk = (cm) => buildTimeline({}, [{ id: 'a' }, { id: 'b', captionMotion: cm, words: 8 }]);
  // entrance starts at 3.5 (crossfade window) + 0.1 delay; 8 words: 0.07*7+0.45 = 0.94 s, longer than the 0.6 s rise
  const rise = posterTime(mk('rise'), 'b'), words = posterTime(mk('words'), 'b');
  assert.equal(rise.time, 4.1);                        // 3.5 + 0.1 delay + 0.5 caption
  assert.equal(words.time, 4.54);                      // 3.5 + 0.1 + 0.94
  assert.ok(words.time >= rise.time);
});

test('stateAt taps array keeps a fixed length; inactive taps are -1', () => {
  const taps = [{ at: 1, x: 0.5, y: 0.5, kind: 'tap' }, { at: 1.2, x: 0.2, y: 0.2, kind: 'tap' }];
  const tl = buildTimeline({}, [{ id: 'a', duration: 4, motion: 'none' }, { id: 'b', duration: 4, motion: 'none', taps, tapStyle: 'ripple' }], { fps: 30 });
  assert.deepEqual(tl.scenes[1].taps.map((x) => x.at), [5, 5.2]);          // scene time -> absolute
  assert.equal(stateAt(tl, 4.5).scenes[1].taps.length, 2);
  assert.deepEqual(stateAt(tl, 4.5).scenes[1].taps, [-1, -1]);
  assert.deepEqual(stateAt(tl, 7.5).scenes[1].taps, [-1, -1]);
  assert.ok(sameState(stateAt(tl, 7.5), stateAt(tl, 7.6)));                   // idle frames compare equal
  const mid = stateAt(tl, 5.3).scenes[1].taps;
  assert.ok(mid[0] > 0 && mid[1] > 0);                                         // two taps 0.2 s apart, both drawing
  assert.deepEqual(stateAt(tl, 5.3).scenes[0].taps, []);
});
