// Layout presets. Each returns a list of elements for one slide on one canvas.
// Coordinates (all elements): x = horizontal CENTER in % of slide width,
// y = TOP edge in % of slide height, w = width in % of slide width, h = max height in % of slide height.
// Font sizes are in % of slide width.

import { deviceAspect, screenRect, isDesktopModel } from './devices.mjs';

export const LAYOUT_INFO = {
  'text-top':      'Caption top, device bottom (bleeds off the edge). The workhorse; use for most slides.',
  'text-bottom':   'Device top, caption bottom.',
  'hero':          'Big caption + large device low on the canvas. Slide 1.',
  'device-hero':   'Huge device fills the slide, small caption in the corner. For striking UIs.',
  'screen-hero':   'Device clipped at the top (~30% off-canvas), caption underneath. Immersive apps, games, video.',
  'tilt-left':     'Caption top, device turned in 3D toward the left. Energetic lifestyle / fitness / social.',
  'tilt-right':    'Mirror of tilt-left.',
  'corner':        'Large rotated device peeking from the bottom-right, caption left-aligned top.',
  'two-devices':   'Two overlapping phones (screen2 behind). Show two related screens.',
  'three-devices': 'Fan of three phones (screen2 left, screen3 right). Overview / variety.',
  'phone-tablet':  'iPad behind + phone in front (screen = phone, screen2 = tablet). Cross-device apps.',
  'landscape':     'Landscape phone under the caption. Games, video, maps.',
  'pop-out':       'Device with 1–2 magnified UI cards popping out (popouts: [{crop}]). Point at details.',
  'metric':        'Device with a big floating achievement card (metric: {icon,value,label}). Streaks, savings, PRs.',
  'annotated':     'Flat device with callout chips pointing at UI spots (callouts: [{text, at:[x%,y%] of screen]}).',
  'before-after':  'Two devices side by side with labels (screen = before, screen2 = after, labels).',
  'frameless':     'Screenshot as a rounded card, no frame. Max focus on UI.',
  'mosaic':        'Tilted collage of 4 frameless screens (screens: [...]). Breadth of content.',
  'feature-grid':  'Caption + 2-column grid of icon tiles (features: [{icon,title,text}]). No device. Slide 4+.',
  'steps':         'Caption + numbered step rows (steps: [{title,text}]). Onboarding / how it works.',
  'stats':         'Caption + big numbers (stats: [{value,label}]), optional small device. Data-led proof.',
  'review':        'Stars + rating headline + quote card + clipped device (review: {stars,quote,author}).',
  'awards':        'Caption + laurel badges (awards: [{title,subtitle}]) + device. Real awards only.',
  'split-photo':   'Lifestyle photo on top (photo), device overlapping below.',
  'text-left':     'Wide canvases: caption left, device right.',
  'text-right':    'Wide canvases: device left, caption right.',
  'caption-only':  'Big statement, no device.',
  'caption-top':   'Caption band on top, nothing else — used by panorama patterns, which place the devices.',
  // ---- signature layouts (our own look: light, type, motion, depth) ----
  'spotlight':     'Device on a lit stage: a light beam from above + floor glow. Premium, dark themes, launches. (beam: color)',
  'big-type':      'Giant gradient word (the **highlight** of the title, or word) above the device, with an outlined echo behind it.',
  'ticker':        'Two marquee bands of repeated words cross behind and in front of the device (ticker: text or [a, b]). Energy, sports, sales.',
  'arch':          'Device rising out of a glowing arch portal with an outline halo (arch: fill). Calm, wellness, premium.',
  'orbit':         'Device inside a 3D orbit ring with feature chips riding the ring (orbit: [{icon,text}] up to 4). Feature overview.',
  'lens':          'Magnifier lens enlarging one spot of the screen, joined by a line (lens: {at:[x%,y%], span}). Small but key UI detail.',
  'layers':        'Tilted device with 2 UI layers lifted off the screen toward you (layers: [{crop}]). Shows what the screen is made of.',
  'notify':        'Notification banners cascade onto the device (notifications: [{icon,title,text}]). Reminders, messages, alerts.',
  'deck':          'Three phones stacked like a deck of cards, back ones dimmed (screen, screen2, screen3). Flows and sequences.',
  // ---- cross-device ----
  'phone-watch':   'Phone + watch in front (screen = phone, screen2 = watch). "Also on your wrist". watchModel: apple-watch | wear-os.',
  'watch-hero':    'One big watch with straps under the caption (screen = watch UI). Marketing / social / website.',
  'laptop-phone':  'Laptop (screen2) with a phone in front (screen). Cross-platform apps; works on tall and wide canvases.',
  // ---- real-footage layouts (also fine on screenshots) ----
  'full-screen':   'The screen fills the canvas edge to edge; the caption sits on a gradient scrim (caption.position: "bottom" flips it). Recordings must match the canvas aspect.',
  'caption-band':  'A solid band (top 18%, or bottom) holds the caption; the screen fills the rest at its own aspect, so captions never cover the UI.',
  'end-card':      'App icon (app.icon), app name, the title as a tagline and a small subtitle (e.g. "Subscription required"). No device. Last scene of a preview.',
  'blank':         'Nothing; place elements yourself.',
};
export const LAYOUTS = Object.keys(LAYOUT_INFO);
// wide canvases that hold a laptop / monitor / window (Mac, Windows) may use these too
const DESK_WIDE = ['text-top', 'hero', 'device-hero', 'tilt-left', 'tilt-right', 'text-left', 'text-right', 'laptop-phone', 'phone-watch'];
const WIDE_OK = ['phone-watch', 'laptop-phone', 'caption-top', 'text-left', 'text-right', 'caption-only', 'blank', 'frameless', 'feature-grid', 'steps', 'stats', 'review', 'awards', 'landscape', 'mosaic', 'full-screen', 'caption-band', 'end-card'];

