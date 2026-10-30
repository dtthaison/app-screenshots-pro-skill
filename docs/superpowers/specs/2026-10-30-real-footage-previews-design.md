# Real-footage app previews: recommend, record, App Store cut (design)

Date: 2026-10-30. Status: draft for review. Builds on 1.1.0 (`docs/superpowers/specs/2026-10-30-app-previews-and-creative-assets-design.md`),
on branch `feat/app-preview-videos-and-creative-assets`. Target release: 1.2.0 (Phase 1 below).
Research: `docs/superpowers/research/2026-10-30-real-footage-previews.md`. It is the source material for the knowledge base
and for every constant below. There is also a summary page: https://claude.ai/artifact/ELgQ51VSuJnh9Xo5DmrZAw.

## Intent

1.1.0 renders app preview videos from a config. The scenes can use stills, HTML mocks or screen recordings. The owner tried it
on AptusFIT, and two things came out of it:

- **A preview made of the screenshots adds nothing.** It is a slower slideshow of the images it pushes out of search results.
  Apple also wants previews built from "video screen captures of the app itself" (App Review Guideline 2.3.4).
- **Recording is the hard part, and the skill leaves it to a human.** It is also the part an agent can do best. The agent
  already reads the code, so it knows the deep links, the test IDs and the moments that move.

The skill should make a preview that is worth watching, for any app, with little work from the owner:

1. Read the code to find the moments that **move**.
2. Recommend **3 video concepts** drawn from a sourced **knowledge base**, the **app's code** and the **owner's context**.
   Each recommendation says why.
3. **Record the app by itself** on the iOS simulator, logging where and when every tap lands.
4. Render a store-safe preview with motion built from that log: tap ripples, kinetic captions, speed ramps through the waits,
   an end card.

The tap log is the edge over screen recorders such as Screen Studio or Cap. They guess the interaction from the cursor. The
skill issues every tap itself, so it knows each one exactly. Prior art found in research does one half but not the other:

- `joanseg/app-preview-videos` renders previews from footage the user already has.
- `gabrielmoreira/app-preview-video` recommends concepts but renders nothing.

## Phasing

- **Phase 1 (this design, 1.2.0):**
  - knowledge base
  - brief and recommendation
  - storyboard checks
  - iOS recorder with tap log
  - speed ramps, tap effects and kinetic captions
  - full-screen App Store layouts
  - end card
  - must-not-ship review
  - hand-over report
  - evals
- **Phase 2 (later, own design):** the cinematic cut for Google Play and social:
  - floating 3D device and parallax
  - zoom-to-tap camera (Cap-style segments and springs)
  - lifted UI cards
  - grid finale
  - two-device sync for the Multi-device concept
  - Android emulator recording

  - **iPad previews**, recorded on an iPad simulator.

  Phase 1 keeps the data Phase 2 needs (taps with positions, marks) in the recording sidecar, so Phase 2 adds renderers only.

*My call:* the owner said "go ahead" to my recommendation of App Store cut first.

## Goals

1. Given an app's codebase, the agent produces a **brief**: signals, moments, owner context. A script ranks the concepts in
   the knowledge base against it and returns 3 that differ from each other, each with reasons citing code, owner and knowledge base.
2. The chosen concept becomes an ordinary `previews[]` entry. It gets a `record` block, which is the script for the take,
   and `concept`, which lets the validator apply that concept's rules. Before anything is recorded, it renders as a draft
   from the existing screenshots: the storyboard.
3. `scripts/record.mjs` drives the booted simulator through the `record` steps. It writes:
   - one clean `.mov` per locale;
   - a sidecar `.taps.json` with every tap, swipe and typed text, plus named **marks**, all in video time.
4. Scenes refer to marks (`clip: { "from": "swap", "to": "progress" }`) instead of seconds, so a re-take does not break the config.
5. The renderer turns the sidecar into motion:
   - `speed: "auto"` ramps through still stretches;
   - `tap` draws a ripple, ring or spotlight at each tap, starting the frame before the screen reacts;
   - `captionMotion` animates captions word by word or line by line.
6. Two new layouts make the footage full-screen at native resolution: `full-screen` and `caption-band`. The `end-card`
   layout closes the video.
7. App Store rules from the knowledge base become checks, so the App Store cut follows them. Examples: device frames on Apple
   preview targets, prices in captions, caption reading time.
8. The agent ends with a **hand-over report**: what was made, checks passed, what was cut, what a human must still do.
9. The skill ships **at least 3 evals**, including "a different app gets different recommendations".

