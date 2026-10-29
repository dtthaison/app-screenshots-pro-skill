// Panorama patterns: ready-made arrangements of devices across a connected set.
// x values are global: 0..N*100 (% of ONE slide width). Slide i (0-based) spans i*100..(i+1)*100.
// Store reality: the App Store / Play show each screenshot as a separate rounded card with a gap, and most
// people only see slide 1 (often only in search results). So patterns keep slide 1 self-contained, and the
// "risk" column says how much of a device a seam cuts through.

export const PATTERN_INFO = {
  flow:            { risk: 'none',   text: 'One centered device per slide; only the background connects. Safest; every card stands alone.' },
  peek:            { risk: 'low',    text: 'Each device sits off-center so its edge peeks into the next card — a teaser that invites the swipe.' },
  cascade:         { risk: 'low',    text: 'Devices step down slide by slide and lean into the next card, like a staircase.' },
  zigzag:          { risk: 'low',    text: 'Devices alternate high/low and left/right, hugging the seams in a wave rhythm.' },
  bridge:          { risk: 'medium', text: 'Slide 1 has its own device; later devices straddle every other seam (2|3, 4|5…).' },
  crossing:        { risk: 'medium', text: 'Pairs of crossed phones over seams 2|3 and 4|5; slide 1 stands alone.' },
  'landscape-lay': { risk: 'medium', text: 'Landscape phones lie across seams 2|3 and 4|5; slide 1 has an upright device.' },
  giant:           { risk: 'high',   text: 'One oversized tilted device spans slides 2–3 as a hero; other slides get centered devices.' },
  scatter:         { risk: 'medium', text: 'Many small tilted phones float across the whole set like a collage wall.' },
  // ---- signature patterns: the connection is drawn by light, type and lines, so devices never get cut ----
  'wave-ride':     { risk: 'none',   text: 'A glowing wave runs through the set and every phone rides it, rising and tilting with the curve.' },
  timeline:        { risk: 'none',   text: 'A dashed journey line with numbered stops (1, 2, 3…) links the slides; each phone hangs from its stop.' },
  'giant-word':    { risk: 'none',   text: 'One giant outlined word (app name or word) runs behind all the phones across the whole set.' },
  constellation:   { risk: 'none',   text: 'Phones float at different heights, joined by dotted star-map lines across the seams. Pair with a stars scene.' },
  stage:           { risk: 'none',   text: 'One continuous stage floor with a spotlight on each phone — a product line-up. Best on dark themes.' },
  ticker:          { risk: 'none',   text: 'Two marquee bands of repeated words run through the whole set, behind and in front of the phones.' },
};
export const PATTERNS = Object.keys(PATTERN_INFO);

