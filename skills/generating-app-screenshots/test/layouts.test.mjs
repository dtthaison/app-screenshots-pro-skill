import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, screenAspectError, solidBackground, stillMeta, LAYOUTS } from '../scripts/layouts.mjs';

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
  // a CSS gradient or image string is not a colour: color-mix() and a band fill would be dropped by the browser
  assert.equal(solidBackground('linear-gradient(#123, #456)'), '#123');
  assert.equal(solidBackground('linear-gradient(180deg, rgba(1, 2, 3, .5) 0%, #000 100%)'), 'rgba(1, 2, 3, .5)');
  assert.equal(solidBackground('url(bg.png) center / cover'), '#000');
  r = run({ background: 'radial-gradient(circle, #ff7e5f, #feb47b)' });
  assert.equal(r.band, '#ff7e5f');
  assert.ok(cssOk(r.band) && cssOk(r.scrim.stops[0]));
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

// ---- review fixes: colours with alpha, Play never shows Apple hardware, slide.device wins over layout geometry ----
const play = { W: 1080, H: 1920, theme: {}, target: { id: 'android-phone', store: 'play', model: 'android' } };
const byId = (els, id) => els.find((e) => e.id === id);

test('arch: the fill takes any CSS accent colour, not just 6-digit hex', () => {
  const fill = (accent) => byId(buildLayout({ id: 's', layout: 'arch', title: 'x', screen: 'a.png' }, { ...ctx, theme: { accent } }), 'arch').fill;
  assert.equal(fill('#abcdef'), 'linear-gradient(180deg,#abcdef66,#abcdef10 75%)');
  assert.equal(fill(undefined), 'linear-gradient(180deg,#ffffff66,#ffffff10 75%)');
  assert.equal(fill('#fff'), 'linear-gradient(180deg,#ffffff66,#ffffff10 75%)');
  assert.equal(fill('white'), 'linear-gradient(180deg,color-mix(in srgb, white 40%, transparent),color-mix(in srgb, white 6%, transparent) 75%)');
  assert.match(fill('rgb(10, 20, 30)'), /color-mix\(in srgb, rgb\(10, 20, 30\) 40%, transparent\)/);
});

test('phone-tablet: the back tablet is an iPad on Apple stores and an Android tablet on Play', () => {
  const back = (c, s = {}) => byId(buildLayout({ id: 's', layout: 'phone-tablet', title: 'x', screen: 'a.png', screen2: 'b.png', ...s }, c), 'device2');
  assert.equal(back(ctx).model, 'ipad');
  assert.equal(back(play).model, 'android-tablet');
  assert.equal(back({ ...ctx, target: { store: 'social', model: 'iphone' } }).model, 'ipad');
  assert.equal(back(play, { device2: { model: 'ipad' } }).model, 'ipad', 'a slide override still wins');
});

test('laptop-phone: no MacBook on Play; laptopModel and device2.model still win', () => {
  const lap = (c, s = {}) => byId(buildLayout({ id: 's', layout: 'laptop-phone', title: 'x', screen: 'a.png', screen2: 'b.png', ...s }, c), 'device2');
  assert.equal(lap(ctx).model, 'macbook');
  assert.equal(lap({ ...ctx, target: { store: 'msstore', model: 'windows-window' } }).model, 'desktop');
  assert.equal(lap(play).model, 'desktop');
  assert.equal(lap(play, { laptopModel: 'browser' }).model, 'browser');
  assert.equal(lap(play, { device2: { model: 'macbook' } }).model, 'macbook');
  assert.equal(lap(ctx, { laptopModel: 'desktop' }).model, 'desktop');
});

test('no layout puts Apple hardware on a Play canvas', () => {
  const APPLE = ['iphone', 'iphone-notch', 'iphone-home', 'ipad', 'apple-watch', 'macbook', 'mac-window'];
  const slide = { title: 'x', screen: 'a.png', screen2: 'b.png', screen3: 'c.png' };
  for (const layout of LAYOUTS) for (const c of [play, { ...play, W: 1440, H: 2560, target: { ...play.target, model: 'android-tablet' } }]) {
    for (const e of buildLayout({ id: 's', layout, ...slide }, c).filter((x) => x.type === 'device'))
      assert.ok(!APPLE.includes(e.model), `${layout}: ${e.id} is ${e.model} on ${c.target.model}`);
  }
});

