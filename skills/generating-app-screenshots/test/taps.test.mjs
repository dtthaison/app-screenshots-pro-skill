import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { sidecarPath, resolveTap, readSidecar, validateSidecar, markSpan, tapsInSpan, activityInSpan, tapProgress, tapColor, TAP_FX } from '../scripts/taps.mjs';
import { buildSidecar } from '../scripts/record.mjs';

const sc = { version: 1, fps: 30, width: 1206, height: 2622, events: [
  { t: 3.233, kind: 'tap', x: 0.86, y: 0.41, step: 1, align: 'frame' },
  { t: 3.433, kind: 'tap', x: 0.2, y: 0.5, step: 2, align: 'frame' } ], marks: { start: 1.1, log: 3.2, swap: 8.95 } };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'asp-taps-'));

test('sidecarPath sits next to the recording', () => {
  assert.equal(sidecarPath('/r/en-US/walk.mov'), '/r/en-US/walk.taps.json');
  assert.equal(sidecarPath('/r/walk.mp4'), '/r/walk.taps.json');
});
test('markSpan: from..next mark, to, unknown and reversed marks', () => {
  assert.deepEqual(markSpan(sc, 'log', undefined, 20), { start: 3.2, end: 8.95 });
  assert.deepEqual(markSpan(sc, 'swap', undefined, 20), { start: 8.95, end: 20 });
  assert.deepEqual(markSpan(sc, 'start', 'swap', 20), { start: 1.1, end: 8.95 });
  assert.throws(() => markSpan(sc, 'nope', undefined, 20), /unknown mark "nope" \(marks: start, log, swap\)/);
  assert.throws(() => markSpan(sc, 'swap', 'log', 20), /mark "log" \(3\.2s\) is not after "swap" \(8\.95s\)/);
});
test('two taps 0.2 s apart are both active at 3.5 s', () => {
  const at = tapsInSpan(sc, 3.2, 8.95).map((e) => e.srcT);
  assert.equal(at.length, 2);
  assert.ok(at.every((a) => tapProgress(a, 3.5, 'tap', 'ripple') >= 0));
});
test('tapProgress is -1 before and after the ripple, 0..1 inside, and spans a spotlight and a swipe', () => {
  assert.equal(tapProgress(1, 0.9, 'tap', 'ripple'), -1); assert.equal(tapProgress(1, 1.61, 'tap', 'ripple'), -1);
  assert.equal(tapProgress(1, 1, 'tap', 'ripple'), 0); assert.ok(Math.abs(tapProgress(1, 1.3, 'tap', 'ring') - 0.5) < 1e-9);
  const sp = TAP_FX.spotlight, len = sp.in + sp.hold + sp.out;
  assert.ok(tapProgress(1, 1 + len - 0.01, 'tap', 'spotlight') > 0.9); assert.equal(tapProgress(1, 1 + len + 0.01, 'tap', 'spotlight'), -1);
  assert.ok(tapProgress(1, 1.6, 'swipe', 'ripple', 0.4) > 0); assert.equal(tapProgress(1, 1.8, 'swipe', 'ripple', 0.4), -1);
});
test('validateSidecar flags x outside [0,1] and a missing version', () => {
  assert.deepEqual(validateSidecar(sc), []);
  const bad = validateSidecar({ ...sc, version: undefined, events: [{ t: 1, kind: 'tap', x: 1.4, y: 0.5, step: 0, align: 'frame' }] });
  assert.equal(bad.length, 2);
  assert.match(bad.join('|'), /missing version/); assert.match(bad.join('|'), /events\[0\]\.x must be between 0 and 1/);
});
test('a tap without x/y is valid and skipped; type events are skipped; swipes carry their end', () => {
  const o = { ...sc, events: [
    { t: 4, kind: 'tap', step: 0, align: 'window' },
    { t: 5, kind: 'type', text: 'hi', step: 1, align: 'window' },
    { t: 6, kind: 'swipe', x: 0.5, y: 0.7, x2: 0.5, y2: 0.3, dur: 0.4, step: 2, align: 'frame' }] };
  assert.deepEqual(validateSidecar(o), []);
  assert.deepEqual(tapsInSpan(o, 0, 10), [{ srcT: 6, x: 0.5, y: 0.7, kind: 'swipe', x2: 0.5, y2: 0.3, dur: 0.4, align: 'frame' }]);
  assert.deepEqual(activityInSpan(o, 0, 10), [4, 6]);        // the box-less tap still holds the ramp at 1x
});
test('buildSidecar output validates', () => {
  const o = buildSidecar({ fps: 30, width: 1206, height: 2622, device: 'iPhone', locale: 'en-US', offsetMs: 412,
    events: [{ kind: 'tap', step: 0, t: 3.2, align: 'frame' }, { kind: 'swipe', step: 1, t: 5, align: 'window', durMs: 400 }, { kind: 'type', step: 2, t: 6, align: 'window' }],
    steps: [{ box: { x: 0.8, y: 0.4, w: 0.1, h: 0.04 }, mark: 'log' }, { swipe: { from: '50%,70%', to: '50%,30%' } }, { type: 'x' }], takes: 1 });
  assert.deepEqual(validateSidecar(o), []);
});
test('readSidecar: null when absent, parsed when valid, throws naming the file when invalid', () => {
  const d = tmp(), mov = path.join(d, 'a.mov');
  assert.equal(readSidecar(mov), null);
  fs.writeFileSync(sidecarPath(mov), JSON.stringify(sc));
  assert.equal(readSidecar(mov).marks.log, 3.2);
  fs.writeFileSync(sidecarPath(mov), JSON.stringify({ ...sc, version: undefined }));
  assert.throws(() => readSidecar(mov), /invalid sidecar .*a\.taps\.json: missing version/);
  fs.writeFileSync(sidecarPath(mov), '{nope');
  assert.throws(() => readSidecar(mov), /invalid sidecar /);
});
test('tapColor: white on a dark screen, the accent on a light one', async () => {
  const d = tmp();
  const mk = async (bg, name) => { const f = path.join(d, name); await sharp({ create: { width: 200, height: 400, channels: 3, background: bg } }).jpeg().toFile(f); return f; };
  assert.equal(await tapColor(await mk('#101010', 'dark.jpg'), 0.5, 0.5, '#ff0066'), '#ffffff');
  assert.equal(await tapColor(await mk('#f0f0f0', 'light.jpg'), 0.99, 0.99, '#ff0066'), '#ff0066');
});

