import test from 'node:test';
import assert from 'node:assert/strict';
import { handover, forPreview, networkMoments } from '../scripts/report.mjs';

test('handover lists files, cut seconds and the human to-do', () => {
  const md = handover({ preview: { id: 'loop' }, concept: 'feature-loop', locales: ['en-US', 'ja'],
    results: [{ tag: 'preview-iphone/en-US/loop', file: 'out/preview-iphone/en-US/01_loop.mp4', length: 15, posterTime: 5, warnings: 0 }],
    ramps: [{ scene: 'log', saved: 3.4 }], warnings: [], notes: [] });
  assert.match(md, /^# loop/); assert.match(md, /00:00:05:00/); assert.match(md, /3\.4s/);
  assert.match(md, /native-speaker review of captions \(2 locales\)/);
  assert.match(md, /upload with fastlane deliver or by hand in App Store Connect/);
  assert.match(md, /clean/);
});

test('handover adds network and draft to-dos and counts WARNs only when they apply', () => {
  const md = handover({ preview: { id: 'p' }, locales: ['en-US'], moments: ['sync'], drafts: ['a'],
    results: [{ tag: 't/en-US/p', file: 'f.mp4', length: 10, posterTime: 2, warnings: 2 }], warnings: ['[t/en-US/p] x'], notes: ['[t/en-US/p] y'] });
  assert.match(md, /accept the take for sync \(network moment\)/);
  assert.match(md, /replace draft scenes with recordings/);
  assert.match(md, /2 WARN/); assert.match(md, /Nothing was ramped/);
  assert.doesNotMatch(md, /native-speaker/);
});

test('forPreview filters tagged lines by preview id', () => {
  const l = ['[a/en-US/loop] 1', '[a/en-US/loop/s1] 2', '[a/en-US/loop2] 3', 'untagged'];
  assert.deepEqual(forPreview(l, 'loop'), [l[0], l[1]]);
});

test('networkMoments: named ones, else all, no brief none', () => {
  const brief = { moments: [{ id: 'a', automatable: 'network' }, { id: 'b', automatable: 'network' }, { id: 'c', automatable: true }] };
  assert.deepEqual(networkMoments(brief, ['b', 'c']), ['b']);
  assert.deepEqual(networkMoments(brief, []), ['a', 'b']);
  assert.deepEqual(networkMoments(null, ['a']), []);
});

test('networkMoments tolerates a non-array moments', () => {
  assert.deepEqual(networkMoments({ moments: 'x' }, []), []);
});

test('handover lists only ramps that saved time, totals the printed values', () => {
  const md = handover({ preview: { id: 'p' }, locales: ['en'], ramps: [{ scene: 'a', saved: 0.04 }, { scene: 'b', saved: 1.26 }, { scene: 'c', saved: 1.26 }], results: [] });
  assert.doesNotMatch(md, /- a:/); assert.match(md, /total: 2\.6s/);
  assert.match(handover({ preview: { id: 'p' }, locales: [], ramps: [{ scene: 'a', saved: 0 }], results: [] }), /Nothing was ramped/);
});

test('handover names the source span of each ramped scene, so trimmed waits are visible', () => {
  const md = handover({ preview: { id: 'p' }, locales: ['en'], results: [],
    ramps: [{ scene: 'ask', saved: 5.5, from: 37, to: 47.5 }, { scene: 'answer', saved: 10.4, from: 84, to: 101.3 }] });
  assert.match(md, /- ask: recording 37\.0s - 47\.5s, 5\.5s saved by the speed ramp/);
  assert.match(md, /- answer: recording 84\.0s - 101\.3s, 10\.4s saved by the speed ramp/);
});
