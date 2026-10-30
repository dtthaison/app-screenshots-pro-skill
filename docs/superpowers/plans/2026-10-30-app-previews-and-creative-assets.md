# App Previews and Creative Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `screenshots.config.json` also renders App Store app previews (video) and the product page header, search results and In-App Event assets (image and video), validated against Apple's specs and laid out for `fastlane deliver`.

**Architecture:** A new pure module `scripts/video.mjs` owns timeline math (`buildTimeline`, `stateAt`), ffmpeg discovery/extraction/encoding, and the QA filmstrip; it has no knowledge of slides. `scripts/render.mjs` keeps building scene DOM with its existing slide code, wraps it in animatable layers, computes the per-frame state in Node, applies it in the page with `window.__apply(state)`, screenshots the frame and pipes it to ffmpeg. Static creative assets are plain new entries in `scripts/targets.mjs`.

**Tech Stack:** Node ≥ 18.17 ES modules, `playwright-core` (headless Chrome), `sharp`, `ffmpeg-static` (optional dependency; `FFMPEG_PATH` or `ffmpeg` on PATH override it), `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-30-app-previews-and-creative-assets-design.md`

All paths below are relative to `skills/generating-app-screenshots/` unless they start with `docs/` or `.claude-plugin/` (repo root). Commits are made from the repo root.

## Global Constraints

- Node `>=18.17`; dependencies stay `playwright-core`, `sharp`; `ffmpeg-static ^5.3.0` is an **optionalDependency** only.
- Video encode: H.264 High profile, level 4.0, progressive, `yuv420p`, **30 fps**, `-b:v 11M -maxrate 12M -bufsize 24M`, `.mp4` with `+faststart`; audio **always** present: stereo AAC 256 kbps 48 kHz, `anullsrc` when no music.
- App preview duration 15–30 s; header and search videos 5–30 s; In-App Event videos 15–30 s; at most **3** previews per Apple video target × locale; file ≤ **500 MB**.
- Accepted resolutions are the ones in the spec's target tables (copied from Apple's live pages on 2026-10-30); the live page wins on a discrepancy and the CHANGELOG notes it.
- Deterministic frames: no CSS animations, no `requestAnimationFrame`, no playing `<video>`; every animated value is a function of `t` computed in Node.
- Video renders at `supersample: 1` by default; screenshots keep 2.
- Fixed transition lengths: crossfade 0.5 s, push 0.6 s, cut 0, fade-through 0.6 s (0.3 + 0.3). Entrance `rise`: device 0.6 s with a 6% rise, caption 0.5 s starting 0.1 s later, labels fade 0.3 s. Loop fades: 0.4 s in on scene 1, 0.6 s out on the last scene.
- Default scene duration 4 s; default still motion `drift` (scale 1 → 1.03); `scroll` falls back to `drift` when the image overflow is under 2%.
- Creative image targets: family `creative`, `max: 1`, `maxMB: 500`, no alpha; `app-header-16-9` and `search-asset-16-9` are PNG only. Safe-area warning when a caption or badge leaves the central 80% of width or height.
- fastlane: previews to `out/fastlane/app-previews/<asc-locale>/NN_<IDENT>_<id>.mp4`; creative assets to `out/fastlane/creative/<asc-locale>/`; poster time is reported as `preview_frame_time_code` `HH:MM:SS:CC`.
- The existing CLI, config, outputs and warnings for screenshots do not change behavior.

## Review Focus

1. A scene whose `duration` is shorter than the transition into the next scene (e.g. 0.4 s with crossfade 0.5 s) must be a config error naming the scene, never negative start times or a frame count of zero. → test in Task 3.
2. A clip shorter than its scene must hold its last frame and warn once; it must not throw on a missing frame file or show a black screen. → test in Task 5.
3. A locale with no recording and no `clipLocale` warns **once per preview × locale**, not once per frame or per scene. → test in Task 5.
4. A poster time inside a transition or entrance (e.g. `poster: 0.2`) must produce a warning, and `poster: "<scene id>"` must resolve to that scene's rest time. → test in Task 3.
5. `--format jpeg` with `app-header-16-9` in `targets` must be an ERROR before any rendering starts, and a jpeg with `app-header` is fine. → test in Task 1.

---

### Task 1: Video and creative targets in `targets.mjs`, with unit tests

**Files:**
- Modify: `scripts/targets.mjs` (TARGETS table, `resolveTarget`)
- Create: `test/targets.test.mjs`
- Modify: `package.json` (`scripts.test`, `scripts["test:unit"]`)

**Interfaces:**
- Produces: `TARGETS[id]` entries with `video: { minSec, maxSec, fps: 30, maxMB: 500 }` and `asc: 'IPHONE_67' | 'IPHONE_55' | 'IPHONE_47' | 'IPAD_PRO_3GEN_129' | 'IPAD_97' | 'DESKTOP'` on Apple preview targets; `family: 'creative'`, `maxMB: 500`, `formats: ['png']` where PNG only.
- Produces: `export const isVideoTarget = (t) => !!t.video` and `export function checkTargetFormat(t, format) → string | null` (error message or null).

- [ ] **Step 1: Write the failing tests**

