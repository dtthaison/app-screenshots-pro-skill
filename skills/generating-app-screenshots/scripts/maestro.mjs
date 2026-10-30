// Maestro helpers for the recorder: flow YAML, hierarchy -> element rects, the command
// timeline of a finished take. Pure apart from maestroVersion and readCommands.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const MIN_MAESTRO = '2.6';
const INSTALL = 'curl -Ls "https://get.maestro.mobile.dev" | bash';

export function maestroVersion() {
  try { return execFileSync('maestro', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop() || null; }
  catch { return null; }
}
export function checkMaestro() {
  const v = maestroVersion();
  const [a, b] = (v || '').split('.').map(Number), [ma, mb] = MIN_MAESTRO.split('.').map(Number);
  if (!v || !(a > ma || (a === ma && b >= mb))) throw new Error(`maestro ${MIN_MAESTRO}+ is needed to record: ${INSTALL}`);
  return v;
}

// Scalars are JSON (valid YAML); bare strings in a list are command names.
const scalar = (v) => JSON.stringify(v);
function emit(v, pad) {
  if (Array.isArray(v)) return v.map((it) => {
    if (typeof it === 'string') return `${pad}- ${it}\n`;
    return emit(it, pad + '  ').replace(pad + '  ', pad + '- ');
  }).join('');
  return Object.entries(v).map(([k, x]) => x && typeof x === 'object' ? `${pad}${k}:\n${emit(x, pad + '  ')}` : `${pad}${k}: ${scalar(x)}\n`).join('');
}
export const flowYaml = (appId, commands) => `appId: ${scalar(appId)}\n---\n${emit(commands, '')}`;

// Maestro 2.6.1 rejects `optional` beside extendedWaitUntil ("Invalid Command Format"); inside the map it waits the
// full timeout (checked: 2000 ms -> 2.3 s on the timeline) and ends WARNED, exit 0, with no duration in commands-*.json.
export const sleep = (ms) => ({ extendedWaitUntil: { visible: '__asp_never__', timeout: ms, optional: true } });

// Maestro 2.6.1 rejects fractional percentages ("46.5%" -> NumberFormatException), so whole percents only.
const pct = (f) => `${Math.round(f * 100)}%`;
export function stepCommands(step, point) {
  const out = [];
  if (step.open != null) out.push({ openLink: step.open });
  else if (step.tap) out.push({ tapOn: { point: step.tap.point ?? `${pct(point.x)},${pct(point.y)}` } });
  else if (step.swipe) out.push({ swipe: { start: step.swipe.from, end: step.swipe.to, ...(step.swipe.ms && { duration: step.swipe.ms }) } });
  else if (step.type != null) out.push({ inputText: step.type });
  if (out.length) out.push('waitForAnimationToEnd');
  if (step.wait) out.push(sleep(Math.round(step.wait * 1000)));
  return out;
}

// Maestro prints a tree of { attributes: { 'resource-id', text, accessibilityText, bounds: "[x1,y1][x2,y2]" }, children }.
// Fractions are of the first node with an area (the app window; the outermost node is [0,0][0,0]).
export function parseHierarchy(json) {
  const all = [];
  (function walk(n) {
    const a = n.attributes || {}, m = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(a.bounds || '');
    if (m) all.push({ id: a['resource-id'] || '', text: (a.text || '').trim(), label: (a.accessibilityText || '').trim(), b: m.slice(1).map(Number) });
    (n.children || []).forEach(walk);
  })(json);
  const root = all.find((n) => n.b[2] > n.b[0] && n.b[3] > n.b[1]);
  if (!root) return [];
  const [rx, ry, rr, rb] = root.b, W = rr - rx, H = rb - ry;
  return all.map(({ id, text, label, b }) => ({ id, text, label, x: (b[0] - rx) / W, y: (b[1] - ry) / H, w: (b[2] - b[0]) / W, h: (b[3] - b[1]) / H }));
}

export function findElement(nodes, { id, text } = {}) {
  return nodes.find((n) => n.w > 0 && n.h > 0 && (id != null ? n.id === id : text != null && (n.text === text.trim() || n.label === text.trim()))) || null;
}

const ALERT = ['Allow', "Don't Allow", 'Don’t Allow', 'Allow Once', 'Allow While Using App', 'Allow Full Access', 'Allow Notifications'];
export function systemAlert(nodes) {
  for (const n of nodes) { const hit = ALERT.find((a) => n.text === a || n.label === a); if (hit) return hit; }
  return null;
}

// Command timeline of a take (commands-*.json, any order) -> [{ seq, kind, startMs, durMs, step }].
// step = index of the recorder step: waits belong to the step before them.
const KINDS = [['open', /^openLink/], ['tap', /^tap/], ['swipe', /^(swipe|scroll)/], ['type', /^(inputText|eraseText)/]];
export function readCommands(dir) {
  const rows = fs.readdirSync(dir).filter((f) => /^commands.*\.json$/.test(f))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((e) => !/^(defineVariables|applyConfiguration)Command$/.test(Object.keys(e.command)[0]))
    .sort((a, b) => a.metadata.sequenceNumber - b.metadata.sequenceNumber);
  let step = -1;
  return rows.map((e) => {
    const key = Object.keys(e.command)[0], kind = KINDS.find(([, re]) => re.test(key))?.[0] || 'wait';
    if (kind !== 'wait') step++;
    return { seq: e.metadata.sequenceNumber, kind, startMs: e.metadata.timestamp, durMs: e.metadata.duration, step: Math.max(step, 0) };
  });
}
