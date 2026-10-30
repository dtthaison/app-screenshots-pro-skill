import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONCEPTS, SIGNALS, CATEGORIES, validateBrief, recommend } from '../scripts/concepts.mjs';

const load = (n) => JSON.parse(fs.readFileSync(new URL(`../evals/files/${n}`, import.meta.url), 'utf8'));

test('fitness: feature-loop is safe, ask-answer is strongest (must-show coach), 3 picks with 3 hooks', () => {
  const r = recommend(load('fitness-brief.json'));
  assert.deepEqual(r.picks.map((p) => [p.role, p.id]).slice(0, 2), [['safe', 'feature-loop'], ['strongest', 'ask-answer']]);
  assert.equal(r.picks.length, 3);
  assert.equal(r.picks[2].role, 'bold');
  assert.equal(new Set(r.picks.map((p) => p.hook)).size, r.picks.length);
  assert.ok(r.picks.find((p) => p.id === 'ask-answer').beats.some((b) => b.moment === 'coach'));
  assert.ok(r.excluded.some((e) => e.id === 'multi-device' && /Phase 2/.test(e.reason)));
});

test('fitness: safe feature-loop uses only relevant, automatable moments', () => {
  const safe = recommend(load('fitness-brief.json')).picks[0];
  const used = [...new Set(safe.beats.map((b) => b.moment).filter(Boolean))];
  assert.deepEqual(used, ['log-set', 'progress', 'swap']);
  assert.equal(safe.beats.at(-1).moment, null);
});

test('budget: no ask-answer; before-after or results-first picked', () => {
  const ids = recommend(load('budget-brief.json')).picks.map((p) => p.id);
  assert.ok(!ids.includes('ask-answer'));
  assert.ok(ids.includes('before-after') || ids.includes('results-first'));
});

test('mustAvoid paywall: no pick uses the paywall moment', () => {
  const r = recommend(load('fitness-avoid-paywall-brief.json'));
  assert.ok(r.picks.every((p) => p.beats.every((b) => b.moment !== 'paywall')));
});

test('every pick has code, owner or kb reasons and beats summing to 15s', () => {
  for (const f of ['fitness-brief.json', 'budget-brief.json']) {
    for (const p of recommend(load(f)).picks) {
      assert.ok(p.reasons.length > 0);
      assert.ok(p.reasons.every((x) => ['code', 'owner', 'kb'].includes(x.source) && x.ref));
      assert.equal(p.beats.reduce((a, b) => a + b.sec, 0), 15);
    }
  }
});

test('catalog: phase 1 beats sum to 15, vocabularies are exact', () => {
  for (const c of CONCEPTS.filter((x) => x.phase === 1)) assert.equal(c.beats.reduce((a, b) => a + b.sec, 0), 15, c.id);
  assert.equal(SIGNALS.length, 26);
  assert.equal(CATEGORIES.length, 13);
});

test('risks: network moment and over-long beat', () => {
  const ask = recommend(load('fitness-brief.json')).picks.find((p) => p.id === 'ask-answer');
  assert.ok(ask.risks.includes('moment "coach" varies per take (network)'));
  assert.ok(!ask.risks.some((x) => /needs trimming/.test(x)));
  const b = load('fitness-brief.json');
  b.moments.find((m) => m.id === 'coach').seconds = 40;
  const long = recommend(b).picks.find((p) => p.id === 'ask-answer');
  assert.ok(long.risks.some((x) => /^moment "coach" is 40s but its beat is 8s — even at 4× it needs trimming$/.test(x)));
});

test('validateBrief rejects unknown signals and unknown mustShow', () => {
  const b = load('fitness-brief.json');
  b.signals.push('teleport');
  b.owner.mustShow = ['nope'];
  const errs = validateBrief(b);
  assert.ok(errs.includes('unknown signal "teleport" in app signals'));
  assert.ok(errs.includes('owner.mustShow "nope" is not a moment id'));
  assert.deepEqual(validateBrief(load('fitness-brief.json')), []);
});

test('validateBrief: name, category, moment signal, duplicate id, automatable', () => {
  const b = load('fitness-brief.json');
  delete b.app.name; b.app.category = 'pets';
  b.moments[0].signals = ['zzz']; b.moments[1].id = 'log-set'; b.moments[2].automatable = 'maybe';
  const errs = validateBrief(b);
  assert.ok(errs.includes('app.name is missing'));
  assert.ok(errs.some((e) => /app\.category "pets" is not one of/.test(e)));
  assert.ok(errs.includes('unknown signal "zzz" in moment "log-set"'));
  assert.ok(errs.includes('duplicate moment id "log-set"'));
  assert.ok(errs.includes('moment "progress" automatable must be true, false or "network"'));
});

test('unconfirmed owner context adds a note', () => {
  const b = load('fitness-brief.json');
  b.owner.confirmed = false;
  assert.match(recommend(b).notes[0], /not confirmed/);
});

test('fewer than 3 concepts fit: says so', () => {
  const r = recommend({ app: { name: 'X', category: 'games' }, signals: [], moments: [], owner: { confirmed: true } });
  assert.ok(r.picks.length < 3);
  assert.ok(r.notes.some((n) => /^only \d concepts? fit/.test(n)));
});
