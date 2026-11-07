import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mockOutName, cssUrl, localize, localeChain, screenRefs, fastlanePath } from '../scripts/refs.mjs';
import { resolveTarget, storeLocale } from '../scripts/targets.mjs';

// ---- 1. html mock output names ----
test('mock output: same file name in two folders gets two outputs', () => {
  const a = mockOutName({ found: '/p/screens/one/index.html', locale: 'en-US', vw: 440, vh: 956 });
  const b = mockOutName({ found: '/p/screens/two/index.html', locale: 'en-US', vw: 440, vh: 956 });
  assert.notEqual(a, b);
  for (const n of [a, b]) assert.match(n, /^index\..+\.en-US\.440x956\.png$/);
});
test('mock output: stable per file, and still split by query, full page, locale and viewport', () => {
  const base = { found: '/p/screens/stats.html', locale: 'de', vw: 440, vh: 956 };
  const n = mockOutName(base);
  assert.equal(mockOutName({ ...base }), n);
  assert.match(n, /^stats\./);
  const others = [{ query: 'state=before' }, { fullPage: true }, { locale: 'fr' }, { vw: 402 }, { vh: 874 }].map((o) => mockOutName({ ...base, ...o }));
  assert.equal(new Set([n, ...others]).size, 6);
  assert.match(mockOutName({ ...base, query: 'state=before' }), /^stats\.state_before\./);
  assert.match(mockOutName({ ...base, fullPage: true }), /^stats\.full\./);
});

// ---- 2. locale lookup reaches the default locale's language ----
test('localeChain: locale, language, then the default locale and its language', () => {
  assert.deepEqual(localeChain('fr-FR', 'en-US'), ['fr-FR', 'fr', 'en-US', 'en']);
  assert.deepEqual(localeChain('en-US', 'en-US'), ['en-US', 'en']);
  assert.deepEqual(localeChain('vi', 'en'), ['vi', 'en']);
});
const mk = (strings) => {
  const warns = [], errors = [];
  return { warns, errors, opts: { strings, defaultLocale: 'en-US', warn: (m) => warns.push(m), error: (m) => errors.push(m) } };
};
test('strings stored under the default locale\'s language are found for other locales', () => {
  const { opts, warns, errors } = mk({ en: { t: 'Hi' } });
  assert.equal(localize('@t', 'en-US', opts), 'Hi');
  assert.equal(warns.length, 0);
  assert.equal(localize('@t', 'fr-FR', opts), 'Hi');
  assert.equal(errors.length, 0);
  assert.match(warns[0], /\[fr-FR\] missing translation "t"/);
});
test('strings: the locale and its language still win; a truly missing key is an error', () => {
  const { opts, errors } = mk({ 'en-US': { t: 'Hi' }, fr: { t: 'Salut' }, 'de-DE': { t: 'Hallo' } });
  assert.equal(localize('@t', 'fr-FR', opts), 'Salut');
  assert.equal(localize('@t', 'de-DE', opts), 'Hallo');
  assert.equal(localize('@t', 'ja', opts), 'Hi');
  assert.equal(localize('@nope', 'ja', opts), 'nope');
  assert.match(errors[0], /string key "nope" not found in any locale/);
});
test('inline object values fall back to the default locale, then its language', () => {
  const { opts } = mk({});
  const v = { en: 'Hi', de: 'Hallo' };
  assert.equal(localize(v, 'fr-FR', opts), 'Hi');
  assert.equal(localize(v, 'de-AT', opts), 'Hallo');
  assert.equal(localize(v, 'en-US', opts), 'Hi');
  assert.equal(localize({ 'en-US': 'US', en: 'EN' }, 'fr', opts), 'US');
  assert.equal(localize({ 'fr-FR': 'Salut', fr: 'x' }, 'fr-FR', opts), 'Salut');
  assert.equal(localize({ ja: 'こんにちは' }, 'fr', opts), null);
});
test('localize passes plain values through', () => {
  const { opts } = mk({});
  assert.equal(localize(null, 'en', opts), null);
  assert.equal(localize('plain', 'en', opts), 'plain');
  assert.equal(localize(7, 'en', opts), 7);
});

