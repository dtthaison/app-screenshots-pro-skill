#!/usr/bin/env node
// Records a preview's `record` script on a booted iOS simulator: Maestro drives the app while
// `simctl io recordVideo` films it. Writes recordings/<locale>/<preview>.mov, .taps.json (the tap
// sidecar) and .sheet.jpg (1 fps contact sheet for the must-not-ship review).
//
// Debugging: ASP_KEEP_TMP=1 keeps the temp folder (raw video, frames, Maestro debug output).
// Usage: node record.mjs <config.json> --preview <id> [--udid U] [--locales a,b] [--takes 3]
import { spawn, spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameDiffs, alignCommands } from './align.mjs';
import { checkMaestro, flowYaml, stepCommands, parseHierarchy, findElement, systemAlert, readCommands } from './maestro.mjs';
import { findFfmpeg, probeClip, extractClip, filmstrip } from './video.mjs';

const ACTIONS = ['open', 'tap', 'swipe', 'type'];
const STEP_KEYS = new Set([...ACTIONS, 'wait', 'mark']);
const isAction = (s) => ACTIONS.some((k) => s[k] != null);

export function validateRecord(record) {
  const errs = [];
  const steps = record?.steps;
  if (!Array.isArray(steps) || !steps.length) return ['record.steps is missing or empty'];
  const bad = steps.flatMap((s, i) => (s && typeof s === 'object' && !Array.isArray(s) ? [] : [`step ${i + 1}: must be an object like { "tap": { "id": "save" } }`]));
  if (bad.length) return bad;
  if (steps[0].open == null) errs.push('the first step must be an "open": it changes the whole screen, and that change is how the recording is synced to Maestro');
  const marks = new Set();
  steps.forEach((s, i) => {
    const n = i + 1;
    if (s.shell != null) errs.push(`step ${n}: "shell" is only allowed in setup and boot`);
    for (const k of Object.keys(s)) if (!STEP_KEYS.has(k) && k !== 'shell') errs.push(`step ${n}: unknown key "${k}"`);
    if (ACTIONS.filter((k) => s[k] != null).length > 1) errs.push(`step ${n}: has more than one of ${ACTIONS.join(', ')}`);
    if (s.tap && s.tap.id == null && s.tap.text == null && s.tap.point == null) errs.push(`step ${n}: "tap" needs id, text or point`);
    if (s.wait != null && !(typeof s.wait === 'number' && s.wait >= 0)) errs.push(`step ${n}: wait must be a number of seconds, 0 or more (got ${JSON.stringify(s.wait)})`);
    if (s.swipe && (s.swipe.from == null || s.swipe.to == null)) errs.push(`step ${n}: "swipe" needs from and to`);
    for (const [what, v] of [['tap.point', s.tap?.point], ['swipe.from', s.swipe?.from], ['swipe.to', s.swipe?.to]])
      if (v != null && !/^\d+%,\d+%$/.test(v)) errs.push(`step ${n}: ${what} "${v}" must be whole percents like "50%,80%" (Maestro rejects fractions)`);
    if (s.mark != null) {
      if (marks.has(s.mark)) errs.push(`mark "${s.mark}" used twice`);
      marks.add(s.mark);
      if (!isAction(s)) errs.push(`step ${n}: mark "${s.mark}" is on a wait-only step; put it on the action step it belongs to`);
    }
  });
  for (const key of ['setup', 'boot'])
    (record[key] || []).forEach((s, i) => { if (typeof s.shell !== 'string') errs.push(`${key} step ${i + 1}: needs a "shell" string`); });
  return errs;
}

export const substitute = (str, { udid, locale, appLocale }) =>
  str.replaceAll('{udid}', udid).replaceAll('{appLocale}', appLocale).replaceAll('{locale}', locale);

// Atomic: copies the new files next to the old ones, then renames them all over. Missing input -> throws, old files untouched.
export function writeTake(dir, id, files) {
  const dest = { mov: `${id}.mov`, taps: `${id}.taps.json`, sheet: `${id}.sheet.jpg` };
  for (const k of Object.keys(dest)) if (!files[k] || !fs.existsSync(files[k])) throw new Error(`cannot write the take: ${k} file is missing (${files[k]})`);
  fs.mkdirSync(dir, { recursive: true });
  const staged = [];
  try {
    for (const k of Object.keys(dest)) {
      const tmp = path.join(dir, `${dest[k]}.new`);
      fs.copyFileSync(files[k], tmp);
      staged.push([tmp, path.join(dir, dest[k])]);
    }
  } catch (e) { staged.forEach(([t]) => fs.rmSync(t, { force: true })); throw e; }
  for (const [tmp, to] of staged) fs.renameSync(tmp, to);
}

// The take's Maestro commands: every step, waits included, so pacing matches the script.
export const takeCommands = (resolved) => resolved.flatMap((s) => stepCommands(s, s.point));

