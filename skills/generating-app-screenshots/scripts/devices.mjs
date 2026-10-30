// CSS-drawn device frames. All geometry is relative to the body width (1.0) so a frame
// renders crisply at any export size. No bitmap frame assets are needed.

export const MODELS = {
  // screen: screen height / screen width. bezel: side bezel. top/bottom: vertical bezel (default = bezel).
  // rim: visible metal/plastic edge (part of bezel). radius / screenRadius: corner radii as a fraction of body width.
  // viewport: CSS px an HTML mock screen is rendered at (@3x). pad: extra visible parts around the body
  // (watch straps, laptop base, monitor stand) as fractions of body width. kind groups models for layouts.
  'iphone':         { kind: 'phone', screen: 2868 / 1320, viewport: [440, 956], bezel: 0.042, rim: 0.014, radius: 0.170, screenRadius: 0.132, cutout: 'island', buttons: 'iphone' },
  'iphone-notch':   { kind: 'phone', screen: 2532 / 1170, viewport: [390, 844], bezel: 0.045, rim: 0.014, radius: 0.165, screenRadius: 0.125, cutout: 'notch', buttons: 'iphone' },
  'iphone-home':    { kind: 'phone', screen: 2208 / 1242, viewport: [414, 736], bezel: 0.055, rim: 0.012, top: 0.20, bottom: 0.20, radius: 0.150, screenRadius: 0.0, cutout: 'none', home: true, buttons: 'iphone' },
  'ipad':           { kind: 'tablet', screen: 2752 / 2064, viewport: [1032, 1376], bezel: 0.036, rim: 0.008, radius: 0.062, screenRadius: 0.034, cutout: 'camera-bezel', buttons: 'ipad' },
  'android':        { kind: 'phone', screen: 2400 / 1080, viewport: [412, 915], bezel: 0.032, rim: 0.012, radius: 0.115, screenRadius: 0.092, cutout: 'punch', buttons: 'android' },
  'android-flat':   { kind: 'phone', screen: 2400 / 1080, viewport: [412, 915], bezel: 0.036, rim: 0.016, radius: 0.085, screenRadius: 0.06, cutout: 'punch', buttons: 'android' },
  'android-tablet': { kind: 'tablet', screen: 2560 / 1600, viewport: [800, 1280], bezel: 0.036, rim: 0.008, radius: 0.050, screenRadius: 0.030, cutout: 'camera-bezel', buttons: 'android' },
  'apple-watch':    { kind: 'watch', screen: 514 / 422, viewport: [211, 257], bezel: 0.075, rim: 0.03, radius: 0.30, screenRadius: 0.215, cutout: 'none', buttons: 'watch', pad: { t: 0.62, b: 0.62 }, strap: 0.78 },
  'wear-os':        { kind: 'watch', screen: 1, viewport: [227, 227], bezel: 0.1, rim: 0.035, radius: 0.5, screenRadius: 0.4, cutout: 'none', buttons: 'wear', pad: { t: 0.55, b: 0.55 }, strap: 0.5, round: true },
  'macbook':        { kind: 'laptop', screen: 1800 / 2880, viewport: [1440, 900], bezel: 0.021, rim: 0.004, top: 0.03, bottom: 0.036, radius: 0.03, screenRadius: 0.012, cutout: 'mac-notch', pad: { l: 0.08, r: 0.08, b: 0.034 } },
  'desktop':        { kind: 'desktop', screen: 1080 / 1920, viewport: [1600, 900], bezel: 0.018, rim: 0.004, radius: 0.018, screenRadius: 0.004, cutout: 'none', pad: { b: 0.2 } },
  'mac-window':     { kind: 'window', screen: null, viewport: [1280, 800], bezel: 0, rim: 0, top: 0.03, bottom: 0, radius: 0.014, screenRadius: 0.014, cutout: 'none', chrome: 'mac' },
  'windows-window': { kind: 'window', screen: null, viewport: [1280, 800], bezel: 0, rim: 0, top: 0.026, bottom: 0, radius: 0.007, screenRadius: 0.007, cutout: 'none', chrome: 'windows' },
  'browser':        { kind: 'window', screen: null, viewport: [1280, 800], bezel: 0, rim: 0, top: 0.046, bottom: 0, radius: 0.012, screenRadius: 0.012, cutout: 'none', chrome: 'browser' },
  'none':           { kind: 'none', screen: null, bezel: 0, rim: 0, radius: 0.06, screenRadius: 0.06, cutout: 'none' },
};
export const kindOf = (model) => (MODELS[model] || MODELS.iphone).kind;
export const isDesktopModel = (model) => ['laptop', 'desktop', 'window'].includes(kindOf(model));

