// Store-rule and concept checks for app preview videos. Every check name below has a section in
// references/video/store-rules.md ("Enforcing checks"), with its level and the targets it applies to.
// Levels never change the exit code except ERROR: WARN and NOTE exit 0.
import { CONCEPTS } from './concepts.mjs';
import { splitWords, wordCount } from './kinetic.mjs';
import { restLen } from './video.mjs';

const EPS = 1e-6;

// check name -> level. A WARN or NOTE can be switched off with `checks.ignore` on a preview or a scene; an ERROR cannot.
export const CHECKS = {
  'framed-device': 'WARN', price: 'WARN', 'time-sensitive': 'NOTE', 'play-phrases': 'WARN', 'reading-time': 'WARN',
  'hook-timing': 'WARN', 'beat-length': 'WARN', 'end-card': 'WARN', 'iphone-only': 'ERROR', disclose: 'NOTE',
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const langOf = (locale) => String(locale || 'en').split(/[-_]/)[0].toLowerCase();
// scripts written without spaces between words: a term matches anywhere in the text
const NO_BREAKS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
// One term as a regex source. Without word breaks the term may sit inside a word, but never right after a digit or a
// Han numeral ("11月" is not "1月", "十一月" is not "一月"); elsewhere it must stand alone. A space matches any white space.
function termRe(term) {
  const body = escapeRe(term).replace(/ +/g, '\\s+');
  return NO_BREAKS.test(term) ? `(?<![\\p{N}〇一二三四五六七八九十])${body}` : `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`;
}
// longest first, so "Tháng 10" wins over "Tháng 1" and "die beste app" over a shorter term
const termsRegex = (terms) => new RegExp([...new Set(terms)].sort((a, b) => b.length - a.length).map(termRe).join('|'), 'iu');
// one compiled regex per (kind, language), built on first use
const reCache = new Map();
function cached(key, build) {
  if (!reCache.has(key)) reCache.set(key, build());
  return reCache.get(key);
}

// framed-device (WARN, preview-*)
export function framedDevice(target, dev) {
  if (!String(target?.id ?? '').startsWith('preview-') || !dev) return null;
  if (dev.model === 'none' && dev.style === 'frameless') return null;
  return 'device frames risk rejection under 2.3.4 — use full-screen or caption-band';
}

// price (WARN, Apple preview and creative targets): currency symbols and codes next to digits, and period words
const SYMBOLS = '$€£¥₩₫฿₹₱₺₽₴₪₦₸';
const MARK = `(?:\\d|[${SYMBOLS}円元원])`;   // what ends an amount: a digit or a currency mark
// ISO codes are matched in capitals only, so "Try 7 days" and "php 8" are not prices. TRY and PHP are also an English
// word and a language name, so they count only after the amount ("50 TRY"), or PHP before at least two digits ("PHP 199").
const CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'VND', 'THB', 'INR', 'MYR', 'IDR', 'AUD', 'CAD', 'CHF', 'BRL', 'MXN',
  'SGD', 'HKD', 'TWD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'UAH', 'ZAR', 'NZD', 'AED', 'SAR', 'ILS', 'NGN', 'EGP',
  'PKR', 'TRY', 'PHP'];
const PREFIX_CODES = CODES.filter((c) => c !== 'TRY' && c !== 'PHP').join('|');
// period words after "/" in many languages; a period word counts only right after an amount ("3x/week" is not a price)
const PERIODS = ['month', 'mo', 'year', 'yr', 'week', 'wk', 'monat', 'jahr', 'woche', 'mois', 'an', 'semaine', 'mes', 'año',
  'semana', 'mês', 'ano', 'mese', 'anno', 'settimana', 'mån', 'år', 'måned', 'mnd', 'mies', 'rok', 'ay', 'yıl', 'maand', 'jaar',
  'tháng', 'năm', 'tuần'];