test('resolveTap: scene, then preview, then theme, then ripple; none turns it off', () => {
  assert.deepEqual(resolveTap(undefined, undefined, undefined), { explicit: false, style: 'ripple' });
  assert.deepEqual(resolveTap(undefined, 'ring', 'spotlight'), { explicit: true, style: 'ring' });
  assert.deepEqual(resolveTap(undefined, undefined, 'spotlight'), { explicit: true, style: 'spotlight' });
  assert.deepEqual(resolveTap('spotlight', 'ring', undefined), { explicit: true, style: 'spotlight' });
  assert.deepEqual(resolveTap('none', 'ring', 'spotlight'), { explicit: true, style: null });
  assert.throws(() => resolveTap('glow'), /unknown tap "glow" \(ripple, ring, spotlight, none\)/);
});
test('spotlight cut-out is 18% of the screen width wide (radius 9%)', () => assert.equal(TAP_FX.spotlight.radius, 0.09));
test('markSpan without from starts at 0; a reversed span from the start never prints undefined', () => {
  assert.deepEqual(markSpan(sc, undefined, 'log', 20), { start: 0, end: 3.2 });
  assert.deepEqual(markSpan(sc, undefined, undefined, 20), { start: 0, end: 1.1 });
  assert.throws(() => markSpan({ marks: { a: 0 } }, undefined, 'a', 20), /mark "a" \(0s\) is not after "start" \(0s\)/);
});
test('tapsInSpan: a tap at the span start counts, one at the end does not', () => {
  const o = { events: [{ t: 2, kind: 'tap', x: 0.5, y: 0.5 }, { t: 5, kind: 'tap', x: 0.5, y: 0.5 }, { t: 4.999, kind: 'tap', x: 0.5, y: 0.5 }] };
  assert.deepEqual(tapsInSpan(o, 2, 5).map((e) => e.srcT), [2, 4.999]);
});

test('markSpan: a mark can carry an offset in seconds ("log+1.5", "swap-0.4")', () => {
  assert.deepEqual(markSpan(sc, 'log+1.5', 'swap-0.45', 20), { start: 4.7, end: 8.5 });
  assert.deepEqual(markSpan(sc, 'start+0.4', undefined, 20), { start: 1.5, end: 3.2 });   // next mark after the shifted start
  assert.deepEqual(markSpan(sc, 'log-0.5', undefined, 20), { start: 2.7, end: 8.95 });    // not 'log' itself: the next mark after it
  assert.deepEqual(markSpan(sc, 'swap-0.5', undefined, 20), { start: 8.45, end: 20 });
  assert.throws(() => markSpan(sc, 'nope+1', undefined, 20), /unknown mark "nope"/);
  assert.throws(() => markSpan(sc, 'log+9', 'swap', 20), /mark "swap" \(8.95s\) is not after "log\+9" \(12.2s\)/);
});
