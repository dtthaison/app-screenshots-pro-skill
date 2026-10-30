# Real-Footage Previews (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The skill reads an app, recommends 3 preview concepts, records the app on the iOS simulator with a tap log, and
renders a full-screen App Store preview. The motion (speed ramps, tap ripples, kinetic captions, end card) comes from that log.

**Architecture:**
- **Pure modules.** New logic goes in small modules next to the existing renderer, each unit-tested with `node --test`:
  - `align.mjs`
  - `maestro.mjs`
  - `concepts.mjs`
  - `ramp.mjs`
  - `taps.mjs`
  - `kinetic.mjs`
  - `storecheck.mjs`
  - `report.mjs`
- **Two new CLIs:**
  - `record.mjs` drives Maestro and `simctl`. It is the only part that is not deterministic, and its output is files.
  - `recommend.mjs` scores the brief.
- **Wiring.** `render.mjs` connects everything into the existing preview pass. That pass is:
  `resolvePreviews` → `buildTimeline`/`stateAt` → `__apply` → JPEG → ffmpeg.
  Every new motion is a value in `stateAt`, so rendering stays a pure function of `t`.

**Tech Stack:** Node ≥ 18.17 ESM, playwright-core, sharp, ffmpeg-static (all existing), Maestro 2.6+ and Xcode `simctl`
(external, needed by `record.mjs` only).

**Spec:** `docs/superpowers/specs/2026-10-30-real-footage-previews-design.md`. Research behind every constant:
`docs/superpowers/research/2026-10-30-real-footage-previews.md`.

All paths below are relative to `skills/generating-app-screenshots/` unless they start with `docs/`.

## Global Constraints

- **Dependencies:**
  - No new runtime dependencies beyond playwright-core, sharp and ffmpeg-static.
  - Maestro is checked at run time and needed only by `record.mjs`.
  - The minimum Maestro version is 2.6.
- **Determinism:** the same recording plus the same config must give the same frames. No CSS transitions or animations, and
  no `Date.now()` in render paths.
- **Compatibility:**
  - Existing 1.1.0 configs render unchanged. The only new output allowed is the frame WARN on Apple preview targets, and NOTEs.
  - WARN never changes the exit code. The codes stay: 0 = clean, 1 = validation errors, 2 = crash.
- **Scope:** iPhone only in this release. A preview with `concept` may target only `preview-iphone` (886×1920). Any other
  video target is an ERROR: `iPhone only in this release (preview-iphone)`.
- **Speed ramps:**
  - Ramps only compress, never below 1×. The top speed is 4×. Stills are idle at ≥ 0.5 s.
  - Rate edges: 300 ms smoothstep.
  - Tap protection: 0.4 s before a tap and 0.8 s after it stay at 1×.
- **Tap effects** (each value cited in `references/video/motion.md`):
  - **Ripple:** starts the frame before the reaction. Radius 3% → 12% of the screen width over 600 ms, expo-out easing.
    Opacity 0.5 → 0.
  - **Ring:** same timing, 3 px stroke.
  - **Spotlight:** an 18%-wide cut-out. Fade in 200 ms, hold 600 ms, fade out 300 ms.
- **Kinetic captions** (each value cited in `references/video/motion.md`):
  - **Words:** 70 ms stagger, 450 ms per word, `1 - 2^(-10p)` (expo-out). Each word rises from 110% inside a clipping box.
  - **Lines:** the same, with a 120 ms stagger per line.
  - **Pop:** scale 0.92 → 1 and opacity 0 → 1, spring with ζ = 0.8 and ω0 = 10 rad/s.
  - **Reading time:** a caption should be visible for at least 0.5 s + 0.3 s per word, otherwise WARN.
- **Concept checks** (WARN):
  - The first caption is fully visible by 1.0 s.
  - Beats last 2–5 s. `hero-moment` and `ask-answer` allow one beat of up to 8 s.
  - The end card comes last and lasts 1.5–3 s.
  - The 15–30 s total stays an ERROR, measured after ramping.
- **Layout aspect:** with `full-screen`, a screen whose aspect is more than 2% off the canvas is an ERROR that suggests
  `caption-band`. `caption-band` WARNs when the screen ends up narrower than 80% of the canvas width.
- **Paths:**
  - Paths resolve relative to the config's directory.
  - Recordings live in `recordings/<locale>/<preview>.mov`, with `<preview>.taps.json` and `<preview>.sheet.jpg` next to it.
  - The brief is `preview-brief.json`, next to the config.
- **Knowledge base sources:** each entry carries a source URL, `verified_on` and `verified` or `reported`. Untraceable
  statistics are never quoted.
- **Licensing:** MIT. No code is copied from Cap (AGPL) or Remotion (company licence).

## Decisions made in this plan

These sharpen the spec. They are the planner's calls.

1. **`open` steps use Maestro `openLink` inside the take,** so every step lands in one `commands-*.json` timeline. This
   changes spec "Resolved 6", and the spec is updated in Task 3.
2. **Scene 1 keeps its caption complete at frame 0.** The theme or preview default `captionMotion` does not apply to scene 1.
   It applies only when scene 1 sets `captionMotion` itself. The owner disliked an empty frame 0 in 1.1.0, and the hard loop
   cuts back to frame 0.
3. **The `strongest` pick must feature a `mustShow` moment** whenever `owner.mustShow` is non-empty. This is how "the
   recommendation never ignores the owner" is guaranteed.
4. **`examples/preview-recorded/` uses no `concept`.** It renders on a custom 880×1912 target with `minSec: 1`, because the
   bundled `walk.mp4` is 6 s, and it needs no simulator. Concept rules are covered by unit tests and by Task 13.

## Review Focus

These are the input classes the spec implies but no feature test would naturally exercise. Each has its test in the owning
task.

1. **A caption in ja, zh or th with `captionMotion: "words"`.** It has no spaces, so the whole title animates as one unit
   and the line breaks match `rise`. Test: Task 7.
2. **A clip span that is entirely idle**, or one that is too long even at 4×.
   - The ramp runs at 4× without crashing.
   - A span too long at 4× gives an ERROR with both lengths.
   - A span that is too short holds its last frame with the existing WARN.

   Test: Task 8.
3. **Two taps closer together than the ripple's 600 ms.** Both ripples draw independently, neither cut off. Test: Task 9.
4. **A failed or interrupted take.** The previous good recording, its sidecar and its contact sheet stay intact. Test: Task 3.
5. **Bad marks.** An unknown mark name is an ERROR that lists the available marks. `to` at or before `from` is an ERROR.
   Test: Task 9.

---

### Task 1: Frame differences and tap alignment

**Files:**
- Create: `scripts/align.mjs`
- Test: `test/align.test.mjs`

**Interfaces:**
- Produces:
  - `frameDiffs(files: string[], { width = 128 } = {}): Promise<Float64Array>`: the mean absolute difference (0–255) of
    grayscale frames resized to `width`. `d[0] = 0`.
  - `findSync(diffs, { full = SYNC_MAD } = {}): number | null`: the first frame with `diff ≥ full`.
  - `reactionFrame(diffs, from: number, to: number, { threshold = REACT_MAD } = {}): number | null`
  - `alignCommands(commands: Cmd[], diffs, fps, { slack = 0.5 } = {}): { offsetMs, events: AlignedCmd[] }`, where:
    - `Cmd` is `{ seq, kind, startMs, durMs, step }`;
    - `AlignedCmd` is `Cmd & { t, align: 'frame' | 'window' }`;
    - `commands[0]` is the sync command.
  - The constants `SYNC_MAD = 30` and `REACT_MAD = 3` are starting values. Task 3 tunes them on real footage and records
    the final values with their reasoning in `references/video/motion.md`.

- [ ] **Step 1: Write the failing tests**

