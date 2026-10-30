// Finds, in a screen recording, the video time of each Maestro command: frame
// differences -> sync frame (offset between Maestro's clock and the video) -> per-tap
// reaction frame. Pure apart from frameDiffs, which reads the extracted frames.
import sharp from 'sharp';

// Spike (iPhone 17 Pro sim, iOS 27, Settings app, 30 fps, 128 px wide grayscale): noise on a still screen is <= 0.7.
// Opening Settings from the home screen is a ~15-frame transition whose per-frame diff starts at 12 (peak 30, rarely
// above), so the old 30 found the sync 6 frames (0.2 s) late; 8 catches its first frame and stays 10x above the noise.
// A tap (push to General) jumps from <0.3 to 16 in one frame and decays over ~12, so 3 finds its first frame.
export const SYNC_MAD = 8;    // mean abs diff (0-255) that counts as a full-screen change
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
  // Adjacent windows can overlap, so a search starts after the sync frame and after the previous
  // command's reaction: neither can be claimed twice.
  let last = sync;
  const events = commands.map((c, i) => {
    if (i === 0) return { ...c, t: sync / fps, align: 'frame' };
    const from = (c.startMs - offsetMs) / 1000, end = (c.startMs + c.durMs - offsetMs) / 1000;
    const r = reactionFrame(diffs, Math.max(Math.round(from * fps), last + 1), Math.round((end + slack) * fps));
    if (r == null) return { ...c, t: end, align: 'window' };
    last = r;
    return { ...c, t: (r - 1) / fps, align: 'frame' };
  });
  return { offsetMs, events };
}
