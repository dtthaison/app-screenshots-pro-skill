// Concept catalog and the deterministic recommender behind recommend.mjs.
// Every weight below is explained in references/video/concepts.md under the concept's own entry (concepts.md#<id>).

export const SIGNALS = ['ai-stream', 'chat', 'search', 'recommendations', 'timer', 'live-update', 'sheet', 'progress',
  'charts', 'counter', 'streak', 'map', 'camera', 'scan', 'media', 'social', 'watch-app', 'tablet-app', 'desktop-app',
  'daily-habit', 'replaces-chore', 'speed', 'many-features', 'single-magic', 'onboarding', 'paywall'];

export const CATEGORIES = ['fitness', 'health', 'finance', 'ai', 'productivity', 'social', 'education', 'travel',
  'shopping', 'games', 'utilities', 'media', 'food'];

const b = (...pairs) => pairs.map(([kind, sec]) => ({ kind, sec }));

export const CONCEPTS = [
  { id: 'hero-moment', name: 'Hero moment', hook: 'demo', // concepts.md#hero-moment
    requires: ['single-magic', 'ai-stream', 'scan', 'camera'],
    useWhen: { 'single-magic': 3, 'ai-stream': 2, scan: 2, camera: 2, 'live-update': 1 },
    avoidWhen: ['many-features'], categories: ['ai', 'utilities', 'productivity'], bold: false, phase: 1,
    beats: b(['hook', 2], ['beat', 8], ['beat', 3], ['end', 2]) },
  { id: 'feature-loop', name: 'Feature loop', hook: 'demo', // concepts.md#feature-loop
    requires: ['live-update', 'sheet', 'timer', 'counter'],
    useWhen: { 'daily-habit': 3, 'live-update': 2, timer: 2, sheet: 1, counter: 1, progress: 1 },
    avoidWhen: [], categories: ['fitness', 'health', 'productivity', 'finance', 'food'], bold: false, phase: 1,
    beats: b(['hook', 2], ['beat', 3.5], ['beat', 3.5], ['beat', 4], ['end', 2]) },
  { id: 'ask-answer', name: 'Ask and answer', hook: 'question', // concepts.md#ask-answer
    requires: ['ai-stream', 'chat', 'search', 'recommendations'],
    useWhen: { 'ai-stream': 3, chat: 2, search: 2, recommendations: 2 },
    avoidWhen: [], categories: ['ai', 'fitness', 'education', 'travel', 'shopping'], bold: false, phase: 1,
    beats: b(['hook', 2], ['beat', 8], ['beat', 3], ['end', 2]) },
  { id: 'before-after', name: 'Before and after', hook: 'contrast', // concepts.md#before-after
    requires: ['replaces-chore'],
    useWhen: { 'replaces-chore': 3, speed: 1, charts: 1 },
    avoidWhen: [], categories: ['finance', 'productivity', 'utilities', 'health'], bold: true, phase: 1,
    beats: b(['hook', 2], ['beat', 4], ['beat', 5], ['beat', 2], ['end', 2]) },
  { id: 'speedrun', name: 'Speedrun', hook: 'bold-claim', // concepts.md#speedrun
    requires: ['speed', 'onboarding'],
    useWhen: { speed: 3, onboarding: 2, 'replaces-chore': 1 },
    avoidWhen: [], categories: ['utilities', 'travel', 'shopping', 'finance'], bold: true, phase: 1,
    beats: b(['hook', 2], ['beat', 5], ['beat', 4], ['beat', 2], ['end', 2]) },
  { id: 'results-first', name: 'Results first', hook: 'outcome', // concepts.md#results-first
    requires: ['progress', 'charts', 'streak', 'counter'],
    useWhen: { progress: 3, charts: 2, streak: 2, counter: 1 },
    avoidWhen: [], categories: ['fitness', 'health', 'finance', 'education'], bold: false, phase: 1,
    beats: b(['hook', 3], ['beat', 4], ['beat', 4], ['beat', 2], ['end', 2]) },
  { id: 'day-in-life', name: 'A day in the life', hook: 'demo', // concepts.md#day-in-life
    requires: ['daily-habit'],
    useWhen: { 'daily-habit': 3, timer: 1, progress: 1 },
    avoidWhen: [], categories: ['health', 'fitness', 'productivity', 'food'], bold: false, phase: 1,
    beats: b(['hook', 2], ['beat', 3.5], ['beat', 3.5], ['beat', 4], ['end', 2]) },
  { id: 'multi-device', name: 'Multi-device', hook: 'demo', // concepts.md#multi-device
    requires: ['watch-app', 'tablet-app', 'desktop-app'],
    useWhen: { 'watch-app': 3, 'tablet-app': 2, 'desktop-app': 2 },
    avoidWhen: [], categories: ['fitness', 'health', 'productivity'], bold: true, phase: 2, beats: [] },
  { id: 'bento', name: 'Bento', hook: 'proof', // concepts.md#bento
    requires: ['many-features'], useWhen: { 'many-features': 3 },
    avoidWhen: ['single-magic'], categories: ['productivity', 'utilities', 'finance'], bold: true, phase: 2, beats: [] },
  { id: 'cinematic', name: 'Cinematic', hook: 'pattern-interrupt', // concepts.md#cinematic
    requires: [], useWhen: {}, avoidWhen: [], categories: [...CATEGORIES], bold: true, phase: 2, beats: [] },
  // base score 1: the fallback when nothing else fits
  { id: 'type-led', name: 'Type-led', hook: 'bold-claim', // concepts.md#type-led
    requires: [], useWhen: {}, avoidWhen: [], categories: ['social', 'games', 'media'], bold: true, phase: 1,
    beats: b(['hook', 2], ['beat', 4], ['beat', 4], ['beat', 3], ['end', 2]) },
];