```js
// synthetic: 30 fps, sync change at frame 12, taps react at frames 70 and 140
const diffs = Float64Array.from({ length: 200 }, (_, i) => (i === 12 ? 80 : i === 70 || i === 140 ? 9 : 0.4));
test('findSync returns the first full-screen change', () => assert.equal(findSync(diffs), 12));
test('reactionFrame finds the change inside the window, null outside', () => {
  assert.equal(reactionFrame(diffs, 60, 80), 70);
  assert.equal(reactionFrame(diffs, 80, 120), null);
});
test('alignCommands: offset from sync, tap time = frame before reaction', () => {
  const cmds = [{ seq: 0, kind: 'open', startMs: 10_000, durMs: 300, step: 0 },
                { seq: 1, kind: 'tap', startMs: 11_800, durMs: 500, step: 1 },
                { seq: 2, kind: 'tap', startMs: 14_100, durMs: 400, step: 2 },
                { seq: 3, kind: 'tap', startMs: 16_000, durMs: 200, step: 3 }];   // no reaction anywhere near
  const { offsetMs, events } = alignCommands(cmds, diffs, 30);
  assert.equal(offsetMs, 10_000 - 400);                    // frame 12 = 0.4 s
  assert.deepEqual(events.slice(1, 3).map((e) => [+(e.t * 30).toFixed(3), e.align]), [[69, 'frame'], [139, 'frame']]);
  assert.equal(events[3].align, 'window');
  assert.equal(events[3].t, (16_000 + 200 - offsetMs) / 1000);
});
test('frameDiffs: identical frames 0, different frames > 0', async () => { /* write 3 PNGs with sharp: black, black, white */ });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/align.test.mjs`
Expected: FAIL. `Cannot find module '../scripts/align.mjs'`.

- [ ] **Step 3: Implement `scripts/align.mjs`**

- **`frameDiffs`** uses `sharp(file).resize({ width }).grayscale().raw()`.
- **Command windows.** A command's window in video time is
  `[(startMs - offsetMs)/1000, (startMs + durMs - offsetMs)/1000 + slack]`.
- **Sync.** The sync command's own `t` is `findSync(diffs) / fps`, with `align: 'frame'`. When no sync frame exists, throw
  `no full-screen change found for the sync step — does the first step open a different screen?`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/align.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/align.mjs test/align.test.mjs
git commit -m "feat(record): frame differences and tap alignment"
```

---

### Task 2: Maestro helpers

**Files:**
- Create: `scripts/maestro.mjs`
- Create: `test/fixtures/maestro/commands.json`. Copy it from `~/.maestro/tests/2026-10-30_134027/commands-(plank-timer.Ea8yEQKuhW.yaml).json`.
- Create: `test/fixtures/maestro/hierarchy.json`. Capture it with `maestro --udid <any booted simulator> hierarchy`, then
  trim it to under 200 lines while keeping the root and 3–4 nodes with `resource-id`, `text` and `accessibilityText`.
- Test: `test/maestro.test.mjs`

**Interfaces:**
- Produces:
  - `MIN_MAESTRO = '2.6'`
  - `maestroVersion(): string | null`, and `checkMaestro(): string`, which returns the version or throws
    `maestro 2.6+ is needed to record: curl -Ls "https://get.maestro.mobile.dev" | bash`.
  - `flowYaml(appId: string, commands: (string | object)[]): string`. Every scalar is JSON-quoted, which is valid YAML.
  - `sleep(ms): object`, which returns
    `{ extendedWaitUntil: { visible: '__asp_never__', timeout: ms }, optional: true }`. Task 3 confirms that the
    `optional` placement works in 2.6.1.
  - `stepCommands(step: Step, point?: { x, y }): object[]`. `Step` is one of:
    - `{ open, wait?, mark? }`
    - `{ tap: { id } | { text } | { point: "x%,y%" }, wait?, mark? }`
    - `{ swipe: { from: "x%,y%", to: "x%,y%", ms? }, wait?, mark? }`
    - `{ type: string, wait?, mark? }`
    - `{ wait }`
    - `{ shell }` (setup only)

    Each step becomes `openLink`, `tapOn: { point }`, `swipe`, `inputText`, then `waitForAnimationToEnd`, then
    `sleep(wait*1000)` when `wait` is set.
  - `parseHierarchy(json): Node[]`. A `Node` is `{ id, text, label, x, y, w, h }`, with every number a fraction (0–1) of the
    root bounds. It parses Maestro's `bounds` string `"[x1,y1][x2,y2]"`.
  - `findElement(nodes, { id } | { text }): Node | null`.
    - `id` matches `resource-id` exactly.
    - `text` matches the trimmed `text` or `accessibilityText`.
    - The first match with a non-zero area wins.
  - `systemAlert(nodes): string | null`. It looks for buttons among `Allow`, `Don't Allow`, `Don’t Allow`, `Allow Once`,
    `Allow While Using App`, `Allow Full Access` and `Allow Notifications`.
  - `readCommands(dir): Cmd[]`.
    - It reads every `commands-*.json`, sorts by `metadata.sequenceNumber`, and drops `defineVariablesCommand` and
      `applyConfigurationCommand`.
    - `kind` is `open`, `tap`, `swipe`, `type` or `wait`, taken from the command key.
    - `step` is the index into the recorder's step list, which comes from the order of the non-wait commands.

- [ ] **Step 1: Write the failing tests**

```js
test('flowYaml quotes values and starts with appId', () => {
  const y = flowYaml('ai.x.app', [{ openLink: 'x://a?b=1' }, 'waitForAnimationToEnd', { tapOn: { point: '86%,41%' } }]);
  assert.match(y, /^appId: "ai\.x\.app"\n---\n/);
  assert.match(y, /- openLink: "x:\/\/a\?b=1"/); assert.match(y, /point: "86%,41%"/);
});
test('stepCommands: tap by id uses the resolved point, then waits', () => {
  assert.deepEqual(stepCommands({ tap: { id: 'set-done-4-0' }, wait: 2 }, { x: 0.86, y: 0.41 }),
    [{ tapOn: { point: '86%,41%' } }, 'waitForAnimationToEnd', sleep(2000)]);
});
test('parseHierarchy + findElement on the real fixture', () => { /* assert a known id from the fixture resolves to fractions within [0,1] */ });
test('systemAlert finds an Allow button', () => {
  assert.equal(systemAlert([{ text: 'Allow', id: '', label: '', x: 0.5, y: 0.6, w: 0.2, h: 0.05 }]), 'Allow');
  assert.equal(systemAlert([{ text: 'Start', id: '', label: '', x: 0.5, y: 0.6, w: 0.2, h: 0.05 }]), null);
});
test('readCommands sorts by sequence and drops config commands', () => {
  const c = readCommands('test/fixtures/maestro');
  assert.ok(c.length > 0 && c.every((x, i) => i === 0 || x.seq > c[i - 1].seq));
  assert.ok(c.every((x) => ['open', 'tap', 'swipe', 'type', 'wait'].includes(x.kind)));
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/maestro.test.mjs`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement `scripts/maestro.mjs`** with the signatures above. Percentages are rounded to one decimal.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/maestro.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/maestro.mjs test/maestro.test.mjs test/fixtures/maestro
git commit -m "feat(record): Maestro flow, hierarchy and command helpers"
```

---

### Task 3: Recorder CLI and alignment spike

**Files:**
- Create: `scripts/record.mjs`
- Modify: `package.json`. Add the script `"record": "node scripts/record.mjs"`.
- Modify: `docs/superpowers/specs/2026-10-30-real-footage-previews-design.md`. In "Resolved 6", `open` steps now use Maestro
  `openLink` inside the take.
- Test: `test/record.test.mjs`

**Interfaces:**
- Consumes:
  - Task 1: `frameDiffs`, `alignCommands`.
  - Task 2: `checkMaestro`, `flowYaml`, `stepCommands`, `parseHierarchy`, `findElement`, `systemAlert`, `readCommands`.
  - `video.mjs`: `findFfmpeg`, `probeClip`, `extractClip`, `filmstrip`.
- Produces:
  - **CLI:** `node scripts/record.mjs <config> --preview <id> [--udid U] [--locales a,b] [--takes 3]`
  - **Exported for tests:**
    - `validateRecord(record): string[]`. Errors when:
      - `steps` is missing or empty;
      - `steps[0]` is not an `open`;
      - a step has an unknown key;
      - a `mark` is duplicated;
      - a `shell` step appears outside `setup`.
    - `substitute(str, { udid, locale, appLocale }): string`
    - `writeTake(dir: string, id: string, files: { mov, taps, sheet }): void`. It is atomic: it renames the new files over
      the old ones only once all three exist, and otherwise leaves the old ones untouched.
    - `deviceClass(width, height): 'iphone' | 'ipad'`. It returns `'iphone'` when `h/w > 1.9`.
    - `buildSidecar({ fps, width, height, device, locale, offsetMs, events, steps, takes }): object`. This is the spec's
      sidecar schema.
      - `marks[name]` is the `t` of the step that carries that `mark`.
      - `syncOffset` is `offsetMs/1000`, measured relative to the start of the recorder.

- [ ] **Step 1: Write the failing tests**

```js
test('validateRecord: first step must open', () => {
  assert.match(validateRecord({ steps: [{ tap: { id: 'a' } }] }).join(), /first step must be an "open"/);
  assert.deepEqual(validateRecord({ steps: [{ open: 'x://a', mark: 'a' }, { tap: { text: 'Go' }, mark: 'b' }] }), []);
  assert.match(validateRecord({ steps: [{ open: 'x://a', mark: 'a' }, { wait: 1, mark: 'a' }] }).join(), /mark "a" used twice/);
});
test('substitute fills udid, locale, appLocale', () =>
  assert.equal(substitute('s.sh {udid} {locale} {appLocale}', { udid: 'U', locale: 'en-US', appLocale: 'en-SG' }), 's.sh U en-US en-SG'));
