// Shared chrome for the demo mock screens: status bar, tab bar, ring helper. ?locale= and ?state= are read here.
const Q = new URLSearchParams(location.search);
window.STATE = Q.get('state') || 'after';
document.body.insertAdjacentHTML('afterbegin', `<div class="status"><span>9:41</span><span class="r">
 <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg>
 <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2C14 1.7 11.4.6 8.5.6S3 1.7 1.1 3.6l1.2 1.2C3.9 3.2 6.1 2.3 8.5 2.3zm0 3.4c1.5 0 2.8.6 3.8 1.5l1.2-1.2c-1.3-1.2-3.1-2-5-2s-3.7.8-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5zm0 3.4c.6 0 1.1.2 1.5.6L8.5 11.2 7 9.7c.4-.4.9-.6 1.5-.6z" fill="#fff"/></svg>
 <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="#fff" stroke-opacity=".4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#fff"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="#fff" fill-opacity=".5"/></svg></span></div>`);
const tab = document.body.dataset.tab;
if (tab) {
  const icons = {
    Today: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="currentColor"/>',
    Stats: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    Reminders: '<path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2.5 15a2.5 2.5 0 0 0 5 0" fill="currentColor"/>',
    Profile: '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="currentColor"/>',
  };
  document.body.insertAdjacentHTML('beforeend', `<nav class="tabbar">${Object.entries(icons).map(([k, p]) => `<div class="tab ${k === tab ? 'on' : ''}"><svg viewBox="0 0 24 24">${p}</svg>${k}</div>`).join('')}</nav><div class="home-ind"></div>`);
} else document.body.insertAdjacentHTML('beforeend', '<div class="home-ind"></div>');
window.ring = (pct, size, stroke, colors) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, id = 'g' + Math.random().toString(36).slice(2);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="#232637" stroke-width="${stroke}" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="url(#${id})" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};
document.querySelectorAll('[data-ring]').forEach((el) => { const [p, s, w] = el.dataset.ring.split(',').map(Number); el.insertAdjacentHTML('afterbegin', ring(p, s, w, ['#8b5cf6', '#ec4899'])); });