const PRICE_CI = new RegExp([
  `[${SYMBOLS}]\\s?\\d`, `\\d\\s?[${SYMBOLS}]`,
  `(?<![\\p{L}])(?:RM|Rp|R\\$|kr\\.?)\\s?\\d`, `\\d\\s?(?:kr|zł|kč)(?![\\p{L}])`,
  `${MARK}\\s?\\/\\s?(?:${PERIODS.join('|')})(?![\\p{L}])`,
  `${MARK}\\s?\\/\\s?(?:月|年|週|周|월|년|주)`,
].join('|'), 'iu');
const PRICE_CODES = new RegExp([
  `(?<![\\p{L}])(?:${PREFIX_CODES})\\s?\\d`, `(?<![\\p{L}])PHP\\s?\\d{2,}`,
  `\\d\\s?(?:${CODES.join('|')}|TL)(?![\\p{L}])`,
].join('|'), 'u');
export function priceMatch(text) {
  const s = String(text ?? '');
  const m = PRICE_CI.exec(s) || PRICE_CODES.exec(s);
  if (!m) return null;
  // quote the whole amount ("$9.99", not "$9"): widen the match over the digits and separators around it
  let a = m.index, b = m.index + m[0].length;
  while (a > 0 && /[\d.,]/.test(s[a - 1])) a--;
  while (b < s.length && (/\d/.test(s[b]) || (/[.,]/.test(s[b]) && /\d/.test(s[b + 1] ?? '')))) b++;
  return `"${s.slice(a, b).trim()}" looks like a price — prices and currencies vary by region (apple-prices)`;
}

// time-sensitive (NOTE, all video targets): a year, a month name in the locale, or a season or holiday word in the
// locale's language or English. Case-insensitive. An English "May" or "March" in ordinary prose is a false positive;
// acceptable because this check is only a NOTE and can be ignored per scene.
const SEASONS = {
  en: ['spring', 'summer', 'autumn', 'winter', 'this fall', 'christmas', 'xmas', 'easter', 'halloween', 'thanksgiving',
    'black friday', 'cyber monday', 'new year', "valentine's day", 'back to school', 'holiday season'],
  de: ['frühling', 'frühjahr', 'sommer', 'herbst', 'weihnachten', 'ostern', 'silvester', 'neujahr', 'valentinstag'],
  fr: ['printemps', 'cet été', "l'été", 'automne', 'hiver', 'noël', 'pâques', 'nouvel an', 'saint-valentin', 'rentrée'],
  es: ['primavera', 'verano', 'otoño', 'invierno', 'navidad', 'pascua', 'año nuevo', 'san valentín'],
  pt: ['primavera', 'verão', 'outono', 'inverno', 'natal', 'páscoa', 'ano novo', 'dia dos namorados'],
  it: ['primavera', 'estate', 'autunno', 'inverno', 'natale', 'pasqua', 'capodanno', 'san valentino'],
  vi: ['mùa xuân', 'mùa hè', 'mùa hạ', 'mùa thu', 'mùa đông', 'giáng sinh', 'noel', 'tết', 'năm mới', 'trung thu', 'valentine'],
  ja: ['春の', '夏の', '秋の', '冬の', '夏休み', '冬休み', 'クリスマス', '正月', '年末年始', 'バレンタイン', 'ハロウィン', 'ブラックフライデー'],
  zh: ['春季', '夏季', '秋季', '冬季', '春节', '春節', '圣诞', '聖誕', '新年', '双十一', '雙十一', '情人节', '情人節', '中秋'],
  ko: ['봄', '여름', '가을', '겨울', '크리스마스', '설날', '추석', '블랙프라이데이', '발렌타인'],
};
function monthNames(locale) {
  let fmt;
  try { fmt = new Intl.DateTimeFormat(locale, { month: 'long' }); } catch { fmt = new Intl.DateTimeFormat('en', { month: 'long' }); }
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2024, m, 15)));
}
export function timeSensitive(text, locale = 'en') {
  const s = String(text ?? '');
  const year = /(?<!\d)(?:199\d|20\d\d)(?!\d)/.exec(s);
  if (year) return `"${year[0]}" dates the video — avoid years and seasons (apple-seasonal)`;
  const month = cached(`month:${locale}`, () => termsRegex(monthNames(locale))).exec(s);
  if (month) return `"${month[0]}" dates the video — avoid months and seasons (apple-seasonal)`;
  const lang = langOf(locale);
  const season = cached(`season:${lang}`, () => termsRegex([...SEASONS.en, ...(SEASONS[lang] ?? [])])).exec(s);
  if (season) return `"${season[0]}" dates the video — avoid seasons and holidays (apple-seasonal)`;
  return null;
}