## Non-goals (Phase 1)

- Everything in Phase 2.
- Android recording. Play's promo video is a YouTube link, and a Play cut of iOS footage is fine for now.
- Making live, network-dependent moments repeatable, for example streaming AI replies. The recorder retries takes. The owner
  or agent accepts one.
- Voice-over and music selection. `music` stays a file the user supplies.
- Uploading. `--fastlane` already lays out the files.
- Conversion claims. The knowledge base quotes no lift numbers, because none could be traced to primary data.

## Anti-goals (a failure even if it works)

- **Invented UI.** Captions claim only what the footage shows. Footage is never edited to show something the app doesn't do.
- **A default that risks rejection.** App Store previews that use frames, zoom, or prices.
- **A recommendation that ignores the owner.** A must-show feature missing from all 3, or a must-avoid shown.
- **The same 3 recommendations for every app.** The evals guard this.
- **A long interview.** Owner context is prefilled from what exists and confirmed in **one** message.
- **Non-deterministic render.** Same recording plus same config gives the same frames. Recording may vary; rendering may not.
- **Leaking private data**, debug banners or capture scaffolding screens into a shipped video.
- **Needing a paid tool.** No Remotion (company licence), Screen Studio, Rotato or idb install requirement.

## How it gets made

### Decided in conversation (owner)

- It extends `generating-app-screenshots`. It is not a separate skill.
- Video choices compose like screenshot choices, and presets bundle good combinations.
- Recommendations come from three inputs: a knowledge base shipped with the skill, the app code, and the owner context.
- The skill offers **3 recommended concepts** and the owner picks one.
- The video should be short and hook early. The App Store floor is 15 s, so a typical cut is 15 s.
- Real recordings of the app, with "cool motion" on top.

### Decided by me (calls the owner can override)

- **Recording driver: Maestro.** It is already used by the owner's apps, it is free, and it needs no idb.
  - **Pass 1, rehearsal:** runs the steps one at a time with `maestro hierarchy` between them, to resolve each element's bounds.
  - **Pass 2, take:** generates one flow with `tapOn: { point: "x%,y%" }` and runs it while `simctl io recordVideo --codec=h264` records.
- **Video times come from command windows refined by frame change.**
  - Maestro's `commands-*.json` gives each command's start and duration, but no coordinates.
  - The recorder looks for the first large frame change inside each command's window. The tap time is the frame before it.
  - The window is aligned to video time with a sync step at the start of every take. That step is a deep link that changes
    the whole screen; the first full-screen change locates it.
  - Target accuracy: ±1 frame (33 ms).
- **Sidecar format** is JSON next to the recording: `recordings/<locale>/<id>.mov` + `<id>.taps.json` (schema below).
- **Recommendation is a script, not taste:** `scripts/recommend.mjs`, which is deterministic and unit-tested. The agent
  writes the storylines in words from its output.
- **Concept catalog lives in code:** `scripts/concepts.mjs`, with its data next to the scorer. `references/video/concepts.md`
  is the craft guidance, keyed by the same ids.
- **Frames on Apple preview targets are a WARN, not an ERROR.** Rejections are reported, but enforcement is inconsistent.
  1.1.0 examples and configs with frames keep rendering. The QA rule "no WARN lines" pushes new work to full-screen.
- **Speed ramps are applied to source frames in Node, not with ffmpeg `setpts`.** Rendering stays a pure function of `t`.
- **The motion constants come from the research** and are listed in `references/video/motion.md` with their sources:
  - HyperFrames `motion.md` for easing, stagger and exits;
  - `joanseg/app-preview-videos` for tap-ring timing and ramp bounds.

  Every constant in code has a comment naming its knowledge base entry.

## The pieces

### 1. Knowledge base: `references/video/`

| File | Content |
|---|---|
| `store-rules.md` | Apple app preview spec and guideline 2.3.4 guidance; Google Play promo video rules. One rule per row: rule, store, source URL, `verified_on`, `verified`/`reported`, and the renderer check that enforces it (or "agent QA"). A "re-check by" date at the top (6 months). |
| `concepts.md` | The 11 concepts (ids below): story shape, beat template with seconds, hook type, "use when", "avoid when", recording needs, default choices, App Store cut, and a worked example. |
| `motion.md` | Every motion value the renderer uses (easing by role, stagger, holds, ripple size and timing, ramp bounds), each with its source, plus "feedback fixes" (owner says "too fast" → what to change). |
| `categories.md` | App category → concepts that suit it, with reasons; categories at least: fitness, health, finance, AI/chat, productivity, social, education, travel, shopping, games, utilities. |
| `sources.md` | Every source with URL, what it supports, `verified_on`, `verified` or `reported`. Untraceable statistics are listed under "not used" with the reason. |