// ---- 3. file URLs inside CSS url('…') ----
test('cssUrl encodes quotes and parentheses and still points at the same file', () => {
  const p = "/Users/Son's Apps/shots (v2)/bg.png";
  const href = cssUrl(pathToFileURL(p).href);
  assert.doesNotMatch(href, /['()]/);
  assert.match(href, /Son%27s%20Apps\/shots%20%28v2%29\/bg\.png$/);
  assert.equal(fileURLToPath(href), p);
  assert.equal(cssUrl('file:///a/b.png'), 'file:///a/b.png');
});

// ---- 4. fastlane file names keep the real extension ----
const entry = (id, over = {}) => ({ target: id, store: resolveTarget(id).store, locale: 'en-US', slide: 'hero', index: 3, file: '/o/x.png', ...over });
test('fastlane: ios screenshots keep the extension of the rendered file', () => {
  const t = resolveTarget('ios-6.9');
  assert.equal(fastlanePath('/o', t, entry('ios-6.9', { file: '/o/ios/03_hero.jpeg' })), path.join('/o', 'fastlane', 'screenshots', storeLocale('en-US', 'ios'), '03_ios-6.9_hero.jpeg'));
  assert.match(fastlanePath('/o', t, entry('ios-6.9')), /03_.*_hero\.png$/);
});
test('fastlane: play screenshots, feature graphic and tv banner keep the extension', () => {
  const loc = storeLocale('en-US', 'play');
  const phone = resolveTarget('android-phone');
  assert.equal(fastlanePath('/o', phone, entry('android-phone', { file: '/o/a/03_hero.jpeg' })), path.join('/o', 'fastlane', 'metadata', 'android', loc, 'images', 'phoneScreenshots', '3_en-US.jpeg'));
  assert.equal(fastlanePath('/o', resolveTarget('play-feature-graphic'), entry('play-feature-graphic', { file: '/o/f/01_g.jpeg' })), path.join('/o', 'fastlane', 'metadata', 'android', loc, 'images', 'featureGraphic.jpeg'));
  assert.equal(fastlanePath('/o', resolveTarget('tv-banner'), entry('tv-banner', { file: '/o/f/01_g.webp' })), path.join('/o', 'fastlane', 'metadata', 'android', loc, 'images', 'tvBanner.webp'));
  assert.match(fastlanePath('/o', phone, entry('android-phone')), /3_en-US\.png$/);
});
test('fastlane: creative assets and targets without a folder', () => {
  const t = resolveTarget('app-header');
  assert.equal(fastlanePath('/o', t, entry('app-header', { file: '/o/h/01_h.jpeg' })), path.join('/o', 'fastlane', 'creative', storeLocale('en-US', 'ios'), 'app-header_hero.jpeg'));
  assert.equal(fastlanePath('/o', { ...resolveTarget('android-phone'), playDir: undefined }, entry('android-phone')), null);
  assert.equal(fastlanePath('/o', { store: 'msstore', id: 'x' }, entry('android-phone')), null);
});

// ---- 5. every screen a slide shows gets image metadata ----
test('screenRefs: screen, screen2, screen3, screens[] and element screens', () => {
  const s = { screen: 'a.png', screen2: 'b.png', screen3: 'c.png', screens: ['d.png', 'e.png'], elements: [{ type: 'device', screen: 'f.png' }, { type: 'text' }] };
  assert.deepEqual(screenRefs(s), ['a.png', 'b.png', 'c.png', 'd.png', 'e.png', 'f.png']);
});
test('screenRefs: zoom sources of pop-out, lens and layers, no duplicates, non-strings skipped', () => {
  const s = { screen: 'a.png', screens: ['a.png', null, { x: 1 }, 'b.png'], popouts: [{ screen: 'p.png' }, { crop: [0, 0, 1, 1] }], lens: { screen: 'l.png' }, layers: [{ screen: 'y.png' }] };
  assert.deepEqual(screenRefs(s), ['a.png', 'b.png', 'p.png', 'l.png', 'y.png']);
  assert.deepEqual(screenRefs({}), []);
  assert.deepEqual(screenRefs({ screens: 'not-an-array', elements: 'nope' }), []);
});