// play-phrases (WARN, play-promo): calls to action and claims such as "best" or "#1", in the locale's language and English.
// A bare "best" is a claim only as "the best ..." or "best <app word>": "your best self" is not one, and Play's
// "Best of" awards are allowed.
const PLAY = {
  en: ['install now', 'download now', 'download today', 'install today', 'get it now', 'play now', '#1', 'no. 1', 'no.1',
    'number one', 'top-rated', 'top rated', 'best-rated', 'best rated', 'best-selling', 'best selling'],
  de: ['jetzt herunterladen', 'jetzt installieren', 'jetzt laden', 'lade jetzt', 'die beste app', 'die besten apps', 'beste app', 'nr. 1', 'nr.1', 'nummer 1', 'nummer eins'],
  fr: ['télécharger maintenant', 'téléchargez maintenant', 'téléchargez-la', 'installez maintenant', 'la meilleure app', 'la meilleure application', 'le meilleur jeu', 'n°1', 'n° 1', 'nº1', 'nº 1', 'numéro 1', 'numéro un'],
  es: ['descarga ahora', 'descárgala ahora', 'descargar ahora', 'descárgala ya', 'instala ahora', 'la mejor app', 'la mejor aplicación', 'el mejor juego', 'nº 1', 'n.º 1', 'número 1', 'número uno'],
  pt: ['baixe agora', 'baixar agora', 'baixe já', 'instale agora', 'o melhor app', 'o melhor aplicativo', 'a melhor app', 'o melhor jogo', 'nº 1', 'número 1', 'número um'],
  it: ['scarica ora', 'scaricala ora', 'scarica subito', 'installa ora', 'la migliore app', 'la migliore applicazione', 'il miglior gioco', 'n. 1', 'numero 1', 'numero uno'],
  vi: ['tải ngay', 'tải về ngay', 'tải xuống ngay', 'cài đặt ngay', 'cài ngay', 'tốt nhất', 'số 1', 'số một', 'hàng đầu'],
  ja: ['今すぐダウンロード', '今すぐインストール', 'ダウンロードはこちら', 'ナンバーワン', 'ナンバー1', '1位', '最高のアプリ'],
  zh: ['立即下载', '立即下載', '马上下载', '現在下載', '现在下载', '立即安装', '立即安裝', '最好的应用', '最好的應用', '第一名', '排名第一'],
  ko: ['지금 다운로드', '지금 설치', '다운로드하세요', '최고의 앱', '1위', '넘버원'],
};
const APP_WORDS = 'apps?|games?|tools?|trackers?|planners?|choice';
const BEST = new RegExp(`(?<![\\p{L}\\p{N}])(?:the\\s+best(?!\\s+of(?![\\p{L}]))(?![\\p{L}\\p{N}])|best(?:\\s+[\\p{L}-]+){0,2}?\\s+(?:${APP_WORDS})(?![\\p{L}\\p{N}]))`, 'iu');
export function playPhrase(text, locale = 'en') {
  const s = String(text ?? ''), lang = langOf(locale);
  const m = cached(`play:${lang}`, () => termsRegex([...PLAY.en, ...(PLAY[lang] ?? [])])).exec(s) || BEST.exec(s);
  return m ? `"${m[0]}" — Google Play asks for no calls to action or superlatives (play-phrases)` : null;
}