export const COLORS = {
  // Apple-ish finishes
  'black-titanium': '#3a3a3c', 'natural-titanium': '#bdb6aa', 'white-titanium': '#ecebe7',
  'desert-titanium': '#c9ad90', 'deep-blue': '#34425f', 'cosmic-orange': '#e5722f', 'silver': '#dfe0e3',
  'space-black': '#232325', 'midnight': '#2a3240', 'starlight': '#f0e9dd', 'sky-blue': '#bcd3ea',
  'pink': '#f3c9d3', 'teal': '#a9d6d3', 'ultramarine': '#7183e3', 'lavender': '#d9cdf0', 'sage': '#c9d5c0',
  // Pixel-ish finishes
  'jet-black': '#151517', 'rose-gold': '#e8c2b4', 'gold': '#d8c39a', 'graphite': '#4a4a4e', 'space-gray': '#7d7e83', 'aluminum': '#d6d7da',
  'obsidian': '#26272a', 'porcelain': '#ece6dc', 'hazel': '#8c8b7b', 'bay': '#a9c1de', 'mint': '#cfe8d9',
  // Clay defaults
  'clay-white': '#f3f3f6', 'clay-black': '#2a2a2e',
};
export const color = (c, fallback) => COLORS[c] || c || fallback;

export const shade = (hex, amt) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + amt) + (amt > 0 ? 255 * amt * 0.25 : 0))));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
};

// Visible height / visible width, for layout math.
export function deviceAspect(el) {
  const g = geometry(el, 1000);
  return el.landscape ? g.visW / g.visH : g.visH / g.visW;
}

// pads (straps, laptop base, stand) as fractions of body width; none when frameless or band: false
function pads(el) {
  const m = MODELS[el.model] || MODELS.iphone;
  if (el.style === 'frameless' || el.model === 'none' || !m.pad || el.landscape) return { t: 0, r: 0, b: 0, l: 0 };
  const strap = m.kind === 'watch' && el.band === false;
  return { t: strap ? 0 : m.pad.t || 0, b: strap ? 0 : m.pad.b || 0, l: m.pad.l || 0, r: m.pad.r || 0 };
}
// el.w is the VISIBLE width (incl. laptop base); the body is narrower
const bodyWidth = (el, visW) => { const p = pads(el); return visW / (1 + p.l + p.r); };

function geometry(el, W) {
  const m = MODELS[el.model] || MODELS.iphone;
  const frameless = el.style === 'frameless' || el.model === 'none';
  const bezel = frameless ? 0 : m.bezel * W;
  const top = frameless ? 0 : (m.top ?? m.bezel) * W;
  const bottom = frameless ? 0 : (m.bottom ?? m.bezel) * W;
  const screenW = W - 2 * bezel;
  const vpAspect = m.viewport ? m.viewport[1] / m.viewport[0] : null;
  const aspect = el.screenAspect || (el.model === 'none' ? el.imageAspect : m.screen) || el.imageAspect || vpAspect || 2.1667;
  const screenH = screenW * aspect;
  const p = pads(el), bodyH = screenH + top + bottom;
  const pad = { t: p.t * W, b: p.b * W, l: p.l * W, r: p.r * W };
  return { m, frameless, bezel, top, bottom, screenW, screenH, bodyW: W, bodyH, pad, visW: W + pad.l + pad.r, visH: bodyH + pad.t + pad.b };
}

const px = (n) => `${Math.round(n * 100) / 100}px`;

