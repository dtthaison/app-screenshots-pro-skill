import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, stateAt, sameState, posterTime, checkDuration, timeCode } from '../scripts/video.mjs';

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