SKILL.md links each file directly (one level deep). Files over 100 lines get a table of contents.

**Concept ids:**
- `hero-moment`
- `feature-loop`
- `ask-answer`
- `before-after`
- `speedrun`
- `results-first`
- `day-in-life`
- `multi-device` (Phase 2 render; recommendable in Phase 1 only as "needs Phase 2")
- `bento` (Phase 2)
- `cinematic` (Phase 2)
- `type-led`

### 2. Brief: `preview-brief.json`

The agent writes it next to `screenshots.config.json` after reading the code. It has three parts: what the app is, what it
can show, and what the owner wants.

```jsonc
{
  "app": { "name": "AptusFIT", "category": "fitness", "promise": "An AI coach that plans, logs and adapts to your gym" },
  "signals": ["ai-stream", "timer", "live-update", "sheet", "progress", "counter", "watch-app", "daily-habit"],
  "moments": [
    { "id": "log-set", "title": "Log a set, rest timer starts", "signals": ["live-update", "timer"],
      "reach": "deep link marketing?action=session, tap set-done-4-0", "automatable": true, "seconds": 4 },
    { "id": "coach", "title": "Coach writes a workout live", "signals": ["ai-stream"],
      "reach": "coach-chat, type prompt, send", "automatable": "network", "seconds": 20 }
  ],
  "owner": {
    "audience": "gym-goers who want a coach", "mustShow": ["coach"], "mustAvoid": ["paywall"],
    "channels": ["app-store"], "tone": "premium", "occasion": "refresh",
    "disclose": "Subscription required for the AI coach",
    "confirmed": true
  }
}
```

**Fields:**
- `signals` and `moments[].signals` use a fixed vocabulary defined in `concepts.mjs` and listed in `concepts.md`. The
  validator rejects unknown signals.
- `automatable` takes one of these values:
  - `true`: deep links and taps;
  - `"network"`: works, but varies per take;
  - `false`: needs a human or a device, for example the camera or the Watch.
- `owner.confirmed` is false until the owner answered the one confirmation message. `recommend.mjs` prints a NOTE when it is false.

The owner context is prefilled from store metadata, `copy.json`, the screenshot config, the README and marketing docs. The
agent then confirms it in one message listing what it inferred.

### 3. Recommend: `scripts/recommend.mjs`

`node scripts/recommend.mjs preview-brief.json [--json]`

1. **Filter.** Drop concepts whose required signals are missing, for example `ask-answer` needs `ai-stream`, `chat` or
   `search`. Drop concepts whose `avoidWhen` matches. Drop concepts that conflict with the channels: a Phase-2-only concept
   when the channels are only `app-store`, or when its renderer isn't built yet.
2. **Score.** Score each remaining concept from:
   - signal matches, weighted, from the concept's `useWhen`;
   - category fit (from `categories.md` data in `concepts.mjs`);
   - owner `mustShow` coverage, where a concept that can feature a must-show moment ranks up;
   - automatability of the moments it needs.
3. **Pick 3 that differ.** The top concept, then the best concept with a different hook type, then the best "bold" concept.
   Each concept carries a `role`: `safe`, `strongest` or `bold`. Fewer than 3 is allowed when the filter leaves fewer, and it
   is said so.
4. **Output.** For each pick:
   - concept id;
   - role;
   - score;
   - the moments it would use, in beat order, with seconds fitted to the concept's beat template and to 15 s by default;
   - risks, for example `automatable: "network"` or a moment over its beat length;
   - reasons, each tagged `code`, `owner` or `kb` with the brief field or knowledge base entry it came from.

The agent turns the output into 3 short storylines in words, written for the owner, and asks the owner to pick one. It does
not change the ranking. It may add a note when it disagrees.

### 4. Storyboard: the preview entry

The pick becomes a normal `previews[]` entry with two additions:

```jsonc
{
  "id": "loop",
  "concept": "feature-loop",                 // enables concept checks (beat lengths, hook timing)
  "targets": ["preview-iphone"],
  "record": {                                // the take; see 5
    "app": "ai.aptusfit.app",
    "setup": [ { "shell": "bash marketing/store-screenshots/set-locale.sh {udid} {locale}" } ],
    "steps": [
      { "open": "exp+aptusfit-monorepo://marketing?action=session", "wait": 6, "mark": "start" },
      { "tap": { "id": "set-done-4-0" }, "wait": 3, "mark": "log" },
      { "open": "exp+aptusfit-monorepo://marketing?action=swap", "wait": 8, "mark": "swap" },
      { "tap": { "text": "Arnold Press" }, "wait": 2 },
      { "open": "exp+aptusfit-monorepo://marketing?action=progress", "wait": 4, "mark": "progress" }
    ]
  },
  "scenes": [
    { "id": "log", "layout": "full-screen", "title": "@loop.log", "screen": "recordings/{locale}/loop.mov",
      "clip": { "from": "log", "to": "swap" }, "speed": "auto", "tap": "ripple", "captionMotion": "words" },
    { "id": "end", "layout": "end-card", "title": "@loop.end", "duration": 2 }
  ]
}
```

- **Before recording, the same entry renders as a draft.** A scene whose recording does not exist yet falls back to the
  scene's `draft` still if given, for example `"draft": "screens/{locale}/session.png"`. Otherwise it is an ERROR naming
  `record.mjs`. Draft scenes carry the existing "draft" NOTE.
- **`render.mjs --check`** runs every validation without capturing frames:
  - the existing checks;
  - the concept checks below;
  - the store-rule checks.

  It exits as usual (0, 1 or 2). The agent runs it on the storyboard before recording, and again before the final render.
- **Concept checks** come from the concept's beat template in `concepts.mjs`:
  - **Hook timing:** the first caption must be fully visible by 1.0 s.
  - **Beat length:** each beat lasts 2–5 s. `hero-moment` and `ask-answer` allow one beat of up to 8 s.
  - **End card:** last, and 1.5–3 s.

  Results are WARNs, except the 15–30 s total, which stays an ERROR.

### 5. Recorder: `scripts/record.mjs`

`node scripts/record.mjs <config> --preview <id> [--udid <udid>] [--locales a,b] [--takes 3]`

**Prerequisites it checks**, with a clear ERROR for each:
- `maestro` is on `PATH`;
- `xcrun simctl` exists;
- exactly one booted simulator, or `--udid` given;
- the app is installed (`simctl get_app_container`).

**Per locale:**
1. Run the `setup` steps. `{udid}`, `{locale}` and `{appLocale}` are substituted; `record.locales` maps store locale to app
   locale and defaults to the same.
2. Apply the status bar override (9:41, full battery, full bars, wifi), as reading-the-app.md §2 does.
3. **Rehearsal.** Run each step alone. Before every `tap` or `swipe` by `id` or `text`, read `maestro hierarchy` and store
   the element's bounds as % of the screen. Then:
   - **A step whose element is not found** is an ERROR that names the step. Nothing is recorded.
   - **System alerts.** The hierarchy is checked for system alerts (permission prompts, "Allow", notification banners) at
     every step. A system alert is an ERROR telling the owner to grant or turn off the permission first.
4. **Take.**
   - Start `simctl io <udid> recordVideo --codec=h264 --force`.
   - Run the generated flow: the sync step, then the steps with resolved points, then `wait`s as `extendedWaitUntil` or
     `waitForAnimationToEnd` plus a fixed delay.
   - Stop the recording with SIGINT and wait for the file. Never SIGKILL.
   - Keep `commands-*.json` from `--debug-output`.
5. **Align and write the sidecar.**
   - Find each command's reaction frame through frame differences on a downscaled grayscale copy.
   - Convert times to video seconds.
   - Write `recordings/<locale>/<preview>.mov` and `.taps.json`.
   - Write a 1 fps contact sheet `recordings/<locale>/<preview>.sheet.jpg` for the must-not-ship review.
6. **Retakes.** With `--takes n`, a take whose steps failed, or whose tap alignment fell back for more than one step, is
   retried. The best take is kept. The others are deleted.

**Sidecar schema** (`.taps.json`):