// The layout's own geometry is a default: slide.device / device2 / ... keys are merged "into the layout's device" and win.
const CANVASES = {
  tall: ctx,
  tablet: { W: 1200, H: 1600, theme: {}, target: { id: 'preview-ipad', store: 'ios', model: 'ipad' } },
  wide: { W: 1920, H: 1080, theme: {}, target: { id: 'x-post', store: 'social', model: 'iphone' } },
  desk: { W: 2880, H: 1800, theme: {}, target: { id: 'mac', store: 'ios', family: 'desktop', model: 'macbook' } },
  watch: { W: 422, H: 514, theme: {}, target: { id: 'watch-ultra@styled', store: 'ios', family: 'watch', model: 'apple-watch' } },
};
const FULL = { title: 'x', subtitle: 'y', screen: 'a.png', screen2: 'b.png', screen3: 'c.png', photo: 'p.png', appName: 'A',
  callouts: [{ text: 'c', at: [50, 30] }], features: [{ title: 'f' }], steps: [{ title: 's' }], stats: [{ value: '1', label: 'l' }], awards: [{ title: 'a' }],
  review: { quote: 'q', author: 'a' }, metric: { value: '1', label: 'l' }, orbit: [{ text: 'o' }], notifications: [{ title: 'n' }] };

test('slide.device / device2 / watch overrides of w and y survive in every layout on every canvas class', () => {
  const hasDevice = new Set(), checked = new Set();
  for (const [cname, c] of Object.entries(CANVASES)) for (const layout of LAYOUTS) {
    const base = buildLayout({ id: 's', layout, ...FULL }, c);
    const ids = base.filter((e) => e.type === 'device').map((e) => e.id);
    if (!ids.length) continue;
    hasDevice.add(layout);
    for (const id of ids) {
      const els = buildLayout({ id: 's', layout, ...FULL, [id]: { w: 50, y: 60 } }, c);
      const d = byId(els, id);
      assert.deepEqual([d.w, d.y], [50, 60], `${layout} on ${cname}: slide.${id} {w:50, y:60} gave w ${d.w} / y ${d.y}`);
      checked.add(`${layout}/${id}`);
    }
  }
  // layouts without a device of their own on any canvas
  assert.deepEqual(LAYOUTS.filter((l) => !hasDevice.has(l)).sort(), ['blank', 'caption-only', 'caption-top', 'end-card', 'feature-grid', 'steps']);
  for (const k of ['landscape/device', 'landscape/device2', 'screen-hero/device', 'watch-hero/device', 'caption-band/device', 'deck/device2', 'deck/device3', 'mosaic/tile1', 'mosaic/tile4', 'text-left/device', 'phone-watch/watch'])
    assert.ok(checked.has(k), `${k} was not exercised`);
});

test('landscape: the documented repro (slide.device {w: 50, y: 60}) and the layout default without it', () => {
  const land = (dev) => byId(buildLayout({ id: 's', layout: 'landscape', title: 'x', screen: 'a.png', device: dev }, ctx), 'device');
  assert.deepEqual(pick(land({ w: 50, y: 60 }), ['w', 'y']), { w: 50, y: 60 });
  assert.deepEqual(pick(land({}), ['w', 'y']), { w: 94, y: 38 }, 'layout default when the slide sets nothing');
  assert.equal(land({ x: 30 }).x, 30);
});

test('geometry that depends on a moved device follows it: the second landscape device stacks under an overridden first', () => {
  const els = buildLayout({ id: 's', layout: 'landscape', title: 'x', screen: 'a.png', screen2: 'b.png', device: { y: 40 } }, ctx);
  assert.equal(byId(els, 'device').y, 40);
  assert.ok(byId(els, 'device2').y > 40 + 10, 'device2 sits below device');
});
