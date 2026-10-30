import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MIN_MAESTRO, flowYaml, sleep, stepCommands, parseHierarchy, findElement, systemAlert, readCommands } from '../scripts/maestro.mjs';

test('flowYaml quotes values and starts with appId', () => {
  const y = flowYaml('ai.x.app', [{ openLink: 'x://a?b=1' }, 'waitForAnimationToEnd', { tapOn: { point: '86%,41%' } }]);
  assert.match(y, /^appId: "ai\.x\.app"\n---\n/);
  assert.match(y, /- openLink: "x:\/\/a\?b=1"/); assert.match(y, /point: "86%,41%"/);
  assert.match(y, /- waitForAnimationToEnd\n/);
});
test('flowYaml nests objects and keeps booleans and numbers bare', () => {
  assert.match(flowYaml('a', [sleep(2000)]), /- extendedWaitUntil:\n {4}visible: "__asp_never__"\n {4}timeout: 2000\n {4}optional: true\n/);
});
test('stepCommands: tap by id uses the resolved point, then waits', () => {
  assert.deepEqual(stepCommands({ tap: { id: 'set-done-4-0' }, wait: 2 }, { x: 0.86, y: 0.41 }),
    [{ tapOn: { point: '86%,41%' } }, 'waitForAnimationToEnd', sleep(2000)]);
});
test('stepCommands: resolved points are whole percents (Maestro 2.6.1 rejects "46.5%")', () =>
  assert.deepEqual(stepCommands({ tap: { text: 'General' } }, { x: 0.5, y: 0.4648 }), [{ tapOn: { point: '50%,46%' } }, 'waitForAnimationToEnd']));
test('stepCommands: the other step kinds', () => {
  assert.deepEqual(stepCommands({ open: 'x://a' }), [{ openLink: 'x://a' }, 'waitForAnimationToEnd']);
  assert.deepEqual(stepCommands({ tap: { point: '50%,60.5%' } }), [{ tapOn: { point: '50%,60.5%' } }, 'waitForAnimationToEnd']);
  assert.deepEqual(stepCommands({ swipe: { from: '50%,80%', to: '50%,20%', ms: 400 } }),
    [{ swipe: { start: '50%,80%', end: '50%,20%', duration: 400 } }, 'waitForAnimationToEnd']);
  assert.deepEqual(stepCommands({ type: 'hi', wait: 1 }), [{ inputText: 'hi' }, 'waitForAnimationToEnd', sleep(1000)]);
  assert.deepEqual(stepCommands({ wait: 1.5 }), [sleep(1500)]);
});
test('parseHierarchy + findElement on the real fixture', () => {
  const nodes = parseHierarchy(JSON.parse(fs.readFileSync('test/fixtures/maestro/hierarchy.json', 'utf8')));
  const f = findElement(nodes, { id: 'Fitness' });
  assert.ok(f);
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(f[k] >= 0 && f[k] <= 1);
  assert.equal(f.x, 28 / 402); assert.equal(f.y, 88 / 874); assert.equal(f.w, 68 / 402);
  assert.equal(f.label, 'Fitness');
  assert.equal(findElement(nodes, { text: 'Utilities folder' }).id, 'Utilities');
  assert.equal(findElement(nodes, { text: '2 apps' }).id, 'Utilities');
  assert.equal(findElement(nodes, { id: 'nope' }), null);
});
test('findElement skips zero-area matches', () => {
  const z = { id: 'a', text: 'T', label: '', x: 0, y: 0, w: 0, h: 0 }, ok = { ...z, w: 0.1, h: 0.1 };
  assert.equal(findElement([z, ok], { text: 'T' }), ok);
});
test('systemAlert finds an Allow button', () => {
  assert.equal(systemAlert([{ text: 'Allow', id: '', label: '', x: 0.5, y: 0.6, w: 0.2, h: 0.05 }]), 'Allow');
  assert.equal(systemAlert([{ text: 'Start', id: '', label: '', x: 0.5, y: 0.6, w: 0.2, h: 0.05 }]), null);
  assert.equal(systemAlert([{ text: '', id: '', label: 'Don’t Allow', x: 0.5, y: 0.6, w: 0.2, h: 0.05 }]), 'Don’t Allow');
});
test('readCommands sorts by sequence and drops config commands', () => {
  const c = readCommands('test/fixtures/maestro');
  assert.ok(c.length > 0 && c.every((x, i) => i === 0 || x.seq > c[i - 1].seq));
  assert.ok(c.every((x) => ['open', 'tap', 'swipe', 'type', 'wait'].includes(x.kind)));
  assert.deepEqual(c.map((x) => x.kind), ['tap', 'wait', 'swipe', 'tap', 'wait', 'swipe', 'tap', 'wait', 'tap']);
  assert.deepEqual(c.map((x) => x.step), [0, 0, 1, 2, 2, 3, 4, 4, 5]);
  assert.equal(c[0].startMs, 1793342436309); assert.equal(c[0].durMs, 1987);
});
test('MIN_MAESTRO is 2.6', () => assert.equal(MIN_MAESTRO, '2.6'));