// screens: one screen per slide (index-aligned). cls: 'tall' | 'tablet'.
export function patternElements(name, { n, screens, cls, opts = {}, theme = {}, app }) {
  const tall = cls !== 'tablet';
  const w0 = opts.w ?? (tall ? 70 : 54);           // standard device width (% of one slide)
  const top = opts.y ?? (tall ? 27 : 25);           // device top under the caption band
  const scr = (i) => screens[((i % n) + n) % n];
  const dev = (o) => ({ type: 'device', z: 3, ...o });
  const out = [];
  const acc = opts.color || theme.accent || '#ffffff', ink = theme.caption?.color || '#ffffff';
  const devH = (w) => w * (tall ? 2.07 * 0.46 : 1.38 * 0.75);   // device height in % of canvas height (approx.)
  const line = (o) => ({ type: 'arrow', head: false, curve: 0, width: 0.45, color: ink, z: 1, ...o });
  switch (name) {
    case 'flow':
      for (let i = 0; i < n; i++) out.push(dev({ x: i * 100 + 50, y: top, w: w0, screen: scr(i) }));
      break;
    case 'peek':
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      for (let i = 1; i < n; i++) out.push(dev({ x: i * 100 + 50, y: top + 2, w: w0 * 0.92, screen: scr(i) }));
      // teaser: last device of each card nudged right so its edge crosses into the next card
      for (let i = 0; i < n - 1; i++) out[i].x = i * 100 + 50 + (tall ? 17 : 21), out[i].rotate = 5;
      break;
    case 'cascade':
      for (let i = 0; i < n; i++) out.push(dev({ x: i * 100 + (i < n - 1 ? 64 : 52), y: top + i * (tall ? 3.2 : 3), w: w0 * 0.95, rotate: -7, screen: scr(i) }));
      break;
    case 'zigzag':
      for (let i = 0; i < n; i++) {
        const up = i % 2 === 0;
        out.push(dev({ x: i * 100 + (up ? 62 : 38), y: up ? top : top + 9, w: w0 * 0.92, rotate: up ? 8 : -8, screen: scr(i) }));
      }
      break;
    case 'bridge':
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      for (let s = 2; s < n; s += 2) out.push(dev({ x: s * 100, y: top + ((s / 2) % 2 ? 6 : 12), w: w0 * 0.95, rotate: (s / 2) % 2 ? 10 : -10, screen: scr(s - 1) }));
      if (n % 2 === 0) out.push(dev({ x: (n - 1) * 100 + 55, y: top + 4, w: w0 * 0.9, screen: scr(n - 1) }));
      break;
    case 'crossing':
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      for (let s = 2; s < n; s += 2) {
        out.push(dev({ x: s * 100 - 26, y: top + 2, w: w0 * 0.8, rotate: -9, screen: scr(s - 1), z: 3 }));
        out.push(dev({ x: s * 100 + 22, y: top + 11, w: w0 * 0.8, rotate: 8, screen: scr(s), z: 4 }));
      }
      if (n % 2 === 0) out.push(dev({ x: (n - 1) * 100 + 55, y: top + 4, w: w0 * 0.9, screen: scr(n - 1) }));
      break;
    case 'landscape-lay':
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      for (let s = 2; s < n; s += 2) out.push(dev({ x: s * 100, y: top + (tall ? 14 : 12), w: tall ? 118 : 100, landscape: true, rotate: s % 4 ? 6 : -6, screen: opts.landscapeScreen || scr(s - 1) }));
      if (n % 2 === 0) out.push(dev({ x: (n - 1) * 100 + 55, y: top + 4, w: w0 * 0.9, screen: scr(n - 1) }));
      break;
    case 'giant':
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      if (n > 2) out.push(dev({ x: 200, y: top - 4, w: tall ? 150 : 118, rotate: -12, screen: scr(1), z: 3 }));
      for (let i = 3; i < n; i++) out.push(dev({ x: i * 100 + 50, y: top, w: w0, screen: scr(i) }));
      break;
    case 'scatter': {
      const spots = [[20, 30, -12], [62, 40, 8], [38, 62, -4], [82, 70, 14]];
      out.push(dev({ x: 50, y: top, w: w0, screen: scr(0) }));
      for (let i = 1; i < n; i++)
        spots.forEach(([x, y, r], k) => out.push(dev({ x: i * 100 + x, y: y - (tall ? 4 : 6), w: w0 * 0.46, rotate: r, screen: scr(i + k), z: 3 + k })));
      break;
    }
    case 'wave-ride': {
      const y0 = opts.waveY ?? (tall ? 60 : 58), period = opts.period ?? 200, amp = tall ? 6 : 7, ph = 0;
      const wave = (x) => ((x + 10) / period) * 2 * Math.PI + ph;
      out.push({ type: 'ribbon', from: -10, to: n * 100 + 10, y: y0, amp, period, width: tall ? 11 : 7, colors: [acc, ink, acc], opacity: 0.55, z: 1 });
      out.push({ type: 'ribbon', from: -10, to: n * 100 + 10, y: y0 + 4, amp: amp * 0.8, period, phase: 0.7, width: tall ? 1.2 : 0.8, colors: [ink, acc, ink], opacity: 0.7, z: 1 });
      for (let i = 0; i < n; i++) {
        const x = i * 100 + 50, a = wave(x);
        out.push(dev({ x, y: top + 3 + amp * 0.75 * Math.sin(a), w: w0 * 0.88, rotate: +(Math.cos(a) * 7).toFixed(1), screen: scr(i) }));
      }
      break;
    }
    case 'timeline': {
      const ly = top + (tall ? 1.6 : 2);
      out.push(line({ from: [50, ly], to: [n * 100 + 5, ly], dash: [1.6, 1.3], width: 0.5, opacity: 0.6 }));
      for (let i = 0; i < n; i++) {
        out.push({ type: 'badge', text: String(opts.labels?.[i] ?? i + 1), x: i * 100 + 50, y: ly - (tall ? 1.75 : 2.3), size: tall ? 3.8 : 2.8, background: acc, color: opts.labelColor || '#111', z: 6, shadow: `0 0 0 ${tall ? 10 : 12}px ${acc}33` });
        out.push(dev({ x: i * 100 + 50, y: ly + (tall ? 4.5 : 5), w: w0 * 0.92, screen: scr(i) }));
      }
      break;
    }
    case 'giant-word': {
      const word = String(opts.word || app || 'YOUR APP').toUpperCase();
      const size = Math.min(tall ? 120 : 80, (n * 100 * 0.96) / ([...word].length * 0.7 + 0.2));
      const hPct = (size * 0.9) * (tall ? 0.46 : 0.75);
      const y = (opts.wordY ?? (tall ? 85 : 84)) - hPct / 2;   // low: phones overlap only the top of the letters
      const t = { type: 'text', text: word, x: n * 50, w: n * 100, size, fit: 'width', upper: true, nowrap: true, weight: 900, lineHeight: 0.9, tracking: -0.02 };
      out.push({ ...t, y, gradient: { angle: 90, stops: [acc, ink, acc] }, opacity: 0.5, z: 1 });
      out.push({ ...t, x: n * 50 + 0.8, y: y + 0.5, stroke: tall ? 0.35 : 0.25, strokeColor: ink, opacity: 0.7, z: 1 });
      for (let i = 0; i < n; i++) out.push(dev({ x: i * 100 + 50, y: top, w: w0 * 0.8, screen: scr(i), z: 3 }));
      break;
    }
    case 'constellation': {
      const dy = [0, 9, 3, 11, 5, 8], rot = [-4, 5, -3, 6, -5, 4];
      const w = w0 * 0.8, h = devH(w);
      const pos = Array.from({ length: n }, (_, i) => ({ x: i * 100 + 50, y: top + 1 + dy[i % 6] }));
      pos.forEach((p, i) => {
        if (i < n - 1) {
          const q = pos[i + 1];
          out.push(line({ from: [p.x + w * 0.48, p.y + h * (i % 2 ? 0.62 : 0.3)], to: [q.x - w * 0.48, q.y + h * (i % 2 ? 0.3 : 0.62)], curve: i % 2 ? -0.18 : 0.18, dash: [0.5, 1.4], width: 0.55, dot: 1.4, dotColor: acc, opacity: 0.85 }));
        }
        out.push(dev({ x: p.x, y: p.y, w, rotate: rot[i % 6], screen: scr(i) }));
      });
      break;
    }
    case 'stage': {
      const w = w0 * 0.86, y = top + 1, floor = y + devH(w);
      out.push({ type: 'shape', x: n * 50, y: floor - 2, w: n * 100 + 4, h: 104 - floor, z: 0, fill: `linear-gradient(180deg,${ink}30,${ink}0d 30%,rgba(0,0,0,0))` });
      out.push({ type: 'shape', x: n * 50, y: floor - 2, w: n * 100 + 4, h: 0.15, z: 0, fill: `linear-gradient(90deg,transparent,${ink}88 10%,${ink}88 90%,transparent)` });
      for (let i = 0; i < n; i++) {
        const x = i * 100 + 50;
        out.push({ type: 'shape', x, y: -2, w: tall ? 140 : 120, h: floor + 2, z: 1, blur: 1.6, clip: 'polygon(42% 0,58% 0,84% 100%,16% 100%)', fill: `linear-gradient(180deg,${opts.beam || 'rgba(255,255,255,.32)'},rgba(255,255,255,0) 92%)` });
        out.push({ type: 'shape', shape: 'circle', x, y: floor - (tall ? 4.2 : 5.5), w: tall ? 100 : 86, h: tall ? 7 : 9, z: 1, fill: `radial-gradient(closest-side,${ink}66,rgba(255,255,255,0))` });
        out.push({ type: 'shape', shape: 'circle', x, y: floor - 1.1, w: w * 0.9, h: tall ? 1.8 : 2.6, z: 2, blur: 0.8, fill: 'rgba(0,0,0,.55)' });
        out.push(dev({ x, y, w, screen: scr(i) }));
      }
      break;
    }
    case 'ticker': {
      const tk = [].concat(opts.ticker || app || 'Your app');
      out.push({ type: 'band', text: tk[0], x: n * 50, y: tall ? 46 : 44, w: n * 100 + 30, rotate: -2.2, size: tall ? 5.4 : 4, background: acc, color: opts.tickerColor || '#111', z: 1 });
      out.push({ type: 'band', text: tk[1] ?? tk[0], x: n * 50, y: tall ? 84 : 82, w: n * 100 + 30, rotate: 1.6, size: tall ? 5.4 : 4, background: '#111', color: '#fff', offset: 4, z: 5 });
      for (let i = 0; i < n; i++) out.push(dev({ x: i * 100 + 50, y: top + 3, w: w0 * 0.8, screen: scr(i) }));
      break;
    }
    default:
      throw new Error(`Unknown panorama pattern "${name}". Known: ${PATTERNS.join(', ')}`);
  }
  return out;
}