export const deviceClass = (width, height) => (Math.max(width, height) / Math.min(width, height) > 1.9 ? 'iphone' : 'ipad');

const pctPair = (s) => { const m = /^\s*([\d.]+)%\s*,\s*([\d.]+)%\s*$/.exec(s || ''); return m ? [+m[1] / 100, +m[2] / 100] : null; };
const r4 = (v) => Math.round(v * 10000) / 10000;
const r3 = (v) => Math.round(v * 1000) / 1000;

// events: aligned commands ({ kind, step, t, align }); steps: the recorder's ACTION steps in order, each with an
// optional `box` { x, y, w, h } (fractions) for taps. `step` counts action steps only, as readCommands does.
export function buildSidecar({ fps, width, height, device, locale, offsetMs, events, steps, takes }) {
  const out = [];
  const marks = {};
  for (const e of events) {
    const s = steps[e.step] || {};
    if (s.mark) marks[s.mark] = r3(e.t);
    const base = { t: r3(e.t) };
    if (e.kind === 'tap') {
      const p = s.box || (s.tap?.point && pctPair(s.tap.point) && { x: pctPair(s.tap.point)[0], y: pctPair(s.tap.point)[1] });
      out.push({ ...base, kind: 'tap', ...(p && { x: r4(s.box ? s.box.x + s.box.w / 2 : p.x), y: r4(s.box ? s.box.y + s.box.h / 2 : p.y) }),
        ...(s.box && { w: r4(s.box.w), h: r4(s.box.h) }), step: e.step, align: e.align });
    } else if (e.kind === 'swipe') {
      const a = pctPair(s.swipe?.from), b = pctPair(s.swipe?.to);
      out.push({ ...base, kind: 'swipe', ...(a && b && { x: a[0], y: a[1], x2: b[0], y2: b[1] }), dur: (s.swipe?.ms ?? e.durMs) / 1000, step: e.step, align: e.align });
    } else if (e.kind === 'type') {
      out.push({ ...base, kind: 'type', text: s.type ?? '', step: e.step, align: e.align });
    }
  }
  return { version: 1, fps, width, height, device, class: deviceClass(width, height), locale, syncOffset: r3(offsetMs / 1000), events: out, marks, takes };
}

// ---- CLI -----------------------------------------------------------------------------------------------------

const log = (m) => console.log(m);
const fail = (m) => { throw new Error(m); };
const KEYBOARD = ['com.apple.iphonesimulator', 'ConnectHardwareKeyboard'];
// `defaults` args that put the hardware-keyboard setting back: `prev` is the `defaults read` result from before the run.
export const keyboardRestoreArgs = (prev) =>
  (prev.status !== 0 ? ['delete', ...KEYBOARD] : ['write', ...KEYBOARD, '-bool', prev.stdout.trim() === '1' ? 'true' : 'false']);
// Maestro ends its output with a promo box; the failure is above it.
const tail = (r, n = 5) => (r.stdout + r.stderr).split('\n').filter((l) => l.trim() && !/[│╭╰]/.test(l)).slice(-n).join(' | ');
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
const simctl = (...a) => run('xcrun', ['simctl', ...a]);

function pickUdid(flagUdid) {
  const r = simctl('list', 'devices', '-j');
  if (r.status !== 0) fail('xcrun simctl is not available — install Xcode and its command line tools');
  const all = Object.values(JSON.parse(r.stdout).devices).flat();
  if (flagUdid) {
    const d = all.find((x) => x.udid === flagUdid);
    if (!d) fail(`no simulator with udid ${flagUdid}`);
    return d;
  }
  const booted = all.filter((d) => d.state === 'Booted');
  if (booted.length !== 1) fail(`${booted.length ? 'several simulators are booted' : 'no simulator is booted'}; pass --udid. Booted: ${booted.map((d) => `${d.name} ${d.udid}`).join(', ') || 'none'}`);
  return booted[0];
}

function hierarchy(udid) {
  const r = run('maestro', ['--udid', udid, 'hierarchy']);
  const i = (r.stdout || '').indexOf('{');
  if (r.status !== 0 || i < 0) fail(`maestro hierarchy failed: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`);
  return parseHierarchy(JSON.parse(r.stdout.slice(i)));
}

function maestroTest(udid, yamlFile, extra = []) {
  return run('maestro', ['--udid', udid, 'test', ...extra, yamlFile]);
}

