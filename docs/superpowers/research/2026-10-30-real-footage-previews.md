# Research notes: real-footage previews (2026-10-30)

These notes are the source material for the knowledge base in `references/video/`, and for the constants in
`docs/superpowers/specs/2026-10-30-real-footage-previews-design.md`.

Tags used throughout:
- **[A]** first-party Apple or Google text, read directly.
- **[V]** a source read directly (a README, source code, or a vendor page).
- **[R]** reported by a third party or a search snippet. Re-verify before marking it `verified` in the knowledge base.
- **[O]** opinion, or a craft synthesis with no source.

The knowledge base keeps these tags as `verified` (A or V) or `reported` (R or O).

## 1. Store rules

### Apple App Store app previews
Sources:
- https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/
- https://developer.apple.com/app-store/app-previews/
- https://developer.apple.com/app-store/review/guidelines/ (2.3.4)

**Spec [A]**
- **Length and count:** 15–30 s. Up to 3 per device size and language. 500 MB max. 30 fps max.
- **Formats:** .mov, .m4v or .mp4. H.264 at 10–12 Mbps, High Profile, Level 4.0, or ProRes 422 HQ.
- **Audio:** stereo AAC 256 kbps at 44.1 or 48 kHz.
- **Sizes:**
  - iPhone 6.9", 6.5", 6.3", 6.1" and 5.8": 886×1920 portrait or 1920×886 landscape.
  - iPhone 5.5": 1080×1920.
  - iPhone 4.7": 750×1334.
  - iPad: 1200×1600.

  App Store Connect scales from a related class when a size is missing.
- **Poster frame:** defaults to 5 s and can be changed. Changing it on an approved preview needs a new version.
- **Placement:** previews always come before screenshots. They autoplay muted on the product page and in search. With
  autoplay off, the poster shows.

**Guideline 2.3.4 [A]**
"Previews may only use video screen captures of the app itself … You can add narration and video or textual overlays to
help explain anything that isn't clear from the video alone." Guideline 2.3.3 allows text and image overlays on
screenshots, for example an animated touch point.

**The "App previews" page [A]**
- Use footage captured on device. Stay within the app: no people, no fingers or hands.
- "Capture the native UI resolution rather than zooming in on the view."
- Graphic elements such as touch hotspots are allowed.
- Use "straightforward transitions like dissolves and fades". A transition must not imply functionality the app lacks.
- Text must be legible and on screen long enough to read.
- Avoid seasonal references and dates. Show no prices or currencies.
- Disclose an IAP, subscription or login requirement in the footage or on the end frame.
- Content must suit all ages.

**Device frames [R]**
The Apple guidance does not mention frames. Developer forum threads from 2020, July 2024 and December 2024 quote Apple
rejecting previews under 2.3.4 because they "include device images and/or device frames":
- https://developer.apple.com/forums/thread/656342
- https://developer.apple.com/forums/thread/689232

One earlier approval of the same video was also reported, so enforcement looks inconsistent. Treat frames as a rejection
risk; full-screen footage is the safe default.

**Zoom [A]**
Apple's only wording is "native UI resolution rather than zooming in". That is guidance, not a stated prohibition. A vendor
advises leaving zooms out of the App Store cut [R]: https://matte.app/help/app-store-previews/

**Looping:** Apple publishes no rule about looping.

### Google Play promo video [A]
Source: https://support.google.com/googleplay/android-developer/answer/9866151

- **Format:**
  - One YouTube URL with no parameters.
  - Public or unlisted, embeddable, not age-restricted.
  - Ads and monetization off.
- **Length:** not fixed. Only the first 30 s autoplay inline, muted.
- **Content:** show the real app within the first 10 s. At least 80% of the video should be real user experience.
- **Don't:**
  - fingers or hands on the device;
  - black bars on a portrait video;
  - calls to action such as "Install now";
  - claims such as "Best" or "#1";
  - time-sensitive taglines.
- **Text:** use readable on-screen text for muted viewing.
- **Not addressed:** device frames and zoom.

## 2. Hook and pacing [R, consistent across sources]

- **Open on the app:** the first frame must already show the app doing the valuable thing. No logo, splash screen, fade from
  black or slow pan.
- **Captions and features:** put a value caption on screen within about 2 s. Show 3–4 features. Shots last 2–5 s. Never
  hold a static screen longer than 2 s. Total length is 15–25 s.
- **Muted viewing:** captions are essential, because most viewers watch muted.
- **Suggested arcs:**
  - 0–5 s hook, 5–15 s core workflow, 15–25 s benefit, 25–30 s end frame.
  - Compressed for 15–20 s: hook (0–3 s), three beats of about 4 s, then an end frame (about 2 s).