// ---------- procedural scene backgrounds that run across the whole set ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// scene: { type: ridge|waves|dunes|aurora|stars, colors: [...back → front], height: % of canvas, seed }
export function sceneSvg(scene, W, H) {
  const r = rng(scene.seed ?? 7);
  const type = scene.type || 'ridge';
  const cols = scene.colors || { ridge: ['#4c3b8f', '#2e2366', '#1a143f'], waves: ['#38bdf8', '#0284c7', '#075985'], dunes: ['#f6c48f', '#e8a06a', '#c87a4a'], aurora: ['#34d399', '#22d3ee', '#a78bfa'], stars: ['#ffffff'] }[type];
  const hPct = (scene.height ?? (type === 'aurora' ? 60 : 34)) / 100;
  let body = '';
  if (type === 'ridge' || type === 'dunes' || type === 'waves') {
    cols.forEach((c, li) => {
      const base = H * (1 - hPct + (li / cols.length) * hPct * 0.55);
      const step = type === 'ridge' ? W / (30 + li * 12) : W / (8 + li * 3);
      let d = `M0 ${H} L0 ${base}`;
      let prev = [0, base];
      for (let x = step; x <= W + step; x += step) {
        const amp = H * hPct * (type === 'ridge' ? 0.28 : 0.12) * (1 - li * 0.18);
        const y = base - (type === 'ridge' ? r() * amp : Math.sin((x / W) * Math.PI * (4 + li * 2) + li) * amp * 0.6 + amp * 0.3);
        d += type === 'ridge' ? ` L${x.toFixed(1)} ${y.toFixed(1)}` : ` Q${(prev[0] + step / 2).toFixed(1)} ${(prev[1] + (y - prev[1]) * 0.5 - amp * 0.25).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
        prev = [x, y];
      }
      d += ` L${W} ${H} Z`;
      body += `<path d="${d}" fill="${c}" opacity="${scene.opacity ?? 1}"/>`;
    });
  } else if (type === 'aurora') {
    const bands = scene.bands ?? 7;
    for (let i = 0; i < bands; i++) {
      const cx = (i + 0.5) * (W / bands) + (r() - 0.5) * W * 0.05, cy = H * (0.12 + r() * hPct * 0.6);
      body += `<ellipse cx="${cx}" cy="${cy}" rx="${W / bands * 0.9}" ry="${H * 0.05}" fill="${cols[i % cols.length]}" opacity="${0.35 + r() * 0.3}" transform="rotate(${-18 + r() * 36} ${cx} ${cy})" filter="url(#blur)"/>`;
    }
  }
  if (type === 'stars' || scene.stars) {
    const count = scene.count ?? Math.round(W / 9);
    for (let i = 0; i < count; i++) body += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H * (scene.starsTo ?? 0.6)).toFixed(1)}" r="${(0.6 + r() * 1.8) * (W / 6000) * 4}" fill="#fff" opacity="${0.25 + r() * 0.7}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${H * 0.03}"/></filter></defs>${body}</svg>`;
}
