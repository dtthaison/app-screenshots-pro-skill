import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { frameDiffs, findSync, reactionFrame, alignCommands } from '../scripts/align.mjs';

// synthetic: 30 fps, sync change at frame 12, taps react at frames 70 and 140
const diffs = Float64Array.from({ length: 200 }, (_, i) => (i === 12 ? 80 : i === 70 || i === 140 ? 9 : 0.4));

test('findSync returns the first full-screen change', () => assert.equal(findSync(diffs), 12));
test('findSync is null when nothing changes enough', () => assert.equal(findSync(new Float64Array(50)), null));
test('reactionFrame finds the change inside the window, null outside', () => {
  assert.equal(reactionFrame(diffs, 60, 80), 70);
  assert.equal(reactionFrame(diffs, 80, 120), null);
});
test('alignCommands: offset from sync, tap time = frame before reaction', () => {
  const cmds = [{ seq: 0, kind: 'open', startMs: 10_000, durMs: 300, step: 0 },
                { seq: 1, kind: 'tap', startMs: 11_800, durMs: 500, step: 1 },
                { seq: 2, kind: 'tap', startMs: 14_100, durMs: 400, step: 2 },
                { seq: 3, kind: 'tap', startMs: 16_000, durMs: 200, step: 3 }];   // no reaction anywhere near
  const { offsetMs, events } = alignCommands(cmds, diffs, 30);
  assert.equal(offsetMs, 10_000 - 400);                    // frame 12 = 0.4 s
  assert.deepEqual(events.slice(1, 3).map((e) => [+(e.t * 30).toFixed(3), e.align]), [[69, 'frame'], [139, 'frame']]);
  assert.equal(events[3].align, 'window');
  assert.equal(events[3].t, (16_000 + 200 - offsetMs) / 1000);
  assert.deepEqual([events[0].t, events[0].align], [0.4, 'frame']);
});
test('alignCommands throws when there is no sync frame', () => {
  assert.throws(() => alignCommands([{ seq: 0, kind: 'open', startMs: 0, durMs: 1, step: 0 }], new Float64Array(50), 30),
    /no full-screen change found for the sync step/);
});
test('frameDiffs: identical frames 0, different frames > 0', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asp-align-'));
  const files = [];
  for (const [i, c] of [0, 0, 255].entries()) {
    const f = path.join(dir, `f${i}.png`);
    await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: c, g: c, b: c } } }).png().toFile(f);
    files.push(f);
  }
  const d = await frameDiffs(files, { width: 32 });
  assert.deepEqual([...d], [0, 0, 255]);
  fs.rmSync(dir, { recursive: true });
});