function rehearse(udid, record, tmp, boot) {
  const resolved = [];   // every step (waits included), with its resolved point
  simctl('terminate', udid, record.app);   // same starting point as a take: an app left deep in a flow would resolve different elements
  boot();
  record.steps.forEach((step, i) => {
    const n = i + 1;
    const nodes = hierarchy(udid);
    const alert = systemAlert(nodes);
    if (alert) fail(`a system alert "${alert}" is on screen at step ${n} — grant or turn off the permission first`);
    let point = null, box = null;
    const sel = step.tap && (step.tap.id != null ? { id: step.tap.id } : step.tap.text != null ? { text: step.tap.text } : null);
    if (sel) {
      const el = findElement(nodes, sel);
      const name = sel.id != null ? sel.id : sel.text;
      if (!el) fail(`element "${name}" not found at step ${n}`);
      const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
      if (cx < 0 || cx > 1 || cy < 0 || cy > 1) fail(`element "${name}" is off screen at step ${n} — scroll first`);
      point = { x: cx, y: cy }; box = { x: el.x, y: el.y, w: el.w, h: el.h };
    }
    const file = path.join(tmp, `rehearse-${i}.yaml`);
    fs.writeFileSync(file, flowYaml(record.app, stepCommands(step, point)));
    const r = maestroTest(udid, file);
    if (r.status !== 0) fail(`step ${n} failed in rehearsal: ${tail(r)}`);
    resolved.push({ ...step, point, box });
  });
  return resolved;
}

async function recordOnce({ udid, record, resolved, tmp, ffmpeg, device, locale, takeNo, boot }) {
  const dir = path.join(tmp, `take-${takeNo}`);
  fs.mkdirSync(dir, { recursive: true });
  // Every take starts from the home screen, so the first step's whole-screen change is there to sync on.
  simctl('terminate', udid, record.app);
  boot();
  await new Promise((r) => setTimeout(r, 1000));
  const raw = path.join(dir, 'raw.mov');
  const rec = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--force', raw], { stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = new Promise((res) => rec.on('exit', res));
  let recStartMs = 0;
  await new Promise((res, rej) => {
    let buf = '';
    const t = setTimeout(() => rej(new Error('simctl recordVideo did not report "Recording started" within 3 s')), 3000);
    rec.stderr.on('data', (d) => { buf += d; if (/Recording started/i.test(buf)) { clearTimeout(t); recStartMs = Date.now(); res(); } });
    exited.then(() => { clearTimeout(t); rej(new Error(`simctl recordVideo exited early: ${buf.trim()}`)); });
  }).catch((e) => { rec.kill('SIGINT'); throw e; });

  const flow = path.join(dir, 'take.yaml');
  fs.writeFileSync(flow, flowYaml(record.app, takeCommands(resolved)));
  const dbg = path.join(dir, 'dbg');
  const m = maestroTest(udid, flow, ['--debug-output', dbg, '--flatten-debug-output']);
  rec.kill('SIGINT');                 // never SIGKILL: the file is finalised on SIGINT
  await exited;

  const result = { ok: m.status === 0, log: tail(m, 6), raw, dir };
  if (!result.ok) return result;
  return processTake({ ffmpeg, raw, dbg, dir, resolved, device, locale, takeNo, recStartMs, result });
}

// Everything after Maestro: a take whose video, timeline or sync cannot be read is a failed take (the caller retries),
// not a crash.
export async function processTake({ ffmpeg, raw, dbg, dir, resolved, device, locale, takeNo, recStartMs = 0, result = {} }) {
  try {
    const info = probeClip(ffmpeg, raw);
    const clip = extractClip(ffmpeg, { file: raw, height: 480, dir: path.join(dir, 'frames') });
    const diffs = await frameDiffs(clip.files);
    const cmds = readCommands(dbg).filter((c) => c.kind !== 'wait');   // waits end WARNED, without a duration
    const { offsetMs, shiftMs, events } = alignCommands(cmds, diffs, clip.fps);
    const taps = events.filter((e) => e.kind === 'tap');
    return { ...result, ok: true, raw, dir, info, clip, events, offsetMs, shiftMs, diffs, taps, windowTaps: taps.filter((e) => e.align === 'window'),
      sidecar: buildSidecar({ fps: clip.fps, width: info.width, height: info.height, device: device.name, locale, offsetMs: offsetMs - recStartMs,
        events, steps: resolved.filter(isAction), takes: takeNo }) };
  } catch (e) {
    return { ...result, ok: false, raw, dir, log: `could not process the take: ${e.message}` };
  }
}

async function writeBest(best, { outDir, id, tmp, takesRun }) {
  const dir = best.dir;
  const frames = [];
  for (let k = 0; k * best.clip.fps < best.clip.count; k++) frames.push({ t: k, buf: fs.readFileSync(best.clip.files[k * best.clip.fps]) });
  const sheet = path.join(dir, 'sheet.jpg');
  await filmstrip(frames, sheet);   // spreads its 30 tiles over the whole take
  best.sidecar.takes = takesRun;
  const taps = path.join(dir, 'taps.json');
  fs.writeFileSync(taps, JSON.stringify(best.sidecar, null, 2) + '\n');
  writeTake(outDir, id, { mov: best.raw, taps, sheet });
}