```js
// test/targets.test.mjs  (node:test + node:assert/strict)
test('preview-iphone is 886x1920, 30 fps, 15–30 s, asc IPHONE_67', () => {
  const t = resolveTarget('preview-iphone');
  assert.deepEqual([t.w, t.h, t.video.fps, t.video.minSec, t.video.maxSec, t.asc, t.store, t.max], [886, 1920, 30, 15, 30, 'IPHONE_67', 'ios', 3]);
});
test('header-video is 3840x1646, 5–30 s, family creative', ...)   // minSec 5
test('event-details-video is 2160x3840, 15–30 s', ...)
test('preview-ipad@landscape swaps to 1600x1200', ...)
test('story-video has no store limits', () => assert.equal(resolveTarget('story-video').video.maxSec, Infinity))
test('creative image targets', () => { for (const [id, w, h] of [['app-header',3840,1646],['app-header-16-9',5244,2950],['search-asset',3840,2560],['search-asset-16-9',5244,2950],['event-card',3840,2160],['event-details',2160,3840]]) { const t = resolveTarget(id); assert.deepEqual([t.w,t.h,t.family,t.max,t.maxMB],[w,h,'creative',1,500]); } })
test('png-only creative targets reject jpeg', () => {
  assert.match(checkTargetFormat(resolveTarget('app-header-16-9'), 'jpeg'), /png/i);
  assert.equal(checkTargetFormat(resolveTarget('app-header'), 'jpeg'), null);
});
test('isVideoTarget', () => { assert.equal(isVideoTarget(resolveTarget('ios-6.9')), false); assert.equal(isVideoTarget(resolveTarget('preview-mac')), true); })
test('custom video target', () => { const t = resolveTarget({ id: 'promo', w: 1080, h: 1080, video: { minSec: 1, maxSec: 60 } }); assert.equal(t.video.fps, 30); })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd skills/generating-app-screenshots && node --test test/targets.test.mjs`
Expected: FAIL (`isVideoTarget` is not exported; unknown target "preview-iphone")

- [ ] **Step 3: Add the targets and helpers to `scripts/targets.mjs`**