```jsonc
{
  "version": 1, "fps": 30, "width": 1206, "height": 2622, "device": "iPhone 17 Pro", "locale": "en-US",
  "syncOffset": 0.412,                                 // seconds between recorder start and the first frame
  "events": [
    { "t": 3.233, "kind": "tap", "x": 0.86, "y": 0.41, "w": 0.08, "h": 0.04, "step": 2, "align": "frame" },
    { "t": 7.800, "kind": "swipe", "x": 0.5, "y": 0.7, "x2": 0.5, "y2": 0.3, "dur": 0.4, "step": 4, "align": "window" },
    { "t": 9.100, "kind": "type", "text": "Give me a quick hotel gym workout", "step": 5, "align": "window" }
  ],
  "marks": { "start": 1.10, "log": 3.20, "swap": 8.95, "progress": 15.40 },
  "takes": 2
}
```

- **`align`** says how the time was found. `frame` means a reaction frame. `window` means no clear frame change, so the
  command's end time was used. The agent gets a NOTE for `window` taps, because their ripple may be early or late.
- **Typing** uses Maestro `inputText`, which types character by character. It is recorded as one `type` event. The
  must-not-ship review checks that text appears typed, not pasted.
- **Device class.** The recording keeps the simulator's native size. The renderer scales it. The recorder warns when the
  simulator's screen aspect is more than 2% off every Apple preview target in the config (same rule as clips today).
- **A manual recording** with a hand-written `.taps.json` (or none) is still valid. Without a sidecar:
  - `tap` effects are skipped with a NOTE;
  - `speed: "auto"` still works, since it needs only frames;
  - `clip.from`/`to` marks are an ERROR.

### 6. Motion from the sidecar

All three are pure functions of scene time, evaluated in `stateAt` and applied by `__apply`, consistent with 1.1.0.

- **`speed: "auto" | <number>`** (clips only; a number is the existing fixed speed).
  - **Idle detection.** Compute the mean absolute difference between consecutive source frames, at 1/8 scale, grayscale.
    A stretch of at least 0.5 s below the idle threshold is idle.
  - **Rate.** Idle stretches play at up to 4×. Active stretches play at 1×. Rate changes ease over 300 ms with smoothstep.
  - **Taps are protected.** The 0.4 s before a tap and the 0.8 s after it stay at 1×.
  - **Scene length.** The scene's output length is the integral of the clip span over the rate. When the scene sets no
    `duration`, that length becomes the duration. When it does set one, the ramp's top speed is solved within [1×, 4×] so
    the span fits. If even 4× doesn't fit, it's an ERROR naming the overrun.
  - **Frame map.** The result is a source-frame map, one entry per output frame. It is computed in `resolvePreviews`,
    cached next to the extracted clip frames, and used by `stateAt` in place of `floor((t - start) * fps)`.
  - Extraction changes from ffmpeg-side speed to 1× extraction. The map does the retiming. A fixed `speed` builds a linear map.
- **`tap: "ripple" | "ring" | "spotlight" | "none"`** (default from `theme.video.tap`, default `ripple`).
  - **Where and when.** Events come from the sidecar inside the scene's source span, mapped to output time through the frame
    map, and placed in the device screen's box (or the full-screen box).
  - **Ripple.** Starts the frame before the reaction. Radius goes from 3% to 12% of screen width over 600 ms, with expo-out
    easing. Opacity goes from 0.5 to 0, white on dark UI and the theme accent otherwise.
  - **Ring.** The same timing, as a 3 px stroke.
  - **Spotlight.** Dims everything except a radial cut-out of 18% of the width: fade in 200 ms, hold 600 ms, fade out 300 ms.
  - **Swipes** draw a short trail. **Type events** draw nothing.
  - Every value is cited in `motion.md`.
- **`captionMotion: "rise" | "words" | "lines" | "pop" | "none"`** (default from `theme.video.captionMotion`, default `rise`,
  which is the 1.1.0 behaviour).
  - **Words.** Each word slides up from 110% inside a clipping line box, with a 70 ms stagger and 450 ms per word, expo-out.
  - **Lines.** The same, per line.
  - **Pop.** A scale from 0.92 with opacity, using a spring with damping ratio 0.8. It is evaluated in closed form from `t`,
    never CSS.
  - **Fitting.** Wrapping words in spans must not change line breaks or auto-fit. Fit checks run on the at-rest state as today.
  - **Reading time.** A caption whose visible time is shorter than 0.5 s + 0.3 s per word gets a WARN with the numbers.

### 7. Layouts

- **`full-screen`.**
  - The recording fills the canvas edge to edge. It is scaled to cover; a 1206×2622 source is scaled to 886 wide and loses
    6 px top and bottom.
  - The caption sits over a gradient scrim at the top. It is bottom-placed with `caption.position: "bottom"`.
  - Default scrim: from 0% to the theme background at 70% opacity, over 22% of the height.
  - The caption never covers the status bar. The status bar from the recording stays visible.
