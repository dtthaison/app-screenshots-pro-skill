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
// ('frame'), or, when nothing reacts in the window ('window'): typing its end, a tap or swipe at most 0.5 s after its
// start (Maestro acts first, then waits for the screen to settle, which a ticking timer stretches to 10 s and more).
export function alignCommands(commands, diffs, fps, { slack = 0.5, shiftRange = [-3, 1] } = {}) {
  const sync = findSync(diffs);
  if (sync == null) throw new Error('no full-screen change found for the sync step — does the first step open a different screen?');
  // Anchor on the sync command's END: its start-to-screen-change latency varies with app launch time (spike: about 30
  // frames of jitter between takes), while the change sits at a roughly fixed distance before the command returns
  // (about 4 frames of jitter).
  const baseMs = commands[0].startMs + commands[0].durMs - (sync * 1000) / fps;
  // Adjacent windows can overlap, so a search starts after the sync frame and after the previous
  // command's reaction: neither can be claimed twice.
  const place = (offsetMs) => {
    let last = sync, hits = 0;
    const events = commands.map((c, i) => {
      if (i === 0) return { ...c, t: sync / fps, align: 'frame' };
      const from = (c.startMs - offsetMs) / 1000, end = (c.startMs + c.durMs - offsetMs) / 1000;
      const r = reactionFrame(diffs, Math.max(Math.round(from * fps), last + 1), Math.round((end + slack) * fps));
      if (r == null) return { ...c, t: c.kind === 'type' ? end : Math.min(end, from + 0.5), align: 'window' };
      last = r; hits++;
      return { ...c, t: (r - 1) / fps, align: 'frame' };
    });
    return { offsetMs, events, hits };
  };
  // A React Native app can change the screen well before openLink returns (AptusFIT coach: 1.2 s), which puts every
  // window early. Fit one global shift, in frame steps, that aligns the most commands; nearest to 0 wins a tie. It must
  // align 2 more than the anchor, so one stray change cannot move the clock.
  const anchor = place(baseMs);
  let best = { ...anchor, hits: anchor.hits + 1 }, shiftMs = 0;
  for (let k = 1; k <= Math.round(Math.max(-shiftRange[0], shiftRange[1]) * fps); k++)
    for (const s of [-k, k]) {
      const ms = (s * 1000) / fps;
      if (ms < shiftRange[0] * 1000 || ms > shiftRange[1] * 1000) continue;
      const p = place(baseMs + ms);
      if (p.hits > best.hits) { best = p; shiftMs = ms; }
    }
  return shiftMs ? { offsetMs: best.offsetMs, shiftMs, events: best.events } : { offsetMs: baseMs, shiftMs, events: anchor.events };
}
