import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONCEPTS, SIGNALS, CATEGORIES } from '../scripts/concepts.mjs';
import { SYNC_MAD, REACT_MAD } from '../scripts/align.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = ['store-rules', 'concepts', 'motion', 'categories', 'sources'];
const heading = (id) => new RegExp(`^## .*\\{#${id}\\}|^## ${id}\\b`, 'm');

test('concepts.md has a section per concept id and lists every signal', () => {
  const md = read('references/video/concepts.md');
  for (const c of CONCEPTS) assert.match(md, heading(c.id), c.id);
  for (const s of SIGNALS) assert.ok(md.includes(`\`${s}\``), s);
});

test('categories.md has a section per category', () => {
  const md = read('references/video/categories.md');
  for (const c of CATEGORIES) assert.match(md, heading(c), c);
});

test('store-rules.md: every row has a URL, a verified_on date and verified|reported', () => {
  const rows = read('references/video/store-rules.md').split('\n').filter((l) => /^\| [a-z-]+ \|/.test(l));
  assert.ok(rows.length >= 15, `${rows.length} rows`);
  for (const r of rows) {
    assert.match(r, /https?:\/\//, r);
    assert.match(r, /20\d\d-\d\d-\d\d/, r);
    assert.match(r, /\b(verified|reported)\b/, r);
  }
});

test('store-rules.md names an enforcing check from the known set on every row', () => {
  const known = ['framed-device', 'price', 'play-phrases', 'time-sensitive', 'reading-time', 'hook-timing', 'beat-length',
    'end-card', 'iphone-only', 'disclose', 'existing: duration', 'agent QA'];
  const rows = read('references/video/store-rules.md').split('\n').filter((l) => /^\| [a-z-]+ \|/.test(l));
  for (const r of rows) assert.ok(known.some((k) => r.includes(k)), r);
});

test('sources.md lists the untraceable stats under "Not used"', () =>
  assert.match(read('references/video/sources.md'), /## Not used[\s\S]*78%/));

test('motion.md carries the anchors, the constants and the tuned thresholds', () => {
  const md = read('references/video/motion.md');
  for (const a of ['tap-effects', 'kinetic-captions', 'speed-ramps', 'detection-thresholds', 'feedback-fixes']) assert.match(md, heading(a), a);
  for (const k of ['600 ms', '110%', '70 ms', '120 ms', '450 ms', '0.5 s + 0.3 s', '300 ms', '0.4 s', '0.8 s', '4×', '18%', '0.8', 'ω0'])
    assert.ok(md.includes(k), k);
  assert.ok(md.includes(`SYNC_MAD = ${SYNC_MAD}`), 'SYNC_MAD value');
  assert.ok(md.includes(`REACT_MAD = ${REACT_MAD}`), 'REACT_MAD value');
});

test('files over 100 lines start with a table of contents', () => {
  for (const f of FILES) {
    const md = read(`references/video/${f}.md`);
    if (md.split('\n').length > 100) assert.ok(md.split('\n').slice(0, 15).some((l) => /^## Contents/.test(l)), f);
  }
});