// A background (string, {color}, {gradient:{stops}}) as one solid CSS colour. Only a trailing position ("0%") is stripped
// from a stop, so "rgba(1, 2, 3, .5) 0%" survives. A CSS gradient string gives its first colour, an image the fallback.
export function solidBackground(bg, fallback = '#000') {
  if (typeof bg === 'string') {
    if (!/gradient|url\(/i.test(bg)) return bg;
    return /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/i.exec(bg.replace(/url\([^)]*\)/gi, ''))?.[0] ?? fallback;
  }
  if (bg?.color) return bg.color;
  const stop = bg?.gradient?.stops?.[0];
  if (typeof stop === 'string') return stop.replace(/\s+-?[\d.]+(%|px)?$/, '').trim() || fallback;
  return fallback;
}

// imageMeta of a still given by the path in a config: the first candidate (locale fallbacks) that exists, under the
// absolute key loadImageMeta uses. HTML mock screens and unknown files have no meta and stay unchecked.
export function stillMeta(src, { cands, abs, exists, meta }) {
  if (typeof src !== 'string') return null;
  const hit = cands(src.split('?')[0]).map((c) => abs(c.file)).find((p) => exists(p));
  return (hit && meta.get(hit)) || null;
}

// Aspect rules for a recording (or still) of clipW×clipH on a W×H canvas. Returns an ERROR/WARN message or null.
export function screenAspectError(layout, clipW, clipH, W, H) {
  if (layout === 'full-screen') {
    const off = Math.abs((clipH / clipW) / (H / W) - 1);
    if (off > 0.02) return `screen ${clipW}×${clipH} does not fit full-screen on ${W}×${H} (aspect off by ${Math.round(off * 100)}%) — use caption-band or record on the matching device`;
  } else if (layout === 'caption-band') {
    const share = Math.min(W, (0.82 * H * clipW) / clipH) / W;
    if (share < 0.8) return `caption-band: the screen is only ${Math.round(share * 100)}% of the canvas width`;
  }
  return null;
}

export function canvasClass(W, H) {
  const r = H / W;
  return r >= 1.6 ? 'tall' : r >= 1.0 ? 'tablet' : 'wide';
}

// Widest device (<= maxW %) whose top sits at `top` % and bottom at or above `bottom` % (bottom may exceed 100 to bleed).
export function fitWidth(dev, W, H, top, bottom, maxW) {
  const a = deviceAspect(dev);
  return Math.min(maxW, (((bottom - top) / 100) * H) / a / W * 100);
}
const heightPct = (dev, W, H) => (deviceAspect(dev) * (dev.w / 100) * W) / H * 100;

const T = {
  //            caption y/h/w,          title size, device top, device bottom, device maxW
  tall:   { cy: 5.5, ch: 17, cw: 88, ts: 7.4, dTop: 25.5, dBot: 104, dMax: 82 },
  tablet: { cy: 4.5, ch: 15, cw: 80, ts: 5.0, dTop: 22,   dBot: 103, dMax: 78 },
  wide:   { cy: 12,  ch: 76, cw: 44, ts: 4.6, dTop: 10,   dBot: 108, dMax: 40 },
};