export function validateBrief(brief) {
  const errs = [];
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) return ['brief must be a JSON object'];
  const app = brief.app && typeof brief.app === 'object' ? brief.app : {};
  if (!app.name) errs.push('app.name is missing');
  if (!CATEGORIES.includes(app.category)) errs.push(`app.category "${app.category}" is not one of: ${CATEGORIES.join(', ')}`);
  const arr = (v, label) => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) { errs.push(`${label} must be an array`); return []; }
    return v;
  };
  for (const s of arr(brief.signals, 'signals')) if (!SIGNALS.includes(s)) errs.push(`unknown signal "${s}" in app signals`);
  const ids = new Set();
  arr(brief.moments, 'moments').forEach((m, i) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) { errs.push(`moments[${i}] must be an object`); return; }
    if (ids.has(m.id)) errs.push(`duplicate moment id "${m.id}"`);
    ids.add(m.id);
    for (const s of arr(m.signals, `moment "${m.id}" signals`)) if (!SIGNALS.includes(s)) errs.push(`unknown signal "${s}" in moment "${m.id}"`);
    if (![true, false, 'network'].includes(m.automatable)) errs.push(`moment "${m.id}" automatable must be true, false or "network"`);
  });
  const owner = brief.owner && typeof brief.owner === 'object' ? brief.owner : {};
  for (const id of arr(owner.mustShow, 'owner.mustShow')) if (!ids.has(id)) errs.push(`owner.mustShow "${id}" is not a moment id`);
  arr(owner.mustAvoid, 'owner.mustAvoid');
  return errs;
}

const relevance = (concept, moment) => (moment.signals || []).reduce((a, s) => a + (concept.useWhen[s] || 0), 0);

// Controller ruling R2: only moments with relevance > 0 are assigned; none relevant -> first moment in brief order.
// Rank ties go to mustShow moments, then brief order. The last assigned moment absorbs the remaining non-end beats.
function pickMoments(concept, moments, mustShow) {
  const ranked = moments.map((m, i) => ({ m, i, r: relevance(concept, m) }))
    .sort((a, c) => c.r - a.r || (mustShow.includes(c.m.id) - mustShow.includes(a.m.id)) || a.i - c.i);
  let chosen = ranked.filter((x) => x.r > 0).map((x) => x.m);
  if (!chosen.length && moments.length) chosen = [moments[0]];
  const beats = concept.beats.map((bt) => ({ ...bt, moment: null }));
  const open = beats.filter((bt) => bt.kind !== 'end');
  open.forEach((bt, i) => { bt.moment = chosen.length ? chosen[Math.min(i, chosen.length - 1)].id : null; });
  const used = chosen.slice(0, open.length);
  return { beats, moments: used };
}

function scoreConcept(concept, brief, S, picked, mustShow) {
  let score = 0;
  for (const s of S) score += concept.useWhen[s] || 0;
  if (concept.categories.includes(brief.app.category)) score += 2;
  for (const m of picked) {
    if (mustShow.includes(m.id)) score += 3;
    if (m.automatable === true) score += 0.5;
    else if (m.automatable === 'network') score -= 0.5;
    else if (m.automatable === false) score -= 2;
  }
  if (concept.bold && (brief.owner?.channels || []).includes('social')) score += 1;
  if (concept.id === 'type-led') score += 1;
  return score;
}

