import test from 'node:test';
import assert from 'node:assert/strict';
import { idleRuns, rateCurve, frameMap, linearMap, fitMap, outputFrame } from '../scripts/ramp.mjs';

const fps = 30;
const quietThenBusy = Float64Array.from({ length: 300 }, (_, i) => (i < 150 ? 0.2 : 5));   // 5 s idle, 5 s active

test('idleRuns finds stretches >= 0.5 s', () => assert.deepEqual(idleRuns(quietThenBusy, fps), [[1, 150]]));
test('idleRuns ignores short stills', () => {
  const d = Float64Array.from({ length: 100 }, (_, i) => (i >= 10 && i < 20 ? 0.2 : 5));
  assert.deepEqual(idleRuns(d, fps), []);
});
test('rateCurve: 4x deep in idle, 1x when active, 1x around taps, bounded slope', () => {
  const r = rateCurve(300, fps, { idle: [[1, 150]], taps: [60] });
  assert.equal(r[200], 1); assert.equal(r[120], 4);
  for (let i = 60 - 12; i <= 60 + 24; i++) assert.equal(r[i], 1);                         // 0.4 s before, 0.8 s after
  for (let i = 1; i < 300; i++) assert.ok(Math.abs(r[i] - r[i - 1]) <= 1.5 * 3 / 9 + 1e-9);   // 0.3 s smoothstep edge = 9 frames; 1.5x is its peak slope (spec: rate changes ease over 300 ms with smoothstep)
});
test('frameMap is monotone and shorter than the source when ramped', () => {
  const map = frameMap(rateCurve(300, fps, { idle: [[1, 150]] }));
  for (let k = 1; k < map.length; k++) assert.ok(map[k] >= map[k - 1]);
  assert.ok(map.length < 300); assert.ok(map.at(-1) >= 290);
});
test('whole span idle: fits at 4x; too long at 4x throws with both lengths', () => {
  const idle = new Float64Array(300).fill(0.1);
  assert.ok(fitMap(idle, fps, { targetFrames: 90, idle: idleRuns(idle, fps) }).max <= 4);
  assert.throws(() => fitMap(new Float64Array(300).fill(5), fps, { targetFrames: 60, idle: [], scene: 'log' }), /clip span is 10\.0s and needs 10\.0s with still stretches at 4×, but scene "log" lasts 2\.0s/);
});
test('fitMap picks the smallest top speed that fits, and never exceeds the target', () => {
  const { map, max } = fitMap(quietThenBusy, fps, { targetFrames: 250, idle: idleRuns(quietThenBusy, fps) });
  assert.ok(max > 1 && max < 4); assert.ok(map.length <= 250 && map.length > 240);
});
test('fitMap at 1x may fall short of the target', () => {
  const d = new Float64Array(60).fill(5);
  const { map, max } = fitMap(d, fps, { targetFrames: 90, idle: [] });
  assert.equal(max, 1); assert.equal(map.length, 60);
});
test('linearMap at 1x is the identity', () => assert.deepEqual([...linearMap(5, 1)], [0, 1, 2, 3, 4]));
test('outputFrame inverts the map', () => {
  const map = linearMap(90, 2);
  assert.equal(map.length, 45); assert.equal(outputFrame(map, 40), 20);
  assert.equal(outputFrame(map, 1000), map.length);
});