test('writeTake keeps the previous take when a file is missing', () => {
  // dir with old loop.mov/.taps.json/.sheet.jpg; call writeTake with taps missing -> throws, old files byte-identical
});
test('buildSidecar: marks come from the marked steps, version 1', () => { /* events with step 0 t=0.4, step 1 t=3.2 */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/record.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `scripts/record.mjs`**

**Before recording**, in order:
1. Load the config and the preview's `record`, and run `validateRecord`.
2. Run `checkMaestro`.
3. Pick the UDID from `--udid`, or else the single booted device in `xcrun simctl list devices booted -j`. Zero or several
   booted devices without `--udid` is an ERROR that lists them.
4. Check the app is installed with `simctl get_app_container <udid> <record.app>`.
5. Run `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`, and print a NOTE that Simulator may
   need a restart for it to apply.

**Per locale:**
1. **Setup.** Run the `setup` shell steps with `substitute`.
2. **Status bar override.** Apply the same flags as reading-the-app.md §2.
3. **Rehearsal.** For each step:
   - Read the hierarchy and check `systemAlert`. An alert is an ERROR: `a system alert "Allow" is on screen at step N — grant or turn off the permission first`.
   - For `tap` by `id` or `text`, resolve the point with `findElement`. A missing element is an ERROR that names the step.
   - Run the step as a one-step flow: `maestro --udid U test <tmp>.yaml`.
4. **Take.** Repeat up to `--takes` times (default 1):
   1. Spawn `xcrun simctl io U recordVideo --codec=h264 --force <tmp>/raw.mov`, and wait for `Recording started` on stderr,
      with a 3 s timeout.
   2. Run `maestro --udid U test --debug-output <tmp>/dbg <tmp>/take.yaml`, built from `stepCommands` with the resolved
      points.
   3. Stop the recorder with `kill('SIGINT')` and wait for it to exit.
   4. Extract the frames with `extractClip(ffmpeg, { file, height: 480, dir })`.
   5. Run `frameDiffs`, `readCommands(<tmp>/dbg)` and `alignCommands`.
   6. **Retry when** a step failed (the Maestro exit code is not 0), or when more than half the taps came back `window`.
5. **Write the best take.**
   - The contact sheet is `filmstrip` over one frame per second.
   - Write the files with `writeTake` into `recordings/<locale>/`.
   - Print a NOTE for each `window` tap.
   - Clean up the temporary folder.

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `node --test test/record.test.mjs`
Expected: PASS.

- [ ] **Step 5: Alignment spike (manual checkpoint, owner's machine)**

Boot the AptusFIT simulator with Metro on :8081 and the persona seeded, as the prerequisites of
`marketing/store-screenshots/capture.sh` describe. **Ask the owner to start Metro if it isn't running.** Then add a
temporary config `/tmp/asp-spike/spike.config.json` with this preview `record`:

```json
{ "app": "ai.aptusfit.app",
  "steps": [ { "open": "exp+aptusfit-monorepo://marketing?action=session", "wait": 8, "mark": "start" },
             { "tap": { "id": "set-done-4-0" }, "wait": 3, "mark": "log" } ] }
```

Run: `node scripts/record.mjs /tmp/asp-spike/spike.config.json --preview spike --locales en-US`

Expected:
- `recordings/en-US/spike.mov`, `.taps.json` and `.sheet.jpg` exist.
- The `log` tap has `align: "frame"`.
- Opening the `.mov` at `t` and `t + 1/30` shows the check filling only on the second of those frames.

Then:
- **Tune `SYNC_MAD` and `REACT_MAD`** if needed, and record the values and why in a comment in `align.mjs`. Task 5 copies
  them to `motion.md`.
- **Confirm in 2.6.1** that `openLink` shows no "Open in…?" dialog, and that the `sleep()` form waits the full time. If a
  dialog appears, add `{ tapOn: { text: 'Open' }, optional: true }` after `openLink` in `stepCommands`, and add a test for it.

- [ ] **Step 6: Commit**

```bash
git add scripts/record.mjs test/record.test.mjs package.json ../../docs/superpowers/specs/2026-10-30-real-footage-previews-design.md scripts/align.mjs scripts/maestro.mjs
git commit -m "feat(record): record.mjs drives the simulator and writes a tap sidecar"
```

---

### Task 4: Concept catalog and recommendation

**Files:**
- Create: `scripts/concepts.mjs`
- Create: `scripts/recommend.mjs`
- Create: `evals/files/fitness-brief.json`, `evals/files/budget-brief.json`, `evals/files/fitness-avoid-paywall-brief.json`
- Modify: `package.json`. Add the script `"recommend": "node scripts/recommend.mjs"`.
- Test: `test/recommend.test.mjs`

**Interfaces:**
- Produces:
  - `SIGNALS: string[]`. Exactly these: `ai-stream chat search recommendations timer live-update sheet progress charts
    counter streak map camera scan media social watch-app tablet-app desktop-app daily-habit replaces-chore speed
    many-features single-magic onboarding paywall`.
  - `CATEGORIES: string[]`. Exactly these: `fitness health finance ai productivity social education travel shopping games
    utilities media food`.
  - `CONCEPTS: Concept[]`, where `Concept` is
    `{ id, name, hook, requires: string[], useWhen: Record<signal, number>, avoidWhen: string[], categories: string[], bold: boolean, phase: 1|2, beats: { kind: 'hook'|'beat'|'end', sec: number }[] }`.
    The data is in the table below.
  - `validateBrief(brief): string[]`
  - `recommend(brief): { picks: Pick[], excluded: { id, reason }[], notes: string[] }`, where `Pick` is
    `{ id, name, role: 'safe'|'strongest'|'bold', hook, score, beats: { kind, sec, moment: string|null }[], risks: string[], reasons: { source: 'code'|'owner'|'kb', text, ref }[] }`.
    Picks are ordered safe, strongest, bold.
  - CLI: `node scripts/recommend.mjs <brief.json> [--json]`. It prints the 3 picks, the excluded concepts and the notes.
    Exit codes: 1 for brief errors, 0 otherwise.

**Concept data.** Beat seconds sum to 15 in each concept.

| id | hook | requires (any) | useWhen | avoidWhen | categories | bold | phase | beats (s) |
|---|---|---|---|---|---|---|---|---|
| hero-moment | demo | single-magic, ai-stream, scan, camera | single-magic 3, ai-stream 2, scan 2, camera 2, live-update 1 | many-features | ai, utilities, productivity | no | 1 | hook 2, beat 8, beat 3, end 2 |
| feature-loop | demo | live-update, sheet, timer, counter | daily-habit 3, live-update 2, timer 2, sheet 1, counter 1, progress 1 | — | fitness, health, productivity, finance, food | no | 1 | hook 2, beat 3.5, beat 3.5, beat 4, end 2 |
| ask-answer | question | ai-stream, chat, search, recommendations | ai-stream 3, chat 2, search 2, recommendations 2 | — | ai, fitness, education, travel, shopping | no | 1 | hook 2, beat 8, beat 3, end 2 |
| before-after | contrast | replaces-chore | replaces-chore 3, speed 1, charts 1 | — | finance, productivity, utilities, health | yes | 1 | hook 2, beat 4, beat 5, beat 2, end 2 |
| speedrun | bold-claim | speed, onboarding | speed 3, onboarding 2, replaces-chore 1 | — | utilities, travel, shopping, finance | yes | 1 | hook 2, beat 9, beat 2, end 2 |
| results-first | outcome | progress, charts, streak, counter | progress 3, charts 2, streak 2, counter 1 | — | fitness, health, finance, education | no | 1 | hook 3, beat 4, beat 4, beat 2, end 2 |
| day-in-life | demo | daily-habit | daily-habit 3, timer 1, progress 1 | — | health, fitness, productivity, food | no | 1 | hook 2, beat 3.5, beat 3.5, beat 4, end 2 |
| multi-device | demo | watch-app, tablet-app, desktop-app | watch-app 3, tablet-app 2, desktop-app 2 | — | fitness, health, productivity | yes | 2 | — |
| bento | proof | many-features | many-features 3 | single-magic | productivity, utilities, finance | yes | 2 | — |
| cinematic | pattern-interrupt | — | — | — | (all) | yes | 2 | — |
| type-led | bold-claim | — | — (base score 1) | — | social, games, media | yes | 1 | hook 2, beat 4, beat 4, beat 3, end 2 |

**Algorithm.** The rules are pinned by the tests.

1. **Exclusions:**
   - phase 2 concepts: `needs Phase 2 (cinematic renderer)`;
   - a missing `requires` signal;
   - an `avoidWhen` signal that is present.
2. **Moments.** Moments named in `mustAvoid`, by id or by any of their signals, are removed first.
3. **Score.** Let S be the app signals plus all moment signals.
   - Add `useWhen[s]` for each s in S.
   - +2 if `app.category` is in the concept's `categories`.
   - +3 if a picked moment is in `mustShow`.
   - +0.5 for each picked moment with `automatable: true`, −0.5 for each with `"network"`, −2 for each with `false`.
   - +1 for `bold` concepts when `owner.channels` includes `social`.
4. **Moment picking for a concept.**
   - Rank the moments by the sum of `useWhen` over their signals. Ties go to `mustShow` moments, then to brief order.
   - Assign them in order to the non-end beats. When moments run out, the last moment absorbs the remaining beats.
5. **Roles:**
   - **strongest:** the best-scored concept that picks a `mustShow` moment when `mustShow` is non-empty, otherwise the top score.
   - **safe:** the best remaining concept whose picked moments are all `automatable: true` and whose hook differs from
     strongest's. If none exists, drop the hook rule.
   - **bold:** the best remaining `bold` concept whose hook differs from both. Then drop the hook rule. Then take any
     remaining concept.
   - Ties keep catalog order.
6. **Risks:**
   - `moment "coach" varies per take (network)`;
   - `moment "x" needs a human or a device`;
   - `moment "x" is 20s but its beat is 3.5s — even at 4× it needs trimming` (when `seconds > beat.sec * 4`).
7. **Reasons:**
   - `code`, per matched signal: `ref: "signals.<s>"`;
   - `owner`, for mustShow, channels and tone: `ref: "owner.mustShow"`;
   - `kb`, for the category: `ref: "categories.md#<category>"`, and for the concept: `ref: "concepts.md#<id>"`.
8. **Notes:**
   - `owner context not confirmed yet — confirm it with the owner before showing these` when `owner.confirmed !== true`;
   - `only N concepts fit` when fewer than 3 are picked.

`validateBrief` errors:
- `app.name` is missing;
- the category is not in `CATEGORIES`;
- an unknown signal, in the app or in a moment;
- a duplicate moment id;
- `automatable` is not one of `true`, `false` or `"network"`;
- a `mustShow` id that is not a moment.

- [ ] **Step 1: Write the fixture briefs and the failing tests**

- `fitness-brief.json` is the spec's AptusFIT brief.
  - Moments:
    - `log-set` [live-update, timer], automatable `true`, 4 s;
    - `swap` [sheet], `true`, 3 s;
    - `progress` [progress, counter], `true`, 3 s;
    - `coach` [ai-stream], `"network"`, 20 s;
    - `paywall` [paywall], `true`, 3 s.
  - `mustShow: ["coach"]`, channels `["app-store"]`.
- `budget-brief.json`:
  - category `finance`;
  - signals `charts`, `replaces-chore`, `progress`;
  - moments `scan-receipt` [replaces-chore], `budget-chart` [charts, progress], `monthly` [progress];
  - no `mustShow`.
- `fitness-avoid-paywall-brief.json` is the fitness brief with `mustAvoid: ["paywall"]`.

```js
test('fitness: feature-loop is safe, ask-answer is strongest (must-show coach), 3 picks with 3 hooks', () => {
  const r = recommend(load('fitness-brief.json'));
  assert.deepEqual(r.picks.map((p) => [p.role, p.id]).slice(0, 2), [['safe', 'feature-loop'], ['strongest', 'ask-answer']]);
  assert.equal(new Set(r.picks.map((p) => p.hook)).size, r.picks.length);
  assert.ok(r.picks.find((p) => p.id === 'ask-answer').beats.some((b) => b.moment === 'coach'));
  assert.ok(r.excluded.some((e) => e.id === 'multi-device' && /Phase 2/.test(e.reason)));
});
test('budget: no ask-answer; before-after or results-first picked', () => {
  const ids = recommend(load('budget-brief.json')).picks.map((p) => p.id);
  assert.ok(!ids.includes('ask-answer')); assert.ok(ids.includes('before-after') || ids.includes('results-first'));
});
test('mustAvoid paywall: no pick uses the paywall moment', () => {
  const r = recommend(load('fitness-avoid-paywall-brief.json'));
  assert.ok(r.picks.every((p) => p.beats.every((b) => b.moment !== 'paywall')));
});
test('every pick has code, owner or kb reasons and beats summing to 15s', () => { /* sum(sec) === 15 */ });
test('validateBrief rejects unknown signals and unknown mustShow', () => { /* two assertions with the exact messages */ });
test('unconfirmed owner context adds a note', () => { /* owner.confirmed false -> notes[0] matches /not confirmed/ */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/recommend.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `scripts/concepts.mjs`** (data plus `validateBrief` and `recommend`) **and `scripts/recommend.mjs`** (CLI).
  Each weight gets a short comment pointing to its `concepts.md` entry.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/recommend.test.mjs && node scripts/recommend.mjs evals/files/fitness-brief.json`
Expected: PASS. The CLI prints 3 picks: feature-loop (safe), ask-answer (strongest) and one bold pick.

- [ ] **Step 5: Commit**

```bash
git add scripts/concepts.mjs scripts/recommend.mjs evals/files test/recommend.test.mjs package.json
git commit -m "feat(recommend): concept catalog and brief-driven recommendation"
```

---

### Task 5: Knowledge base

**Files:**
- Create: `references/video/store-rules.md`, `concepts.md`, `motion.md`, `categories.md` and `sources.md`
- Test: `test/kb.test.mjs`

**Interfaces:**
- Consumes: `CONCEPTS`, `SIGNALS` and `CATEGORIES` from Task 4. `SYNC_MAD` and `REACT_MAD` from Task 1 (as tuned in Task 3).
- Produces: the files the spec's §1 table describes. Later tasks cite them by anchor:
  - `motion.md#tap-effects`
  - `motion.md#kinetic-captions`
  - `motion.md#speed-ramps`
  - `motion.md#detection-thresholds`
  - `store-rules.md#<check-name>`, with the check names from Task 10
  - `concepts.md#<id>`
  - `categories.md#<category>`

- [ ] **Step 1: Write the failing consistency test**

```js
test('concepts.md has a section per concept id and lists every signal', () => {
  const md = read('references/video/concepts.md');
  for (const c of CONCEPTS) assert.match(md, new RegExp(`^## .*\\{#${c.id}\\}|^## ${c.id}\\b`, 'm'));
  for (const s of SIGNALS) assert.ok(md.includes(`\`${s}\``), s);
});
test('categories.md has a section per category', () => { /* same for CATEGORIES */ });
test('store-rules.md: every row has a URL, a verified_on date and verified|reported', () => {
  const rows = read('references/video/store-rules.md').split('\n').filter((l) => /^\| [a-z-]+ \|/.test(l));
  assert.ok(rows.length >= 15);
  for (const r of rows) { assert.match(r, /https?:\/\//); assert.match(r, /20\d\d-\d\d-\d\d/); assert.match(r, /\b(verified|reported)\b/); }
});
test('sources.md lists the untraceable stats under "Not used"', () => assert.match(read('references/video/sources.md'), /## Not used[\s\S]*78%/));
test('files over 100 lines start with a table of contents', () => { /* "## Contents" in the first 15 lines */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/kb.test.mjs`
Expected: FAIL. ENOENT.

- [ ] **Step 3: Write the five files from the research notes**

Write them from `docs/superpowers/research/2026-10-30-real-footage-previews.md`, sections 1–9.

- **Verification.** Re-fetch every Apple and Google URL, and set `verified_on` to the fetch date. [R] and [O] items stay
  `reported`.
- **`motion.md`** carries every constant from Global Constraints, the tuned detection thresholds, and the "feedback fixes"
  table (owner says "too fast" → scale the stagger and ripple by 1.3; "too slow" → by 0.75; "can't read it" → raise the
  hold to the reading-time rule).
- **`store-rules.md`** lists, per row:
  - rule;
  - store;
  - source;
  - `verified_on`;
  - status;
  - enforcing check: one of Task 10's names, `existing: duration`, or `agent QA`.
- **`concepts.md`** follows the spec's §1 table, plus the signal vocabulary and a worked AptusFIT example.

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/kb.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add references/video test/kb.test.mjs
git commit -m "docs(kb): video knowledge base with sources"
```

---

### Task 6: Layouts `full-screen`, `caption-band` and `end-card`

**Files:**
- Modify: `scripts/layouts.mjs`, inside the `buildLayout` switch. Also add the three names to `LAYOUTS` and to the layout
  descriptions table at the top of the file.
- Modify: `scripts/render.mjs`:
  - `slideElements` passes `cfg.app.icon` and `cfg.app.name` into the slide as `appIcon` and `appName` for `end-card`;
  - `resolvePreviews` adds the aspect check for `full-screen` and `caption-band`.
- Test: `test/layouts.test.mjs`

**Interfaces:**
- Produces:
  - **`full-screen`** returns:
    - `[device, scrim, caption]`;
    - `device = { type:'device', id:'device', model:'none', style:'frameless', radius:0, shadow:false, x:50, y:0, w:100 }`;
    - a scrim element `{ id:'scrim' }` covering the top 22%, or the bottom 22% when `slide.caption?.position === 'bottom'`,
      with a gradient from the theme background at 70% alpha to transparent;
    - a caption inside the scrim, below the status bar (top 6% kept clear).
  - **`caption-band`** returns `[band, caption, device]`:
    - the band is the top 18% (bottom when `caption.position === 'bottom'`), in the theme background;
    - the device is the same frameless `none` device, fitted with `fitWidth` into the remaining 82% and centered.
  - **`end-card`** returns:
    - an `image` element (`appIcon`, `x:50, y:30, w:22`, rounded);
    - a `text` element (`appName`, `y:46`, size 7, weight 800);
    - the caption (`title` as the tagline, `y:55, h:12`);
    - a `text` element (`subtitle`, `y:72`, size 3, opacity 0.8);
    - no device.

    Without `appIcon`, the name moves up to `y:36` and render adds the NOTE
    `end-card "<id>": no app.icon in the config — showing the name only`.
  - `screenAspectError(layout, clipW, clipH, W, H): string | null`. Exported from `layouts.mjs`. It implements the
    Global Constraints aspect rule and returns the exact messages:
    - `screen 1206×2622 does not fit full-screen on 1200×1600 (aspect off by 37%) — use caption-band or record on the matching device`
    - `caption-band: the screen is only 62% of the canvas width`

- [ ] **Step 1: Write the failing tests**

```js
const ctx = { W: 886, H: 1920, theme: {}, target: { id: 'preview-iphone', store: 'ios', model: 'iphone' } };
test('full-screen: frameless none device fills the canvas, caption below the status bar', () => {
  const els = buildLayout({ id: 's', layout: 'full-screen', title: 'x', screen: 'a.png' }, ctx);
  assert.deepEqual(pick(els.find((e) => e.id === 'device'), ['model', 'style', 'radius', 'x', 'y', 'w']), { model: 'none', style: 'frameless', radius: 0, x: 50, y: 0, w: 100 });
  assert.ok(els.find((e) => e.type === 'caption').y >= 6);
});
test('caption-band bottom puts the band below the screen', () => { /* band.y >= 82, device.y === 0 */ });
test('end-card has no device; icon above name', () => { /* no type device; image.y < appName text.y */ });
test('screenAspectError: 2% rule and band width rule', () => {
  assert.equal(screenAspectError('full-screen', 1206, 2622, 886, 1920), null);
  assert.match(screenAspectError('full-screen', 1206, 2622, 1200, 1600), /use caption-band/);
  assert.match(screenAspectError('caption-band', 1206, 2622, 1200, 1600), /only \d+% of the canvas width/);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/layouts.test.mjs`
Expected: FAIL. `Unknown layout "full-screen"`.

- [ ] **Step 3: Implement the layouts and the aspect check, and wire them into `render.mjs`**

The scrim and band use the existing `shape` element if it accepts a CSS background. Otherwise add a `band`-style element
with the gradient, as `case 'band'` at render.mjs:394 does.

- [ ] **Step 4: Run the tests, then a visual check**

Run: `node --test test/layouts.test.mjs`
Expected: PASS.

Then render one full-screen still, to confirm there is no hidden inset:
`node scripts/render.mjs examples/preview/clip.config.json --only-previews`, with the scene's layout temporarily set to
`full-screen`. The corner pixels of `out/_preview` frame 0 must be the clip's pixels, not the background. Revert the
temporary edit afterwards.

- [ ] **Step 5: Commit**

```bash
git add scripts/layouts.mjs scripts/render.mjs test/layouts.test.mjs
git commit -m "feat(layouts): full-screen, caption-band and end-card"
```

---

### Task 7: Kinetic captions

**Files:**
- Create: `scripts/kinetic.mjs`
- Modify: `scripts/video.mjs`:
  - `buildTimeline` takes `captionMotion` and `words` per scene;
  - `stateAt` adds `caption.units` and `caption.pop`.
- Modify: `scripts/render.mjs`:
  - `captionHtml` wraps title words when `el.motion` is set;
  - `resolvePreviews` sets `scene.captionMotion`, with Decision 2's scene-1 rule, and counts the words;
  - `applyState` applies `units` and `pop`.
- Test: `test/kinetic.test.mjs`, plus additions to `test/video.test.mjs`

**Interfaces:**
- Produces:
  - `splitWords(text: string): { word: string, hl: boolean }[]`.
    - It keeps the `**highlight**` state across words.
    - Text without spaces (ja, zh, th) is a single unit.
  - `wordsHtml(units, richFn): string`. Each unit is
    `<span class="kw" style="display:inline-block;overflow:hidden;vertical-align:bottom"><span class="kwi" style="display:inline-block">…</span></span>`,
    and units are joined with a single space text node.
  - `unitProgress(kind, t, n): number[]`.
    - `words`: per word, `ease((t - 0.07*i)/0.45)`.
    - `lines`: n is the word count. It returns per-index values with a 0.12 stagger, and the page maps each line to its index.
    - The ease is `1 - 2^(-10p)`, clamped.
  - `popValue(t): { scale, opacity }`. A closed-form underdamped spring with ζ = 0.8 and ω0 = 10.
  - `motionLength(kind, n): number`. This is when the last unit finishes. `stateAt` clamps the caption time to it, so rest
    frames stay identical.
  - **The `stateAt` scene shape** gains `caption.units: number[]` (empty for `rise`/`none`) and `caption.pop` (null unless `pop`).
  - **Theme default:** `theme.video.captionMotion` defaults to `rise`.

- [ ] **Step 1: Write the failing tests**

```js
test('splitWords keeps highlight state across words', () =>
  assert.deepEqual(splitWords('Swap in **one tap**'), [{ word: 'Swap', hl: false }, { word: 'in', hl: false }, { word: 'one', hl: true }, { word: 'tap', hl: true }]));
test('text without spaces is one unit (ja)', () => assert.equal(splitWords('ワンタップで入れ替え').length, 1));
test('words: 70 ms stagger, done at 0.07*(n-1)+0.45', () => {
  const p = unitProgress('words', 0.1, 3);
  assert.ok(p[0] > p[1] && p[1] > p[2]); assert.equal(+motionLength('words', 3).toFixed(3), 0.59);
  assert.deepEqual(unitProgress('words', 0.59, 3).map((x) => +x.toFixed(2)), [1, 1, 1]);
});
test('pop settles to scale 1 and opacity 1', () => { const v = popValue(1); assert.ok(Math.abs(v.scale - 1) < 0.01 && v.opacity === 1); });
// video.test.mjs
test('scene 1 keeps a complete caption at frame 0 unless it sets captionMotion itself', () => { /* units all 1 at t=0 */ });
test('caption units freeze after motionLength (rest frames compare equal)', () => { /* sameState(stateAt(t1), stateAt(t2)) */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/kinetic.test.mjs test/video.test.mjs`
Expected: FAIL for the new tests. The existing tests still pass.

- [ ] **Step 3: Implement**

- **Kinetic units start** at the caption's entrance start, which is `a + delay` in `stateAt`.
- **During kinetic motion,** the caption's own opacity is 1 and its `dy` is 0.
- **Eyebrow and subtitle** fade in with the last unit.
- **In `applyState`:**
  - set `.kwi` `transform: translateY(${(1-p)*110}%)` by index;
  - for `lines`, group the `.kw` elements by `offsetTop` and use the group index;
  - for `pop`, set the `.fit-inner` scale and opacity.

- [ ] **Step 4: Run to verify pass, and check line breaks**

Run: `node --test test/kinetic.test.mjs test/video.test.mjs`
Expected: PASS.

Render `examples/preview/preview.config.json --only-previews --locales en-US,ja --targets preview-iphone --scenes <first two>`
with `captionMotion: "words"` on scene 2 (temporarily). In the filmstrip, the scene 2 caption's line breaks must match a
`rise` render. Revert the temporary edit.

- [ ] **Step 5: Commit**

```bash
git add scripts/kinetic.mjs scripts/video.mjs scripts/render.mjs test/kinetic.test.mjs test/video.test.mjs
git commit -m "feat(video): kinetic captions (words, lines, pop)"
```

---

### Task 8: Speed ramps and the frame map

**Files:**
- Create: `scripts/ramp.mjs`
- Modify: `scripts/video.mjs`:
  - `buildTimeline` keeps `clip.map`;
  - `stateAt` gets its frame index from the map.
- Modify: `scripts/render.mjs`:
  - `resolvePreviews` always extracts at 1× (`speed` stays in `clipKey` as `1`);
  - compute the diffs once per extraction, cached as `diffs.json` in the clip folder;
  - build the map;
  - derive or fit the scene duration;
  - the "last frame holds" warning compares `map.length / fps`.
- Test: `test/ramp.test.mjs`, plus additions to `test/video.test.mjs`

**Interfaces:**
- Consumes: `frameDiffs` (Task 1).
- Produces:
  - `IDLE_MAD`, a starting value of 1.5, tuned on `walk.mp4` and AptusFIT and documented in `motion.md#detection-thresholds`.
  - `idleRuns(diffs, fps, { threshold = IDLE_MAD, minSec = 0.5 } = {}): [from, to][]`. Source frame ranges, `to` exclusive.
  - `rateCurve(n, fps, { idle, taps = [], max = 4, edgeSec = 0.3, before = 0.4, after = 0.8 }): Float64Array`. `taps` are
    source frame indices.
  - `frameMap(rate: Float64Array): Int32Array`. The source frame shown at each output frame. It is monotone and ends when
    the source position reaches n.
  - `linearMap(n: number, speed: number): Int32Array`
  - `fitMap(diffs, fps, { taps, targetFrames, idle }): { map: Int32Array, max: number }`.
    - It binary-searches `max` in [1, 4] for the smallest value whose map fits.
    - It throws `clip span is 9.0s at 4× but scene "log" lasts 2.0s` when even 4× doesn't fit.
    - At `max = 1` it may be shorter than the target, and the caller adds the "last frame holds" WARN.
  - `outputFrame(map, srcFrame): number`. The first output index whose source is at or after `srcFrame`.
  - **The `stateAt` frame rule:** `frame = map[min(map.length - 1, floor((t - start) * fps))]` when `clip.map` exists.
    Otherwise the old formula.

- [ ] **Step 1: Write the failing tests**

```js
const fps = 30;
const quietThenBusy = Float64Array.from({ length: 300 }, (_, i) => (i < 150 ? 0.2 : 5));   // 5 s idle, 5 s active
test('idleRuns finds stretches ≥ 0.5 s', () => assert.deepEqual(idleRuns(quietThenBusy, fps), [[1, 150]]));
test('rateCurve: 4× deep in idle, 1× when active, 1× around taps, bounded slope', () => {
  const r = rateCurve(300, fps, { idle: [[1, 150]], taps: [60] });
  assert.equal(r[200], 1); assert.equal(r[120], 4);
  for (let i = 60 - 12; i <= 60 + 24; i++) assert.equal(r[i], 1);                         // 0.4 s before, 0.8 s after
  for (let i = 1; i < 300; i++) assert.ok(Math.abs(r[i] - r[i - 1]) <= 3 / 9 + 1e-9);       // 0.3 s edge = 9 frames
});
test('frameMap is monotone and shorter than the source when ramped', () => { /* every map[k] >= map[k-1], length < 300 */ });
test('whole span idle: fits at 4×; too long at 4× throws with both lengths', () => {
  const idle = new Float64Array(300).fill(0.1);
  assert.ok(fitMap(idle, fps, { targetFrames: 90, idle: idleRuns(idle, fps) }).max <= 4);
  assert.throws(() => fitMap(new Float64Array(300).fill(5), fps, { targetFrames: 60, idle: [] }), /10\.0s at 4× but scene/);
});
test('outputFrame inverts the map', () => { /* map from linearMap(90, 2): outputFrame(map, 40) === 20 */ });
// video.test.mjs
test('stateAt uses clip.map when present', () => { /* map [0,0,5,9]: frame at t=2/30 is 5 */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/ramp.test.mjs test/video.test.mjs`
Expected: FAIL for the new tests.

- [ ] **Step 3: Implement `scripts/ramp.mjs` and wire it into `resolvePreviews`**

How the scene duration is set:
- `speed: "auto"` without `duration`: the scene lasts `map.length / fps`.
- `speed: "auto"` with `duration`: use `fitMap`.
- A number: use `linearMap`.

A `fitMap` error becomes `errors.push('[tag/scene] …')`.

- [ ] **Step 4: Run all the unit tests and the clip example**

Run: `npm run test:unit && node scripts/render.mjs examples/preview/clip.config.json --only-previews`
Expected:
- all tests pass;
- the clip example renders exactly as before, because without `speed` the map is linear at 1×;
- the exit code is 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/ramp.mjs scripts/video.mjs scripts/render.mjs test/ramp.test.mjs test/video.test.mjs
git commit -m "feat(video): speed ramps through idle stretches via a source-frame map"
```

---

### Task 9: Sidecar, marks and tap effects

**Files:**
- Create: `scripts/taps.mjs`
- Modify: `scripts/video.mjs`:
  - `buildTimeline` carries `scene.taps` and `tapStyle`;
  - `stateAt` adds `taps: number[]` (progress 0–1, or −1 when inactive).
- Modify: `scripts/render.mjs`:
  - `resolvePreviews` handles `clip.from`/`clip.to`;
  - the sidecar is read and validated;
  - tap events are passed to `rateCurve` as protected frames and mapped to output time;
  - tap colors are chosen;
  - `sceneHtml` adds a tap overlay over the device's `screenRect`, with one child per tap;
  - `applyState` draws the taps.
- Test: `test/taps.test.mjs`, plus additions to `test/video.test.mjs`

**Interfaces:**
- Consumes:
  - Task 8: `rateCurve` (its `taps` parameter), `outputFrame`.
  - Task 3: the sidecar schema.
- Produces:
  - `sidecarPath(mov): string`
  - `readSidecar(mov): object | null`. Returns null when the sidecar is absent. Throws `invalid sidecar <path>: …` when
    the sidecar is invalid.
  - `validateSidecar(o): string[]`
  - `markSpan(sidecar, from, to, fileDuration): { start, end }`. It throws:
    - `unknown mark "x" (marks: start, log, swap)`;
    - `mark "to" (3.2s) is not after "from" (8.9s)`.

    When `to` is missing, the span ends at the next mark in time, or at the end of the file.
  - `tapsInSpan(sidecar, start, end): { srcT, x, y, kind, x2?, y2?, dur?, align }[]`. `type` events are skipped.
  - `TAP_FX`:
    - `{ ripple: { dur: 0.6, r0: 0.03, r1: 0.12, a0: 0.5 }`
    - `ring: { dur: 0.6, stroke: 3 }`
    - `spotlight: { in: 0.2, hold: 0.6, out: 0.3, radius: 0.18, dim: 0.25 }`
    - `swipe: { extra: 0.3 } }`
  - `tapProgress(at: number, t: number, kind, style): number`. Returns 0–1 while active, otherwise −1.
  - `tapColor(frameFile, x, y, accent): Promise<string>`. Returns `'#ffffff'` when the mean luminance of the area around
    the tap (10% of the width) is below 128, and `accent` otherwise.
- **Render rules:**
  - Giving both `clip.from`/`to` and `clip.start`/`end` is an ERROR.
  - `from`/`to` without a sidecar is an ERROR: `clip marks need recordings/<locale>/<id>.taps.json — record with record.mjs`.
  - `tap` set without a sidecar: NOTE `taps skipped: no sidecar`.
  - A `window`-aligned tap: NOTE `tap at 7.80s was timed from the command window (may be early or late)`.

- [ ] **Step 1: Write the failing tests**

```js
const sc = { version: 1, fps: 30, width: 1206, height: 2622, events: [
  { t: 3.233, kind: 'tap', x: 0.86, y: 0.41, step: 1, align: 'frame' },
  { t: 3.433, kind: 'tap', x: 0.2, y: 0.5, step: 2, align: 'frame' } ], marks: { start: 1.1, log: 3.2, swap: 8.95 } };
test('markSpan: from..next mark, unknown and reversed marks', () => {
  assert.deepEqual(markSpan(sc, 'log', undefined, 20), { start: 3.2, end: 8.95 });
  assert.throws(() => markSpan(sc, 'nope', undefined, 20), /unknown mark "nope" \(marks: start, log, swap\)/);
  assert.throws(() => markSpan(sc, 'swap', 'log', 20), /is not after/);
});
test('two taps 0.2 s apart are both active at 3.5 s', () => {
  const at = tapsInSpan(sc, 3.2, 8.95).map((e) => e.srcT);
  assert.ok(at.every((a) => tapProgress(a, 0.35, 'tap', 'ripple') >= 0));
});
test('tapProgress is -1 before and after the ripple', () => { assert.equal(tapProgress(1, 0.9, 'tap', 'ripple'), -1); assert.equal(tapProgress(1, 1.61, 'tap', 'ripple'), -1); });
test('validateSidecar flags x outside [0,1] and a missing version', () => { /* two messages */ });
// video.test.mjs
test('stateAt taps array keeps a fixed length; inactive taps are -1', () => { /* sameState across two idle frames */ });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/taps.test.mjs test/video.test.mjs`
Expected: FAIL for the new tests.

- [ ] **Step 3: Implement**

- **Overlay.** The tap overlay is `position:absolute` at the device's `screenRect`, with `overflow:hidden` and the screen's
  border radius.
- **Elements.** Each tap is a `div` sized `r1*2` of the screen width, centered at (x, y).
- **Drawing.** `applyState` sets `transform: scale(r/r1)` and opacity from `p`, using the expo-out easing from Global
  Constraints, written inline in `applyState`, since that function is serialized into the page.
- **Spotlight.** A full-overlay `div` with `background: radial-gradient(circle at x y, transparent R, rgba(0,0,0,dim) R+1px)`.
- **Swipe.** A dot moving from (x, y) to (x2, y2) over `dur`, fading over `extra`.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/taps.mjs scripts/video.mjs scripts/render.mjs test/taps.test.mjs test/video.test.mjs
git commit -m "feat(video): recording marks and tap ripples, rings, spotlights from the sidecar"
```

---

### Task 10: Draft fallback, store and concept checks, and `--check`

**Files:**
- Create: `scripts/storecheck.mjs`
- Modify: `scripts/render.mjs`:
  - **Draft fallback.** A clip `screen` with no file falls back to `scene.draft` (a still) with the draft NOTE. Otherwise it
    is an ERROR: `recording recordings/en-US/loop.mov not found — run: node scripts/record.mjs <config> --preview loop`.
  - **Store checks.** Run every `storecheck` function per job. The caption and label texts are resolved per locale.
  - **iPhone-only rule.** Applies to previews with `concept`.
  - **Disclose NOTE.** Read from `preview-brief.json` next to the config, if present.
  - **`--check` flag.** It implies `--only-previews`. After `fitScenes` and the duration and count checks, a job is
    recorded and skipped before the encoder starts. The run prints `checked N previews (no frames captured)`.
  - Add `--check` to the usage line at the top of the file.
- Test: `test/storecheck.test.mjs`

**Interfaces:**
- Consumes: `CONCEPTS` (Task 4) for concept rules, and `motionLength` (Task 7) for caption visible times.
- Produces:
  - **Check names.** `store-rules.md` links to these:
    - `framed-device` (WARN, `preview-*`);
    - `price` (WARN, Apple preview and creative targets);
    - `play-phrases` (WARN, `play-promo`);
    - `time-sensitive` (NOTE, all video targets);
    - `reading-time` (WARN);
    - `hook-timing`, `beat-length` and `end-card` (WARN, previews with `concept`);
    - `iphone-only` (ERROR);
    - `disclose` (NOTE).
  - `framedDevice(target, dev): string | null`. Returns
    `device frames risk rejection under 2.3.4 — use full-screen or caption-band`.
  - `priceMatch(text): string | null`. It matches:
    - a currency symbol next to a digit (`$ € £ ¥ ₩ ₫ ฿ ₹ ₱`, `RM`, `Rp`, `R$`);
    - ISO codes before or after digits;
    - `/month|/mo|/year|/yr|/week`, `/Monat`, `/mois`, `/mes`, `/月`, `/tháng`, `/年`.
  - `timeSensitive(text, locale): string | null`. It matches a 4-digit year from 1990 to 2099, or a month name from
    `Intl.DateTimeFormat(locale, { month: 'long' })` for months 1–12.
  - `playPhrase(text): string | null`. `/\b(install now|download now|best|#1)\b/i`.
  - `readingTime(words): number`. `0.5 + 0.3 * words`.
  - `conceptWarnings(conceptId, timeline, { hookVisibleAt, endCardIds }): string[]`
  - `iphoneOnly(target): string | null`

- [ ] **Step 1: Write the failing tests**

```js
test('price patterns across locales', () => {
  for (const s of ['Just $9.99', '9,99 €/Monat', '¥1,000', '99.000₫/tháng', '月額500円/月']) assert.ok(priceMatch(s), s);
  for (const s of ['Swap in one tap', '12/25 sets', '3 workouts']) assert.equal(priceMatch(s), null, s);
});
test('time-sensitive: year and localized month names', () => {
  assert.ok(timeSensitive('New for 2026', 'en-US')); assert.ok(timeSensitive('Neu im Oktober', 'de'));
  assert.equal(timeSensitive('Train 5 days a week', 'en-US'), null);
});
test('play phrases', () => { assert.ok(playPhrase('The #1 fitness app')); assert.equal(playPhrase('Your coach'), null); });
test('reading time for 6 words is 2.3 s', () => assert.equal(readingTime(6), 2.3));
test('concept warnings: hook after 1.0 s, a 6 s beat in feature-loop, end card 4 s', () => { /* three messages */ });
test('ask-answer allows one 8 s beat, not two', () => { /* one ok, two -> warning */ });
test('iphone-only', () => { assert.equal(iphoneOnly({ id: 'preview-iphone' }), null); assert.match(iphoneOnly({ id: 'preview-ipad' }), /iPhone only in this release/); });
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/storecheck.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `scripts/storecheck.mjs` and the render wiring**

In this step:
- move `examples/preview/preview.config.json`'s Apple preview targets to `layout: "caption-band"` through
  `byTarget.preview-iphone` and `byTarget.preview-ipad`;
- keep the frames on the creative targets;
- run the example once to confirm it has no frame WARN.

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:unit && node scripts/render.mjs examples/preview/preview.config.json --check --locales en-US`
Expected:
- unit tests PASS;
- the `--check` output ends with `checked 3 previews (no frames captured)` (tour × preview-iphone, preview-ipad, header-video);
- the exit code is 0;
- no `framed-device` WARN appears for `preview-iphone` or `preview-ipad`.

- [ ] **Step 5: Commit**

```bash
git add scripts/storecheck.mjs scripts/render.mjs test/storecheck.test.mjs examples/preview/preview.config.json
git commit -m "feat(video): store-rule and concept checks, draft fallback, --check"
```

---

### Task 11: Hand-over report

**Files:**
- Create: `scripts/report.mjs`
- Modify: `scripts/render.mjs`. At the end of the preview pass, for each preview id, write `out/_preview/<id>.report.md` and
  print its summary lines.
- Test: `test/report.test.mjs`

**Interfaces:**
- Consumes:
  - from `renderPreviews` results: `{ tag, file, posterTime, … }`;
  - from Task 8: ramp savings per scene, as source length minus output length;
  - the WARN and NOTE lines tagged with that preview.
- Produces: `handover({ preview, concept, results, ramps, warnings, notes, locales }): string`. The markdown has these
  sections, in order:
  1. `# <preview id>`. The concept, plus each scene's beats with start and end times.
  2. `## Files`. One row per target × locale: the file, the length, `preview_frame_time_code`, and either `clean` or the
     WARN count.
  3. `## Cut`. Each ramped scene and the seconds saved, plus the total.
  4. `## Warnings and notes`
  5. `## Still to do`. It always lists `upload with fastlane deliver or by hand in App Store Connect`, and adds these when
     they apply:
     - `native-speaker review of captions (<n> locales)` when there is more than one locale;
     - `accept the take for <moment> (network moment)` when a sidecar step is network;
     - `replace draft scenes with recordings` when there is any draft.

- [ ] **Step 1: Write the failing test**

```js
test('handover lists files, cut seconds and the human to-do', () => {
  const md = handover({ preview: { id: 'loop' }, concept: 'feature-loop', locales: ['en-US', 'ja'],
    results: [{ tag: 'preview-iphone/en-US/loop', file: 'out/preview-iphone/en-US/01_loop.mp4', length: 15, posterTime: 5, warnings: 0 }],
    ramps: [{ scene: 'log', saved: 3.4 }], warnings: [], notes: [] });
  assert.match(md, /^# loop/); assert.match(md, /00:00:05:00/); assert.match(md, /3\.4s/);
  assert.match(md, /native-speaker review of captions \(2 locales\)/);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `node --test test/report.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `scripts/report.mjs`** (reusing `timeCode` from `video.mjs`) **and the render wiring.**

- [ ] **Step 4: Run to verify pass**

Run: `node --test test/report.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/report.mjs scripts/render.mjs test/report.test.mjs
git commit -m "feat(video): hand-over report per preview"
```

---

### Task 12: Example, skill docs, evals and version

**Files:**
- Create: `examples/preview-recorded/preview.config.json` and `copy.json`. These follow Decision 4: target
  `{ "id": "clip-full", "w": 880, "h": 1912, "video": { "minSec": 1, "maxSec": 60 } }`.
  - Scene 1 is `full-screen` on `../preview/recordings/{locale}/walk.mp4`, with `clip: { from: "top", to: "mid" }`,
    `speed: "auto"`, `tap: "ripple"` and `captionMotion: "words"`.
  - Scene 2 is `caption-band` on `clip: { from: "mid" }`.
  - Scene 3 is `end-card`.
- Create: `examples/preview/recordings/en-US/walk.taps.json`. It is hand-written and valid against `validateSidecar`, with
  2 taps and the marks `top: 0`, `mid: 3`.
- Create: `evals/evals.json`. It uses skill-creator's format, with 4 evals that follow the spec's "Skill evals" list and use
  `evals/files/*.json`.
- Modify:
  - `SKILL.md`. Add a "Preview video" path inside step 4: brief → `recommend.mjs` → 3 storylines in words to the owner →
    storyboard + `--check` → `record.mjs` → read `*.sheet.jpg` with the must-not-ship checklist (spec §9, as checkboxes) → render → QA → hand-over.
    Also add the quick-reference rows for `concept`, `record`, `speed`, `tap`, `captionMotion` and the three layouts, and
    links to the five knowledge base files. Keep the file under 200 lines.
  - `references/config.md` (previews section): document `concept`, `record` (all step kinds), `clip.from`/`to`,
    `speed: "auto"`, `tap`, `captionMotion`, `draft`, the three layouts, `--check`, and the new WARN and NOTE lines with
    their exact text.
  - `references/reading-the-app.md` §2b. Rewrite it around `record.mjs`, plus how to find moments, deep links, test routes
    and test IDs in Expo Router, Android intents and Flutter keys. Manual recording becomes the fallback.
  - `package.json`: version `1.2.0`, plus the script
    `"example:preview-recorded": "node scripts/render.mjs examples/preview-recorded/preview.config.json --only-previews"`.
  - `CHANGELOG.md` (repo root): a 1.2.0 entry.
  - `README.md`: the feature list.

- [ ] **Step 1: Render the example and read it**

Run: `npm run example:preview-recorded`
Expected:
- exit code 0, no WARN;
- in `out/_preview/clip-full__en-US__*.jpg`, the ripples show at the tap points;
- the scene 1 caption animates word by word;
- the end card shows the name and tagline;
- `out/_preview/<id>.report.md` exists.

- [ ] **Step 2: Run the full test suite and every example**

Run: `npm test && npm run examples && npm run example:preview-recorded`
Expected: all exit 0. The only new lines in the output are the documented ones.

- [ ] **Step 3: Run the skill evals**

Use skill-creator's eval flow on `evals/evals.json`, on Haiku, Sonnet and Opus, and once without the skill. Record the
pass rates in `evals/RESULTS.md`.
Expected: evals 1–3 pass with the skill on Sonnet and Opus. The no-skill baseline does not pass eval 1, which needs the
must-show coach in the strongest pick.

- [ ] **Step 4: Commit**

```bash
git add examples/preview-recorded examples/preview/recordings/en-US/walk.taps.json evals SKILL.md references package.json ../../CHANGELOG.md ../../README.md
git commit -m "docs: real-footage previews workflow, example, evals; 1.2.0"
```

---

### Task 13: AptusFIT end to end (acceptance, owner's machine)

**Files (in `/Users/sondoan/go/src/aptusfit/fe/marketing/store-screenshots/`, not committed in this repo; the owner
decides about their repo):**
- Create: `preview-brief.json`
- Modify: `screenshots.config.json`. Add a `previews` entry produced by the workflow.

- [ ] **Step 1: Brief and recommendation**

Follow the new SKILL.md path:
1. Write `preview-brief.json` from the code, using the recon in the research notes §10.
2. Confirm the owner context with the owner in one message.
3. Run `node <skill>/scripts/recommend.mjs preview-brief.json`.
4. Present the 3 storylines.
5. **The owner picks.** `feature-loop` is expected.

- [ ] **Step 2: Storyboard and check**

Write the `previews` entry: `concept`, `record` steps, scenes with `draft` stills from `screens/{locale}/*.png`, and
`full-screen` or `caption-band`.

Run: `node <skill>/scripts/render.mjs screenshots.config.json --check --previews loop --locales en-US`
Expected: exit 0, no WARN.

- [ ] **Step 3: Record**

Run: `node <skill>/scripts/record.mjs screenshots.config.json --preview loop --locales en-US,ja --takes 2`
Expected:
- two recordings, each with a sidecar and a contact sheet;
- every tap `align: "frame"`.

Then read both `*.sheet.jpg` against the must-not-ship checklist. Fix by trimming marks or re-taking, never by painting
over the UI.

- [ ] **Step 4: Render and QA**

Run: `node <skill>/scripts/render.mjs screenshots.config.json --only-previews --previews loop --locales en-US,ja --targets preview-iphone`
Expected:
- exit 0, no WARN;
- length 15–20 s;
- in the filmstrip, the ripples land on the ✓ and the swap row;
- the captions animate;
- the end card has the disclosure line;
- `out/_preview/loop.report.md` is complete.

Show the owner the video and the report.

- [ ] **Step 5: Record the outcome**

Add a "1.2.0 acceptance" note to `CHANGELOG.md` with the length, the take count and any thresholds that were tuned.

```bash
git add ../../CHANGELOG.md scripts/align.mjs scripts/ramp.mjs references/video/motion.md
git commit -m "chore: AptusFIT acceptance run for real-footage previews"
```
