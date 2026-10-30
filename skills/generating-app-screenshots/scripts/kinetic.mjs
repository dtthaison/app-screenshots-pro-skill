// Kinetic captions: per-unit progress curves for word-by-word, line-by-line and spring "pop" entrances.
// Pure maths plus the markup helpers; values are cited in references/video/motion.md#kinetic-captions.
export const CAPTION_MOTIONS = ['rise', 'words', 'lines', 'pop', 'none'];
const WORD_STAGGER = 0.07, LINE_STAGGER = 0.12, UNIT_DUR = 0.45;
const ZETA = 0.8, OMEGA0 = 10;
const POP_FROM = 0.92;
// Envelope of the step response is e^(-zeta*omega0*t) * 1.67 = 1.67 * e^(-8t); 0.75 s leaves 0.4% (< 0.5% of the step).
const POP_SETTLE = 0.75;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// expo-out, exactly 0 before the start and exactly 1 once done (so rest frames compare equal)
const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - 2 ** (-10 * p));

// Scene 1 keeps its caption complete at frame 0 (hard loop, owner preference): the theme/preview default does not
// apply to it; only a captionMotion set on the scene itself does.
// A caption without a title has nothing to animate (and the eyebrow/subtitle would show with no entrance): rise instead.
export function resolveCaptionMotion(index, scene = {}, preview = {}, themeVideo = {}, hasTitle = true) {
  const m = scene.captionMotion != null ? scene.captionMotion : index === 0 ? 'rise' : preview.captionMotion ?? themeVideo.captionMotion ?? 'rise';
  return !hasTitle && (m === 'words' || m === 'lines' || m === 'pop') ? 'rise' : m;
}

// "Swap in **one tap**" -> one unit per space-separated word, keeping the **highlight** state across words.
// A word that mixes highlighted and plain text (`**tap**.`) keeps its markers in `word` with hl false.
// Text without spaces (ja, zh, th) stays a single unit. A manual line break (a real newline or a literal backslash-n,
// as rich() reads them) becomes a `{ br: true }` marker; it is not a word, so indices and counts cover words only.
export function splitWords(text) {
  const units = [];
  let hl = false;
  String(text ?? '').split(/\\n|\n/).forEach((line, li) => {
    if (li > 0) units.push({ br: true });
    let open = false;                       // open: the last unit has no whitespace after it yet
    for (const seg of line.split('**')) {
      seg.split(/\s+/).forEach((piece, k) => {
        if (k > 0) open = false;
        if (!piece) return;
        if (open) {
          const u = units.at(-1);
          if (!u.mixed) { u.word = u.hl ? `**${u.word}**` : u.word; u.mixed = true; u.hl = false; }
          u.word += hl ? `**${piece}**` : piece;
        } else units.push({ word: piece, hl, mixed: false });
        open = true;
      });
      hl = !hl;
    }
    // the final toggle above flips once per segment; undo the one past the last segment
    hl = !hl;
  });
  return units.map((u) => (u.br ? u : { word: u.word, hl: u.hl }));
}

export const wordCount = (units) => units.filter((u) => !u.br).length;

export function wordsHtml(units, richFn) {
  let html = '', prevWord = false;
  for (const u of units) {
    if (u.br) { html += '<br>'; prevWord = false; continue; }
    html += `${prevWord ? ' ' : ''}<span class="kw" style="display:inline-block;overflow:hidden;vertical-align:bottom;padding:.2em .1em .35em;margin:-.2em -.1em -.35em"><span class="kwi" style="display:inline-block">${richFn(u.hl ? `**${u.word}**` : u.word)}</span></span>`;
    prevWord = true;
  }
  return html;
}

// Per-unit progress 0..1 at caption time t. For `lines`, n is the word count (the most lines there can be);
// the page maps each rendered line to its index.
export function unitProgress(kind, t, n) {
  const stagger = kind === 'lines' ? LINE_STAGGER : WORD_STAGGER;
  return Array.from({ length: n }, (_, i) => ease((t - stagger * i) / UNIT_DUR));
}

// Closed-form underdamped spring step response (zeta 0.8, omega0 10 rad/s); scale 0.92 -> 1, opacity 0 -> 1.
export function popValue(t) {
  if (t >= POP_SETTLE) return { scale: 1, opacity: 1 };
  if (t <= 0) return { scale: POP_FROM, opacity: 0 };
  const wd = OMEGA0 * Math.sqrt(1 - ZETA * ZETA), k = ZETA * OMEGA0;
  const x = 1 - Math.exp(-k * t) * (Math.cos(wd * t) + (k / wd) * Math.sin(wd * t));
  return { scale: POP_FROM + (1 - POP_FROM) * x, opacity: clamp01(x) };
}

// When the last unit finishes; stateAt clamps the caption time here so rest frames are identical.
export function motionLength(kind, n = 1) {
  if (kind === 'pop') return POP_SETTLE;
  if (kind === 'words') return WORD_STAGGER * (Math.max(1, n) - 1) + UNIT_DUR;
  if (kind === 'lines') return LINE_STAGGER * (Math.max(1, n) - 1) + UNIT_DUR;
  return 0;
}