// reading-time (WARN): a caption stays up at least 0.5 s + 0.3 s per word
export const readingTime = (words) => 0.5 + 0.3 * words;

// iphone-only (ERROR): concept previews are recorded on iPhone in this release
export function iphoneOnly(target) {
  const id = String(target?.id ?? '');
  return id.startsWith('preview-') && id !== 'preview-iphone' ? 'iPhone only in this release (preview-iphone)' : null;
}

// hook-timing, beat-length, end-card (WARN, previews with a concept) -> [{ check, scene, message }]
// scene is the scene id the finding is about, or null for the whole preview
const LONG_OK = new Set(['hero-moment', 'ask-answer']);   // one beat of 5-8 s
const sec = (d) => `${Math.round(d * 100) / 100}s`;
export function conceptFindings(conceptId, timeline, { hookVisibleAt = null, endCardIds = [] } = {}) {
  const out = [], scenes = timeline?.scenes ?? [];
  const add = (check, scene, message) => out.push({ check, scene, message });
  if (hookVisibleAt != null && hookVisibleAt > 1 + EPS) add('hook-timing', null, `the first caption is fully visible at ${hookVisibleAt.toFixed(1)}s — it should be by 1.0s`);
  const ends = new Set(endCardIds);
  // the end card comes last; without one the last scene is not judged as a beat
  let beatScenes = scenes;
  if (!ends.size && scenes.length) {
    add('end-card', null, `concept "${conceptId}": no end card — the last scene should use layout end-card`);
    beatScenes = scenes.slice(0, -1);
  }
  const allowLong = LONG_OK.has(conceptId) && CONCEPTS.some((c) => c.id === conceptId);
  let longSeen = false;
  for (const s of beatScenes) {
    if (ends.has(s.id)) continue;
    const d = s.duration ?? s.end - s.start;
    if (d < 2 - EPS) add('beat-length', s.id, `scene "${s.id}" lasts ${sec(d)} — beats last 2-5s`);
    else if (d > 8 + EPS) add('beat-length', s.id, `scene "${s.id}" lasts ${sec(d)} — even a hero beat stops at 8s`);
    else if (d > 5 + EPS) {
      if (allowLong && !longSeen) longSeen = true;
      else add('beat-length', s.id, `scene "${s.id}" lasts ${sec(d)} — beats last 2-5s${allowLong ? ' (one beat may run to 8s)' : ''}`);
    }
  }
  scenes.forEach((s, i) => {
    if (!ends.has(s.id)) return;
    const d = s.duration ?? s.end - s.start;
    if (i !== scenes.length - 1) add('end-card', s.id, `scene "${s.id}" is not the last scene`);
    if (d < 1.5 - EPS || d > 3 + EPS) add('end-card', s.id, `scene "${s.id}" lasts ${sec(d)} — the end card lasts 1.5-3s`);
  });
  return out;
}
// the same findings as "<check>: <message>" lines
export const conceptWarnings = (...args) => conceptFindings(...args).map((f) => `${f.check}: ${f.message}`);