// Canvas-space rectangle of the screen of an UNROTATED portrait device (for callouts / annotations).
export function screenRect(el, ctx) {
  const g = geometry(el, bodyWidth(el, (el.w / 100) * ctx.W));
  const left = (el.x / 100) * ctx.W - g.visW / 2 + g.pad.l + g.bezel;
  const top = (el.y / 100) * ctx.H + g.pad.t + g.top;
  return { left, top, width: g.screenW, height: g.screenH };
}

// el: normalized device element. ctx: { W, H } canvas px.
export function renderDevice(el, ctx) {
  const portraitW = el.landscape ? (el.w / 100) * ctx.W / (geometry(el, 1000).bodyH / 1000) : bodyWidth(el, (el.w / 100) * ctx.W);
  const g = geometry(el, portraitW);
  const kind = g.m.kind;
  const style = g.frameless ? 'frameless' : kind === 'window' ? 'window' : el.style || 'real';
  const defFrame = kind === 'laptop' || kind === 'desktop' ? COLORS['space-gray'] : COLORS['black-titanium'];
  const frame = color(el.color, style === 'clay' ? COLORS['clay-white'] : defFrame);
  const visW = el.landscape ? g.bodyH : g.visW;
  const visH = el.landscape ? g.bodyW : g.visH;
  const left = (el.x / 100) * ctx.W - visW / 2;
  const top = (el.y / 100) * ctx.H;
  const B = g.bodyW;

  // --- body layers ---
  const R = g.m.radius * B;
  const SR = g.frameless ? (el.radius ?? g.m.screenRadius) * B : g.m.screenRadius * B;
  let body = '';
  if (style === 'real') {
    const rim = (g.m.rim || 0.012) * B;
    const hi = shade(frame, 0.35), lo = shade(frame, -0.35), mid = shade(frame, 0.12);
    body = `
      <div style="position:absolute;inset:0;border-radius:${px(R)};background:
        linear-gradient(90deg,${lo} 0%,${hi} 1.2%,${frame} 3%,${mid} 50%,${frame} 97%,${hi} 98.8%,${lo} 100%);
        box-shadow:inset 0 0 0 ${px(Math.max(1, B * 0.0015))} ${shade(frame, -0.5)},inset 0 ${px(B * 0.003)} ${px(B * 0.004)} rgba(255,255,255,.35)"></div>
      <div style="position:absolute;inset:0;border-radius:${px(R)};background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0) 6%,rgba(0,0,0,0) 94%,rgba(0,0,0,.22))"></div>
      <div style="position:absolute;inset:${px(rim)};border-radius:${px(R - rim)};background:#050505;box-shadow:inset 0 0 0 ${px(B * 0.002)} #1c1c1e"></div>`;
  } else if (style === 'window') {
    body = windowChrome(g, el, B, R);
  } else if (style === 'clay') {
    body = `<div style="position:absolute;inset:0;border-radius:${px(R)};background:linear-gradient(145deg,${shade(frame, 0.12)},${frame} 45%,${shade(frame, -0.1)});
      box-shadow:inset ${px(B * 0.006)} ${px(B * 0.008)} ${px(B * 0.014)} rgba(255,255,255,.55),inset ${px(-B * 0.006)} ${px(-B * 0.01)} ${px(B * 0.02)} rgba(0,0,0,.14)"></div>`;
  } else if (style === 'outline') {
    body = `<div style="position:absolute;inset:0;border-radius:${px(R)};border:${px(B * 0.008)} solid ${frame}"></div>`;
  }

  // --- side buttons (real + clay only) ---
  let buttons = '';
  if ((style === 'real' || style === 'clay') && g.m.buttons && el.buttons !== false) {
    const bw = B * 0.011;
    const btn = (side, y, h, k = 1, ridges = false) =>
      `<div style="position:absolute;${side}:${px(-bw * k * 0.75)};top:${px(y * g.bodyH)};width:${px(bw * k)};height:${px(h * g.bodyH)};border-radius:${px(bw * k * 0.45)};background:${ridges ? `repeating-linear-gradient(180deg,${shade(frame, -0.25)} 0 ${px(bw * 0.35)},${shade(frame, 0.25)} ${px(bw * 0.35)} ${px(bw * 0.7)}),` : ''}linear-gradient(${side === 'left' ? 90 : 270}deg,${shade(frame, -0.3)},${shade(frame, 0.2)} 60%,${shade(frame, -0.1)})"></div>`;
    if (g.m.buttons === 'watch') buttons = btn('right', 0.2, 0.2, 3.4, true) + btn('right', 0.55, 0.22, 1.8);
    else if (g.m.buttons === 'wear') buttons = btn('right', 0.4, 0.2, 3.6, true) + btn('right', 0.2, 0.1, 2) + btn('right', 0.7, 0.1, 2);
    else if (g.m.buttons === 'iphone') buttons = btn('left', 0.155, 0.032) + btn('left', 0.215, 0.06) + btn('left', 0.29, 0.06) + btn('right', 0.24, 0.095) + btn('right', 0.55, 0.05);
    else if (g.m.buttons === 'android') buttons = btn('right', 0.2, 0.06) + btn('right', 0.3, 0.12);
    else if (g.m.buttons === 'ipad') buttons = btn('right', 0.05, 0.045) + btn('right', 0.11, 0.045);
  }

  // --- screen ---
  const content = el.src
    ? el.landscape
      ? `<img class="scr" src="${el.src}" style="position:absolute;left:50%;top:50%;width:${px(g.screenH)};height:${px(g.screenW)};object-fit:${el.fit || 'cover'};object-position:top;transform:translate(-50%,-50%) rotate(90deg)">`
      : `<img class="scr" src="${el.src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${el.fit || 'cover'};object-position:top">`
    : `<div style="position:absolute;inset:0;background:${el.screenColor || '#111'}"></div>`;
  let cutout = '';
  if (!g.frameless && el.cutout !== false) {
    const cw = g.screenW;
    if (g.m.cutout === 'island')
      cutout = `<div style="position:absolute;left:50%;top:${px(cw * 0.026)};width:${px(cw * 0.29)};height:${px(cw * 0.085)};transform:translateX(-50%);border-radius:${px(cw)};background:#000"><div style="position:absolute;right:${px(cw * 0.03)};top:50%;width:${px(cw * 0.03)};height:${px(cw * 0.03)};transform:translateY(-50%);border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3550,#05070c 70%)"></div></div>`;
    else if (g.m.cutout === 'notch') {
      // iPhone X–14 notch: a tab hanging from the top edge with curved shoulders
      const nw = cw * 0.42, nh = cw * 0.082, r = nh * 0.55, sh = nh * 0.4;
      cutout = `<div style="position:absolute;left:50%;top:0;width:${px(nw)};height:${px(nh)};transform:translateX(-50%);background:#000;border-radius:0 0 ${px(r)} ${px(r)}">
        <div style="position:absolute;left:${px(-sh)};top:0;width:${px(sh)};height:${px(sh)};background:radial-gradient(circle at 0 100%,transparent ${px(sh * 0.98)},#000 ${px(sh)})"></div>
        <div style="position:absolute;right:${px(-sh)};top:0;width:${px(sh)};height:${px(sh)};background:radial-gradient(circle at 100% 100%,transparent ${px(sh * 0.98)},#000 ${px(sh)})"></div>
        <div style="position:absolute;left:62%;top:38%;width:${px(nh * 0.32)};height:${px(nh * 0.32)};border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3550,#05070c 70%)"></div>
        <div style="position:absolute;left:36%;top:22%;width:${px(nw * 0.18)};height:${px(nh * 0.1)};border-radius:9px;background:#151518"></div></div>`;
    } else if (g.m.cutout === 'mac-notch') {
      const nw = cw * 0.1, nh = cw * 0.02;
      cutout = `<div style="position:absolute;left:50%;top:0;width:${px(nw)};height:${px(nh)};transform:translateX(-50%);background:#000;border-radius:0 0 ${px(nh * 0.4)} ${px(nh * 0.4)}"><div style="position:absolute;left:50%;top:45%;width:${px(nh * 0.35)};height:${px(nh * 0.35)};transform:translate(-50%,-50%);border-radius:50%;background:#1c2233"></div></div>`;
    }
    else if (g.m.cutout === 'punch')
      cutout = `<div style="position:absolute;left:50%;top:${px(cw * 0.03)};width:${px(cw * 0.042)};height:${px(cw * 0.042)};transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3550,#000 70%)"></div>`;
  }
  const glare = el.glare
    ? `<div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.04) 30%,rgba(255,255,255,0) 31%)"></div>`
    : '';
  const screen = `<div style="position:absolute;left:${px(g.bezel)};top:${px(g.top)};width:${px(g.screenW)};height:${px(g.screenH)};border-radius:${style === 'window' ? `0 0 ${px(SR)} ${px(SR)}` : px(SR)};overflow:hidden;background:#000;${g.frameless ? '' : 'box-shadow:0 0 0 1px rgba(0,0,0,.6)'}">${content}${cutout}${glare}</div>`;

  let bezelDot = '';
  if (!g.frameless && g.m.cutout === 'camera-bezel' && style !== 'outline')
    bezelDot = `<div style="position:absolute;left:50%;top:${px(g.top / 2)};width:${px(B * 0.012)};height:${px(B * 0.012)};transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 35%,#2a3550,#05070c 70%)"></div>`;
  if (!g.frameless && g.m.home && style !== 'outline')
    bezelDot += `<div style="position:absolute;left:50%;bottom:${px(g.bottom / 2)};width:${px(B * 0.14)};height:${px(B * 0.14)};transform:translate(-50%,50%);border-radius:50%;border:${px(B * 0.006)} solid ${shade(frame, -0.25)}"></div>`;

  // --- shadow + 3D ---
  const op = el.shadowOpacity ?? 0.3;
  const shadowCss = el.shadow === false ? 'none'
    : typeof el.shadow === 'string' ? el.shadow
    : `0 ${px(visH * 0.008)} ${px(visH * 0.016)} rgba(0,0,0,${op * 0.6}),0 ${px(visH * 0.035)} ${px(visH * 0.07)} rgba(0,0,0,${op})`;
  const tiltX = el.tiltX || 0, tiltY = el.tiltY || 0;
  let edge = '';
  if ((tiltX || tiltY) && style !== 'frameless' && style !== 'outline' && style !== 'window') {
    // fake device thickness by stacking offset copies of the body edge
    const steps = Math.max(2, Math.round(B * 0.018));
    const dx = -Math.sign(tiltY), dy = Math.sign(tiltX);
    edge = Array.from({ length: steps }, (_, i) => `${dx * (i + 1)}px ${dy * (i + 1)}px 0 ${shade(frame, -0.3 - (i / steps) * 0.2)}`).join(',');
  }
  const transform = [
    tiltX || tiltY ? `perspective(${px(visH * (el.perspective || 2.4))})` : '',
    tiltY ? `rotateY(${tiltY}deg)` : '',
    tiltX ? `rotateX(${tiltX}deg)` : '',
    el.rotate ? `rotate(${el.rotate}deg)` : '',
  ].join(' ');

  const cx = el.landscape ? visW / 2 : g.pad.l + g.bodyW / 2, cy = el.landscape ? visH / 2 : g.pad.t + g.bodyH / 2;
  const decor = style === 'frameless' ? { back: '', front: '' } : extras(g, el, frame, style);
  const inner = `${decor.back}<div style="position:absolute;left:${px(cx)};top:${px(cy)};width:${px(g.bodyW)};height:${px(g.bodyH)};transform:translate(-50%,-50%)${el.landscape ? ' rotate(-90deg)' : ''};border-radius:${px(g.frameless ? SR : R)};box-shadow:${[edge, shadowCss].filter((s) => s && s !== 'none').join(',') || 'none'}">${buttons}${body}${bezelDot}${screen}</div>${decor.front}`;
  return `<div class="el device" data-el="${String(el.id || 'device').replace(/[&<>"]/g, '')}" style="position:absolute;left:${px(left)};top:${px(top)};width:${px(visW)};height:${px(visH)};transform:${transform.trim() || 'none'};z-index:${el.z ?? 2};opacity:${el.opacity ?? 1}${el.dim ? `;filter:brightness(${1 - el.dim})` : ''}">${inner}</div>`;
}

