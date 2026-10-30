# Changelog

## 1.1.0 (2026-10-30)

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