export function buildLayout(slide, ctx) {
  const { W, H, theme } = ctx;
  const cls = canvasClass(W, H);
  const t = T[cls];
  const tall = cls === 'tall';
  // a styled watch target (watch-ultra@styled) defaults to the one-big-watch layout
  const onWatch = ctx.target?.family === 'watch';
  let layout = slide.layout || (onWatch ? 'watch-hero' : 'text-top');
  const deskModel = (ctx.modelFor ? ctx.modelFor(slide.screen) : ctx.target?.model) || ctx.target?.model;
  const desk = cls === 'wide' && isDesktopModel(slide.device?.model || deskModel);
  if (cls === 'wide' && !WIDE_OK.includes(layout) && !(desk && DESK_WIDE.includes(layout))) layout = 'text-left';
  const card = theme.card || {};
  const pad = { tall: 3.4, tablet: 2.4, wide: 1.4 }[cls]; // card padding, % of width

  // font sizes: layout default < theme.caption < slide.caption (auto-fit still shrinks to the box)
  const themeSizes = Object.fromEntries(['titleSize', 'subtitleSize', 'eyebrowSize']
    .filter((k) => theme.caption?.[k] != null).map((k) => [k, theme.caption[k]]));
  const caption = (o) => ({
    type: 'caption', id: 'caption', eyebrow: slide.eyebrow, title: slide.title, subtitle: slide.subtitle,
    x: 50, y: t.cy, w: t.cw, h: t.ch, align: 'center', valign: 'top', titleSize: t.ts,
    ...(slide.highlight ? { highlight: slide.highlight } : {}),
    ...o, ...themeSizes, ...(slide.caption || {}),
  });
  const device = (o, key = 'device') => {
    const d = { type: 'device', id: key, screen: slide.screen, ...(theme.device || {}), ...o, ...(slide[key] || {}) };
    if (!d.model || d.model === 'auto') d.model = ctx.modelFor ? ctx.modelFor(d.screen, d.landscape) : ctx.target?.model || 'iphone';
    // real aspect of the screenshot (windows and 'none' frames take their shape from it)
    if (d.imageAspect == null && ctx.aspectFor) d.imageAspect = ctx.aspectFor(d.screen, d.model, d.landscape);
    return d;
  };
  const withFit = (d, top, bottom, maxW) => {
    if (d.w == null) d.w = fitWidth(d, W, H, top, bottom, maxW);
    if (d.y == null) d.y = top;
    return d;
  };
  // content column for device-less layouts: below the caption (tall/tablet) or on the right (wide)
  const area = cls === 'wide'
    ? { x: 73, w: 46, y: 10, bottom: 92 }
    : { x: 50, w: tall ? 86 : 76, y: t.cy + t.ch + 3, bottom: 95 };
  const sideCaption = (o = {}) => caption(cls === 'wide' ? { x: 27, w: 44, y: 12, h: 76, align: 'left', valign: 'center', ...o } : o);

  const phoneModel = slide.phoneModel || (ctx.target?.store === 'play' ? 'android' : 'iphone');
  const watchModel = slide.watchModel || (ctx.target?.store === 'play' ? 'wear-os' : 'apple-watch');

  // ---- wide canvas with a desktop-class device (Mac / Windows store, website heroes) ----
  if (desk && ['text-top', 'hero', 'device-hero', 'tilt-left', 'tilt-right', 'text-left', 'text-right'].includes(layout)) {
    if (layout === 'text-left' || layout === 'text-right') {
      const left = layout === 'text-left';
      const d = withFit(device({ x: left ? 66 : 34 }), 12, 88, 62);
      d.y = 50 - heightPct(d, W, H) / 2;
      return [caption({ x: left ? 18 : 82, w: 30, y: 10, h: 80, align: left ? 'left' : 'right', valign: 'center', titleSize: 3.6 }), d];
    }
    const big = layout === 'device-hero';
    const tilt = layout === 'tilt-left' ? 1 : layout === 'tilt-right' ? -1 : 0;
    const top = big ? 17 : layout === 'hero' ? 27 : 22;
    const d = withFit(device({ x: 50, ...(tilt ? { tiltY: tilt * 12, tiltX: 4 } : {}) }), top, big ? 112 : 97, big ? 92 : 84);
    const cap = big ? caption({ y: 4, h: 10, w: 90, titleSize: 2.6, align: 'left', subtitle: undefined })
      : caption({ y: layout === 'hero' ? 5 : 4.5, h: layout === 'hero' ? 20 : 15, w: 84, titleSize: layout === 'hero' ? 4.4 : 3.4 });
    return [cap, d];
  }

  switch (layout) {
    case 'phone-watch': {
      const wide = cls === 'wide';
      const ph = withFit(device({ x: wide ? 64 : 40, model: phoneModel, z: 2 }), wide ? 10 : tall ? t.dTop - 1.5 : t.dTop + 1, wide ? 108 : t.dBot + 4, wide ? 22 : tall ? 70 : 44);
      const wa = device({ x: wide ? 84 : tall ? 74 : 70, model: watchModel, screen: slide.screen2 || slide.screen, z: 4, shadowOpacity: 0.4 }, 'watch');
      wa.w ??= wide ? 15 : tall ? 40 : 30;
      wa.y ??= wide ? 50 - heightPct(wa, W, H) / 2 : ph.y + heightPct(ph, W, H) * 0.62 - heightPct(wa, W, H) / 2;
      return [wide ? sideCaption() : caption(), ph, wa];
    }

    case 'watch-hero': {
      // on a watch canvas the straps would only crop at the edges, so the case alone fills it
      const wa = device({ x: 50, model: watchModel, z: 3, shadowOpacity: 0.4, ...(onWatch ? { band: false } : {}) }, 'device');
      wa.w ??= onWatch ? 70 : cls === 'wide' ? 26 : tall ? 66 : 50;
      wa.y ??= onWatch ? 17 : (cls === 'wide' ? 50 : tall ? 63 : 60) - heightPct(wa, W, H) / 2;
      if (cls === 'wide') { wa.x = 72; return [sideCaption(), wa]; }
      return [caption({ z: 6 }), wa];
    }

    case 'laptop-phone': {
      const wide = cls === 'wide';
      const lap = device({ x: wide ? 45 : 50, model: slide.laptopModel || (ctx.target?.store === 'msstore' ? 'desktop' : 'macbook'), screen: slide.screen2 || slide.screen, z: 2 }, 'device2');
      lap.w ??= wide ? 74 : tall ? 104 : 92;
      lap.y ??= wide ? 22 : t.dTop + (tall ? 8 : 6);
      const ph = device({ x: wide ? 84 : tall ? 76 : 80, model: phoneModel, z: 4, shadowOpacity: 0.4 });
      ph.w ??= wide ? 15 : tall ? 34 : 24;
      ph.y ??= lap.y + heightPct(lap, W, H) * (wide ? 0.22 : 0.45);
      return [wide ? caption({ y: 4.5, h: 15, w: 84, titleSize: 3.4 }) : caption(), lap, ph];
    }

    case 'text-top': {
      // a title alone (preview scenes) needs no subtitle band: without the lift the phone sat ~8% below it (AptusFIT)
      const lift = tall && !slide.subtitle && !slide.eyebrow ? 8 : 0;
      return [caption(lift ? { h: t.ch - lift - 0.5 } : {}), withFit(device({ x: 50 }), t.dTop - lift, t.dBot, t.dMax)];
    }

    case 'text-bottom': {
      const top = tall ? 5 : 4, capY = tall ? 79 : 81;
      return [withFit(device({ x: 50 }), top, capY - 3, t.dMax), caption({ y: capY, h: 100 - capY - 3, valign: 'center' })];
    }

    case 'hero':
      return [
        caption({ y: tall ? 9 : 6, h: tall ? 28 : 24, titleSize: t.ts * 1.35, valign: 'center' }),
        withFit(device({ x: 50 }), tall ? 40 : 34, tall ? 122 : 118, t.dMax + 6),
      ];

    case 'device-hero': {
      const d = withFit(device({ x: 50 }), tall ? 15 : 14, 160, tall ? 94 : 86);
      return [caption({ y: 4, h: tall ? 9 : 8, titleSize: t.ts * 0.72, align: 'left', w: t.cw }), d];
    }

    case 'screen-hero': {
      const d = device({ x: 50 });
      d.w = fitWidth(d, W, H, 0, (tall ? 62 : 60) / 0.7, t.dMax + 8);
      d.y = -0.3 * heightPct(d, W, H);
      const capY = d.y + heightPct(d, W, H) + 3;
      return [d, caption({ y: capY, h: 100 - capY - 3, valign: 'center', titleSize: t.ts * 1.05 })];
    }

    case 'tilt-left':
    case 'tilt-right': {
      const s = layout === 'tilt-left' ? 1 : -1;
      return [caption(), withFit(device({ x: 50 + s * 1.5, tiltY: s * 14, tiltX: 4, rotate: -s * 3 }), t.dTop + 1, t.dBot, t.dMax - 4)];
    }

    case 'corner': {
      const d = withFit(device({ x: 64, rotate: -14 }), tall ? 30 : 28, 150, tall ? 84 : 70);
      return [caption({ align: 'left', h: t.ch + 4 }), d];
    }

    case 'two-devices': {
      const back = withFit(device({ x: 33, rotate: -7, screen: slide.screen2 || slide.screen, z: 1 }, 'device2'), t.dTop + 6, t.dBot + 8, t.dMax * 0.68);
      const front = withFit(device({ x: 65, rotate: 5, z: 2 }), t.dTop + 1, t.dBot + 6, t.dMax * 0.72);
      return [caption(), back, front];
    }

    case 'three-devices': {
      const l = withFit(device({ x: 22, rotate: -9, screen: slide.screen2 || slide.screen, z: 1 }, 'device2'), t.dTop + 9, t.dBot + 14, t.dMax * 0.56);
      const r = withFit(device({ x: 78, rotate: 9, screen: slide.screen3 || slide.screen, z: 1 }, 'device3'), t.dTop + 9, t.dBot + 14, t.dMax * 0.56);
      const c = withFit(device({ x: 50, z: 3 }), t.dTop + 1, t.dBot + 8, t.dMax * 0.66);
      return [caption(), l, r, c];
    }

    case 'phone-tablet': {
      const tab = withFit(device({ x: tall ? 42 : 40, model: 'ipad', screen: slide.screen2 || slide.screen, z: 1 }, 'device2'), t.dTop + 4, t.dBot + 30, tall ? 92 : 74);
      const ph = withFit(device({ x: tall ? 78 : 76, z: 3 }), t.dTop + (tall ? 18 : 16), t.dBot + 6, tall ? 34 : 30);
      return [caption(), tab, ph];
    }

    case 'landscape': {
      const d = device({ x: cls === 'wide' ? 66 : 50, landscape: true });
      d.w = cls === 'wide' ? 60 : tall ? 94 : 88;
      d.y = cls === 'wide' ? 50 - heightPct(d, W, H) / 2 : tall ? 38 : 36;
      if (tall && slide.screen2) {
        d.y = 31;
        const d2 = device({ x: 50, landscape: true, screen: slide.screen2, w: d.w }, 'device2');
        d2.y = d.y + heightPct(d, W, H) + 4;
        return [caption({ y: 7, h: 20 }), d, d2];
      }
      const cap = cls === 'wide' ? caption({ x: 19, w: 32, y: 12, h: 76, align: 'left', valign: 'center' }) : caption({ y: tall ? 14 : 8, h: tall ? 20 : 22 });
      return [cap, d];
    }

    case 'pop-out': {
      const d = withFit(device({ x: 50 }), t.dTop, t.dBot, t.dMax - 12);
      const pops = (slide.popouts || [{ crop: [3, 14, 94, 16] }, { crop: [3, 40, 94, 14] }]).slice(0, 2);
      const els = pops.map((p, i) => ({
        type: 'zoom', id: `pop${i + 1}`, screen: p.screen || slide.screen, crop: p.crop,
        x: i % 2 ? 66 : 34, y: d.y + (i ? 42 : 16) * (tall ? 1 : 0.9), w: tall ? 62 : 52, rotate: i % 2 ? 3 : -3, z: 6, ...p,
      }));
      return [caption(), d, ...els];
    }

    case 'metric': {
      const d = withFit(device({ x: 50 }), t.dTop, t.dBot, t.dMax - 6);
      const m = slide.metric || {};
      return [caption(), d, {
        type: 'card', id: 'metric', icon: m.icon, value: m.value, title: m.label, text: m.text,
        x: 50, y: d.y + (tall ? 12 : 14), w: tall ? 72 : 52, direction: 'column', align: 'center',
        background: '#ffffff', color: '#111111', muted: 'rgba(0,0,0,.55)', border: 'none', shadow: '0 18px 50px rgba(0,0,0,.35)',
        valueSize: tall ? 14 : 10, titleSize: tall ? 3.8 : 2.8, iconSize: tall ? 8 : 6, accent: m.color || theme.accent, z: 7, ...(slide.metricCard || {}),
      }];
    }

    case 'annotated': {
      const d = withFit(device({ x: 50 }), t.dTop, t.dBot, tall ? 62 : 56);
      const sr = screenRect(d, { W, H });
      const out = [caption(), d];
      (slide.callouts || []).forEach((c, i) => {
        const px = sr.left + (c.at[0] / 100) * sr.width, py = sr.top + (c.at[1] / 100) * sr.height;
        const side = c.side || (i % 2 ? 'right' : 'left');
        out.push({
          type: 'callout', id: `callout${i + 1}`, text: c.text, to: [(px / W) * 100, (py / H) * 100],
          x: side === 'left' ? 4 : 96, anchor: side, y: (py / H) * 100 - 2.2, size: tall ? 3.4 : 2.4, z: 8, ...c,
        });
      });
      return out;
    }

    case 'before-after': {
      const labels = slide.labels || ['Before', 'After'];
      const l = withFit(device({ x: 27, screen: slide.screen, z: 2 }), t.dTop + 6, t.dBot, tall ? 46 : 40);
      const r = withFit(device({ x: 73, screen: slide.screen2 || slide.screen, z: 2 }, 'device2'), t.dTop + 6, t.dBot, tall ? 46 : 40);
      const lab = (text, x, hl) => ({ type: 'badge', id: `label-${x}`, text, x, y: t.dTop, size: tall ? 3.2 : 2.4, background: hl ? (theme.accent || '#ffffff') : 'rgba(255,255,255,.18)', color: hl ? '#111' : '#fff', z: 5 });
      return [caption(), { type: 'shape', id: 'before-shade', x: 25, y: 0, w: 50, h: 100, fill: 'rgba(0,0,0,.16)', z: 1 }, l, r, lab(labels[0], 27, false), lab(labels[1], 73, true)];
    }

    case 'frameless':
      if (cls === 'wide') return [sideCaption(), withFit(device({ x: 74, style: 'frameless', radius: 0.07 }), 8, 112, 36)];
      return [caption(), withFit(device({ x: 50, style: 'frameless', radius: 0.07 }), t.dTop, t.dBot - 6, t.dMax - 2)];

    case 'mosaic': {
      const screens = slide.screens || [slide.screen, slide.screen2, slide.screen3, slide.screen].filter(Boolean);
      const w = cls === 'wide' ? 19 : tall ? 40 : 34;
      const cols = cls === 'wide' ? [[66, 14], [87, 4]] : [[29, t.dTop + 6], [71, t.dTop - 2]];
      const out = [cls === 'wide' ? sideCaption() : caption()];
      screens.slice(0, 4).forEach((s, i) => {
        const [cx, cy] = cols[i % 2];
        const d = device({ x: cx, w, screen: s, style: 'frameless', radius: 0.08, rotate: -6, shadowOpacity: 0.25 }, `tile${i + 1}`);
        d.y = cy + Math.floor(i / 2) * (heightPct(d, W, H) + 2.5);
        out.push(d);
      });
      return out;
    }

    case 'feature-grid': {
      const f = slide.features || [];
      const cols = cls === 'wide' ? 3 : 2, gx = cls === 'wide' ? 1.6 : 4;
      const rows = Math.ceil(f.length / cols) || 1, gap = cls === 'wide' ? 3 : 2.2;
      const cellH = Math.min(cls === 'wide' ? 40 : 19, (area.bottom - area.y - gap * (rows - 1)) / rows);
      const cw = (area.w - gx * (cols - 1)) / cols;
      const sz = { tall: [8, 4.6, 3.4], tablet: [5.5, 3.2, 2.4], wide: [3.2, 1.9, 1.4] }[cls];
      return [sideCaption(), ...f.map((it, i) => ({
        type: 'card', id: `feature${i + 1}`, icon: it.icon, title: it.title, text: it.text, direction: 'column', align: 'left', padding: pad,
        x: area.x - area.w / 2 + cw / 2 + (i % cols) * (cw + gx), y: area.y + Math.floor(i / cols) * (cellH + gap), w: cw, h: cellH,
        iconSize: sz[0], titleSize: sz[1], textSize: sz[2], ...card, ...(it.card || {}),
      }))];
    }

    case 'steps': {
      const s = slide.steps || [];
      const gap = 2, rowH = Math.min(cls === 'wide' ? 26 : 15, (area.bottom - area.y - gap * (s.length - 1)) / (s.length || 1));
      return [sideCaption(), ...s.map((it, i) => ({
        type: 'card', id: `step${i + 1}`, number: i + 1, icon: it.icon, title: it.title, text: it.text, direction: 'row', align: 'left', padding: pad,
        x: area.x, y: area.y + i * (rowH + gap), w: area.w, h: rowH, titleSize: { tall: 4.4, tablet: 3.2, wide: 2 }[cls], textSize: { tall: 3.2, tablet: 2.3, wide: 1.45 }[cls],
        iconSize: { tall: 7, tablet: 5, wide: 3 }[cls], ...card, accent: theme.accent, ...(it.card || {}),
      }))];
    }

    case 'stats': {
      const s = slide.stats || [];
      const withDev = !!slide.screen && cls !== 'wide';
      const bottom = withDev ? (tall ? 58 : 60) : area.bottom;
      const rowH = Math.min(cls === 'wide' ? 40 : 16, (bottom - area.y) / (s.length || 1));
      const out = [sideCaption(), ...s.map((it, i) => ({
        type: 'card', id: `stat${i + 1}`, value: it.value, title: it.label, direction: 'column', align: 'center', padding: 0.5,
        x: area.x, y: area.y + i * rowH, w: area.w, h: rowH - 1.5, valueSize: { tall: 14, tablet: 9, wide: 7.5 }[cls], titleSize: { tall: 3.8, tablet: 2.5, wide: 1.9 }[cls],
        background: 'transparent', border: 'none', shadow: 'none', color: theme.caption?.color || '#fff', muted: theme.caption?.color || '#fff', accent: theme.accent, gradientValue: theme.highlight?.gradient, ...(it.card || {}),
      }))];
      if (withDev) out.push(withFit(device({ x: 50 }), bottom + 2, 140, t.dMax - 10));
      return out;
    }

    case 'review': {
      const r = slide.review || {};
      const wide = cls === 'wide';
      const starY = wide ? 18 : tall ? 7 : 6;
      const out = [
        { type: 'stars', id: 'stars', count: r.stars ?? 5, x: wide ? 7 : 50, anchor: wide ? 'left' : 'center', y: starY, size: wide ? 4.2 : tall ? 7 : 5, color: r.starColor || '#ffcc33', z: 5 },
        caption(wide ? { x: 27, w: 44, y: 27, h: 30, align: 'left' } : { y: starY + (tall ? 5.5 : 6), h: tall ? 13 : 12 }),
        {
          type: 'card', id: 'quote', title: r.quote, text: r.author, quote: true, direction: 'column', align: wide ? 'left' : 'center', padding: pad,
          x: wide ? 73 : 50, y: wide ? 22 : tall ? 27 : 26, w: wide ? 46 : tall ? 84 : 70, h: wide ? 56 : tall ? 16 : 16,
          titleSize: wide ? 2.4 : tall ? 4.4 : 3.2, textSize: wide ? 1.7 : tall ? 3 : 2.2, ...card, ...(slide.quoteCard || {}),
        },
      ];
      if (slide.screen && !wide) out.push(withFit(device({ x: 50 }), tall ? 46 : 46, 140, t.dMax - 4));
      return out;
    }

    case 'awards': {
      const a = slide.awards || [];
      const wide = cls === 'wide';
      const n = Math.max(1, a.length), lw = wide ? 40 / n : Math.min(44, 92 / n);
      const ly = wide ? 62 : t.cy + t.ch + 1;
      const out = [wide ? sideCaption({ y: 8, h: 50, valign: 'bottom' }) : caption()];
      a.forEach((it, i) => out.push({
        type: 'laurel', id: `award${i + 1}`, title: it.title, subtitle: it.subtitle,
        x: wide ? 7 + lw / 2 + i * lw : 50 + (i - (n - 1) / 2) * lw, y: ly, w: lw, color: it.color || theme.caption?.color || '#fff', z: 5,
      }));
      if (slide.screen) out.push(wide ? withFit(device({ x: 76 }), 10, 108, 40) : withFit(device({ x: 50 }), ly + (tall ? 15 : 13), t.dBot + 10, t.dMax - 4));
      return out;
    }

    case 'split-photo': {
      const ph = tall ? 52 : 50;
      return [
        { type: 'image', id: 'photo', src: slide.photo, x: 50, y: 0, w: 100, h: ph, fit: 'cover', z: 0 },
        { type: 'shape', id: 'photo-fade', x: 50, y: 0, w: 100, h: ph, fill: 'linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,0) 45%)', z: 1 },
        caption({ y: tall ? 5 : 4, color: '#ffffff', textShadow: '0 2px 20px rgba(0,0,0,.35)', highlight: slide.highlight || { style: 'color', color: '#ffd27a' }, ...(slide.photoCaption || {}) }),
        withFit(device({ x: 50 }), tall ? 33 : 30, t.dBot + 4, t.dMax - 8),
      ];
    }

    case 'text-left':
    case 'text-right': {
      const left = layout === 'text-left';
      // 21:9 creative header (phone model, not a desk frame): a smaller phone and a narrower caption sit side by side,
      // caption inside the 10% safe margin. Keyed to the creative family so the Play feature graphic is untouched.
      const creative = ctx.target?.family === 'creative' && cls === 'wide' && !desk;
      const header = creative && W / H >= 2;
      return [
        caption({ x: creative ? (left ? 31 : 69) : left ? 29 : 71, y: t.cy, w: creative ? 40 : t.cw, h: t.ch, align: left ? 'left' : 'right', valign: 'center' }),
        withFit(device({ x: left ? 76 : 24 }), t.dTop, t.dBot, header ? 22 : t.dMax),
      ];
    }

    case 'caption-top':
      return [caption()];

    // ---------------- signature layouts ----------------
    case 'spotlight': {
      const d = withFit(device({ x: 50, z: 3 }), t.dTop + 1, tall ? 93 : 92, t.dMax - (tall ? 4 : 10));
      const floor = d.y + heightPct(d, W, H);
      const beam = slide.beam || {};
      const c = beam.color || 'rgba(255,255,255,.34)';
      return [
        caption({ z: 6 }),
        { type: 'shape', id: 'beam', x: 50, y: -2, w: tall ? 150 : 130, h: floor + 4, z: 1, blur: 1.6, opacity: beam.opacity ?? 1,
          clip: 'polygon(41% 0,59% 0,82% 100%,18% 100%)', fill: `linear-gradient(180deg,${c},rgba(255,255,255,0) 92%)` },
        { type: 'shape', id: 'floor', shape: 'circle', x: 50, y: floor - (tall ? 3.2 : 4.5), w: tall ? 104 : 90, h: tall ? 6.5 : 9, z: 1,
          fill: `radial-gradient(closest-side,${beam.floor || 'rgba(255,255,255,.42)'},rgba(255,255,255,0))` },
        { type: 'shape', id: 'contact', shape: 'circle', x: 50, y: floor - 1.1, w: d.w * 0.9, h: tall ? 1.8 : 2.6, z: 2, blur: 0.8, fill: 'rgba(0,0,0,.55)' },
        d,
      ];
    }

    case 'big-type': {
      const word = { text: slide.word ?? slide.title, pick: slide.word ? null : 'highlight', upper: slide.upper ?? true, nowrap: true, fit: 'width', weight: 900, lineHeight: 0.9, tracking: -0.02 };
      const ts = tall ? 30 : 24, wy = tall ? 12.5 : 11.5;
      const grad = theme.highlight?.gradient || { angle: 90, stops: [theme.accent || '#fff', theme.caption?.color || '#fff'] };
      const wordH = (ts * W / 100 * 0.9) / H * 100;
      const d = withFit(device({ x: 50, z: 3 }), wy + wordH * 0.72, t.dBot + 4, t.dMax - 2);
      return [
        caption({ y: tall ? 4.5 : 3.5, h: tall ? 7.5 : 7, titleSize: t.ts * 0.6, subtitle: undefined, eyebrow: undefined, ...(slide.caption || {}) }),
        { type: 'text', id: 'word', ...word, x: 50, y: wy, w: 94, size: ts, gradient: grad, z: 2 },
        { type: 'text', id: 'echo', ...word, x: 51.6, y: wy + wordH * 0.09, w: 94, size: ts, stroke: tall ? 0.3 : 0.22, strokeColor: theme.caption?.color || '#fff', opacity: 0.55, z: 1 },
        d,
      ];
    }

    case 'ticker': {
      const tk = [].concat(slide.ticker ?? { text: slide.title, pick: 'highlight' });
      const t1 = typeof tk[0] === 'string' ? { text: tk[0] } : tk[0], t2 = tk[1] ? (typeof tk[1] === 'string' ? { text: tk[1] } : tk[1]) : t1;
      const d = withFit(device({ x: 50, z: 3 }), t.dTop + 3, t.dBot, t.dMax - (tall ? 16 : 18));
      const fs = tall ? 5.2 : 3.8;
      return [
        caption(),
        { type: 'band', id: 'band-back', ...t1, x: 50, y: tall ? 40 : 40, w: 170, rotate: -14, size: fs, z: 1, background: theme.accent || '#fff', color: slide.tickerColor || '#111', offset: 1 },
        d,
        { type: 'band', id: 'band-front', ...t2, x: 50, y: tall ? 80 : 78, w: 170, rotate: 7, size: fs, z: 5, background: slide.tickerBackground || '#111', color: '#fff', offset: 3.4 },
      ];
    }

    case 'arch': {
      const top = t.dTop + (tall ? 1 : 0);
      const aw = tall ? 84 : 70;
      const fill = slide.arch || `linear-gradient(180deg,${theme.accent || '#ffffff'}66,${theme.accent || '#ffffff'}10 75%)`;
      const d = withFit(device({ x: 50, z: 3 }), top + (tall ? 7.5 : 8), t.dBot + 6, aw - (tall ? 18 : 16));
      return [
        caption(),
        { type: 'shape', id: 'halo', x: 50, y: top - (tall ? 2.6 : 3), w: aw + 10, h: 110, radius: '9999px 9999px 0 0', fill: 'transparent', stroke: `${(W * (tall ? 0.004 : 0.003)).toFixed(1)}px solid ${slide.haloColor || 'rgba(255,255,255,.38)'}`, z: 1 },
        { type: 'shape', id: 'arch', x: 50, y: top, w: aw, h: 110, radius: '9999px 9999px 0 0', fill, z: 1, shadow: 'inset 0 2px 0 rgba(255,255,255,.35)' },
        { type: 'shape', id: 'sun', shape: 'circle', x: 50 + aw * 0.33, y: top + (tall ? 3 : 4), w: tall ? 9 : 7, z: 2, fill: `radial-gradient(circle at 35% 35%,#fff,${slide.sun || '#ffd27a'})`, shadow: `0 0 ${W * 0.06}px ${slide.sun || '#ffd27a'}` },
        d,
      ];
    }

    case 'orbit': {
      const d = withFit(device({ x: 50, z: 3 }), t.dTop + (tall ? 4 : 3), t.dBot, tall ? 58 : 46);
      const mid = d.y + heightPct(d, W, H) * 0.42;
      const ringW = tall ? 112 : 96, ringH = tall ? 15 : 20, rot = -10;
      const ring = (id, k, z, clip, op) => ({ type: 'shape', id, shape: 'circle', x: 50, y: mid - ringH * k / 2, w: ringW * k, h: ringH * k, rotate: rot, z, clip, fill: 'transparent', opacity: op,
        stroke: `${(W * 0.006).toFixed(1)}px solid ${slide.ringColor || theme.accent || '#fff'}` });
      const out = [caption(), d,
        ring('ring-back', 1, 1, 'inset(0 0 50% 0)', 0.8), ring('ring-front', 1, 5, 'inset(50% 0 0 0)', 0.95),
        ring('ring2-back', 1.22, 1, 'inset(0 0 50% 0)', 0.3), ring('ring2-front', 1.22, 5, 'inset(50% 0 0 0)', 0.35)];
      // chips sit on the ring: angles chosen at the sides so they don't hide the screen
      const angles = [200, 335, 155, 25];
      (slide.orbit || []).slice(0, 4).forEach((c, i) => {
        const a = (angles[i] * Math.PI) / 180, r = (rot * Math.PI) / 180;
        const ex = (ringW / 2) * Math.cos(a), ey = ((ringH / 2) * H / W) * Math.sin(a);   // in % of W units
        const px = 50 + ex * Math.cos(r) - ey * Math.sin(r), py = mid + ((ex * Math.sin(r) + ey * Math.cos(r)) * W) / H;
        const left = px < 50;
        out.push({ type: 'badge', id: `chip${i + 1}`, text: `${c.icon ? c.icon + ' ' : ''}${c.text}`, x: left ? Math.max(3, px - 6) : Math.min(97, px + 6), anchor: left ? 'left' : 'right',
          y: py - (tall ? 1.6 : 2.2), size: tall ? 3.6 : 2.6, z: 7, background: c.background || '#ffffff', color: c.color || '#111', shadow: '0 10px 30px rgba(0,0,0,.28)' });
      });
      return out;
    }

    case 'lens': {
      const L = slide.lens || {};
      const d = withFit(device({ x: L.deviceX ?? 44, z: 3 }), t.dTop + 2, t.dBot, t.dMax - 12);
      const sr = screenRect(d, { W, H });
      const [fx, fy] = L.at || [50, 30];
      const tx = ((sr.left + (fx / 100) * sr.width) / W) * 100, ty = ((sr.top + (fy / 100) * sr.height) / H) * 100;
      const lw = L.w ?? (tall ? 50 : 40), lh = (lw * W) / H;
      const lx = L.x ?? (tx < 50 ? 72 : 30);
      const ly = Math.max(t.cy + t.ch + 1, Math.min(78 - lh, ty - lh * (L.above === false ? 0.2 : 1.05)));
      return [
        caption(), d,
        { type: 'arrow', id: 'lens-line', from: [tx, ty], to: [lx, ly + lh / 2], head: false, curve: 0, width: 0.55, dot: 1.3, color: L.color || '#ffffff', z: 6 },
        { type: 'zoom', id: 'lens', screen: L.screen || slide.screen, circle: true, focus: [fx, fy], span: L.span ?? 34, x: lx, y: ly, w: lw, z: 7,
          border: `${(W * 0.012).toFixed(1)}px solid ${L.color || '#ffffff'}`, shadow: `0 ${W * 0.03}px ${W * 0.07}px rgba(0,0,0,.45), inset 0 0 0 ${W * 0.004}px rgba(0,0,0,.15)` },
      ];
    }

    case 'layers': {
      const d = withFit(device({ x: 42, z: 2, tiltY: 24, tiltX: 6, rotate: -2 }), t.dTop + 3, t.dBot + 4, t.dMax - 10);
      const sr = screenRect(d, { W, H });
      const crops = (slide.layers || [{ crop: [4, 14, 92, 18] }, { crop: [4, 42, 92, 16] }]).slice(0, 3);
      return [caption(), d, ...crops.map((c, i) => {
        const [cx, cy, cw] = c.crop;
        const w = (cw / 100) * (sr.width / W) * 100 * 1.08;
        return { type: 'zoom', id: `layer${i + 1}`, screen: c.screen || slide.screen, crop: c.crop, x: 42 + 16 + i * 4, y: ((sr.top + (cy / 100) * sr.height) / H) * 100 - 2 + i * 1.5,
          w, tiltY: 24, tiltX: 6, rotate: -2, z: 4 + i, radius: 2.4, border: 'none', shadow: `${-W * 0.03}px ${W * 0.035}px ${W * 0.06}px rgba(0,0,0,.45)`, ...c };
      })];
    }

    case 'notify': {
      const n = (slide.notifications || []).slice(0, 3);
      const d = withFit(device({ x: 50, z: 2 }), tall ? 38 : 36, t.dBot + 8, t.dMax - 2);
      const cw = tall ? 86 : 70, y0 = t.cy + t.ch + (tall ? 2 : 1.5), step = tall ? 8.4 : 9.5;
      return [caption(), d, ...n.map((it, i) => ({
        type: 'card', id: `notify${i + 1}`, icon: it.icon, title: it.title, text: it.text, direction: 'row', align: 'left',
        x: 50 + (i % 2 ? 3 : -3), y: y0 + i * step, w: cw - i * 3, rotate: i % 2 ? 1.6 : -1.6, padding: tall ? 2.6 : 1.8, z: 5 + i,
        iconSize: tall ? 7 : 5, titleSize: tall ? 3.5 : 2.6, textSize: tall ? 3 : 2.2,
        background: 'rgba(250,250,252,.94)', border: 'none', color: '#111', muted: 'rgba(0,0,0,.6)', shadow: '0 20px 50px rgba(0,0,0,.3)', radius: tall ? 5 : 3.5, ...(it.card || {}),
      }))];
    }

    case 'deck': {
      const base = withFit(device({ x: 44, z: 3, rotate: 7 }), t.dTop + 9, t.dBot + 10, t.dMax - 10);
      const back = (key, scr, k, dx, dy, dim) => ({ ...device({ x: 44 + dx, z: 3 - k, rotate: 7, screen: scr || slide.screen }, key), w: base.w * (1 - 0.06 * k), y: base.y - dy, dim, shadowOpacity: 0.22 });
      return [caption(), back('device3', slide.screen3, 2, tall ? 26 : 22, tall ? 8 : 9, 0.38), back('device2', slide.screen2, 1, tall ? 13 : 11, tall ? 4 : 4.5, 0.18), base];
    }

    // ---------------- real-footage layouts ----------------
    case 'full-screen': {
      const bottom = slide.caption?.position === 'bottom';
      const solid = solidBackground(slide.background ?? theme.background);
      const edge = `color-mix(in srgb, ${solid} 70%, transparent)`;
      const scrim = { type: 'shape', id: 'scrim', x: 50, y: bottom ? 78 : 0, w: 100, h: 22, z: 3,
        fill: { angle: bottom ? 0 : 180, stops: [edge, 'transparent'] } };
      // the status bar stays visible: a top caption starts at 6%, a bottom one ends at 96%
      const cap = caption(bottom ? { y: 80, h: 16, valign: 'bottom', z: 5 } : { y: 6, h: 15, z: 5 });
      return [device({ model: 'none', style: 'frameless', radius: 0, shadow: false, x: 50, y: 0, w: 100, screenAspect: H / W, fit: 'cover' }), scrim, cap];
    }

    case 'caption-band': {
      const bottom = slide.caption?.position === 'bottom';
      const bandY = bottom ? 82 : 0, top = bottom ? 0 : 18;
      const band = { type: 'shape', id: 'band', x: 50, y: bandY, w: 100, h: 18, z: 3, fill: solidBackground(slide.background ?? theme.background) };
      const d = withFit(device({ model: 'none', style: 'frameless', radius: 0, shadow: false, x: 50 }), top, top + 82, 100);
      d.y = top + Math.max(0, (82 - heightPct(d, W, H)) / 2);
      return [band, caption({ y: bandY, h: 18, valign: 'center', z: 5 }), d];
    }

    case 'end-card': {
      const icon = slide.appIcon;
      const color = theme.caption?.color;
      const els = [];
      if (icon) els.push({ type: 'image', id: 'appIcon', src: icon, x: 50, y: 30, w: 22, h: (22 * W) / H, radius: 5 });
      els.push({ type: 'text', id: 'appName', text: slide.appName, x: 50, y: icon ? 46 : 36, w: 88, size: 7, weight: 800, ...(color ? { color } : {}) });
      els.push(caption({ y: icon ? 55 : 45, h: 12, eyebrow: undefined, subtitle: undefined, titleSize: 4.4 }));
      if (slide.subtitle) els.push({ type: 'text', id: 'subtitle', text: slide.subtitle, x: 50, y: icon ? 72 : 62, w: 80, size: 3, opacity: 0.8, ...(color ? { color } : {}) });
      return els;
    }

    case 'caption-only':
      return [caption({ y: 10, h: 80, valign: 'center', titleSize: t.ts * 1.5 })];

    case 'blank':
      return [];

    default:
      throw new Error(`Unknown layout "${layout}" on slide "${slide.id}". Known: ${LAYOUTS.join(', ')}`);
  }
}
