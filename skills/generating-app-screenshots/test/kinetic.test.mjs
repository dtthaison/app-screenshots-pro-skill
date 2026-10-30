import test from 'node:test';
import assert from 'node:assert/strict';
import { splitWords, wordCount, wordsHtml, unitProgress, popValue, motionLength, resolveCaptionMotion } from '../scripts/kinetic.mjs';

test('splitWords keeps highlight state across words', () =>
  assert.deepEqual(splitWords('Swap in **one tap**'), [{ word: 'Swap', hl: false }, { word: 'in', hl: false }, { word: 'one', hl: true }, { word: 'tap', hl: true }]));
test('text without spaces is one unit (ja, zh, th)', () => {
  for (const t of ['ワンタップで入れ替え', '一键替换', 'แตะครั้งเดียว']) assert.equal(splitWords(t).length, 1);
});
test('punctuation stuck to a highlighted word stays in the same unit', () => {
  const u = splitWords('Try **it**, now');
  assert.deepEqual(u.map((x) => x.word), ['Try', '**it**,', 'now']);
});
test('wordsHtml wraps each unit in a clipping box and joins with one space', () => {
  const h = wordsHtml(splitWords('a **b**'), (x) => x.replace(/\*\*(.+?)\*\*/, '<i>$1</i>'));
  assert.equal(h.match(/<span class="kw" style="display:inline-block;overflow:hidden;vertical-align:bottom;padding:.2em .1em .35em;margin:-.2em -.1em -.35em"><span class="kwi" style="display:inline-block">/g).length, 2);
  assert.match(h, /a<\/span><\/span> <span class="kw"/); assert.match(h, /<i>b<\/i>/);
});
test('words: 70 ms stagger, done at 0.07*(n-1)+0.45', () => {
  const p = unitProgress('words', 0.1, 3);
  assert.ok(p[0] > p[1] && p[1] > p[2]); assert.equal(+motionLength('words', 3).toFixed(3), 0.59);
  assert.deepEqual(unitProgress('words', 0.59, 3).map((x) => +x.toFixed(2)), [1, 1, 1]);
});
test('lines: 120 ms stagger; progress is 0 before the unit starts and exactly 1 at the end', () => {
  assert.equal(unitProgress('lines', 0.1, 2)[1], 0);
  assert.deepEqual(unitProgress('lines', motionLength('lines', 2), 2), [1, 1]);
  assert.equal(+motionLength('lines', 2).toFixed(3), 0.57);
});
test('pop settles to scale 1 and opacity 1', () => { const v = popValue(1); assert.ok(Math.abs(v.scale - 1) < 0.01 && v.opacity === 1); });
test('pop starts at 0.92 / 0 and is within 0.5% of rest at motionLength', () => {
  assert.deepEqual(popValue(0), { scale: 0.92, opacity: 0 });
  const v = popValue(motionLength('pop') - 1e-6);
  assert.ok(Math.abs(v.scale - 1) < 0.005 * 0.08 + 1e-9 && 1 - v.opacity < 0.005);
});
test('scene 1 ignores the theme/preview default captionMotion unless it sets its own', () => {
  assert.equal(resolveCaptionMotion(0, {}, { captionMotion: 'words' }, { captionMotion: 'pop' }), 'rise');
  assert.equal(resolveCaptionMotion(0, { captionMotion: 'words' }, {}, {}), 'words');
  assert.equal(resolveCaptionMotion(1, {}, {}, { captionMotion: 'pop' }), 'pop');
  assert.equal(resolveCaptionMotion(1, {}, { captionMotion: 'words' }, { captionMotion: 'pop' }), 'words');
  assert.equal(resolveCaptionMotion(2, {}, {}, {}), 'rise');
});

test('manual line breaks (real newline and literal backslash-n) are break markers, not words', () => {
  for (const t of ['Build habits\nthat **stick**', 'Build habits\\nthat **stick**']) {
    const u = splitWords(t);
    assert.equal(wordCount(u), 4); assert.equal(u.length, 5);
    assert.deepEqual(u[2], { br: true });
    assert.deepEqual(u.filter((x) => !x.br).map((x) => x.word), ['Build', 'habits', 'that', 'stick']);
    const h = wordsHtml(u, (x) => x);
    assert.equal(h.match(/<br>/g).length, 1); assert.equal(h.match(/class="kw"/g).length, 4);
    assert.match(h, /habits<\/span><\/span><br><span class="kw"/);   // no space around the break
  }
});
test('highlight state carries across a manual break', () => {
  const u = splitWords('a **one\ntwo** b');
  assert.deepEqual(u, [{ word: 'a', hl: false }, { word: 'one', hl: true }, { br: true }, { word: 'two', hl: true }, { word: 'b', hl: false }]);
});
test('no title: kinetic motions fall back to rise', () => {
  for (const m of ['words', 'lines', 'pop']) {
    assert.equal(resolveCaptionMotion(1, { captionMotion: m }, {}, {}, false), 'rise');
    assert.equal(resolveCaptionMotion(1, { captionMotion: m }, {}, {}, true), m);
  }
  assert.equal(resolveCaptionMotion(1, {}, {}, { captionMotion: 'words' }, false), 'rise');
});
