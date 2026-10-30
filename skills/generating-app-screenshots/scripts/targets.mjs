// Store export sizes (portrait). Sources: App Store Connect "Screenshot specifications"
// and Play Console "Add preview assets". Re-check the live pages when Apple/Google change them.
// Append "@landscape" to any id to swap width/height (e.g. "ipad-13@landscape").

export const TARGETS = {
  // ---- Apple App Store (PNG/JPEG, no alpha, max 10 per size & locale) ----
  'ios-6.9':        { w: 1320, h: 2868, store: 'ios', model: 'iphone', max: 10, label: 'iPhone 6.9" (Dynamic Island large)' },
  'ios-6.7':        { w: 1290, h: 2796, store: 'ios', model: 'iphone', max: 10, label: 'iPhone 6.7" (accepted in 6.9" slot)' },
  'ios-6.5':        { w: 1284, h: 2778, store: 'ios', model: 'iphone', max: 10, label: 'iPhone 6.5" (Face ID large)' },
  'ios-6.3':        { w: 1206, h: 2622, store: 'ios', model: 'iphone', max: 10, label: 'iPhone 6.3" (Dynamic Island medium)' },
  'ios-6.1':        { w: 1179, h: 2556, store: 'ios', model: 'iphone', max: 10, label: 'iPhone 6.1" (Dynamic Island medium)' },
  'ios-5.5':        { w: 1242, h: 2208, store: 'ios', model: 'iphone-home', max: 10, label: 'iPhone 5.5" (Home button)' },
  'iphone-duo-outer': { w: 1398, h: 2034, store: 'ios', model: 'iphone', max: 10, label: 'iPhone Duo outer' },
  'iphone-duo-inner': { w: 2007, h: 2853, store: 'ios', model: 'ipad', max: 10, label: 'iPhone Duo inner' },
  'ipad-13':        { w: 2064, h: 2752, store: 'ios', model: 'ipad', max: 10, label: 'iPad 13"' },
  'ipad-12.9':      { w: 2048, h: 2732, store: 'ios', model: 'ipad', max: 10, label: 'iPad Pro 12.9" (2nd gen)' },
  'ipad-11':        { w: 1668, h: 2420, store: 'ios', model: 'ipad', max: 10, label: 'iPad 11"' },
  // Mac App Store: 16:10 — 1280×800, 1440×900, 2560×1600 or 2880×1800
  'mac':            { w: 2880, h: 1800, store: 'ios', family: 'desktop', model: 'macbook', max: 10, label: 'Mac 2880×1800 (16:10)', landscape: true },
  'mac-2560':       { w: 2560, h: 1600, store: 'ios', family: 'desktop', model: 'macbook', max: 10, label: 'Mac 2560×1600 (16:10)', landscape: true },
  'mac-1440':       { w: 1440, h: 900,  store: 'ios', family: 'desktop', model: 'macbook', max: 10, label: 'Mac 1440×900 (16:10)', landscape: true },
  // Apple Watch: one size for all localizations. raw = the app UI only (the App Store shows it in its own watch mask)
  'watch-ultra':    { w: 422, h: 514, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Ultra 3/4' },
  'watch-ultra-2':  { w: 410, h: 502, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Ultra / Ultra 2' },
  'watch-s10':      { w: 416, h: 496, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Series 10–12' },
  'watch-s7':       { w: 396, h: 484, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Series 7–9' },
  'watch-s4':       { w: 368, h: 448, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Series 4–6, SE' },
  'watch-s3':       { w: 312, h: 390, store: 'ios', family: 'watch', model: 'apple-watch', raw: true, max: 10, label: 'Apple Watch Series 1–3' },

  // ---- Apple App Store app previews (H.264/HEVC .mp4/.mov/.m4v, 15–30 s, <= 30 fps, <= 500 MB, max 3 per size & locale) ----
  // Source: https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications (values copied 2026-10-30)
  'preview-iphone':   { w: 886, h: 1920, store: 'ios', model: 'iphone', max: 3, asc: 'IPHONE_67', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'iPhone app preview (6.9/6.5/6.3/6.1/5.8", Duo)' },
  'preview-iphone-16-9': { w: 1080, h: 1920, store: 'ios', model: 'iphone-home', max: 3, asc: 'IPHONE_55', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'iPhone app preview 5.5" / 4" (Home button)' },
  'preview-iphone-4.7': { w: 750, h: 1334, store: 'ios', model: 'iphone-home', max: 3, asc: 'IPHONE_47', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'iPhone app preview 4.7"' },
  'preview-ipad':     { w: 1200, h: 1600, store: 'ios', model: 'ipad', max: 3, asc: 'IPAD_PRO_3GEN_129', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'iPad app preview 13" / 12.9" / 11" / 10.5"' },
  'preview-ipad-9.7': { w: 900, h: 1200, store: 'ios', model: 'ipad', max: 3, asc: 'IPAD_97', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'iPad app preview 9.7"' },
  'preview-mac':      { w: 1920, h: 1080, store: 'ios', family: 'desktop', model: 'macbook', max: 3, asc: 'DESKTOP', video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'Mac app preview 1920×1080', landscape: true },

  // ---- Apple creative assets: product page header, search results, In-App Events (video 5–30 s / 15–30 s, image <= 500 MB) ----
  // Source: https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications (values copied 2026-10-30)
  'header-video':       { w: 3840, h: 1646, store: 'ios', family: 'creative', model: 'iphone', max: 3, video: { minSec: 5, maxSec: 30, fps: 30, maxMB: 500 }, label: 'Product page header video 21:9', landscape: true },
  'search-video':       { w: 3840, h: 2560, store: 'ios', family: 'creative', model: 'iphone', max: 3, video: { minSec: 5, maxSec: 30, fps: 30, maxMB: 500 }, label: 'Search results video 3:2', landscape: true },
  'event-card-video':   { w: 3840, h: 2160, store: 'ios', family: 'creative', model: 'iphone', max: 3, video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'In-App Event card video 16:9', landscape: true },
  'event-details-video': { w: 2160, h: 3840, store: 'ios', family: 'creative', model: 'iphone', max: 3, video: { minSec: 15, maxSec: 30, fps: 30, maxMB: 500 }, label: 'In-App Event details video 9:16' },
  'app-header':         { w: 3840, h: 1646, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, label: 'Product page header 21:9', landscape: true },
  'app-header-16-9':    { w: 5244, h: 2950, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, formats: ['png'], label: 'Product page header 16:9 (PNG only)', landscape: true },
  'search-asset':       { w: 3840, h: 2560, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, label: 'Search results asset 3:2', landscape: true },
  'search-asset-16-9':  { w: 5244, h: 2950, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, formats: ['png'], label: 'Search results asset 16:9 (PNG only)', landscape: true },
  'event-card':         { w: 3840, h: 2160, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, label: 'In-App Event card 16:9', landscape: true },
  'event-details':      { w: 2160, h: 3840, store: 'ios', family: 'creative', model: 'iphone', max: 1, maxMB: 500, label: 'In-App Event details 9:16' },

  // ---- Google Play (JPEG or 24-bit PNG, no alpha; 320–3840px, long side <= 2x short side) ----
  'android-phone':    { w: 1080, h: 1920, store: 'play', model: 'android', max: 8, min: 2, playDir: 'phoneScreenshots', label: 'Play phone 9:16' },
  'android-phone-hd': { w: 1440, h: 2560, store: 'play', model: 'android', max: 8, min: 2, playDir: 'phoneScreenshots', label: 'Play phone 9:16 HD' },
  'android-tablet-7': { w: 1440, h: 2560, store: 'play', model: 'android-tablet', max: 8, min: 4, playDir: 'sevenInchScreenshots', label: 'Play 7" tablet 9:16' },
  'android-tablet-10':{ w: 2160, h: 3840, store: 'play', model: 'android-tablet', max: 8, min: 4, playDir: 'tenInchScreenshots', label: 'Play 10" tablet 9:16' },
  'chromebook':       { w: 1920, h: 1080, store: 'play', model: 'none', max: 8, min: 4, playDir: 'chromebookScreenshots', label: 'Chromebook 16:9', landscape: true },
  // Wear OS: 1:1, >= 384 px, app UI only — Google forbids frames, extra text and backgrounds
  'wear-os':          { w: 768, h: 768, store: 'play', family: 'watch', model: 'wear-os', raw: true, max: 8, min: 1, playDir: 'wearScreenshots', label: 'Wear OS 1:1' },
  'play-feature-graphic': { w: 1024, h: 500, store: 'play', model: 'android', max: 1, playDir: 'featureGraphic', label: 'Play feature graphic', landscape: true },

  // ---- Microsoft Store (PNG, desktop >= 1366×768, 4K supported, <= 50 MB, max 10) ----
  'windows':        { w: 1920, h: 1080, store: 'msstore', family: 'desktop', model: 'windows-window', max: 10, label: 'Windows desktop 1920×1080', landscape: true },
  'windows-4k':     { w: 3840, h: 2160, store: 'msstore', family: 'desktop', model: 'windows-window', max: 10, label: 'Windows desktop 4K', landscape: true },
  'windows-1366':   { w: 1366, h: 768,  store: 'msstore', family: 'desktop', model: 'windows-window', max: 10, label: 'Windows desktop minimum 1366×768', landscape: true },

  // ---- Marketing / social (not store uploads) ----
  'og-image':      { w: 1200, h: 630, store: 'social', model: 'iphone', max: 99, label: 'Open Graph / link preview' },
  'x-post':        { w: 1600, h: 900, store: 'social', model: 'iphone', max: 99, label: 'X / Twitter post 16:9' },
  'product-hunt':  { w: 1270, h: 760, store: 'social', model: 'iphone', max: 99, label: 'Product Hunt gallery' },
  'instagram':     { w: 1080, h: 1350, store: 'social', model: 'iphone', max: 99, label: 'Instagram portrait 4:5' },
  'story':         { w: 1080, h: 1920, store: 'social', model: 'iphone', max: 99, label: 'Story / Reel 9:16' },
  'story-video':   { w: 1080, h: 1920, store: 'social', model: 'iphone', max: 99, video: { minSec: 0, maxSec: Infinity, fps: 30, maxMB: Infinity }, label: 'Story / Reel video 9:16 (no store limits)' },
};

export function resolveTarget(spec) {
  if (typeof spec === 'object') {
    // custom: { "id": "promo", "w": 1200, "h": 628, "model": "iphone" }
    const out = { store: 'custom', model: 'iphone', max: 99, ...spec, id: spec.id || `${spec.w}x${spec.h}` };
    if (out.video) out.video = { fps: 30, maxMB: 500, ...out.video };
    return out;
  }
  const [id, mod] = spec.split('@');
  const t = TARGETS[id];
  if (!t) throw new Error(`Unknown target "${spec}". Known: ${Object.keys(TARGETS).join(', ')}`);
  const out = { ...t, id: spec, baseId: id };
  if (t.video) out.video = { ...t.video };
  if (mod === 'landscape' && out.h > out.w) [out.w, out.h] = [out.h, out.w];
  // Apple accepts captioned watch shots at the store size (it rounds the corners itself); Wear OS rejects them
  if (mod === 'styled') {
    if (out.store !== 'ios' || out.family !== 'watch') throw new Error(`"@styled" is for Apple Watch targets only, not "${id}"`);
    out.raw = false;
  }
  out.landscape = out.w > out.h;
  return out;
}

export const isVideoTarget = (t) => !!t.video;

// Apple takes some creative assets as PNG only. Returns an error message, or null when the format is fine.
export function checkTargetFormat(t, format) {
  if (!t.formats) return null;
  const f = String(format).toLowerCase().replace(/^jpg$/, 'jpeg');
  return t.formats.includes(f) ? null : `${t.id}: Apple accepts ${t.formats.join('/').toUpperCase()} only — use --format ${t.formats[0]}`;
}

// Locale codes differ between App Store Connect and Play Console. Keys are the codes you
// use in the config; values override the store-specific folder name for fastlane export.
export const LOCALE_MAP = {
  'zh-Hans': { ios: 'zh-Hans', play: 'zh-CN' },
  'zh-Hant': { ios: 'zh-Hant', play: 'zh-TW' },
  'zh-HK':   { ios: 'zh-Hant', play: 'zh-HK' },
  'pt-BR':   { ios: 'pt-BR', play: 'pt-BR' },
  'pt-PT':   { ios: 'pt-PT', play: 'pt-PT' },
  'es-ES':   { ios: 'es-ES', play: 'es-ES' },
  'es-MX':   { ios: 'es-MX', play: 'es-419' },
  'he':      { ios: 'he', play: 'iw-IL' },
  'id':      { ios: 'id', play: 'id' },
  'nb':      { ios: 'no', play: 'no-NO' },
  'fil':     { ios: 'fil', play: 'fil' },
  'vi':      { ios: 'vi', play: 'vi' },
  'ja':      { ios: 'ja', play: 'ja-JP' },
  'ko':      { ios: 'ko', play: 'ko-KR' },
  'de':      { ios: 'de-DE', play: 'de-DE' },
  'fr':      { ios: 'fr-FR', play: 'fr-FR' },
  'it':      { ios: 'it', play: 'it-IT' },
  'nl':      { ios: 'nl-NL', play: 'nl-NL' },
  'ru':      { ios: 'ru', play: 'ru-RU' },
  'tr':      { ios: 'tr', play: 'tr-TR' },
  'pl':      { ios: 'pl', play: 'pl-PL' },
  'sv':      { ios: 'sv', play: 'sv-SE' },
  'th':      { ios: 'th', play: 'th' },
  'ar':      { ios: 'ar-SA', play: 'ar' },
  'hi':      { ios: 'hi', play: 'hi-IN' },
};
export const storeLocale = (loc, store) => LOCALE_MAP[loc]?.[store] || loc;

export const RTL_LOCALES = ['ar', 'he', 'fa', 'ur', 'iw'];
export const isRtl = (loc) => RTL_LOCALES.includes(loc.split('-')[0]);

// Google Fonts that cover scripts the brand font usually lacks. Added after the brand font.
export const SCRIPT_FONTS = {
  ja: 'Noto Sans JP', ko: 'Noto Sans KR', zh: 'Noto Sans SC', 'zh-Hant': 'Noto Sans TC', 'zh-HK': 'Noto Sans TC',
  ar: 'Noto Sans Arabic', fa: 'Vazirmatn', ur: 'Noto Nastaliq Urdu', he: 'Noto Sans Hebrew', th: 'Noto Sans Thai',
  hi: 'Noto Sans Devanagari', bn: 'Noto Sans Bengali', ta: 'Noto Sans Tamil', te: 'Noto Sans Telugu',
  km: 'Noto Sans Khmer', my: 'Noto Sans Myanmar', ka: 'Noto Sans Georgian', am: 'Noto Sans Ethiopic',
};
export function scriptFont(loc) {
  return SCRIPT_FONTS[loc] || SCRIPT_FONTS[loc.split('-')[0]];
}