// window title bars: macOS (traffic lights), Windows 11 (caption buttons), browser (address bar)
function windowChrome(g, el, B, R) {
  const dark = (el.chrome || 'light') === 'dark';
  const T = g.top, fs = T * 0.42;
  const bar = dark ? '#2b2b2e' : g.m.chrome === 'windows' ? '#f3f3f3' : '#ececec';
  const ink = dark ? 'rgba(255,255,255,.82)' : 'rgba(0,0,0,.78)';
  const font = g.m.chrome === 'windows' ? "'Segoe UI Variable','Segoe UI',system-ui,sans-serif" : "-apple-system,'SF Pro Text',system-ui,sans-serif";
  const title = el.title ? String(el.title).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]) : '';
  const lights = ['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<div style="position:absolute;left:${px(T * 0.62 + i * T * 0.68)};top:50%;width:${px(T * 0.42)};height:${px(T * 0.42)};transform:translateY(-50%);border-radius:50%;background:${c};box-shadow:inset 0 0 0 ${px(T * 0.02)} rgba(0,0,0,.15)"></div>`).join('');
  let content = '';
  if (g.m.chrome === 'mac') content = `${lights}<div style="position:absolute;inset:0;display:grid;place-items:center;font:600 ${px(fs)}/1 ${font};color:${ink}">${title}</div>`;
  else if (g.m.chrome === 'windows') {
    const bw = T * 1.75, ic = T * 0.3, sw = Math.max(1, T * 0.03);
    const glyph = (i) => `<svg style="position:absolute;right:${px((2 - i) * bw)};top:0;width:${px(bw)};height:${px(T)}" viewBox="0 0 ${bw} ${T}"><g transform="translate(${bw / 2 - ic / 2},${T / 2 - ic / 2})" stroke="${ink}" stroke-width="${sw}" fill="none">${
      i === 0 ? `<line x1="0" y1="${ic / 2}" x2="${ic}" y2="${ic / 2}"/>` : i === 1 ? `<rect x="0" y="0" width="${ic}" height="${ic}" rx="${ic * 0.12}"/>` : `<line x1="0" y1="0" x2="${ic}" y2="${ic}"/><line x1="${ic}" y1="0" x2="0" y2="${ic}"/>`}</g></svg>`;
    content = `<div style="position:absolute;left:${px(T * 0.45)};top:0;height:100%;display:flex;align-items:center;gap:${px(T * 0.3)};font:400 ${px(fs * 0.95)}/1 ${font};color:${ink}">${el.icon ? `<span style="font-size:${px(fs * 1.1)}">${el.icon}</span>` : ''}${title}</div>${glyph(0)}${glyph(1)}${glyph(2)}`;
  } else {
    const url = String(el.url || title || 'example.com').replace(/[&<>"]/g, '');
    content = `${lights}<div style="position:absolute;left:22%;right:22%;top:50%;height:${px(T * 0.58)};transform:translateY(-50%);border-radius:${px(T)};background:${dark ? '#1c1c1e' : '#ffffff'};box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;gap:${px(T * 0.15)};font:500 ${px(fs * 0.8)}/1 ${font};color:${ink}"><span style="opacity:.6">🔒</span>${url}</div>`;
  }
  return `<div style="position:absolute;inset:0;border-radius:${px(R)};background:${bar};box-shadow:inset 0 0 0 1px ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)'}"></div>
    <div style="position:absolute;left:0;top:0;right:0;height:${px(T)};border-bottom:1px solid ${dark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.1)'}">${content}</div>`;
}

// parts outside the body: watch straps (behind), laptop base (in front), monitor stand (behind)
function extras(g, el, frame, style) {
  const B = g.bodyW, P = g.pad, k = g.m.kind;
  let back = '', front = '';
  if (k === 'watch' && (P.t || P.b)) {
    const band = color(el.band, shade(frame, -0.15));
    const sw = B * g.m.strap;
    // sport band: crisp edges, darker toward the far end (curving away), a seam where it meets the case
    const strap = (top) => {
      const h = (top ? P.t : P.b) + g.bodyH * 0.2, dir = top ? '0deg' : '180deg';
      const holes = !top ? Array.from({ length: 4 }, (_, i) => `<div style="position:absolute;left:50%;top:${px(g.bodyH * 0.2 + P.b * (0.22 + i * 0.16))};width:${px(sw * 0.07)};height:${px(sw * 0.07)};transform:translateX(-50%);border-radius:50%;background:${shade(band, -0.45)};box-shadow:inset 0 ${px(sw * 0.01)} ${px(sw * 0.015)} rgba(0,0,0,.4)"></div>`).join('') : '';
      return `<div style="position:absolute;left:${px(g.pad.l + (B - sw) / 2)};${top ? 'top:0' : 'bottom:0'};width:${px(sw)};height:${px(h)};
        border-radius:${top ? `${px(sw * 0.16)} ${px(sw * 0.16)} 0 0` : `0 0 ${px(sw * 0.16)} ${px(sw * 0.16)}`};overflow:hidden;
        background:linear-gradient(${dir},rgba(0,0,0,0) 45%,rgba(0,0,0,.38)),linear-gradient(90deg,${shade(band, -0.3)},${band} 7%,${band} 93%,${shade(band, -0.3)});
        -webkit-mask-image:linear-gradient(${dir},#000 82%,transparent);mask-image:linear-gradient(${dir},#000 82%,transparent)">
        <div style="position:absolute;left:0;right:0;${top ? 'bottom' : 'top'}:${px(g.bodyH * 0.2)};height:${px(sw * 0.035)};background:rgba(0,0,0,.35)"></div>${holes}</div>`;
    };
    back = strap(true) + strap(false);
  } else if (k === 'laptop' && P.b) {
    const baseH = P.b, alu = style === 'clay' ? frame : shade(frame, 0.25);
    front = `<div style="position:absolute;left:0;bottom:0;width:100%;height:${px(baseH)};border-radius:${px(baseH * 0.25)} ${px(baseH * 0.25)} ${px(baseH)} ${px(baseH)} / ${px(baseH * 0.25)} ${px(baseH * 0.25)} ${px(baseH * 0.9)} ${px(baseH * 0.9)};
        background:linear-gradient(180deg,${shade(alu, 0.3)} 0%,${alu} 22%,${shade(alu, -0.18)} 70%,${shade(alu, -0.45)} 100%);box-shadow:0 ${px(baseH * 0.5)} ${px(baseH)} rgba(0,0,0,.25)">
      <div style="position:absolute;left:50%;top:0;width:${px(B * 0.16)};height:${px(baseH * 0.32)};transform:translateX(-50%);border-radius:0 0 ${px(baseH * 0.4)} ${px(baseH * 0.4)};background:${shade(alu, -0.22)}"></div></div>`;
  } else if (k === 'desktop' && P.b) {
    const alu = shade(frame, 0.2), neckW = B * 0.15, footW = B * 0.34, footH = P.b * 0.08;
    back = `<div style="position:absolute;left:50%;top:${px(g.bodyH - B * 0.01)};width:${px(neckW)};height:${px(P.b - footH + B * 0.01)};transform:translateX(-50%);background:linear-gradient(90deg,${shade(alu, -0.25)},${alu} 30%,${shade(alu, 0.15)} 60%,${shade(alu, -0.2)})"></div>
      <div style="position:absolute;left:50%;bottom:0;width:${px(footW)};height:${px(footH)};transform:translateX(-50%);border-radius:${px(footH * 0.5)};background:linear-gradient(180deg,${shade(alu, 0.25)},${shade(alu, -0.3)});box-shadow:0 ${px(footH)} ${px(footH * 2)} rgba(0,0,0,.3)"></div>`;
  }
  return { back, front };
}
