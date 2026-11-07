import test from 'node:test';
import assert from 'node:assert/strict';
import { patternElements, PATTERNS } from '../scripts/panorama.mjs';
import { deviceAspect } from '../scripts/devices.mjs';

const screens = ['a.png', 'b.png', 'c.png'];
const run = (name, o = {}) => patternElements(name, { n: 3, screens, cls: 'tall', ...o });
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
// bottom edge of a generated device, % of canvas height, for a canvas of W×H
const bottom = (d, model, W, H) => d.y + deviceAspect({ model }) * d.w * (W / H);

test('stage / timeline: ink and accent of any CSS colour give valid colours (no hex alpha glued on)', () => {
  const css = (theme, name) => JSON.stringify(run(name, { theme, opts: {} }));
  // a hex byte glued onto a name (white30), a function (rgb(…)30) or a 3-digit hex (#fff30)
  const glued = /(?<!#[0-9a-f]{0,6})[g-z][a-z]*(?:30|0d|88|66|33)\b|\)(?:30|0d|88|66|33)\b|#[0-9a-f]{3}(?:30|0d|88|66|33)\b/i;
  assert.match(css({ caption: { color: '#ffffff' }, accent: '#ffcc00' }, 'stage'), /#ffffff30,#ffffff0d 30%/);
  assert.match(css({ caption: { color: '#ffffff' }, accent: '#ffcc00' }, 'timeline'), /0 0 0 10px #ffcc0033/);
  for (const c of ['#fff', 'white', 'rgb(240, 240, 255)', 'hsl(200 50% 90%)']) {
    const stage = css({ caption: { color: c } }, 'stage'), time = css({ accent: c }, 'timeline');
    assert.ok(!glued.test(stage), `stage with ${c}: ${stage.match(glued)?.[0]}`);
    assert.ok(!glued.test(time), `timeline with ${c}: ${time.match(glued)?.[0]}`);
  }
  assert.match(css({ caption: { color: '#fff' } }, 'stage'), /#ffffff30,#ffffff0d 30%/);
  assert.match(css({ caption: { color: 'white' } }, 'stage'), /color-mix\(in srgb, white 19%, transparent\),color-mix\(in srgb, white 5%, transparent\) 30%/);
  assert.match(css({ caption: { color: 'white' } }, 'stage'), /color-mix\(in srgb, white 53%, transparent\) 10%/);
  assert.match(css({ caption: { color: 'white' } }, 'stage'), /radial-gradient\(closest-side,color-mix\(in srgb, white 40%, transparent\)/);
  assert.match(css({ accent: 'rgb(1, 2, 3)' }, 'timeline'), /0 0 0 10px color-mix\(in srgb, rgb\(1, 2, 3\) 20%, transparent\)/);
});

test('stage: the floor sits at the bottom of the devices on any canvas (android-phone 1080×1920, iPhone, iPad)', () => {
  for (const [W, H, model, cls] of [[1080, 1920, 'android', 'tall'], [1320, 2868, 'iphone', 'tall'], [1440, 2560, 'android-tablet', 'tablet'], [2064, 2752, 'ipad', 'tablet']]) {
    const els = run('stage', { cls, W, H, model });
    const line = els.find((e) => e.type === 'shape' && e.h === 0.15), d = els.find((e) => e.type === 'device');
    assert.ok(near(line.y + 2, bottom(d, model, W, H)), `${model} ${W}×${H}: floor line at ${line.y + 2}, device bottom at ${bottom(d, model, W, H)}`);
    assert.ok(bottom(d, model, W, H) <= 86.01, `the stage shows the whole device (bottom ${bottom(d, model, W, H)})`);
  }
  // the iPhone canvas the constants were drawn for is unchanged
  assert.ok(near(run('stage', { W: 1320, H: 2868, model: 'iphone' }).find((e) => e.type === 'device').w, 60.2));
  // an explicit patternOptions.w is taken literally
  assert.ok(near(run('stage', { W: 1080, H: 1920, model: 'android', opts: { w: 70 } }).find((e) => e.type === 'device').w, 60.2));
});

test('stage: without a canvas it assumes the store\'s own phone / tablet size', () => {
  for (const [cls, W, H, model] of [['tall', 1320, 2868, 'iphone'], ['tablet', 2064, 2752, 'ipad']]) {
    const els = run('stage', { cls });
    const line = els.find((e) => e.type === 'shape' && e.h === 0.15), d = els.find((e) => e.type === 'device');
    assert.ok(near(line.y + 2, bottom(d, model, W, H), 0.2), `${cls}: ${line.y + 2} vs ${bottom(d, model, W, H)}`);
  }
});

test('constellation: link anchors stay on the phones on android-phone 1080×1920', () => {
  const W = 1080, H = 1920, els = run('constellation', { W, H, model: 'android' });
  const devs = els.filter((e) => e.type === 'device'), arrows = els.filter((e) => e.type === 'arrow');
  const h = (d) => deviceAspect({ model: 'android' }) * d.w * (W / H);
  assert.equal(arrows.length, 2);
  arrows.forEach((a, i) => {
    const p = devs[i], q = devs[i + 1];
    assert.ok(near(a.from[1], p.y + h(p) * (i % 2 ? 0.62 : 0.3)), `from ${a.from[1]}`);
    assert.ok(near(a.to[1], q.y + h(q) * (i % 2 ? 0.3 : 0.62)), `to ${a.to[1]}`);
    assert.ok(a.from[1] < p.y + h(p) && a.to[1] < q.y + h(q), 'anchors are on the phone, not below it');
  });
});

test('giant-word: the word is centred on its line on a 9:16 canvas too', () => {
  const W = 1080, H = 1920, els = run('giant-word', { W, H, model: 'android', app: 'Streakly' });
  const t = els.find((e) => e.type === 'text');
  assert.ok(near(t.y + (t.size * 0.9 * (W / H)) / 2, 85), `word centre at ${t.y + (t.size * 0.9 * (W / H)) / 2}`);
});

test('every pattern still builds with and without a canvas', () => {
  for (const name of PATTERNS) for (const o of [{}, { W: 1080, H: 1920, model: 'android' }, { W: 2064, H: 2752, model: 'ipad', cls: 'tablet' }, { W: 1920, H: 1080, model: 'none' }])
    assert.ok(run(name, { app: 'App', ...o }).length > 0, name);
});
