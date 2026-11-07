import test from 'node:test';
import assert from 'node:assert/strict';
import { withAlpha, screenRect, screenRadius, deviceAspect, MODELS } from '../scripts/devices.mjs';

test('withAlpha: hex in any length becomes #rrggbbaa; anything else goes through color-mix', () => {
  assert.equal(withAlpha('#ffffff', 0.4), '#ffffff66');
  assert.equal(withAlpha('#FFF', 0.4), '#ffffff66');
  assert.equal(withAlpha('#f80', 0.2), '#ff880033');
  assert.equal(withAlpha('#abc8', 1), '#aabbcc88');                   // an alpha already there is kept (multiplied)
  assert.equal(withAlpha('#11223380', 0.5), '#11223340');
  assert.equal(withAlpha('#000', 0), '#00000000');
  assert.equal(withAlpha('white', 0.19), 'color-mix(in srgb, white 19%, transparent)');
  assert.equal(withAlpha('rgb(10, 20, 30)', 0.5), 'color-mix(in srgb, rgb(10, 20, 30) 50%, transparent)');
  assert.equal(withAlpha('hsl(200 50% 40% / .5)', 0.25), 'color-mix(in srgb, hsl(200 50% 40% / .5) 25%, transparent)');
  assert.equal(withAlpha(' var(--c) ', 0.1), 'color-mix(in srgb, var(--c) 10%, transparent)');
  assert.equal(withAlpha('#ggg', 0.5), 'color-mix(in srgb, #ggg 50%, transparent)');   // not hex: left to the browser to reject
  assert.equal(withAlpha('#ffffff', 2), '#ffffffff');                   // alpha is clamped to 0..1
  assert.equal(withAlpha('red', 7), 'color-mix(in srgb, red 100%, transparent)');
});

// The screen of a landscape device, measured the way renderDevice lays it out: the portrait body is turned -90° about the
// centre of a box that is bodyH wide and bodyW tall, so the top bezel (island) ends up on the left.
test('screenRect: a landscape device has the screen turned on its side inside the device box', () => {
  const ctx = { W: 1000, H: 2000 };
  const el = { model: 'iphone', landscape: true, x: 50, y: 30, w: 60 };
  const m = MODELS.iphone;
  const r = screenRect(el, ctx);
  const boxW = 0.6 * ctx.W, boxH = boxW * deviceAspect(el), boxLeft = 500 - boxW / 2, boxTop = 0.3 * ctx.H;
  const bodyW = boxH;                                                  // portrait width = box height
  assert.ok(Math.abs(r.width / r.height - m.screen) < 1e-9, 'screen is wider than tall, at the model\'s aspect');
  assert.ok(Math.abs(r.height - bodyW * (1 - 2 * m.bezel)) < 1e-6, 'screen height = portrait screen width');
  assert.ok(Math.abs(r.left - (boxLeft + bodyW * m.bezel)) < 1e-6, 'top bezel is on the left');
  assert.ok(Math.abs(r.top - (boxTop + bodyW * m.bezel)) < 1e-6);
  assert.ok(r.left >= boxLeft && r.left + r.width <= boxLeft + boxW + 1e-6, 'inside the box horizontally');
  assert.ok(r.top >= boxTop && r.top + r.height <= boxTop + boxH + 1e-6, 'inside the box vertically');
  // the corner radius follows the same (portrait) body
  assert.ok(Math.abs(screenRadius(el, ctx) - m.screenRadius * bodyW) < 1e-6);
});

test('screenRect: portrait devices are unchanged', () => {
  const ctx = { W: 1000, H: 2000 };
  const el = { model: 'iphone', x: 50, y: 20, w: 70 };
  const r = screenRect(el, ctx), m = MODELS.iphone;
  assert.ok(Math.abs(r.width - 700 * (1 - 2 * m.bezel)) < 1e-6);
  assert.ok(Math.abs(r.left - (500 - 350 + 700 * m.bezel)) < 1e-6);
  assert.ok(Math.abs(r.top - (400 + 700 * m.bezel)) < 1e-6);
  assert.ok(Math.abs(r.height / r.width - m.screen) < 1e-9);
});
