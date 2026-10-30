import test from 'node:test';
import assert from 'node:assert/strict';
import { isStillImagePath, framedDevice, priceMatch, timeSensitive, playPhrase, readingTime, conceptWarnings, iphoneOnly, storeChecks } from '../scripts/storecheck.mjs';

test('price patterns across locales', () => {
  for (const s of ['Just $9.99', '9,99 €/Monat', '¥1,000', '99.000₫/tháng', '月額500円/月', 'RM 12', 'Rp15.000', 'R$ 9', '9 USD', 'EUR 5', '$5/yr', '4 € /mois', '每月 ¥9/年', '500円/月', '9 /week']) assert.ok(priceMatch(s), s);
  for (const s of ['Swap in one tap', '12/25 sets', '3 workouts', 'Train 5 days a week', 'Do more', '1/more', '3x/week', '5 days/week', 'Train 3 times a week', 'Cardio/year-round']) assert.equal(priceMatch(s), null, s);
});
test('time-sensitive: year and localized month names', () => {
  assert.ok(timeSensitive('New for 2026', 'en-US')); assert.ok(timeSensitive('Neu im Oktober', 'de'));
  assert.ok(timeSensitive('10月の新機能', 'ja')); assert.ok(timeSensitive('十月新功能', 'zh')); assert.ok(timeSensitive('Mới tháng 10', 'vi'));
  assert.ok(timeSensitive('Back in OCTOBER', 'en'));
  assert.equal(timeSensitive('Train 5 days a week', 'en-US'), null);
  assert.equal(timeSensitive('Remarch the Decembrist', 'en'), null);
  assert.equal(timeSensitive('Call 12345', 'en'), null);
});
test('play phrases', () => {
  assert.ok(playPhrase('The #1 fitness app')); assert.ok(playPhrase('Download now')); assert.ok(playPhrase('The BEST coach'));
  assert.equal(playPhrase('Your coach'), null); assert.equal(playPhrase('Bestow gifts'), null);
});
test('reading time for 6 words is 2.3 s', () => assert.equal(readingTime(6), 2.3));
test('iphone-only', () => {
  assert.equal(iphoneOnly({ id: 'preview-iphone' }), null); assert.equal(iphoneOnly({ id: 'header-video' }), null);
  assert.match(iphoneOnly({ id: 'preview-ipad' }), /iPhone only in this release/);
});
test('framed-device warns on frames only for preview-*', () => {
  const msg = 'device frames risk rejection under 2.3.4 — use full-screen or caption-band';
  assert.equal(framedDevice({ id: 'preview-iphone' }, { model: 'iphone', style: undefined }), msg);
  assert.equal(framedDevice({ id: 'preview-iphone' }, { model: 'none', style: 'frameless' }), null);
  assert.equal(framedDevice({ id: 'header-video' }, { model: 'iphone' }), null);
});

const tl = (...d) => { let c = 0; return { scenes: d.map(([id, sec]) => ({ id, start: c, end: (c += sec), duration: sec })) }; };
test('concept warnings: hook after 1.0 s, a 6 s beat in feature-loop, end card 4 s', () => {
  const w = conceptWarnings('feature-loop', tl(['a', 2], ['b', 6], ['end', 4]), { hookVisibleAt: 1.4, endCardIds: ['end'] });
  assert.equal(w.length, 3);
  assert.match(w[0], /hook-timing/); assert.match(w[1], /beat-length/); assert.match(w[2], /end-card/);
  assert.deepEqual(conceptWarnings('feature-loop', tl(['a', 2], ['b', 3.5], ['end', 2]), { hookVisibleAt: 1, endCardIds: ['end'] }), []);
});
test('ask-answer allows one 8 s beat, not two', () => {
  assert.deepEqual(conceptWarnings('ask-answer', tl(['a', 2], ['b', 8], ['end', 2]), { endCardIds: ['end'] }), []);
  assert.equal(conceptWarnings('ask-answer', tl(['a', 8], ['b', 8], ['end', 2]), { endCardIds: ['end'] }).length, 1);
  assert.equal(conceptWarnings('ask-answer', tl(['a', 9], ['end', 2]), { endCardIds: ['end'] }).length, 1);
});

test('storeChecks: reading time, price, disclose and a framed device', () => {
  const timeline = { scenes: [{ id: 'a', start: 0, end: 2, duration: 2, words: 6, captionMotion: 'none', labels: [{ at: 0, until: 0.5, text: 'Two words' }] }] };
  const r = storeChecks({ target: { id: 'preview-iphone', store: 'ios' }, locale: 'en-US', preview: { concept: 'feature-loop' },
    timeline, disclose: 'Subscription required',
    scenes: [{ id: 'a', layout: 'hero', dev: { model: 'iphone' }, texts: ['Only $9.99 in 2026'], hasCaption: true }] });
  assert.ok(r.warnings.some((x) => /2\.3\.4/.test(x)));
  assert.ok(r.warnings.some((x) => /price|looks like a price/.test(x)));
  assert.ok(r.warnings.some((x) => /6 words need 2\.3s/.test(x)));
  assert.ok(r.warnings.some((x) => /label "Two words"/.test(x)));
  assert.ok(r.notes.some((x) => /2026/.test(x)) && r.notes.some((x) => /no end-card/.test(x)));
});

test('a concept preview without an end card warns and does not judge the last scene as a beat', () => {
  const w = conceptWarnings('feature-loop', tl(['a', 2], ['b', 3], ['last', 7]), { hookVisibleAt: 0.5, endCardIds: [] });
  assert.equal(w.length, 1); assert.match(w[0], /concept "feature-loop": no end card — the last scene should use layout end-card/);
});
test('hook timing includes the entrance delay', () => {
  const timeline = { scenes: [{ id: 'a', start: 0, end: 3, duration: 3, words: 8, captionMotion: 'words', entrance: 'fade', transition: { kind: 'cut', dur: 0 }, labels: [] },
    { id: 'end', start: 3, end: 5, duration: 2, words: 1, captionMotion: 'rise', entrance: 'rise', transition: { kind: 'cut', dur: 0 }, labels: [] }] };
  const run = (entrance) => storeChecks({ target: { id: 'preview-iphone', store: 'ios' }, locale: 'en', preview: { concept: 'feature-loop' },
    timeline: { scenes: [{ ...timeline.scenes[0], entrance }, timeline.scenes[1]] },
    scenes: [{ id: 'a', layout: 'caption-band', dev: { model: 'none', style: 'frameless' }, texts: [], hasCaption: true }, { id: 'end', layout: 'end-card', texts: [], hasCaption: true }] }).warnings.filter((x) => /hook-timing/.test(x));
  assert.equal(run('none').length, 0);   // 8 words, no entrance: done before 1.0 s
  assert.equal(run('fade').length, 1);   // the 0.1 s delay pushes it past 1.0 s
});
test('draft must be a still image path', () => {
  for (const p of ['screens/a.png', 'screens/{locale}/a.JPG', 'a.webp']) assert.ok(isStillImagePath(p), p);
  for (const p of ['a.mov', 'a.mp4', 'a.html', 'a', undefined]) assert.ok(!isStillImagePath(p), String(p));
});