export async function main(argv) {
  const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i < 0 ? d : argv[i + 1]; };
  const configPath = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  const id = flag('preview');
  if (!configPath || !id) fail('usage: node scripts/record.mjs <config.json> --preview <id> [--udid U] [--locales a,b] [--takes 3]');
  const cfgFile = path.resolve(configPath), cfgDir = path.dirname(cfgFile);
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  const preview = (cfg.previews || []).find((p) => p.id === id);
  if (!preview) fail(`no preview "${id}" in ${configPath}; available: ${(cfg.previews || []).map((p) => p.id).join(', ') || 'none'}`);
  const record = preview.record;
  if (!record) fail(`preview "${id}" has no "record" block`);
  if (!record.app) fail('record.app (the app id) is missing');
  const errs = validateRecord(record);
  if (errs.length) fail(errs.join('\n'));
  const takes = Math.max(1, +flag('takes', 1) || 1);
  const locales = flag('locales') ? flag('locales').split(',') : cfg.locales || [cfg.defaultLocale || 'en-US'];

  const mv = checkMaestro();
  log(`maestro ${mv}`);
  const ffmpeg = findFfmpeg() || fail('ffmpeg not found: npm install, or set FFMPEG_PATH');
  const device = pickUdid(flag('udid'));
  const udid = device.udid;
  if (simctl('get_app_container', udid, record.app).status !== 0) fail(`app ${record.app} is not installed on ${device.name} (${udid})`);
  const keyboard = run('defaults', ['read', ...KEYBOARD]);
  run('defaults', ['write', ...KEYBOARD, '-bool', 'false']);
  log('NOTE: hardware keyboard turned off so inputText shows the soft keyboard; restart Simulator if it was already running with one.');
  // the 9:41 status bar and the keyboard setting are put back however the run ends
  try { await recordLocales(); } finally {
    simctl('status_bar', udid, 'clear');
    run('defaults', keyboardRestoreArgs(keyboard));
  }

  async function recordLocales() { for (const locale of locales) {
    const appLocale = record.locales?.[locale] || locale;
    const sub = (s) => substitute(s, { udid, locale, appLocale });
    log(`[${locale}] ${device.name} ${udid}`);
    const shell = (key) => { for (const s of record[key] || []) {
      const cmd = sub(s.shell);
      log(`  ${key}: ${cmd}`);
      execSync(cmd, { cwd: cfgDir, stdio: 'inherit' });
    } };
    const boot = () => shell('boot');   // after every terminate: a dev client relaunches to its launcher, not the project
    shell('setup');
    simctl('status_bar', udid, 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100', '--cellularBars', '4', '--wifiBars', '3');

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asp-record-'));
    try {
      const rec = { ...record, steps: record.steps.map((s) => (s.open != null ? { ...s, open: sub(s.open) } : s)) };
      const resolved = rehearse(udid, rec, tmp, boot);
      log(`  rehearsal ok (${rec.steps.length} steps)`);
      let best = null, n = 0, lastErr = '';
      for (let t = 1; t <= takes; t++) {
        n = t;
        const r = await recordOnce({ udid, record: rec, resolved, tmp, ffmpeg, device, locale, takeNo: t, boot });
        if (!r.ok) { lastErr = `maestro failed: ${r.log}`; log(`  take ${t}: ${lastErr}`); continue; }
        const bad = r.windowTaps.length > r.taps.length / 2;
        log(`  take ${t}: ${r.taps.length - r.windowTaps.length}/${r.taps.length} taps aligned to a frame${r.shiftMs ? ` (clock shifted ${(r.shiftMs / 1000).toFixed(2)} s)` : ''}${bad ? ' (too many window taps)' : ''}`);
        if (!best || r.windowTaps.length < best.windowTaps.length) best = r;
        if (!bad) break;
      }
      if (!best) fail(`no take succeeded for ${locale}; the previous recording is untouched. Last error: ${lastErr}`);
      if (best.windowTaps.length > best.taps.length / 2) fail(`more than half the taps could not be aligned to a frame in ${takes} take(s); the previous recording is untouched`);
      const outDir = path.join(cfgDir, 'recordings', locale);
      await writeBest(best, { outDir, id, tmp, takesRun: n });
      for (const e of best.windowTaps) log(`  NOTE: tap at step ${e.step + 1} has no clear frame change; its ripple may be early or late`);
      log(`  wrote ${path.relative(process.cwd(), path.join(outDir, id)) || id}.mov, .taps.json, .sheet.jpg`);
    } finally { if (process.env.ASP_KEEP_TMP) log(`  kept ${tmp}`); else fs.rmSync(tmp, { recursive: true, force: true }); }
  } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`ERROR: ${e.message}`); process.exit(1); });
}