- **`caption-band`.**
  - A solid or theme band holds the caption: the top 18% by default, or the bottom.
  - The recording fills the rest, scaled down to fit the width. This is the joanseg layout, where captions never cover the
    app's UI.
  - The recording keeps its aspect, and the band absorbs the difference.
- **`end-card`.**
  - Shows the app icon (`app.icon`, a path), the app name, the scene title as a tagline, and `subtitle` as a small line.
  - The agent fills `subtitle` from `owner.disclose`, for example "Subscription required", which Apple asks to be disclosed.
  - Uses the theme background. Has no device and no clip.

All three are ordinary layouts in `layouts.mjs`, usable on stills too, so screenshots can use them. `full-screen` and
`caption-band` set the main device to `model: "none"`, `style: "frameless"` and radius 0. That way clip playback, continuity
and the existing `device` id keep working.

### 8. Store-rule checks

These are added to the validation pass, and run in `--check` too. Each rule is listed in `store-rules.md` with the check name.

| Check | Level | Applies to |
|---|---|---|
| A framed device (model not `none`, or style not `frameless`) on an Apple preview target | WARN (`device frames risk rejection under 2.3.4 — use full-screen or caption-band`) | `preview-*` |
| A currency symbol or price pattern in a caption or label (`$9.99`, `€`, `¥ 1,000`, `/month`) | WARN | Apple preview and creative targets |
| A caption or label containing "Install now", "Download now", "Best", "#1" | WARN | `play-promo` |
| A 4-digit year or a month name in captions | NOTE (time-sensitive) | all video targets |
| No real recording in the shipped file (all stills) | the existing "draft" NOTE | unchanged |
| `owner.disclose` set but no `end-card` scene | NOTE | previews with `concept` |

The price, year and month patterns must work in every locale. The knowledge base lists the patterns, and unit tests cover
at least en, de, ja, zh and vi.

### 9. Must-not-ship review and hand-over

Automated checks run at record time:
- system alerts (rehearsal);
- steps that failed;
- `window`-aligned taps.

**Agent review.** The agent reads each `recordings/<locale>/<preview>.sheet.jpg` against a checklist in SKILL.md:
- personal data (names, emails, phone numbers) other than the seeded persona;
- error states or toasts;
- debug overlays, dev-client banners, "Preparing capture…" and other scaffolding screens;
- the keyboard, unless it is the point;
- spinners longer than 1 s that the ramp did not absorb;
- text that appears pasted rather than typed;
- the status bar not at 9:41.

The agent fixes these by:
- trimming with marks or `clip.from` and `clip.to`;
- adding `wait`s;
- re-taking.

It never paints over the UI. Redaction is out of scope; the seeded data should be clean.

**Hand-over report.** `render.mjs` prints it at the end of a preview run and writes it to `out/_preview/<preview>.report.md`:
- concept and role;
- beats with their times;
- per target × locale: file, length, poster time (`preview_frame_time_code`), checks passed, WARN and NOTE lines;
- what was cut: ramped stretches, with total seconds saved;
- what a human must still do: native-speaker caption review, accepting a network take, uploading.

SKILL.md step 7 points to it.

### 10. SKILL.md and docs

- **SKILL.md** gets a short "Preview video" path inside the workflow: brief → `recommend.mjs` → 3 storylines to the owner →
  storyboard and `--check` → `record.mjs` → sheet review → render → QA → hand-over. Each step links to its reference.
  SKILL.md stays under 200 lines; it is 81 now.
- **reading-the-app.md §2b** is rewritten around `record.mjs`. Manual recording becomes the fallback. The section also says
  how to find moments, deep links, test routes and test IDs in common stacks. The examples are Expo Router `(dev)` routes,
  Android `adb shell am start` intents, and Flutter integration-test keys.
- **config.md → previews** documents:
  - `concept`
  - `record`
  - `clip.from`/`to`
  - `speed: "auto"`
  - `tap`
  - `captionMotion`
  - `draft`
  - the three layouts
  - `--check`
  - the new WARNs
- **New example `examples/preview-recorded/`:**
  - a tiny bundled recording (the existing `walk.mp4` or a new one under 1 MB) with a hand-written `.taps.json`;
  - a `feature-loop` config using `full-screen`, `speed: "auto"`, `tap: "ripple"`, `captionMotion: "words"` and `end-card`.

  It renders without a simulator, so CI and the unit tests can use it.
