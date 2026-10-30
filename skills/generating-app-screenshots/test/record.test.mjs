import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateRecord, substitute, writeTake, deviceClass, buildSidecar } from '../scripts/record.mjs';

test('validateRecord: first step must open', () => {
  assert.match(validateRecord({ steps: [{ tap: { id: 'a' } }] }).join(), /first step must be an "open"/);
  assert.deepEqual(validateRecord({ steps: [{ open: 'x://a', mark: 'a' }, { tap: { text: 'Go' }, mark: 'b' }] }), []);
  assert.match(validateRecord({ steps: [{ open: 'x://a', mark: 'a' }, { wait: 1, mark: 'a' }] }).join(), /mark "a" used twice/);
});
test('validateRecord: missing steps, unknown keys, shell outside setup, marks on wait steps', () => {
  assert.match(validateRecord({}).join(), /steps is missing or empty/);
  assert.match(validateRecord({ steps: [] }).join(), /steps is missing or empty/);
  assert.match(validateRecord({ steps: [{ open: 'x://a', bogus: 1 }] }).join(), /unknown key "bogus"/);
  assert.match(validateRecord({ steps: [{ open: 'x://a' }, { shell: 'ls' }] }).join(), /"shell" is only allowed in setup/);
  assert.match(validateRecord({ steps: [{ open: 'x://a' }, { wait: 1, mark: 'z' }] }).join(), /wait-only step/);
  assert.match(validateRecord({ steps: [{ open: 'x://a' }, { tap: { point: '50%,46.5%' } }] }).join(), /whole percents/);
  assert.deepEqual(validateRecord({ setup: [{ shell: 'true' }], steps: [{ open: 'x://a' }] }), []);
});
test('substitute fills udid, locale, appLocale', () =>
  assert.equal(substitute('s.sh {udid} {locale} {appLocale}', { udid: 'U', locale: 'en-US', appLocale: 'en-SG' }), 's.sh U en-US en-SG'));

test('writeTake keeps the previous take when a file is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asp-wt-'));
  const out = path.join(root, 'rec'), src = path.join(root, 'src');
  fs.mkdirSync(out); fs.mkdirSync(src);
  const old = { 'loop.mov': 'OLD-MOV', 'loop.taps.json': 'OLD-TAPS', 'loop.sheet.jpg': 'OLD-SHEET' };
  for (const [f, c] of Object.entries(old)) fs.writeFileSync(path.join(out, f), c);
  fs.writeFileSync(path.join(src, 'a.mov'), 'NEW-MOV'); fs.writeFileSync(path.join(src, 'a.jpg'), 'NEW-SHEET');
  assert.throws(() => writeTake(out, 'loop', { mov: path.join(src, 'a.mov'), taps: path.join(src, 'missing.json'), sheet: path.join(src, 'a.jpg') }), /taps file is missing/);
  for (const [f, c] of Object.entries(old)) assert.equal(fs.readFileSync(path.join(out, f), 'utf8'), c);
  assert.deepEqual(fs.readdirSync(out).sort(), Object.keys(old).sort());   // no staged leftovers
  fs.writeFileSync(path.join(src, 't.json'), 'NEW-TAPS');
  writeTake(out, 'loop', { mov: path.join(src, 'a.mov'), taps: path.join(src, 't.json'), sheet: path.join(src, 'a.jpg') });
  assert.equal(fs.readFileSync(path.join(out, 'loop.taps.json'), 'utf8'), 'NEW-TAPS');
  assert.equal(fs.readFileSync(path.join(out, 'loop.mov'), 'utf8'), 'NEW-MOV');
  fs.rmSync(root, { recursive: true });
});

test('deviceClass: phones are taller than 1.9', () => {
  assert.equal(deviceClass(1206, 2622), 'iphone');
  assert.equal(deviceClass(2064, 2752), 'ipad');
});

test('buildSidecar: marks come from the marked steps, version 1', () => {
  const steps = [{ open: 'x://a', mark: 'start' }, { tap: { id: 'b' }, mark: 'log', box: { x: 0.8, y: 0.4, w: 0.1, h: 0.04 } }, { swipe: { from: '50%,70%', to: '50%,30%', ms: 400 } }, { type: 'hi' }];
  const events = [{ kind: 'open', step: 0, t: 0.4, align: 'frame' }, { kind: 'tap', step: 1, t: 3.2, align: 'frame' },
    { kind: 'swipe', step: 2, t: 5, align: 'window', durMs: 100 }, { kind: 'type', step: 3, t: 6, align: 'window' }];
  const s = buildSidecar({ fps: 30, width: 1206, height: 2622, device: 'iPhone 17 Pro', locale: 'en-US', offsetMs: 412, events, steps, takes: 2 });
  assert.equal(s.version, 1);
  assert.deepEqual(s.marks, { start: 0.4, log: 3.2 });
  assert.equal(s.syncOffset, 0.412);
  assert.equal(s.takes, 2);
  assert.deepEqual(s.events[0], { t: 3.2, kind: 'tap', x: 0.85, y: 0.42, w: 0.1, h: 0.04, step: 1, align: 'frame' });
  assert.deepEqual(s.events[1], { t: 5, kind: 'swipe', x: 0.5, y: 0.7, x2: 0.5, y2: 0.3, dur: 0.4, step: 2, align: 'window' });
  assert.deepEqual(s.events[2], { t: 6, kind: 'type', text: 'hi', step: 3, align: 'window' });
  assert.equal(s.events.length, 3);   // open is a mark/sync, not an event
});
