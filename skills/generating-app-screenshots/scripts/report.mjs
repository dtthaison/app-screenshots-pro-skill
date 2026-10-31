// Hand-over report for one preview: what was made, what was cut, the warnings and notes, what a human must still do.
import { timeCode } from './video.mjs';

const secs = (n) => `${Number(n).toFixed(1)}s`;

// results: [{ tag, file, length, posterTime, warnings: count, beats?: [{ id, start, end }] }]  (one per target x locale)
// ramps: [{ scene, saved, from?, to? }] (speed "auto" scenes only; from/to: the recording span, seconds); moments: network moment ids to accept; drafts: draft scene ids
export function handover({ preview, concept, results = [], ramps = [], warnings = [], notes = [], locales = [], beats, moments = [], drafts = [] }) {
  const out = [`# ${preview.id}`, ''];
  if (concept) out.push(`Concept: ${concept}`, '');
  const bs = beats ?? results[0]?.beats ?? [];
  for (const b of bs) out.push(`- ${b.id}: ${secs(b.start)} - ${secs(b.end)}`);
  if (bs.length) out.push('');

  out.push('## Files', '', '| File | Length | preview_frame_time_code | Checks |', '| --- | --- | --- | --- |');
  for (const r of results) out.push(`| ${r.file} | ${secs(r.length)} | ${timeCode(r.posterTime, r.fps)} | ${r.warnings ? `${r.warnings} WARN` : 'clean'} |`);

  out.push('', '## Cut', '');
  const cut = ramps.map((r) => ({ ...r, saved: Number(r.saved.toFixed(1)) })).filter((r) => r.saved > 0);   // total adds up the printed values
  if (cut.length) {
    // the span shows what the clip trimmed, e.g. a network wait left out between two scenes
    for (const r of cut) out.push(`- ${r.scene}: ${r.from != null ? `recording ${secs(r.from)} - ${secs(r.to)}, ` : ''}${secs(r.saved)} saved by the speed ramp`);
    out.push(`- total: ${secs(cut.reduce((a, r) => a + r.saved, 0))} saved`);
  } else out.push('Nothing was ramped or cut.');

  out.push('', '## Warnings and notes', '');
  if (warnings.length || notes.length) {
    for (const w of warnings) out.push(`- WARN ${w}`);
    for (const n of notes) out.push(`- NOTE ${n}`);
  } else out.push('None.');

  out.push('', '## Still to do', '');
  if (locales.length > 1) out.push(`- [ ] native-speaker review of captions (${locales.length} locales)`);
  for (const m of moments) out.push(`- [ ] accept the take for ${m} (network moment)`);
  if (drafts.length) out.push('- [ ] replace draft scenes with recordings');
  out.push('- [ ] upload with fastlane deliver or by hand in App Store Connect', '');
  return out.join('\n');
}

// the WARN / NOTE lines of one preview: "[target/locale/id]" or "[target/locale/id/scene]"
export const forPreview = (lines, id) => lines.filter((l) => {
  const m = /^\[([^\]]*)\]/.exec(l);
  const p = m && m[1].split('/');
  return !!p && p.length >= 3 && p[2] === id;
});

// network moments to accept: the ones the preview's scenes name, else every network moment of the brief; no brief -> none
export function networkMoments(brief, named = []) {
  const net = (Array.isArray(brief?.moments) ? brief.moments : []).filter((m) => m?.automatable === 'network').map((m) => m.id);
  const hit = net.filter((id) => named.includes(id));
  return named.length ? hit : net;
}