- Sources:
  - https://www.appalize.com/blog/creative-optimization/how-to-design-app-store-preview-videos-that-convert
  - https://appscreenshotstudio.com/blog/app-store-preview-videos-the-2026-conversion-guide
  - https://www.yellowhead.com/blog/11-commandments-app-preview-videos/
- **Not used:** conversion-lift numbers such as "15–35% lift", "65% of completers install", "78% more downloads" and "85%
  watch muted". None could be traced to primary data.
- **Measurement:** Product Page Optimization can A/B test previews. WWDC25 added Download-to-Paid Conversion analytics.

## 3. Motion values

### Primary source: HyperFrames `references/motion.md` [V]
Source: https://github.com/heygen-com/hyperframes

**Easing by role**
- Arrivals: `expo.out` or `power4.out`.
- Camera moves: `power2.inOut`.
- Exits: `power3.in`.

**Durations and springs**
- Exits are 40–50% shorter than entrances.
- Spring damping ratio:
  - 0.7–0.85 reads premium;
  - 0.4–0.6 reads playful;
  - below 0.3 reads cartoonish.

**Holds, staggers and shot lengths**
- Hold a caption for about 0.5 s plus 0.3 s per word.
- Word stagger: 60–120 ms.
- Average shot: 1.8–3 s. A demo hold can last 7–10 s.
- Hold 0.3–0.75 s before a payoff.

**Production rules**
- Apply camera and zoom to a wrapper element, never to the media element.
- "Too fast" feedback: scale zooms and pans to 0.7×.
- Drive speed ramps from a keyframed rate lane.
- Compute beat frames per index, to avoid rounding drift.

**Storylines:** for films longer than about 15 s, propose three distinct storylines in words only, and let the person pick
one. Turn every adjective into a number.

### `joanseg/app-preview-videos` [V]
Source: https://github.com/joanseg/app-preview-videos

**Timing**
- 12-frame fades between scenes.
- Waits play at 2–4×. Static review screens play at 0.5–0.8×.
- A tap ring appears on the last frame before the screen reacts. It lasts at most 0.6 s and ends before a hard cut.

**Captions**
- About 22 characters each.
- They sit in a band above the recording, never over the app UI.
- Captions claim only what the footage shows.
- No prices on the App Store. No "best" or "free" on Google Play.

**Sweeps, redaction and hand-over**
- A "what must not ship" sweep.
- Redaction paints the surrounding surface over private data. It hard-cuts past slides that would move redacted content.
- Typed versus pasted text is checked.
- Footage must match the platform.
- Hand-over report: lengths, pass or fail, what was covered or cut, and open decisions.

### Craft values [O]

**Easing**
- Ease-out reveal: `cubic-bezier(.16,1,.3,1)`.
- In-out move: `cubic-bezier(.65,0,.35,1)`.

**Springs**
- Pop: stiffness 170, damping 18 (ζ ≈ 0.7).
- Tight UI: stiffness 300, damping 30.

**Text**
- Kinetic captions: each word translates from 110% to 0 inside an `overflow:hidden` line wrapper, optionally with a blur
  from 8 px to 0, over 350–600 ms.
- Keep text at least 48 pt equivalent.

**Tap effects**
- **Ripple:** radius 3% → 9–12% of screen width over 500–700 ms, out-expo easing. Opacity 0.5 → 0. Stroke 3 px → 1 px.
- **Press dot:** 7–9% of screen width, white at 35–55% alpha.
- **Spotlight:** 10–25% black over the rest of the screen, with a radial cut-out of about 18% of screen width. Fade in
  200 ms, hold 600 ms, fade out 300 ms.

**3D tilt (Phase 2)**
- Rotate 8–20°.
- Set perspective to about 1.5–2× the device height, with `perspective-origin` at 50% 40%.
- `overflow:hidden` or `filter` on an ancestor flattens the 3D effect.

**Motion blur (Phase 2)**
- 4–8 sub-frames at a 180° shutter.
- Apply it only during zooms and ramps.

### Motion style catalog [O]
Each style is listed with whether it is safe for the App Store.

**App Store safe**
- Tap-point highlight ring (Apple explicitly allows it).
- Kinetic typography.
- Speed ramp.
- Simple fade or wipe.

