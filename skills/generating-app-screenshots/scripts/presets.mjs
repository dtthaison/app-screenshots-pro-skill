// Curated theme presets: background + caption colors + highlight + card style + device color that work together.
// Use as theme.preset (whole set) or slide.preset (one slide). Anything set explicitly wins over the preset.

const dark = { color: '#ffffff', subtitleOpacity: 0.78 };
const glass = { background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)', color: '#ffffff', muted: 'rgba(255,255,255,.72)' };
const paper = (c) => ({ background: '#ffffff', border: 'none', shadow: '0 10px 30px rgba(20,20,40,.10)', color: c, muted: 'rgba(0,0,0,.55)' });

export const PRESETS = {
  aurora: {
    background: { color: '#0b0a1f', mesh: [
      { color: '#6d5dfc', x: 12, y: 8, size: 60 }, { color: '#22d3ee', x: 95, y: 38, size: 48, opacity: 0.55 },
      { color: '#f472b6', x: 20, y: 98, size: 52, opacity: 0.5 }], noise: 0.06 },
    caption: dark, highlight: { style: 'gradient', gradient: { angle: 90, stops: ['#a5f3fc', '#c4b5fd'] } },
    card: glass, accent: '#a5f3fc', device: { color: 'black-titanium' },
  },
  midnight: {
    background: { gradient: { type: 'radial', at: '50% 0%', stops: ['#1e293b', '#020617 75%'] }, noise: 0.05 },
    caption: dark, highlight: { style: 'gradient', gradient: { angle: 90, stops: ['#60a5fa', '#c084fc'] } },
    card: glass, accent: '#60a5fa', device: { color: 'space-black' },
  },
  sunset: {
    background: { gradient: { angle: 165, stops: ['#ff7e5f', '#feb47b'] }, mesh: [{ color: '#ff5f8f', x: 90, y: 10, size: 45, opacity: 0.55 }], noise: 0.05 },
    caption: { color: '#ffffff', subtitleOpacity: 0.9, textShadow: '0 2px 18px rgba(120,30,0,.18)' }, highlight: { style: 'color', color: '#3b0a45' },
    card: { background: 'rgba(255,255,255,.22)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', muted: 'rgba(255,255,255,.85)' },
    accent: '#3b0a45', device: { color: 'white-titanium' },
  },
  ocean: {
    background: { gradient: { angle: 180, stops: ['#0b3a66', '#0f6a99 60%', '#14a3b8'] }, mesh: [{ color: '#7dd3fc', x: 80, y: 0, size: 40, opacity: 0.45 }], noise: 0.05 },
    caption: dark, highlight: { style: 'color', color: '#7ff0ff' }, card: glass, accent: '#7ff0ff', device: { color: 'deep-blue' },
  },
  forest: {
    background: { gradient: { angle: 170, stops: ['#14524c', '#062e2a'] }, mesh: [{ color: '#2dd4bf', x: 10, y: 0, size: 45, opacity: 0.35 }], noise: 0.06 },
    caption: dark, highlight: { style: 'color', color: '#fcd34d' }, card: glass, accent: '#fcd34d', device: { color: 'natural-titanium' },
  },
  mint: {
    background: { gradient: { angle: 160, stops: ['#ecfccb', '#bbf7d0 50%', '#a5f3fc'] }, noise: 0.04 },
    caption: { color: '#0b2e2a', subtitleOpacity: 0.75 }, highlight: { style: 'marker', color: '#fde047' },
    card: paper('#0b2e2a'), accent: '#047857', device: { color: 'black-titanium' },
  },
  paper: {
    background: { color: '#f6f1ea', noise: 0.07 },
    caption: { color: '#1c1917', subtitleOpacity: 0.7 }, highlight: { style: 'marker', color: '#ffd166' },
    card: paper('#1c1917'), accent: '#e76f51', device: { color: 'natural-titanium' },
  },
  candy: {
    background: { gradient: { angle: 135, stops: ['#ffafbd', '#e0b3ff 55%', '#a6c1ff'] }, noise: 0.04 },
    caption: { color: '#2a1140', subtitleOpacity: 0.75 }, highlight: { style: 'color', color: '#7c3aed' },
    card: paper('#2a1140'), accent: '#7c3aed', device: { color: 'white-titanium' },
  },
  citrus: {
    background: { gradient: { angle: 160, stops: ['#fde68a', '#fdba74 60%', '#fb923c'] }, noise: 0.04 },
    caption: { color: '#3b1d00', subtitleOpacity: 0.75 }, highlight: { style: 'color', color: '#c2410c' },
    card: paper('#3b1d00'), accent: '#c2410c', device: { color: 'space-black' },
  },
  lilac: {
    background: { gradient: { angle: 180, stops: ['#f5f3ff', '#ddd6fe'] }, mesh: [{ color: '#c4b5fd', x: 85, y: 85, size: 50, opacity: 0.8 }] },
    caption: { color: '#2e1065', subtitleOpacity: 0.72 }, highlight: { style: 'color', color: '#7c3aed' },
    card: paper('#2e1065'), accent: '#7c3aed', device: { color: 'lavender' },
  },
  coral: {
    background: { color: '#ff6b6b', pattern: { type: 'dots', color: 'rgba(255,255,255,.16)' } },
    caption: dark, highlight: { style: 'marker', color: 'rgba(255,230,109,.9)' },
    card: { background: '#ffffff', border: 'none', shadow: '0 12px 30px rgba(120,0,0,.18)', color: '#3a0d0d', muted: 'rgba(0,0,0,.55)' },
    accent: '#ffe66d', device: { color: 'white-titanium' },
  },
  mono: {
    background: { color: '#0e0e10', noise: 0.05 },
    caption: dark, highlight: { style: 'underline', color: '#ffffff' }, card: glass, accent: '#ffffff', device: { color: 'black-titanium' },
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
