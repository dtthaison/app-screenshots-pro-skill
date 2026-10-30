// Finds, in a screen recording, the video time of each Maestro command: frame
// differences -> sync frame (offset between Maestro's clock and the video) -> per-tap
// reaction frame. Pure apart from frameDiffs, which reads the extracted frames.
import sharp from 'sharp';

export const SYNC_MAD = 30;   // mean abs diff (0-255) that counts as a full-screen change
export const REACT_MAD = 3;   // ... that counts as a tap reaction

// Mean absolute difference of consecutive grayscale frames; d[0] = 0.
export async function frameDiffs(files, { width = 128 } = {}) {
  const d = new Float64Array(files.length);
  let prev = null;
  for (let i = 0; i < files.length; i++) {
    const { data } = await sharp(files[i]).resize({ width }).grayscale().raw().toBuffer({ resolveWithObject: true });
    if (prev) {
      let sum = 0;
      for (let p = 0; p < data.length; p++) sum += Math.abs(data[p] - prev[p]);
      d[i] = sum / data.length;
    }
    prev = data;
  }
  return d;
}

export function findSync(diffs, { full = SYNC_MAD } = {}) {
  const i = diffs.findIndex((v, k) => k > 0 && v >= full);
  return i < 0 ? null : i;
}

// First frame in [from, to] whose diff reaches the threshold.
export function reactionFrame(diffs, from, to, { threshold = REACT_MAD } = {}) {
  for (let i = Math.max(1, from); i <= Math.min(to, diffs.length - 1); i++) if (diffs[i] >= threshold) return i;
  return null;
}

// commands[0] is the sync command. Others get t = the frame before their reaction
// ('frame'), or the end of the command when nothing reacts in its window ('window').
export function alignCommands(commands, diffs, fps, { slack = 0.5 } = {}) {
  const sync = findSync(diffs);
  if (sync == null) throw new Error('no full-screen change found for the sync step — does the first step open a different screen?');
  const offsetMs = commands[0].startMs - (sync * 1000) / fps;
  const events = commands.map((c, i) => {
    if (i === 0) return { ...c, t: sync / fps, align: 'frame' };
    const from = (c.startMs - offsetMs) / 1000, end = (c.startMs + c.durMs - offsetMs) / 1000;
    const r = reactionFrame(diffs, Math.round(from * fps), Math.round((end + slack) * fps));
    return r == null ? { ...c, t: end, align: 'window' } : { ...c, t: (r - 1) / fps, align: 'frame' };
  });
  return { offsetMs, events };
}
