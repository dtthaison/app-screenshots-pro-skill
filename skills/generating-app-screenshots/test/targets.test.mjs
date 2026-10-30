import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTarget, isVideoTarget, checkTargetFormat } from '../scripts/targets.mjs';

test('preview-iphone is 886x1920, 30 fps, 15–30 s, asc IPHONE_67', () => {
  const t = resolveTarget('preview-iphone');
  assert.deepEqual([t.w, t.h, t.video.fps, t.video.minSec, t.video.maxSec, t.asc, t.store, t.max], [886, 1920, 30, 15, 30, 'IPHONE_67', 'ios', 3]);
});
test('apple preview sizes and asc identifiers', () => {
  for (const [id, w, h, asc, model] of [
    ['preview-iphone-16-9', 1080, 1920, 'IPHONE_55', 'iphone-home'],
    ['preview-iphone-4.7', 750, 1334, 'IPHONE_47', 'iphone-home'],
    ['preview-ipad', 1200, 1600, 'IPAD_PRO_3GEN_129', 'ipad'],
    ['preview-ipad-9.7', 900, 1200, 'IPAD_97', 'ipad'],
    ['preview-mac', 1920, 1080, 'DESKTOP', 'macbook'],
  ]) {
    const t = resolveTarget(id);
    assert.deepEqual([t.w, t.h, t.asc, t.model, t.max, t.video.minSec, t.video.maxSec, t.video.maxMB], [w, h, asc, model, 3, 15, 30, 500], id);
  }
  const mac = resolveTarget('preview-mac');
  assert.deepEqual([mac.family, mac.landscape], ['desktop', true]);
});
test('header-video is 3840x1646, 5–30 s, family creative', () => {
  const t = resolveTarget('header-video');
  assert.deepEqual([t.w, t.h, t.video.minSec, t.video.maxSec, t.family, t.landscape, t.max], [3840, 1646, 5, 30, 'creative', true, 1]);
});
test('search-video is 3840x2560, 5–30 s', () => {
  const t = resolveTarget('search-video');
  assert.deepEqual([t.w, t.h, t.video.minSec, t.video.maxSec, t.family, t.max], [3840, 2560, 5, 30, 'creative', 1]);
});
test('event-card-video is 3840x2160, 15–30 s', () => {
  const t = resolveTarget('event-card-video');
  assert.deepEqual([t.w, t.h, t.video.minSec, t.video.maxSec, t.family, t.max], [3840, 2160, 15, 30, 'creative', 1]);
});
test('event-details-video is 2160x3840, 15–30 s', () => {
  const t = resolveTarget('event-details-video');
  assert.deepEqual([t.w, t.h, t.video.minSec, t.video.maxSec, t.family, t.landscape, t.max], [2160, 3840, 15, 30, 'creative', false, 1]);
});
test('preview-ipad@landscape swaps to 1600x1200', () => {
  const t = resolveTarget('preview-ipad@landscape');
  assert.deepEqual([t.w, t.h, t.landscape], [1600, 1200, true]);
});
test('story-video has no store limits', () => {
  const t = resolveTarget('story-video');
  assert.equal(t.video.maxSec, Infinity);
  assert.deepEqual([t.w, t.h, t.store, t.max, t.video.minSec, t.video.maxMB], [1080, 1920, 'social', 99, 0, Infinity]);
});
test('creative image targets', () => {
  for (const [id, w, h] of [['app-header', 3840, 1646], ['app-header-16-9', 5244, 2950], ['search-asset', 3840, 2560], ['search-asset-16-9', 5244, 2950], ['event-card', 3840, 2160], ['event-details', 2160, 3840]]) {
    const t = resolveTarget(id);
    assert.deepEqual([t.w, t.h, t.family, t.max, t.maxMB, t.store], [w, h, 'creative', 1, 500, 'ios'], id);
  }
});
test('png-only creative targets reject jpeg', () => {
  assert.match(checkTargetFormat(resolveTarget('app-header-16-9'), 'jpeg'), /png/i);
  assert.match(checkTargetFormat(resolveTarget('search-asset-16-9'), 'jpg'), /png/i);
  assert.equal(checkTargetFormat(resolveTarget('app-header-16-9'), 'png'), null);
  assert.equal(checkTargetFormat(resolveTarget('app-header'), 'jpeg'), null);
  assert.equal(checkTargetFormat(resolveTarget('ios-6.9'), 'jpg'), null);
});
test('isVideoTarget', () => {
  assert.equal(isVideoTarget(resolveTarget('ios-6.9')), false);
  assert.equal(isVideoTarget(resolveTarget('preview-mac')), true);
});
test('custom video target', () => {
  const t = resolveTarget({ id: 'promo', w: 1080, h: 1080, video: { minSec: 1, maxSec: 60 } });
  assert.deepEqual([t.video.fps, t.video.maxMB, t.video.minSec, t.video.maxSec], [30, 500, 1, 60]);
});