// Every check for one preview × target × locale.
// scenes: [{ id, layout, dev, texts: [string], hasCaption, ignore?: [check] }], in timeline order.
// preview.checks.ignore (and a scene's ignore) switch off WARN and NOTE checks by name.
// -> { findings: [{ check, level, scene, message }], warnings, notes, errors } — the last three as printable lines
export function storeChecks({ target, locale, preview, scenes, timeline, disclose = null }) {
  const findings = [];
  const id = target.id;
  const applePreview = id.startsWith('preview-'), creative = target.family === 'creative';
  const add = (check, scene, message) => message && findings.push({ check, level: CHECKS[check], scene, message });
  // ignore lists: unknown names and ERROR checks are reported, not silently dropped
  const ignoreOf = (list, where) => {
    const set = new Set();
    for (const name of [list ?? []].flat()) {
      if (!(name in CHECKS)) add('checks', null, `${where}checks.ignore: unknown check "${name}" — known: ${Object.keys(CHECKS).join(', ')}`);
      else if (CHECKS[name] === 'ERROR') add('checks', null, `${where}checks.ignore: "${name}" is an ERROR and cannot be ignored`);
      else set.add(name);
    }
    return set;
  };
  const previewIgnore = ignoreOf(preview?.checks?.ignore, '');
  const sceneIgnore = new Map(scenes.map((sc) => [sc.id, ignoreOf(sc.ignore, `scene "${sc.id}": `)]));

  if (preview?.concept) add('iphone-only', null, iphoneOnly(target));
  scenes.forEach((sc, i) => {
    const tl = timeline.scenes[i];
    add('framed-device', sc.id, framedDevice(target, sc.dev));
    for (const text of sc.texts) {
      if (applePreview || (target.store === 'ios' && creative)) add('price', sc.id, priceMatch(text));
      if (id === 'play-promo') add('play-phrases', sc.id, playPhrase(text, locale));
      add('time-sensitive', sc.id, timeSensitive(text, locale));
    }
    if (sc.hasCaption && tl) {
      const need = readingTime(tl.words), nextDur = timeline.scenes[i + 1]?.transition?.dur ?? 0;
      // same model as the hook check: the caption is at rest from visibleAt and the next transition starts covering it at end - nextDur
      const visibleAt = Math.max(tl.start, tl.start - (tl.transition?.dur ?? 0) + restLen(tl)), shown = (tl.end - nextDur) - visibleAt;
      if (shown < need - EPS) add('reading-time', sc.id, `caption is fully visible for ${shown.toFixed(1)}s but ${tl.words} words need ${need.toFixed(1)}s to read`);
    }
    for (const l of tl?.labels ?? []) {
      const n = Math.max(1, wordCount(splitWords(l.text))), need = readingTime(n), shown = l.until - l.at;
      if (shown < need - EPS) add('reading-time', sc.id, `label "${l.text}" is up for ${shown.toFixed(1)}s but ${n} words need ${need.toFixed(1)}s to read`);
    }
  });
  if (preview?.concept) {
    const first = scenes.findIndex((s) => s.hasCaption);
    const f = first >= 0 ? timeline.scenes[first] : null;
    // the entrance starts with the transition into the scene; restLen covers its delay and the caption motion
    const hookVisibleAt = f ? Math.max(f.start, f.start - (f.transition?.dur ?? 0) + restLen(f)) : null;
    const endCardIds = scenes.filter((s) => s.layout === 'end-card').map((s) => s.id);
    for (const c of conceptFindings(preview.concept, timeline, { hookVisibleAt, endCardIds })) add(c.check, c.scene, c.message);
    if (disclose && !endCardIds.length) add('disclose', null, `owner.disclose is set ("${disclose}") but the preview has no end-card scene — show it in the footage or add an end card (apple-disclose)`);
  }

  const kept = findings.filter((f) => f.level === 'ERROR' || f.check === 'checks'
    || !(previewIgnore.has(f.check) || (f.scene != null && sceneIgnore.get(f.scene)?.has(f.check))));
  for (const f of kept) if (!f.level) f.level = 'WARN';   // ignore-list problems
  // printable lines keep the 1.2.0 shape: 'scene "<id>": <message>' for scene findings, the concept ones prefixed by their check
  const line = (f) => {
    const concept = ['hook-timing', 'beat-length', 'end-card'].includes(f.check) ? `${f.check}: ${f.message}` : f.message;
    return f.scene != null && !concept.startsWith(`${f.check}: scene "`) ? `scene "${f.scene}": ${concept}` : concept;
  };
  const pick = (level) => kept.filter((f) => f.level === level).map(line);
  return { findings: kept, warnings: pick('WARN'), notes: pick('NOTE'), errors: pick('ERROR') };
}

// A draft stands in for a missing recording: it must be a still image, never a clip or an html mock.
export const isStillImagePath = (p) => /\.(png|jpe?g|webp|gif|avif)$/i.test(String(p ?? '').split('?')[0]);
