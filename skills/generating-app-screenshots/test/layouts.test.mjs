import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, screenAspectError, solidBackground, stillMeta } from '../scripts/layouts.mjs';

const ctx = { W: 886, H: 1920, theme: {}, target: { id: 'preview-iphone', store: 'ios', model: 'iphone' } };
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

test('full-screen: frameless none device fills the canvas, caption below the status bar', () => {
  const els = buildLayout({ id: 's', layout: 'full-screen', title: 'x', screen: 'a.png' }, ctx);
  assert.deepEqual(pick(els.find((e) => e.id === 'device'), ['model', 'style', 'radius', 'x', 'y', 'w']), { model: 'none', style: 'frameless', radius: 0, x: 50, y: 0, w: 100 });
  const scrim = els.find((e) => e.id === 'scrim');
  assert.equal(scrim.y, 0);
  assert.equal(scrim.h, 22);
  assert.ok(els.find((e) => e.type === 'caption').y >= 6);
});

test('full-screen: a bottom caption moves the scrim to the bottom 22%', () => {
  const els = buildLayout({ id: 's', layout: 'full-screen', title: 'x', screen: 'a.png', caption: { position: 'bottom' } }, ctx);
  const scrim = els.find((e) => e.id === 'scrim');
  assert.equal(scrim.y, 78);
  assert.ok(els.find((e) => e.type === 'caption').y >= 78);
});

test('caption-band: top band holds the caption, device fills the other 82%', () => {
  const els = buildLayout({ id: 's', layout: 'caption-band', title: 'x', screen: 'a.png' }, ctx);
  const band = els.find((e) => e.id === 'band'), dev = els.find((e) => e.id === 'device');
  assert.deepEqual(pick(band, ['y', 'h']), { y: 0, h: 18 });
  assert.ok(dev.y >= 18 && dev.model === 'none' && dev.style === 'frameless');
});

test('caption-band bottom puts the band below the screen', () => {
  const els = buildLayout({ id: 's', layout: 'caption-band', title: 'x', screen: 'a.png', caption: { position: 'bottom' } }, ctx);
  const band = els.find((e) => e.id === 'band'), dev = els.find((e) => e.id === 'device');
  assert.ok(band.y >= 82);
  assert.equal(dev.y, 0);
});

test('end-card has no device; icon above name', () => {
  const els = buildLayout({ id: 's', layout: 'end-card', title: 'Tagline', subtitle: 'Subscription required', appIcon: 'icon.png', appName: 'Streakly' }, ctx);
  assert.ok(!els.some((e) => e.type === 'device'));
  const icon = els.find((e) => e.type === 'image'), name = els.find((e) => e.id === 'appName');
  assert.ok(icon.y < name.y);
  assert.equal(name.y, 46);
  assert.equal(els.find((e) => e.id === 'subtitle').y, 72);
});

test('end-card without an icon moves the name up', () => {
  const els = buildLayout({ id: 's', layout: 'end-card', title: 'Tagline', appName: 'Streakly' }, ctx);
  assert.ok(!els.some((e) => e.type === 'image'));
  assert.equal(els.find((e) => e.id === 'appName').y, 36);
  assert.ok(!els.some((e) => e.id === 'subtitle'));
});

test('screenAspectError: 2% rule and band width rule', () => {
  assert.equal(screenAspectError('full-screen', 1206, 2622, 886, 1920), null);
  assert.match(screenAspectError('full-screen', 1206, 2622, 1200, 1600), /use caption-band/);
  assert.match(screenAspectError('full-screen', 1206, 2622, 1200, 1600), /aspect off by 63%/);
  assert.match(screenAspectError('caption-band', 1206, 2622, 1200, 1600), /only 50% of the canvas width/);
  assert.equal(screenAspectError('caption-band', 1206, 2622, 886, 1920), null);
  assert.equal(screenAspectError('text-top', 1206, 2622, 1200, 1600), null);
});

const cssOk = (v) => typeof v === 'string' && !/\(\s*,|,\s*\)/.test(v) && v.length > 0;
test('band and scrim get a valid solid colour from preset, gradient and slide backgrounds', () => {
  const run = (theme, extra = {}) => {
    const els = (layout) => buildLayout({ id: 's', layout, title: 'x', screen: 'a.png', ...extra }, { ...ctx, theme });
    return { band: els('caption-band').find((e) => e.id === 'band').fill, scrim: els('full-screen').find((e) => e.id === 'scrim').fill };
  };
  let r = run({ background: { color: '#0b0a1f', mesh: [], noise: 0.05 } });
  assert.equal(r.band, '#0b0a1f');
  assert.match(r.scrim.stops[0], /#0b0a1f 70%/);
  r = run({ background: { gradient: { stops: ['#ff7e5f', '#feb47b'] } } });
  assert.equal(r.band, '#ff7e5f');
  r = run({ background: { gradient: { stops: ['rgba(1, 2, 3, .5) 0%', '#000 100%'] } } });
  assert.equal(r.band, 'rgba(1, 2, 3, .5)');
  assert.ok(cssOk(r.band) && cssOk(r.scrim.stops[0]));
  r = run({ background: '#111' }, { background: { color: '#abcdef' } });
  assert.equal(r.band, '#abcdef');
  assert.equal(solidBackground(undefined), '#000');
});

test('stillMeta finds relative and {locale} stills under the absolute key', () => {
  const meta = new Map([['/base/screens/en-US/a.png', { w: 100, h: 200 }], ['/base/b.png', { w: 1, h: 2 }]]);
  const opts = {
    cands: (f) => (f.includes('{locale}') ? [{ file: f.replace('{locale}', 'de') }, { file: f.replace('{locale}', 'en-US') }] : [{ file: f }]),
    abs: (p) => `/base/${p}`, exists: (p) => meta.has(p), meta,
  };
  assert.deepEqual(stillMeta('b.png', opts), { w: 1, h: 2 });
  assert.deepEqual(stillMeta('screens/{locale}/a.png?x=1', opts), { w: 100, h: 200 });
  assert.equal(stillMeta('missing.png', opts), null);
  assert.equal(stillMeta('mock.html', opts), null);
});

test('text-top on a tall canvas: no subtitle or eyebrow moves the device up under the title', () => {
  const dev = (s) => buildLayout({ id: 's', layout: 'text-top', title: 'x', screen: 'a.png', ...s }, ctx).find((e) => e.id === 'device');
  const cap = (s) => buildLayout({ id: 's', layout: 'text-top', title: 'x', screen: 'a.png', ...s }, ctx).find((e) => e.id === 'caption');
  assert.equal(dev({ subtitle: 'y' }).y, 25.5);
  assert.equal(dev({ eyebrow: 'y' }).y, 25.5);
  assert.equal(dev({}).y, 17.5);
  assert.ok(cap({}).y + cap({}).h <= 17.5, 'the caption box ends above the device');
});