- **Other docs:** CHANGELOG 1.2.0; README feature list.

## Evals and tests

- **Unit tests (`node --test`)** cover the following.
  - **`recommend.mjs`:**
    - filtering;
    - scoring;
    - the 3 picks having different hook types;
    - `mustShow`;
    - channels;
    - Phase-2 exclusion.
  - **Frame map:**
    - a monotone map;
    - taps kept at 1×;
    - the fit-to-duration solve;
    - the ERROR when 4× isn't enough.
  - **Tap alignment** on synthetic frame-difference arrays.
  - **Sidecar validation**, and marks resolved to clip spans.
  - **Caption reading time.**
  - **Price, year and month patterns**, per locale.
  - **The new layouts' boxes.**
- **Skill evals (`evals/evals.json`, at least 3)**, each a prompt plus a fixture brief or fixture codebase notes, with
  expected behaviour:
  1. **Fitness app with streaming AI and a watch app.** The picks include `feature-loop` and `ask-answer`. The owner's
     must-show coach appears in at least one pick.
  2. **Budgeting app with no AI, charts and a manual-entry chore.** The picks include `before-after` or `results-first`.
     No `ask-answer`.
  3. **Owner channels only `app-store`.** No Phase-2 concepts. The final config uses `full-screen` or `caption-band`. No
     frame WARN in `--check`.
  4. *(Optional.)* **Same brief, owner must-avoid "paywall".** No moment with the paywall signal is used.

  Run them on Haiku, Sonnet and Opus with skill-creator's eval flow. Also run them once without the skill, to confirm the
  skill adds something.