function risksFor(concept, beats, moments) {
  const risks = [];
  for (const m of moments) {
    if (m.automatable === 'network') risks.push(`moment "${m.id}" varies per take (network)`);
    if (m.automatable === false) risks.push(`moment "${m.id}" needs a human or a device`);
    const beatSec = Math.max(...beats.filter((x) => x.moment === m.id).map((x) => x.sec));
    if (m.seconds > beatSec * 4) risks.push(`moment "${m.id}" is ${m.seconds}s but its beat is ${beatSec}s — even at 4× it needs trimming`);
  }
  return risks;
}

function reasonsFor(concept, brief, S, moments, mustShow) {
  const reasons = [];
  for (const s of S) if (concept.useWhen[s]) reasons.push({ source: 'code', text: `signal "${s}" fits (weight ${concept.useWhen[s]})`, ref: `signals.${s}` });
  const shown = moments.filter((m) => mustShow.includes(m.id));
  if (shown.length) reasons.push({ source: 'owner', text: `features the owner's must-show: ${shown.map((m) => m.id).join(', ')}`, ref: 'owner.mustShow' });
  if (concept.bold && (brief.owner?.channels || []).includes('social')) reasons.push({ source: 'owner', text: 'bold concepts suit the social channel', ref: 'owner.channels' });
  if (brief.owner?.tone) reasons.push({ source: 'owner', text: `owner tone is "${brief.owner.tone}"`, ref: 'owner.tone' });
  if (concept.categories.includes(brief.app.category)) reasons.push({ source: 'kb', text: `suits the ${brief.app.category} category`, ref: `categories.md#${brief.app.category}` });
  reasons.push({ source: 'kb', text: `concept notes for ${concept.id}`, ref: `concepts.md#${concept.id}` });
  return reasons;
}

export function recommend(brief) {
  const owner = brief.owner || {};
  const mustShow = owner.mustShow || [];
  const mustAvoid = owner.mustAvoid || [];
  const have = new Set(brief.signals || []);
  const moments = (brief.moments || []).filter((m) => !mustAvoid.includes(m.id) && !(m.signals || []).some((s) => mustAvoid.includes(s)));
  const S = [...new Set([...have, ...moments.flatMap((m) => m.signals || [])])];

  const excluded = [];
  const cands = [];
  for (const c of CONCEPTS) {
    let reason = null;
    if (c.phase === 2) reason = 'needs Phase 2 (cinematic renderer)';
    else if (c.requires.length && !c.requires.some((s) => have.has(s))) reason = `needs one of: ${c.requires.join(', ')}`;
    else { const hit = c.avoidWhen.find((s) => have.has(s)); if (hit) reason = `avoided when "${hit}" is present`; }
    if (reason) { excluded.push({ id: c.id, reason }); continue; }
    const { beats, moments: picked } = pickMoments(c, moments, mustShow);
    cands.push({ c, beats, picked, score: scoreConcept(c, brief, S, picked, mustShow) });
  }
  // stable sort keeps catalog order on ties
  cands.sort((a, d) => d.score - a.score);

  const taken = new Set();
  const take = (x, role) => { taken.add(x); return { x, role }; };
  const chosen = [];
  const left = () => cands.filter((x) => !taken.has(x));

  const withMust = mustShow.length ? cands.find((x) => x.picked.some((m) => mustShow.includes(m.id))) : null;
  const strongest = withMust || cands[0];
  if (strongest) chosen.push(take(strongest, 'strongest'));

  if (strongest) {
    const safeOk = (x) => x.picked.every((m) => m.automatable === true);
    const safe = left().find((x) => safeOk(x) && x.c.hook !== strongest.c.hook) || left().find(safeOk);
    if (safe) chosen.push(take(safe, 'safe'));
    const hooks = chosen.map((p) => p.x.c.hook);
    const bold = left().find((x) => x.c.bold && !hooks.includes(x.c.hook)) || left().find((x) => x.c.bold) || left()[0];
    if (bold) chosen.push(take(bold, 'bold'));
  }

  const order = ['safe', 'strongest', 'bold'];
  chosen.sort((a, d) => order.indexOf(a.role) - order.indexOf(d.role));
  const picks = chosen.map(({ x, role }) => ({
    id: x.c.id, name: x.c.name, role, hook: x.c.hook, score: x.score, beats: x.beats,
    risks: risksFor(x.c, x.beats, x.picked),
    reasons: reasonsFor(x.c, brief, S, x.picked, mustShow),
  }));

  const notes = [];
  if (owner.confirmed !== true) notes.push('owner context not confirmed yet — confirm it with the owner before showing these');
  if (picks.length < 3) notes.push(`only ${picks.length} concept${picks.length === 1 ? '' : 's'} fit`);
  return { picks, excluded, notes };
}