Add the eleven video targets and six creative image targets from the spec tables (video targets: `store: 'ios'` except `story-video` → `store: 'social'`; `preview-mac` → `family: 'desktop', model: 'macbook', landscape: true`; `preview-iphone-16-9` and `preview-iphone-4.7` → `model: 'iphone-home'`; creative videos and images → `family: 'creative'`, `model: 'iphone'`, `landscape: true` where `w > h`; `max: 3` on Apple video targets, `max: 1` on creative images, `max: 99` on `story-video`). `resolveTarget` fills `video.fps ??= 30` and `video.maxMB ??= 500` for custom objects. Keep the existing `@landscape` and `@styled` behavior.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/targets.test.mjs`
Expected: PASS, all tests

- [ ] **Step 5: Wire the unit tests into npm**

`package.json`: `"test:unit": "node --test test/*.test.mjs"` and `"test": "npm run test:unit && node scripts/render.mjs examples/demo/screenshots.config.json --locales en-US --targets ios-6.9 --no-preview"`.
Run: `npm test` → Expected: unit tests pass, then the demo render exits 0.

- [ ] **Step 6: Commit**

```bash
git add skills/generating-app-screenshots/scripts/targets.mjs skills/generating-app-screenshots/test/targets.test.mjs skills/generating-app-screenshots/package.json
git commit -m "feat(targets): App Store app preview and creative asset targets"
```

---

### Task 2: Creative image targets render end to end (screenshot pass)

**Files:**
- Modify: `scripts/render.mjs` (target filtering in `main()` ~line 549; validation ~lines 673–688; fastlane ~lines 691–703; `pageHtml` `__fit` ~lines 467–525)
- Modify: `scripts/layouts.mjs` (`buildLayout`, wide-canvas phone sizing ~lines 70–120)
- Modify: `examples/devices/devices.config.json` (two slides for creative targets)

**Interfaces:**
- Consumes: `isVideoTarget`, `checkTargetFormat`, `t.maxMB`, `t.family === 'creative'` from Task 1.
- Produces: `__fit(scope?)` accepts an optional CSS selector and reports `{ id, outside: true }` for a `[data-fit]` or badge box leaving the central safe area when `window.__safe` is set; `pageHtml(sheet)` takes `sheet.safe = { x: 10, y: 10 }` (percent margins) for creative targets.

- [ ] **Step 1: Screenshot pass ignores video targets and rejects wrong formats early**

In `main()`, before building sheets: `const STILL_TARGETS = TARGETS.filter((t) => !isVideoTarget(t))`; use it everywhere the screenshot pass used `TARGETS`. Right after `FORMAT` is known, push `checkTargetFormat(t, FORMAT)` results into `errors` and exit 1 before launching the browser when any exist.
Run: `node scripts/render.mjs examples/demo/screenshots.config.json --targets app-header-16-9 --format jpeg --no-preview`
Expected: exit 1, `ERROR app-header-16-9: Apple accepts PNG only — use --format png`, no browser launched (no `out/.build/*.html` written).

- [ ] **Step 2: Size limit per target**

Validation: `const mb = t.maxMB ?? (t.store === 'msstore' ? 50 : 8)`.
Run: `node scripts/render.mjs examples/devices/devices.config.json --targets app-header --locales en-US --no-preview` (after Step 4 adds the slides) → Expected: no `larger than 8 MB` warning on a 3840×1646 PNG.

- [ ] **Step 3: Safe-area check in `__fit`**

`pageHtml` emits `window.__safe = ${JSON.stringify(sheet.safe || null)}`; `__fit(scope)` scopes its queries to `scope` when given, and when `__safe` is set reports `{ id, outside: true }` for any `[data-fit]` box or `.el` badge whose rect leaves `[safe.x%, 100 − safe.x%]` × `[safe.y%, 100 − safe.y%]` of the canvas. `main()` maps `outside` to `warn('[target/locale] caption leaves the safe area: id — Apple crops creative assets per device; keep text inside the central 80%')`. `sheet.safe = { x: 10, y: 10 }` when `target.family === 'creative'`.

- [ ] **Step 4: Layouts on 21:9 and 3:2 canvases**

In `buildLayout`, for `cls === 'wide'` with a **phone or tablet** model (not `desk`): when `W / H >= 2` (the 21:9 header) `text-left`/`text-right` use `dMax: 22` and caption `w: 40`; on `W / H < 1.6` (3:2 search, 16:9 event card) keep the current `T.wide` values. Add two slides to `examples/devices/devices.config.json`: `{ "id": "header", "layout": "text-left", "targets": ["creative"], "title": ..., "screen": <existing phone screen> }` and `{ "id": "event", "layout": "hero", "targets": ["event-details"] }`; add `"app-header"`, `"search-asset"`, `"event-card"`, `"event-details"` to that config's `targets`; put `"skipTargets": ["creative"]` on its existing slides.
Run: `node scripts/render.mjs examples/devices/devices.config.json --targets app-header,search-asset,event-card,event-details --locales en-US`
Expected: exit 0; open `examples/devices/out/index.html`: the header shows the phone at one side, caption beside it, nothing cut; no `safe area` warnings.

- [ ] **Step 5: fastlane folder for creative assets**

In the fastlane block: `if (t.family === 'creative') dest = path.join(OUT, 'fastlane', 'creative', storeLocale(m.locale, 'ios'), `${t.baseId}_${m.slide}.${ext}`)` and print once: `NOTE creative assets (header, search, events) are not uploaded by deliver — add them in App Store Connect`.
Run: the Step 4 command with `--fastlane` → Expected: `out/fastlane/creative/en-US/app-header_header.png` exists.

- [ ] **Step 6: Run the full existing test and commit**

Run: `npm test` → Expected: PASS, exit 0.

```bash
git add skills/generating-app-screenshots/scripts/render.mjs skills/generating-app-screenshots/scripts/layouts.mjs skills/generating-app-screenshots/examples/devices/devices.config.json
git commit -m "feat: render App Store header, search and In-App Event images"
```

---

### Task 3: `video.mjs` timeline math (pure, unit-tested)

**Files:**
- Create: `scripts/video.mjs`
- Create: `test/video.test.mjs`

**Interfaces:**
- Produces:
  - `export const FPS = 30`
  - `export const TRANSITIONS = { crossfade: 0.5, push: 0.6, cut: 0, 'fade-through': 0.6 }`
  - `export const ENTRANCES = { rise: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0.06 }, fade: { device: 0.6, caption: 0.5, delay: 0.1, rise: 0 }, none: null }`
  - `export function buildTimeline(preview, scenes, { fps = FPS } = {}) → { fps, total, frames, scenes, errors }` where each input scene is `{ id, duration?, transition?, in?, motion?, labels?, clip?: { frames: number, fps }, overflow?: number }` and each output scene is `{ id, index, start, end, duration, transition: { kind, dur }, entrance, motion, labels: [{ at, until, text }], clip, overflow, fadeIn, fadeOut }`. `preview` supplies `{ transition?, loop?: 'soft' | 'hard' }` and `theme.video` defaults are merged by the caller. `errors` lists `scene "<id>": duration 0.4s is shorter than its crossfade transition (0.5s)`.
  - `export function stateAt(tl, t) → { scenes: [{ id, visible, opacity, tx, veil, device: { opacity, dy }, caption: { opacity, dy }, screen: { scale, scrollY, frame }, labels: [{ opacity }] }] }` with `dy` in fraction of canvas height, `tx` in fraction of width, `frame` the clip frame index or `null`, all eased with ease-out cubic.
  - `export const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b)`
  - `export function posterTime(tl, poster) → { time, warnings }` (`poster`: seconds, a scene id, or undefined → 5)
  - `export function checkDuration(tl, target, { sceneFilter = false } = {}) → string[]`
  - `export const timeCode = (s) => 'HH:MM:SS:CC'`

- [ ] **Step 1: Write the failing tests**

```js
test('starts accumulate and default duration is 4', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 7 }, { id: 'c' }]);
  assert.deepEqual(tl.scenes.map((s) => [s.start, s.end]), [[0, 4], [4, 11], [11, 15]]);
  assert.equal(tl.total, 15); assert.equal(tl.frames, 450);
});
test('transition shorter than scene is an error naming the scene', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 0.4 }, { id: 'b' }]);
  assert.match(tl.errors[0], /scene "a".*0\.4s.*crossfade.*0\.5s/);
});
test('crossfade: next scene fades in over the last 0.5s of the previous one', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b' }]);
  const s = stateAt(tl, 3.75).scenes;
  assert.equal(s[0].opacity, 1); assert.ok(s[1].visible && s[1].opacity > 0.4 && s[1].opacity < 0.95);
  assert.equal(stateAt(tl, 3.0).scenes[1].visible, false);
});
test('push moves both scenes horizontally', () => {
  const tl = buildTimeline({ transition: 'push' }, [{ id: 'a' }, { id: 'b' }]);
  const s = stateAt(tl, 3.7).scenes; assert.ok(s[0].tx < 0 && s[1].tx > 0 && s[1].tx < 1);
});
test('rise entrance: device starts 6% low and lands by 0.6s', () => {
  const tl = buildTimeline({}, [{ id: 'a' }]);
  assert.equal(stateAt(tl, 0).scenes[0].device.dy, 0.06);
  assert.equal(stateAt(tl, 0.6).scenes[0].device.dy, 0);
  assert.equal(stateAt(tl, 0.05).scenes[0].caption.opacity, 0);   // 0.1 s delay
});
test('loop fades: veil 1 at t=0, 0 at 0.4; veil 1 at the very end', () => {
  const tl = buildTimeline({}, [{ id: 'a' }]);
  assert.equal(stateAt(tl, 0).scenes[0].veil, 1); assert.equal(stateAt(tl, 0.4).scenes[0].veil, 0);
  assert.ok(stateAt(tl, 3.99).scenes[0].veil > 0.9);
  assert.equal(stateAt(buildTimeline({ loop: 'hard' }, [{ id: 'a' }]), 0).scenes[0].veil, 0);
});
test('drift scales 1 → 1.03 across the scene; scroll with overflow pans 0 → 1; scroll without overflow drifts', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'scroll', overflow: 0.8 }, { id: 'b', motion: 'scroll', overflow: 0.01 }]);
  assert.equal(stateAt(tl, 0).scenes[0].screen.scrollY, 0); assert.equal(stateAt(tl, 4).scenes[0].screen.scrollY, 1);
  assert.equal(tl.scenes[1].motion, 'drift'); assert.ok(stateAt(tl, 6).scenes[1].screen.scale > 1);
});
test('clip frames advance at fps and hold the last frame', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 4, clip: { frames: 60, fps: 30 } }]);
  assert.equal(stateAt(tl, 1).scenes[0].screen.frame, 30);
  assert.equal(stateAt(tl, 3.5).scenes[0].screen.frame, 59);
});
test('labels fade in at `at` and out at `until`', () => {
  const tl = buildTimeline({}, [{ id: 'a', labels: [{ at: 1, until: 2, text: 'X' }] }]);
  assert.equal(stateAt(tl, 0.9).scenes[0].labels[0].opacity, 0);
  assert.equal(stateAt(tl, 1.3).scenes[0].labels[0].opacity, 1);
  assert.equal(stateAt(tl, 2.3).scenes[0].labels[0].opacity, 0);
});
test('sameState detects rest frames', () => {
  const tl = buildTimeline({}, [{ id: 'a', motion: 'none' }]);
  assert.ok(sameState(stateAt(tl, 1), stateAt(tl, 1.5))); assert.ok(!sameState(stateAt(tl, 0.1), stateAt(tl, 0.2)));
});
test('poster: default 5, scene id → rest time, inside a transition warns', () => {
  const tl = buildTimeline({}, [{ id: 'a' }, { id: 'b', duration: 8 }]);
  assert.equal(posterTime(tl).time, 5);
  assert.equal(posterTime(tl, 'b').time, 4 + 0.5 + 0.6);        // crossfade 0.5 + entrance 0.6 (0.1 delay + 0.5 caption) over, then rest
  assert.match(posterTime(tl, 3.8).warnings[0], /transition/);
  assert.match(posterTime(tl, 0.2).warnings[0], /entrance|fade/);
});
test('checkDuration against target.video', () => {
  const tl = buildTimeline({}, [{ id: 'a', duration: 10 }]);
  assert.match(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } })[0], /10s.*15.*30/);
  assert.deepEqual(checkDuration(tl, { id: 'preview-iphone', video: { minSec: 15, maxSec: 30 } }, { sceneFilter: true }), []);
});
test('timeCode', () => assert.equal(timeCode(5), '00:00:05:00') && assert.equal(timeCode(65.5), '00:01:05:50'));
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/video.test.mjs` → Expected: FAIL (`Cannot find module './scripts/video.mjs'`)

- [ ] **Step 3: Implement the timeline functions in `scripts/video.mjs`**

Pure functions, no imports beyond `node:` modules. Scene `start_n = Σ duration_{<n}`; the transition **into** scene n occupies `[start_n − dur, start_n]` (scene 0 has none); entrance of scene n starts at `start_n − transition.dur` (0 for scene 0); scenes render in index order so a later scene paints above an earlier one; `visible` is true from `start_n − transition.dur` until `end_n` plus the next transition's length; `fade-through` drives `veil` of scene n up over the first half and of scene n+1 down over the second half; a scene's `fadeIn`/`fadeOut` are the loop fades (`soft` default). `posterTime` rest time of a scene = `start + transition.dur + max(entrance durations incl. delay)`; it warns when the time is within any transition, entrance or loop fade. `checkDuration` with `sceneFilter` returns `[]`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/video.test.mjs` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/generating-app-screenshots/scripts/video.mjs skills/generating-app-screenshots/test/video.test.mjs
git commit -m "feat(video): preview timeline, transitions, entrances, poster and duration checks"
```

---

### Task 4: `video.mjs` ffmpeg: discovery, clip probing/extraction, encoder, filmstrip

**Files:**
- Modify: `scripts/video.mjs`
- Modify: `test/video.test.mjs`
- Modify: `package.json` (`optionalDependencies["ffmpeg-static"] = "^5.3.0"`)

**Interfaces:**
- Produces:
  - `export function findFfmpeg() → string | null` (order: `process.env.FFMPEG_PATH`, `ffmpeg-static` export if the file exists, `ffmpeg` on PATH via `which`/`where`)
  - `export function probeClip(ffmpeg, file) → { duration, width, height, fps }` (parses `ffmpeg -i` stderr: `Duration: 00:00:29.90`, `444x960`, `30 fps`)
  - `export function clipKey({ file, start, end, speed, height }) → string` (sha1 of file size + mtime + params)
  - `export function extractClip(ffmpeg, { file, start, end, speed, height, dir }) → { dir, files: string[], count, fps: 30 }` (`-ss start -to end -vf "setpts=PTS/speed,fps=30,scale=-2:height" -q:v 2 dir/%05d.jpg`; skips the run when `dir` already holds frames)
  - `export function encodeArgs({ fps, width, height, out, total, music }) → string[]` where `music` is `null` or `{ src, volume, fadeOut }`
  - `export function startEncoder(ffmpeg, args) → { write(buf): Promise<void>, end(): Promise<void>, log: string[] }` (rejects with the ffmpeg log tail on a non-zero exit)
  - `export async function filmstrip(frames: [{ t, buf }], out) → { file, w, h }` (one frame per second, 10 per row, 240 px high, second number under each; sharp composite + SVG labels)

- [ ] **Step 1: Write the failing tests**

```js
test('encodeArgs: H.264 High 4.0 yuv420p 30fps 11M, faststart, silent stereo AAC 48k when no music', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20, music: null }).join(' ');
  for (const s of ['-f image2pipe', '-framerate 30', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-c:v libx264', '-profile:v high', '-level 4.0', '-pix_fmt yuv420p', '-b:v 11M', '-maxrate 12M', '-bufsize 24M', '-r 30', '-c:a aac', '-b:a 256k', '-ar 48000', '-ac 2', '-movflags +faststart', '-t 20', 'x.mp4']) assert.ok(a.includes(s), s);
});
test('encodeArgs with music trims to total and fades out', () => {
  const a = encodeArgs({ fps: 30, width: 886, height: 1920, out: 'x.mp4', total: 20, music: { src: 'm.mp3', volume: 0.8, fadeOut: 1.5 } }).join(' ');
  assert.ok(a.includes('-i m.mp3') && a.includes('volume=0.8') && a.includes('afade=t=out:st=18.5:d=1.5'));
});
test('clipKey changes with params', () => assert.notEqual(clipKey({ file: __filename, start: 0, end: 1, speed: 1, height: 600 }), clipKey({ file: __filename, start: 0, end: 2, speed: 1, height: 600 })));
test('probeClip and extractClip on a generated test clip', { skip: !findFfmpeg() }, async () => {
  // make a 2 s 320x640 testsrc clip in the scratch dir with ffmpeg, then:
  const p = probeClip(ff, clip); assert.deepEqual([p.width, p.height, Math.round(p.duration)], [320, 640, 2]);
  const x = extractClip(ff, { file: clip, start: 0.5, end: 1.5, speed: 1, height: 320, dir }); assert.equal(x.count, 30); assert.ok(fs.existsSync(x.files[29]));
});
test('startEncoder writes a valid mp4', { skip: !findFfmpeg() }, async () => {
  // 10 identical 64x64 JPEG frames from sharp → encoder → file exists, size > 0, probeClip gives width 64, duration ≈ 0.33
});
test('filmstrip tiles one frame per second', async () => {
  // 25 frames of a solid color → { w: 10 columns wide, h: 3 rows } sized image exists
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/video.test.mjs` → Expected: FAIL on the new tests only

- [ ] **Step 3: Implement**

`findFfmpeg` uses `createRequire(import.meta.url)('ffmpeg-static')` inside try/catch. `extractClip` runs `spawnSync` with `stdio: 'pipe'` and throws the stderr tail on failure. `startEncoder` spawns with `stdio: ['pipe', 'ignore', 'pipe']`, honors back-pressure (`write` resolves on `drain` when `stdin.write` returns false). Add `optionalDependencies` to `package.json`, run `npm install`, confirm `node -e "console.log(require('ffmpeg-static'))"` prints a path.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/video.test.mjs` → Expected: PASS (ffmpeg tests not skipped on this machine)

- [ ] **Step 5: Commit**

```bash
git add skills/generating-app-screenshots/scripts/video.mjs skills/generating-app-screenshots/test/video.test.mjs skills/generating-app-screenshots/package.json skills/generating-app-screenshots/package-lock.json
git commit -m "feat(video): ffmpeg discovery, clip extraction, H.264 encoder, QA filmstrip"
```

---

### Task 5: Preview page assembly in `render.mjs` (scenes → animatable DOM, clips, scroll mocks)

**Files:**
- Modify: `scripts/devices.mjs:143-144` (screen `<img>` gets `class="scr"`; the device's outermost element gets `data-el="${el.id}"`)
- Modify: `scripts/render.mjs` (`resolveScreen` ~line 195; the html mock pre-render ~lines 627–640; new functions `resolvePreviews`, `sceneHtml`, `previewPageHtml`)
- Modify: `test/video.test.mjs` (a page-level test using Playwright is **not** added; keep page logic thin)

**Interfaces:**
- Consumes: `buildTimeline`, `stateAt`, `probeClip`, `extractClip`, `clipKey`, `findFfmpeg` (Tasks 3–4); `screenRect` from `devices.mjs`; existing `slideElements`, `elementHtml`, `backgroundHtml`, `specialize`, `slideOn`, `str`, `fontStack`, `googleLink`.
- Produces in `render.mjs`:
  - `resolvePreviews() → [{ preview, target, locale, scenes: [{ scene, s, th, els, clip, overflow, labelEls }], warnings }]` — one job per preview × video target × locale, after `specialize(preview, target, locale)` layered over `theme.video` defaults (`entrance`, `transition`, `scroll`); a `scenes` value that is an array of **strings** after specialization selects base scenes by id (spec: `byTarget.scenes`).
  - `sceneHtml(job, sceneEntry, i) → string`: `<div class="scene" data-scene="id" style="position:absolute;inset:0;visibility:hidden">` + background + each element wrapped in `<div class="anim" data-role="device|caption|label|other" data-i="n" style="position:absolute;inset:0">` + `<div class="veil" style="position:absolute;inset:0;background:<bg color>;opacity:0"></div>`.
  - `previewPageHtml(job, bodies, { W, H, safe }) → string`: like `pageHtml` plus `window.__apply(state)`; it also includes `__fit(scope)` from Task 2.
  - A clip scene's device element carries `screen: <first frame path>` and `clipFrames: [file URLs]`.
- `window.__apply(state)`: for each `state.scenes[i]`: `.scene` → `visibility` (`hidden` when `!visible`), `opacity`, `transform: translateX(tx*100%)`; `.anim[data-role=device]` → `opacity`, `transform: translateY(dy*H px)`; same for caption; `.anim[data-role=label][data-i=k]` → `opacity`; `.scr` of the `data-el="device"` element → `transform: scale(s)`, `object-position: 50% ${scrollY*100}%`, and `src = clipFrames[frame]` when it differs; `.veil` → `opacity`. Returns after `Promise.all(changedImgs.map((i) => i.decode()))`.

- [ ] **Step 1: Device markup hooks**

`devices.mjs`: add `class="scr"` to both `<img>` variants at lines 143–144 and `data-el="${el.id || 'device'}"` on the outermost wrapper `renderDevice` returns.
Run: `npm test` → Expected: PASS (screenshots unchanged; compare one demo PNG hash before/after to be sure).

- [ ] **Step 2: Clip detection and extraction**

`const isClip = (p) => /\.(mov|mp4|m4v|webm)$/i.test(p)`. In `resolvePreviews`, for a scene whose `screen` (after `{locale}` resolution with the same candidate order as `resolveScreen`, plus `preview.clipLocale` silencing the fallback warning) is a clip: `probeClip`, compute the device's screen height in px with `screenRect(el, { W, H })` after `slideElements`, `extractClip` into `path.join(OUT, '.build', 'clips', clipKey(...))`, set `el.screen` to `files[0]`, `el.clipFrames` to file URLs, and record `clip: { frames: count, fps: 30 }` for the timeline. Warn once per job: `clip <file> is 6.0s but scene "x" lasts 7s — the last frame holds`; warn when `|clipAspect / modelScreenAspect − 1| > 0.02`: `clip 444×960 does not match the iphone screen (2.17:1) — it will be cropped`. When `findFfmpeg()` is null, push `ERROR previews need ffmpeg: npm install (ffmpeg-static), set FFMPEG_PATH, or brew install ffmpeg` and skip the preview pass.

- [ ] **Step 3: Full-page mocks for `scroll`**

`resolveScreen(src0, locale, model, landscape, { fullPage } = {})`: when `fullPage`, the build file name gets `.full` and the html job carries `fullPage: true`; the mock pre-render loop uses `p.screenshot({ path: job.out, fullPage: job.fullPage })`. `resolvePreviews` passes `fullPage: scene.motion === 'scroll'` and computes `overflow = imageAspect / modelScreenAspect − 1` for stills.

- [ ] **Step 4: Labels as badge elements**

For each `scene.labels[k]`, append `{ type: 'badge', id: 'label-k', text, x: 50, y: <caption.y + caption.h + 1 when caption.y < 50, else caption.y − 6>, size: 3.2, background: th.accent || '#ffcf5c', color: '#111', role: 'label', i: k }`; the wrapper role comes from `el.role || (type === 'device' ? 'device' : type === 'caption' ? 'caption' : 'other')`.

- [ ] **Step 5: Page and apply script; fit checks per scene**

Implement `sceneHtml`, `previewPageHtml`, `__apply` as in Interfaces. In a temporary harness (`node scripts/render.mjs examples/demo/screenshots.config.json --targets preview-iphone --only-previews` will exist after Task 6; for now call the functions from a scratch script) verify that, for a preview with two scenes, `previewPageHtml` output written to `out/.build/` opens in Chrome and `__apply(stateAt(tl, 3.75))` shows scene 2 half faded over scene 1 (visual check via a `page.screenshot`).

- [ ] **Step 6: Review-focus tests (Node side)**

Add to `test/video.test.mjs` (pure, no browser): `resolvePreviews` is in `render.mjs` which runs `main()` on import, so test the extracted helper `export function selectScenes(previewScenes, override)` (new, in `video.mjs`): `selectScenes([{id:'a'},{id:'b'}], ['b'])` → `[{id:'b'}]`; unknown id → throws naming it. And `missingClipWarning(locale, file, clipLocale)` → returns `null` when `clipLocale === locale`'s language or equals the fallback used; the per-job warning set is a `Set` so a locale warns once.

- [ ] **Step 7: Commit**

```bash
git add skills/generating-app-screenshots/scripts/devices.mjs skills/generating-app-screenshots/scripts/render.mjs skills/generating-app-screenshots/scripts/video.mjs skills/generating-app-screenshots/test/video.test.mjs
git commit -m "feat(video): scene pages with animatable layers, clips and scrolling mocks"
```

---

### Task 6: Capture loop, encode, poster, filmstrip, validation, fastlane, CLI

**Files:**
- Modify: `scripts/render.mjs` (`main()`: new preview pass after the screenshot pass and before validation; CLI flags at the top; manifest, index.html, fastlane blocks)

**Interfaces:**
- Consumes: everything from Tasks 3–5; `startEncoder`, `encodeArgs`, `filmstrip`, `posterTime`, `checkDuration`, `timeCode`, `sameState`.
- Produces: files `out/<target>/<locale>/NN_<id>.mp4`, `NN_<id>.poster.png`, `out/_preview/<target>__<locale>__<id>.jpg`; `manifest.json` gains `previews: [{ id, target, locale, index, file, poster, posterTime, duration }]`; `index.html` gains a Previews section with `<video controls loop muted playsinline>` and the filmstrip; CLI: `--previews a,b`, `--no-previews`, `--only-previews`, `--scenes a,b`.

- [ ] **Step 1: CLI flags**

`const PREVIEW_FILTER = list(flag('previews'))`, `SCENE_FILTER = list(flag('scenes'))`, `has('no-previews')`, `has('only-previews')`. `--only-previews` skips the screenshot pass. When a video target is requested (via `--targets` or config) and the config has no `previews`, push `ERROR no "previews" in the config, but video target preview-iphone was requested`.
Run: `node scripts/render.mjs examples/demo/screenshots.config.json --targets preview-iphone --only-previews` → Expected: exit 1 with that message.

- [ ] **Step 2: Capture loop**

For each job from `resolvePreviews`: write the page to `out/.build/`, `page.setViewportSize({ W, H })` on a page with `deviceScaleFactor: VIDEO_SUPERSAMPLE` (`flag('supersample')` or `cfg.videoSupersample` or 1; a target's `renderScale: 0.5` (custom video targets or `byTarget`) renders at that factor and the encoder's `-vf scale=W:H:flags=lanczos` upscales, with a NOTE `rendered at 0.5× — drafts only`), `goto`, run `__fit('.scene[data-scene="id"]')` at each scene's rest state and map results to the existing warnings, then: `const enc = startEncoder(ff, encodeArgs({...}))`; `let prev = null, buf = null; for (f = 0; f < tl.frames; f++) { const st = stateAt(tl, f / fps); if (!prev || !sameState(st, prev)) { await page.evaluate((s) => window.__apply(s), st); buf = await page.screenshot({ type: 'jpeg', quality: 95 }); } await enc.write(buf); keep buf when f % fps === 0 for the filmstrip; prev = st; print progress every 10% }`, `await enc.end()`. Poster: `__apply(stateAt(tl, posterTime))` → `page.screenshot({ type: 'png' })` → `toStoreImage(..., W, H)` to `NN_<id>.poster.png`. Then `filmstrip(frames, out/_preview/...)`.

- [ ] **Step 3: Validation**

Per job: `checkDuration(tl, target, { sceneFilter: !!SCENE_FILTER })` → errors; `fs.statSync(file).size > target.video.maxMB MB` → error; count per target × locale > `target.max` → error; `preview.music` on `search-video` → warn `search results videos cannot be unmuted — music is wasted bytes`; all scenes stills on a `creative` video target → NOTE `header-video/<locale>/tour.mp4 is a draft: every scene is a still; Apple wants the main flow recorded (see reading-the-app.md §2b)`; `posterTime.warnings` → warnings; `SCENE_FILTER` → NOTE `--scenes given: duration check skipped`.

- [ ] **Step 4: manifest, index.html, fastlane**

manifest `previews` array as in Interfaces; `index.html` section per target × locale: `<h2>Preview · <label> <small>locale · W×H · n videos</small></h2>` then per video `<video controls loop muted playsinline src="..."></video>` + `<img src="_preview/...jpg">` + `poster at 00:00:05.00`. fastlane: `out/fastlane/app-previews/<storeLocale(ios)>/NN_<target.asc>_<id>.mp4` for Apple targets; print `NOTE deliver: pass preview_frame_time_code "<timeCode>"` when any poster ≠ 5, and warn when previews in one run have different poster times.
Final summary line: `Rendered N screenshots + M previews → out`.

- [ ] **Step 5: End-to-end check**

Create a scratch config in the scratchpad (not committed): the demo config plus `"targets": ["preview-iphone"]` and a `previews` entry with 4 scenes (`hero`, `text-top` with `motion: "scroll"` on `screens/stats.html`, `tilt-right`, `caption-only`), durations 5/5/5/5, labels on scene 2.
Run: `node scripts/render.mjs <scratch>/screenshots.config.json --only-previews --locales en-US`
Expected: exit 0; `out/preview-iphone/en-US/01_tour.mp4` plays in QuickTime at 886×1920, 20 s, 30 fps; `ffmpeg -i` shows `h264 (High)`, `yuv420p`, `aac ... stereo, 48000 Hz`; the poster PNG is 886×1920 with no alpha; the filmstrip shows 20 numbered frames; `index.html` plays it. Wall time printed; expect under 3 minutes.

- [ ] **Step 6: Run everything and commit**

Run: `npm test` → PASS.

```bash
git add skills/generating-app-screenshots/scripts/render.mjs
git commit -m "feat(video): render app previews: capture, encode, poster, filmstrip, validation, fastlane"
```

---

### Task 7: Example `examples/preview`, synthetic recording, npm scripts

**Files:**
- Create: `examples/preview/preview.config.json`, `examples/preview/copy.json`, `examples/preview/clip.config.json`, `examples/preview/recordings/en-US/walk.mp4` (committed, ≤ 1.5 MB)
- Modify: `package.json` (`example:preview`, `example:preview-clip`, `test:video`, `examples`)
- Modify: `.gitignore` in the skill (nothing new; confirm `out/` stays ignored and `recordings/` is not)

**Interfaces:**
- Consumes: the CLI from Task 6; demo screens `../demo/screens/*.html`.

- [ ] **Step 1: Synthetic clip config**

`clip.config.json`: `app.name "Streakly"`, `locales ["en-US"]`, one custom target `{ "id": "clip", "w": 880, "h": 1912, "video": { "minSec": 1, "maxSec": 60 } }`, `previews: [{ "id": "walk", "loop": "hard", "scenes": [{ "id": "walk", "layout": "blank", "duration": 6, "in": "none", "motion": "scroll", "elements": [{ "type": "device", "id": "device", "model": "none", "style": "frameless", "radius": 0, "shadow": false, "x": 50, "y": 0, "w": 100, "screen": "../demo/screens/stats.html" }] }] }]`.
Run: `node scripts/render.mjs examples/preview/clip.config.json --only-previews && cp examples/preview/out/clip/en-US/01_walk.mp4 examples/preview/recordings/en-US/walk.mp4` → Expected: a 6 s 880×1912 mp4 under 1.5 MB (lower `-b:v` is not an option; if it is over, shorten to 5 s).

- [ ] **Step 2: Preview example**

`preview.config.json`: locales `en-US`, `ja`; targets `preview-iphone`, `preview-ipad`, `header-video`, `app-header`, `event-card`; theme preset `aurora`, font `Plus Jakarta Sans`; slides: two creative-only slides (`header` text-left, `event` hero); `previews`: one entry `tour` with scenes `hero` (5 s), `stats` (`text-top`, `screen: recordings/{locale}/walk.mp4`, 6 s, labels at 1 s and 3.5 s), `remind` (`tilt-right`, `motion: scroll`, 5 s), `close` (`caption-only`, 4 s), `"clipLocale": "en-US"`, `"byTarget": { "header-video": { "scenes": ["stats", "remind"], "transition": "push" } }`; `copy.json` with en-US and ja strings for every key.
Run: `node scripts/render.mjs examples/preview/preview.config.json` → Expected: exit 0, no WARN; `examples/preview/out/index.html` shows 2 locales × (iPhone 20 s, iPad 20 s, header 11 s) and the two creative images; the header video pushes between two scenes with the phone at the left and the caption at the right.

- [ ] **Step 3: npm scripts**

`"example:preview": "node scripts/render.mjs examples/preview/preview.config.json"`, `"example:preview-clip": "node scripts/render.mjs examples/preview/clip.config.json --only-previews"`, `"test:video": "node scripts/render.mjs examples/preview/preview.config.json --only-previews --locales en-US --targets preview-iphone --no-preview"`, and add `example:preview` to `examples`.
Run: `npm run test:video` → Expected: exit 0 in under 2 minutes.

- [ ] **Step 4: Commit**

```bash
git add skills/generating-app-screenshots/examples/preview skills/generating-app-screenshots/package.json
git commit -m "feat: preview example with a synthetic recording and npm scripts"
```

---

### Task 8: Documentation and version 1.1.0

**Files:**
- Modify: `references/config.md` (targets tables; new sections `## previews`, `### Scenes`, `### Creative videos`, `### Poster frame`; CLI line; outputs line)
- Modify: `references/reading-the-app.md` (new `## 2b. Record the app for previews` after §2)
- Modify: `SKILL.md` (description, workflow steps 2, 4, 6, 7; quick reference rows; common mistakes)
- Modify: `README.md`, `CHANGELOG.md`, `package.json` version, `.claude-plugin/plugin.json` version, `.claude-plugin/marketplace.json` version if present

- [ ] **Step 1: config.md**

Add the video and creative target rows (exact pixels, slots, durations) and `creative` family notes; document `previews` with the spec's JSON example, every scene field (`duration`, `clip`, `motion`, `labels`, `in`, `transition`), continuity (same layout → device stays), loop fades and `loop: "hard"`, `byTarget.scenes`, `clipLocale`, `music`, `poster`, `theme.video`; the CLI flags from Task 6; outputs incl. `.poster.png`, filmstrip and `out/fastlane/app-previews/`.

- [ ] **Step 2: reading-the-app.md §2b**

iOS: `xcrun simctl io <udid> recordVideo --codec h264 --mask ignored recordings/en-US/flow.mov` (Ctrl-C stops), status bar override first, drive with deep links or `maestro test`; Android: `adb shell screenrecord --bit-rate 8000000 /sdcard/flow.mp4` + `adb pull`; rules: slow gestures, 1 s pause per screen, no keyboard unless it is the point, no personal data, one recording per locale or one English recording with `clipLocale`; HTML mocks do not record.

- [ ] **Step 3: SKILL.md**

Description adds "app preview videos, product page header, search results and In-App Event assets". Step 2 gains "(d) screen recordings for previews (reading-the-app.md §2b)". Step 4: "add `previews` when the app ships a preview; the preview shows **first** on the store, so scene 1 and the poster carry the hook". Step 6 QA adds: read `_preview/*__<id>.jpg` filmstrips; poster frame readable alone; nothing still moving at the loop point; clips not stretched; labels timed right in every locale. Step 7 adds: preview files, poster times to set, draft notice when scenes are stills. Quick reference rows: video targets, creative targets, `previews` keys. Common mistakes: "preview over 30 s", "fast cuts", "stills-only preview submitted as final", "clip in the wrong language", "music on a search video".

- [ ] **Step 4: README, CHANGELOG, versions**

README: feature bullets for previews and creative assets, a row in Examples for `examples/preview`, Limits adds render time (about 1–2 minutes per preview per locale, 3–5 for 4K creative videos) and "Chromium from `playwright install` works; H.264 decoding is not needed because clips are extracted to frames". CHANGELOG `## 1.1.0 (<date>)` listing the above. Bump `package.json` and `.claude-plugin/plugin.json` to `1.1.0`.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run test:video` → PASS.

```bash
git add -A skills/generating-app-screenshots/SKILL.md skills/generating-app-screenshots/references README.md CHANGELOG.md skills/generating-app-screenshots/package.json .claude-plugin
git commit -m "docs: app previews and creative assets; release 1.1.0"
```

---

### Task 9: Showcase site and AptusFIT sample support

**Files:**
- Modify: `scripts/build-site.mjs` (new "Previews" section from `examples/preview/out/manifest.json`; copies the en-US iPhone mp4 and poster to `docs/shots/preview/`)
- Modify: `docs/samples/aptusfit/index.html` (first carousel slot shows `<video>` when `previews/<locale>.mp4` exists, poster from `previews/<locale>.png`; a one-line note that the UI in the video is English)
- Modify: `docs/index.html` (regenerated by the script)

**Interfaces:**
- Consumes: Task 7 outputs.

- [ ] **Step 1: build-site Previews section**

After the devices section: a `<section id="previews">` with the iPhone preview `<video controls loop muted playsinline poster="shots/preview/tour.png" src="shots/preview/tour.mp4">`, the header video beside it, and the two creative images as `fig`. Keep `docs/` growth under 3 MB for this section (the mp4 at 886×1920 and 20 s is ~2.5 MB; if larger, re-encode the copy with `-b:v 4M` in the site builder).
Run: `npm run example:preview && npm run site` → Expected: `docs/index.html` has the section and `docs/shots/preview/tour.mp4` exists.

- [ ] **Step 2: AptusFIT sample page**

In `docs/samples/aptusfit/index.html`, when `D.previews` lists a locale, render slot 1 of the App Store carousel as a `<video muted loop playsinline controls>` with `src="previews/<locale>.mp4"` and `poster="previews/<locale>.png"`, else the current image. Add to `intro`: "The app preview is one English recording; captions are localized by the skill."
Human step (owner): record the main flow once with §2b, add `previews` to `marketing/store-screenshots/screenshots.config.json` in the app repo with `clipLocale: "en-US"`, render the 12 locales, copy `out/preview-iphone/<locale>/01_*.mp4` and posters to `docs/samples/aptusfit/previews/`, and set `D.previews`. The plan is complete without this step; the page must work with `D.previews` empty.
Run: open the sample page locally with no previews → unchanged; with one test mp4 dropped in → slot 1 plays.

- [ ] **Step 3: Commit**

```bash
git add skills/generating-app-screenshots/scripts/build-site.mjs docs
git commit -m "showcase: app preview section and video slot in the AptusFIT sample"
```