- **Integration (the owner's machine, not CI).** AptusFIT end to end:
  1. brief;
  2. 3 recommendations;
  3. `feature-loop` picked;
  4. `record.mjs` on the booted AptusFIT simulator for en-US and one more locale;
  5. render `preview-iphone`.

  Pass criteria:
  - `--check` and the render exit 0 with no WARN;
  - the sheet review is clean;
  - ripples visibly land on the tapped controls in the filmstrip;
  - the total length is 15–20 s.

## Constraints

- Node ESM. No new runtime dependencies beyond what 1.1.0 has: Playwright, sharp and ffmpeg-static.
  - Frame differences use sharp on extracted frames.
  - Maestro is an external tool, checked at run time, and needed only by `record.mjs`.
- Rendering stays deterministic. `record.mjs` is the only non-deterministic part, and its output is files.
- macOS with Xcode for recording. Rendering works anywhere 1.1.0 renders.
- Simulator recordings have no audio. The renderer's silent stereo track (1.1.0) still applies.
- Existing 1.1.0 configs render unchanged. Only new WARNs (frames on Apple preview targets) and NOTEs may appear.
- MIT licence. Cap is AGPL, so its code is not copied; only published constants and the described algorithm are used, in Phase 2.

## Resolved after the builder check

Each answer is marked as either the owner's or my call.

1. **Device classes and aspect.**

   *Owner's answer: iPhone first.*

   - **Phase 1 records iPhone only.** It is one simulator per run, and every Apple preview made with `concept` targets
     `preview-iphone` (886×1920).
   - **Out of Phase 1:** `preview-ipad`, `preview-ipad-9.7`, `preview-mac`, `preview-iphone-16-9` and `preview-iphone-4.7`.
     A `concept` preview on any of them is an ERROR saying "iPhone only in this release". Existing 1.1.0 previews without
     `concept` still render on every target.
   - **iPad recordings come in a later phase.** The likely shape: `<id>.ipad.mov` picked by `byTarget`, with the same
     sidecar naming. `record.mjs` must not hard-code assumptions that block it. It should take the device class from the
     simulator's screen aspect, and write the class into the sidecar's `device` field.
   - **`full-screen` never crops UI away.** When the recording's aspect is more than 2% off the canvas, it is an ERROR. The
     message suggests `caption-band`, or a recording on the right class. The one exception is the documented 886×1920
     iPhone case, where a few pixels are cropped.
   - **`caption-band`** absorbs the difference by letterboxing inside the band area. When the screen would end up narrower
     than 80% of the canvas width, it is a WARN.
2. **Alignment risk first.** *My call.*
   - The plan starts with a spike: `record.mjs` minimal, one tap on the example app or AptusFIT, measuring how close
     `frame` alignment gets.
   - **Quality floor.** `window` alignment may ship, with a NOTE per tap. The ripple then starts at the command's end.
   - **When the recorder fails.** Only when more than half of a take's taps fall back to `window`. Then the recorder
     retries, and after the last take it errors.
3. **Clip spans.** *My call.*
   - `clip.from`/`to` (marks) and `clip.start`/`end` (seconds) are exclusive. Giving both is an ERROR.
   - `from` without `to` runs to the next mark, or to the end of the file.
   - Extraction at 1× and 30 fps is the same cost as 1.1.0 (about 600 frames for 20 s), and its cache key drops `speed`.
   - `sameState` keeps working, because the mapped source frame is part of the state.
   - The "last frame holds" warning compares the mapped length with the scene.
4. **Durations with ramps.** *My call.*
   - Ramps only compress. The rate is never below 1×.
   - The 15–30 s check runs on the final output durations, after ramping, and stays an ERROR. The message lists each
     scene's ramped length, so the agent can lengthen a span or the end card.
   - Concept beat checks and hook timing use output time.
5. **Full-screen machinery.** *My call.*
   - The layouts place the main device at an exact pixel box: the whole canvas for `full-screen`, the area below or above
     the band for `caption-band`. They do not go through `withFit` and the safe-area fit.
   - The plan includes a test that renders a full-screen still at 886×1920 and checks the corners for the screen's pixels,
     so a hidden inset is caught.
6. **Maestro baseline.** *My call.*
   - Maestro 2.6.1, the version installed on the owner's machine. `record.mjs` checks for at least 2.6 and prints the
     version it found.
   - **`open` steps** use `xcrun simctl openurl <udid>`, not Maestro's `openLink`. Custom schemes opened that way show no
     confirm dialog.
   - **Setup steps** handle the dev-client launch.
   - **Keyboard.** The recorder turns the hardware keyboard off for the simulator, so `inputText` shows the soft keyboard.
     If that isn't possible, it says how to do it once.
7. **Paths.** *My call.*
   - Everything resolves relative to the config's directory, as screens do today.
   - `record.mjs` writes `recordings/<locale>/` there.
   - `preview-brief.json` sits next to the config, and only `recommend.mjs` validates it.
   - `--fastlane` and `build-site` don't need the recordings; they ship the rendered `.mp4`.
8. **WARN and exit codes.** *My call.*
   - Unchanged: WARN never changes the exit code.
   - "No WARN" is the QA checklist's rule for the agent, as it is today.
   - Existing 1.1.0 configs with frames on Apple preview targets will now show the frame WARN. That is intended.
     `examples/preview/` moves to `caption-band` or `full-screen` for its Apple preview targets, and keeps frames for the
     creative targets.
9. **Knowledge base content.** *My call.*
   - The source is `docs/superpowers/research/2026-10-30-real-footage-previews.md`. Its sections are per knowledge base file.
   - The builder writes the knowledge base from it and re-fetches every Apple and Google URL to set `verified_on`.
   - Items tagged [R] or [O] stay `reported` unless re-verified.
   - The 11 concepts' beat templates and `useWhen` signals start from design section 3 and the research's hook and pacing
     section.
10. **Small points.** *My call.*
    - `record.locales` maps a store locale to the app's locale string. It is used as `{appLocale}`, and defaults to the same.
    - `end-card` without `app.icon` shows the name and tagline only, with a NOTE.
    - Unit tests go in the existing `test/`. Skill evals go in `skills/generating-app-screenshots/evals/evals.json`, in
      skill-creator's format, and are run with skill-creator.

## Left to the builder

- **Detection thresholds:** the idle threshold and the reaction-frame threshold, chosen from tests on the example recording
  and AptusFIT. They are documented in `motion.md`.
- **The sync step's exact form**, as long as it reaches ±1 frame on the example.
- **How rehearsal runs one step at a time:** one Maestro flow per step, or Maestro's MCP/Studio API, whichever is reliable.
- **The internal structure** of `concepts.mjs`, and the scoring weights, within the rules above. The weights are explained
  in comments.
- **The exact wording of the knowledge base.** Every rule and number must keep its source.
- **The caption scrim and band styling details**, within the theme.
- **Splitting the work into plan tasks.** A suggested order:
  0. recorder alignment spike (one tap, measure how close `frame` alignment gets);
  1. knowledge base;
  2. recommend;
  3. layouts and end card;
  4. captions;
  5. frame map and ramps;
  6. sidecar and tap effects;
  7. recorder;
  8. checks and report;
  9. docs, example and evals.
