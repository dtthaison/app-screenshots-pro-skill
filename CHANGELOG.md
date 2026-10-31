# Changelog

## 1.2.0 (2026-10-31)

- Real-footage app previews, iPhone only (`preview-iphone`): brief → recommend → storyboard → record → review → render → hand-over.
  - `scripts/recommend.mjs` reads a `preview-brief.json` (signals, moments, the owner's wishes) and returns 3 storylines (safe, strongest, bold) from 11 concepts. The strongest pick always features the owner's must-show moment.
  - `scripts/record.mjs` films a scripted take on the iOS Simulator with Maestro (2.6+): `record` steps `open`, `tap`, `swipe`, `type`, `wait`, `mark`. It writes `recordings/<locale>/<id>.mov`, a tap sidecar `.taps.json` (times found from reaction frames) and a `.sheet.jpg` contact sheet for review.
  - `clip: { from, to }` cuts by mark names; `clip.speed: "auto"` ramps idle stretches (1× to 4×, taps stay at 1×).
  - `tap` effects `ripple` (the default), `ring`, `spotlight`, `none`; `captionMotion` `rise`, `words`, `lines`, `pop`, `none`.
  - Layouts `full-screen`, `caption-band` and `end-card`; scene fields `draft` (a still that stands in before the take) and `moment`.
  - `render.mjs --check` validates a storyboard without capturing frames. New WARNs: hook timing, beat length, end card, reading time, device frames (2.3.4), prices; NOTEs for years and months, `owner.disclose`, window-timed taps and a missing sidecar.
  - A hand-over report `out/_preview/<id>.report.md` per preview: beats, files, poster time, time cut, WARN and NOTE lines, what a human must still do.
  - Knowledge base in `references/video/` (concepts, categories, store rules, motion, sources); the must-not-ship checklist is in SKILL.md.
- Example `examples/preview-recorded` (`npm run example:preview-recorded`) renders without a simulator. `examples/preview/recordings/en-US/walk.taps.json` is a hand-written sidecar, so the `stats` scene of `examples/preview` (on `walk.mp4`) now shows tap ripples by default.
- `examples/preview` shows one expected WARN for `preview-ipad`, `caption-band: the screen is only 50% of the canvas width`, because this release is iPhone-first.
- `evals/evals.json`: 4 skill evals for the recommend and storyboard steps.
- Upgrade note: existing 1.1.0 preview configs that show device frames on `preview-*` targets now get the WARN `device frames risk rejection under 2.3.4 — use full-screen or caption-band` for each framed scene. Fix: switch those scenes to `full-screen` or `caption-band`.
- Docs: `references/reading-the-app.md` §2b is rewritten around `record.mjs` (moments, deep links, test IDs), and `references/config.md` documents every new field and message.
- Fixes from the first real app (AptusFIT, React Native on the iOS Simulator):
  - Recordings are read by presentation time (`-fflags +igndts`) and clips are cut with `trim` on that timeline, never an input seek. Simulator takes reorder frames by up to ~7 s; ffmpeg's dts-based guess put a third of the frames up to 3.4 s off, so taps matched the wrong reactions and clips landed seconds away. **Takes recorded with an earlier 1.2.0 build can have wrong marks: record them again.**
  - The sync fits one global clock shift (-3 s to +1 s) when the app changes the screen before `openLink` returns; the take log prints `clock shifted …`. A tap Maestro held open waiting for the screen to settle is timed near its start.
  - `record.boot`: shell steps after every terminate, for Expo dev clients that relaunch to their launcher.
  - `clip.from` / `clip.to` take offsets (`"start+2"`, `"swap-0.5"`); a mark named like `tab-2` is still found whole. With an offset `from` and no `to`, the clip runs to the next mark after the named one.
  - `text-top` lifts the device under a title that has no subtitle or eyebrow (the phone sat ~8% below it).
  - The recorder clears the 9:41 status bar and restores the hardware-keyboard setting when it ends, also on failure. `record` steps that are not objects, and `wait` values that are not numbers 0 or more, are validation messages.
  - Contact sheets spread their 30 tiles over the whole video or take, so anything over 30 s is reviewed to its end.
  - `--supersample` is for stills only; videos use `--video-supersample` (default 1), and both stay under Chrome's ~16k px texture limit. Upgrade note: a run that used `--supersample` to sharpen videos now needs `--video-supersample`.
  - A CSS gradient string background gives the `full-screen` scrim and the `caption-band` band its first colour instead of an invalid fill.
  - The hand-over report lists each ramped scene's recording span.

## 1.1.0 (2026-10-30)

- Google Play: `android-tv` and `tv-banner` (supply uploads both), `android-xr` (3840×2400), `android-auto` / `android-auto-portrait` (raw system UI), and `play-promo`, a 1920×1080 video for the YouTube preview link.
- Fix: HTML mock screens on frameless Play targets (`chromebook`, now also `android-tv`, `android-xr`) rendered black because the mock was queued for the wrong frame; they now render for the Android frame.
- Previews open on a complete first scene and loop with a cut by default; `loop: "soft"` restores the fade through the background.
- App previews: `previews` in the config renders `.mp4` videos (H.264 High, 30 fps, stereo AAC, faststart) for `preview-iphone`, `preview-iphone-16-9`, `preview-iphone-4.7`, `preview-ipad`, `preview-ipad-9.7` and `preview-mac`.
  - Scenes take stills, HTML mocks or screen recordings (`clip`, with `{locale}` and `clipLocale`), `motion` (drift, scroll, none), timed `labels`, `in`, `transition` (crossfade, push, cut, fade-through) and continuity between scenes with the same layout.
  - Hard loop by default (`loop: "soft"` fades through the background), `music`, `poster` (seconds or a scene id) with a `.poster.png`, a filmstrip in `_preview/`, and a `<video>` per file in `index.html`.
  - Checks: duration 15–30 s, up to 3 per size and locale, 500 MB, poster in a transition, clip length and aspect, "draft" notes for stills.
  - Scene times are rounded to the millisecond (3 + 3.4 + 11.8 + 11.8 is exactly 30 s), and duration and count are checked before capture, so an out-of-range preview is never rendered.
  - `--previews`, `--scenes`, `--no-previews`, `--only-previews`; `--supersample` and `videoSupersample` for both passes; `renderScale` for drafts.
  - `--fastlane` writes `out/fastlane/app-previews/<locale>/NN_<IDENT>_<id>.mp4` for `deliver`.
- Creative assets: images `app-header`, `app-header-16-9`, `search-asset`, `search-asset-16-9`, `event-card`, `event-details` and videos `header-video`, `search-video`, `event-card-video`, `event-details-video` (1 per locale; safe-area warning; png-only check). Fastlane copies go to `out/fastlane/creative/`.
- ffmpeg is found through `FFMPEG_PATH`, the optional `ffmpeg-static` dependency (GPL-3.0 binary downloaded at install time, not redistributed here), or `PATH`.
- Example `examples/preview` (`npm run example:preview`, `example:preview-clip`, `test:video`) and a new "Record the app for previews" section in `references/reading-the-app.md`.
- Known limits: landscape recordings in device frames, page-load timeouts count as errors, filtered runs rewrite `manifest.json` and `index.html`.

## 1.0.2 (2026-10-30)

- Apple Watch targets take `@styled` (e.g. `"watch-ultra@styled"`): background and caption at the store size, a strap-less watch via `watch-hero` by default, still exported by `--fastlane` as watch screenshots. Wear OS stays raw.
- `phone-watch` on tall canvases: a bigger phone (70% wide, higher up) and the watch moved down with it, so less of the canvas is empty.
- Showcase: a real app sample (AptusFIT) with 31 options in 12 languages, previewed as App Store and Google Play listings, at `docs/samples/aptusfit/`.

## 1.0.1 (2026-10-29)

- `theme.caption.titleSize`, `subtitleSize` and `eyebrowSize` now apply to every slide. Before, each layout's own default size overrode them. A slide's own `caption` sizes still take priority.

## 1.0.0 (2026-10-29)

First public release.

- Renderer: one JSON config renders every target × locale with headless Chrome, validated against store rules (size, alpha, count, file size).
- 35 targets covering iPhone, iPad, Mac, Apple Watch, Android phone and tablet, Chromebook, Wear OS, Windows, the Play feature graphic and social formats.
- CSS device frames:
  - iPhone (Dynamic Island, notch, Home button), iPad, Android phone and tablet, Apple Watch, Wear OS, MacBook, desktop, and Mac, Windows and browser windows.
  - Styles: real, clay, outline and frameless, with colors and 3D tilt.
- 41 layouts, including 9 signature layouts and the cross-device layouts phone-watch, watch-hero and laptop-phone.
- 15 panorama patterns, with seam checks and an App Store card preview.
- Captions:
  - `**highlight**` in 4 styles, auto-fit, stroke/gradient/tracking text options and a separate subtitle font.
  - Hyphenation only in languages with long compound words.
- Localization: right-to-left layout, Noto fallbacks for CJK, Thai, Indic and Arabic scripts, plus `byLocale` and `byTarget` overrides.
- `--fastlane` export for `deliver` and `supply`.
