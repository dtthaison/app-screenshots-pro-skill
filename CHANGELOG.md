# Changelog

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