**Play and social only**
- Zoom to tap (it conflicts with Apple's "native resolution" guidance).
- 3D device tilt and swing.
- Floating device with parallax, a 4–8 s sine drift of 8–20 px.
- Split screen or multi-device.
- Layered UI pop-out. This is hard from a flat recording; only crop real element bounds.
- Mask and wipe transitions. Keep only a simple wipe for Apple.
- Bento grid.
- Screen fills the frame, then pulls back into the device. The full-bleed half is safe.

## 4. Recording and tap log

### `xcrun simctl io <UDID> recordVideo` [V, local help]
- **Flags:** `--codec=h264|hevc` (the default is HEVC, so use h264), `--display`, `--mask=ignored|alpha|black` and `--force`.
- **Not settable:** fps, bitrate and size.
- **Output:** device-native size, no audio, a variable frame rate [R]. Normalize with
  `ffmpeg -i in.mov -vf fps=30 -vsync cfr`.
- **Stopping:** stop with `kill -INT` and wait. A `kill -9` leaves a file with no moov atom.
- **Before recording:** wait for `xcrun simctl bootstatus <UDID> -b`, and use a UDID rather than `booted`.
- **Hazards:**
  - Simulator touch dots (`ShowSingleTouches`) never appear in recordings.
  - Competing builds and Instruments make the recording stutter.
  - Headless CI with no window server can't record.
  - The hardware keyboard hides the soft keyboard; Cmd+Shift+K toggles it.
- **Source:** https://www.screenify.studio/blog/2026-08-13-simctl-recordvideo-ios-simulator

### Maestro 2.6.1 [V, installed locally]
- **`maestro record`** without `--local` uploads to mobile.dev, and its output is decorated. So use `maestro test` together
  with `simctl recordVideo`.
- **`maestro test --debug-output=DIR`** writes `commands-(<flow>).json`. Each entry looks like
  `{command:{tapOnElement:{selector}}, metadata:{status, timestamp:<epoch ms>, duration:<ms>, sequenceNumber}}`.
  - It carries no element bounds and no tap coordinates.
  - `timestamp` is when the command started.
  - `duration` includes waiting and retries.
- **`tapOn: { point: "x%,y%" }`** exists.
- **`startRecording` and `stopRecording`** exist, with a 2-minute cap: https://docs.maestro.dev/api-reference/commands/startrecording
- **`maestro hierarchy`** prints the view tree as JSON, with bounds.
- **Tap dots on iOS** need an injected dylib, which hasn't shipped yet: https://maestro.dev/blog/showing-tap-indicators-on-ios-recordings

### idb [R]
- `idb ui tap X Y`, `idb ui describe-all` (frames).
- It is largely unmaintained, and it is not installed here.

### Android (Phase 2) [R]
- `adb exec-out screenrecord --bit-rate 8M --time-limit 180 -`
- `settings put system show_touches 1` burns the touch dots into the recording.
- `getevent -lt` prints timestamped touches.
- `input tap x y` taps exact coordinates.

### Reliable tap log
Log the commands the recorder issues itself:
1. Resolve the coordinates from the hierarchy.
2. Stamp the time before and after each command.
3. Align to the video with a sync marker, giving ±1 frame.

## 5. Auto-zoom (Phase 2): Cap [V]
Sources:
- https://github.com/CapSoftware/Cap: PR #1106, issue #2928, `crates/rendering/src/spring_mass_damper.rs` and
  `crates/project/src/configuration.rs`.

The desktop app is AGPL, so reimplement it; do not copy code.

**Zoom segments**
- Pre-padding 0.6 s, post-padding 1.6 s.
- Merge gap 0.6 s. Minimum segment length 1.3 s.
- Drop the stop click within 0.8 s.
- Zoom 2.0.
- A later version uses pre 300 ms, post 2500 ms and a 2500 ms merge gap.

**Springs**
- Camera: stiffness 200, mass 2.25, damping 40.
- Closed-form under-, critically and over-damped solutions. Rest snap at |d| < 1e-5 and |v| < 1e-4.

**Dedup and edges**
- Double-clicks within 400 ms are deduplicated.
- Edge snap ratio 0.25.

**For phones:** zoom 1.35–1.6× and hold 1.2–1.8 s.

## 6. Idle detection and ramps [R]

- **ffmpeg options:** `freezedetect=n=-60dB:d=0.5`, or `mpdecimate`.
- **Preferred method:** compute in Node the mean absolute difference between downscaled grayscale frames. It is
  deterministic and tunable.
- **Speed ramps:** build a monotone time map `src(t_out)` from the integral of the rate. Use rate 1 when active and up to 4×
  when idle, with smoothstep edges of 250–400 ms. Take frames with `floor(src*fps)`.

## 7. Deterministic animation

- **Remotion [V]:** `spring()` defaults are damping 10, mass 1, stiffness 100. It steps per frame with a closed-form advance
  and caches by frame.
  - The licence is free for individuals and companies of up to 3 people; others need a company licence. Borrow the ideas,
    not the code.
  - Source: https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md
- **Rule:** every animated value is a pure function of `t`, with no CSS transitions.

## 8. Prior art (agent skills and tools)

**Agent skills**
- **joanseg/app-preview-videos [V]:** footage in, previews out. Remotion, 4 caption styles, a spec checker. No concept
  recommendation and no recording.
- **gabrielmoreira/app-preview-video [V via directory]:**
  - Planning only.
  - Asks for the conversion goal, platform, existing recordings and localization scope.
  - Builds 3 variants by hook angle: outcome, demo, social proof.
  - Beat template:
    - hook 0–2 s
    - problem 2–8 s
    - demo 8–20 s
    - proof 20–26 s
    - CTA 26–30 s
  - Speeds demos up 1.25–1.5×.
  - Source: https://www.skillsdirectory.com/skills/gabrielmoreira-app-preview-video
- **HyperFrames [V]:** the same architecture as ours. A 12-rule determinism contract, a reference-map table, and a
  storyboard → check → snapshot → render loop.
- **remotion-dev/skills [V]:**
  - A router skill with one reference per sub-skill.
  - `version` frontmatter that tracks Remotion releases.
  - A docs lookup instead of encoded APIs.
- **Creatify-AI/video-ad-generator [V, README]:**
  - Hooks: Pattern Interrupt, Question, Bold Claim, POV, Stat/Authority.
  - Bodies: PAS, Feature Cascade, Social Proof Stack, Before/After, Day-in-the-Life.
- **Neelshah1810/Claude-Video-Skills [V]:** 8 named style presets plus low/medium/high dials.
- **hisyam44/promo-video-skill [V, README]:** one storyboard JSON drives 16:9, 9:16 and 1:1. A `doctor` script, re-runnable stages.
- **Tella cut-video [V]:** re-verifies every cut boundary.

**Recorder tools [R]**
- **Screen Studio:** auto-zoom, smoothing, motion blur.
- **Cap:** open source, zoom segments from clicks.
- **Tella:** Auto Zoom, Auto Cut.
- **Supademo:** users like editable zooms.
- **Rotato:** 3D mockups, with a CLI.
- None of these recommends a concept.

**Gap:** nothing found records the app automatically and recommends from the app's code.

## 9. Skill authoring
Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices [V]

- **Size and references:** SKILL.md under 500 lines. References one level deep. A table of contents in any reference over
  100 lines.
- **Freedom:** match the level of freedom to how fragile the step is.
- **Wording:** descriptions in the third person. Give a default, not a menu. Explain every constant.
- **Workflow:** plan → validate → execute, with a machine-checkable intermediate file.
- **Evals:** write at least 3 evals first. Test on Haiku, Sonnet and Opus. Check that the base model fails them without the skill.
- **Skill-creator:** has a benchmark mode and a description optimizer [R]:
  https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

## 10. First test app: AptusFIT (recon summary)

The repo is `/Users/sondoan/go/src/aptusfit/fe` (Expo Router). The dev scheme is `exp+aptusfit-monorepo`, and the bundle
is `ai.aptusfit.app`. The app uses dark mode.

**Moments that move**
- **Log a set**, starting from `marketing?action=session`:
  - tap `set-done-4-0` (Overhead Press set 1);
  - the count goes from 12/25 to 13/25;
  - the InlineRestTimer slides in and counts down from 1:30, with a ring.
- **Swap:** `marketing?action=swap` opens the swap sheet by itself. Tap a row by its text (the rows have no testID).
- **Progress:** `marketing?action=progress` rolls the counters in with springs, 50 ms per digit.
- **Coach:** the coach streams live, which needs the network, a dev token, and varies per run. `marketing?action=coach`
  instead shows a static seeded conversation.
- **Plank:** a full-screen countdown timer.

**Setup**
- Seed with `seed/case-104?mode=loggedin&marketing=1` (`__DEV__` builds only).
- Switch the language with `test/set-language?lng=<app locale>`, then terminate the app, run `apply_locale.py`, and relaunch
  the dev client.
- See `marketing/store-screenshots/capture.sh`.

**Hazards**
- "Preparing capture…" scaffolding screens.
- The swap and coach screens render cleanly only after a settled Home.
- A possible notification permission prompt on the first rest timer.
- Random "done" phrases in the coach.
- Session time is based on `Date.now()`.

**Brand**
- Navy `#000a1e` with a blue mesh, and `#4db8ff` highlights.
- Font: Aptos.
