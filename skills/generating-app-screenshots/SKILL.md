---
name: generating-app-screenshots
description: Use when making App Store or Google Play screenshots, store listing images, marketing screenshots, a Play feature graphic, or social promo images for a mobile app — framed devices with captions, device colors, gradient or image backgrounds, panoramic sets, or translated/localized screenshot sets — especially when starting from an app's codebase (iOS, Android, Flutter, React Native, Expo, web) or from simulator/device captures. Alternative to screenshots.pro, AppScreens, Picasso, BrandBird.
---

# Generating App Screenshots

Code-driven App Store / Play screenshots: one JSON config → every store size × every locale, rendered by headless Chrome
(`scripts/render.mjs`). Frames are drawn in CSS (real / clay / outline / frameless, any color, 3D tilt), so nothing needs
downloading. Output is validated against store rules (exact size, no alpha, count limits).

**Core principle:** screenshots sell *benefits*, not screens. Read the app first, write captions from what users get, then render, look at every preview, and fix.

## Workflow

1. **Read the app** → name, value props, top 4–6 features, brand colors, fonts, supported locales, existing translations.
   Where to look per stack: [references/reading-the-app.md](references/reading-the-app.md).
2. **Get raw screens**, best first: (a) real captures from simulator/emulator per locale (commands in reading-the-app.md);
   (b) user-supplied PNGs; (c) HTML mock screens rebuilt from the app's UI code (`screens/*.html`, read `?locale=` to localize).
   Never invent features the app doesn't have.
3. **Write copy + translations** → `copy.json`. Rules and locale codes: [references/copy-and-locales.md](references/copy-and-locales.md).
4. **Write `screenshots.config.json`** — schema, layouts, elements: [references/config.md](references/config.md).
   Start from `examples/demo/screenshots.config.json` (normal set), `examples/demo/panorama.config.json` (connected set),
   or copy slides from `examples/gallery/layouts.config.json` — one slide for every layout × preset (open `examples/gallery/out/index.html` to see them).
   Pick a `theme.preset` that matches the brand, then vary `preset`/`layout` per slide for rhythm.
5. **Render:**
   ```bash
   cd <skill-dir> && [ -d node_modules ] || npm install --no-fund --no-audit
   node <skill-dir>/scripts/render.mjs path/to/screenshots.config.json [--locales en-US,vi] [--targets ios-6.9] [--slides hero] [--fastlane]
   ```
   Iterate on one locale + one target, then run everything.
6. **QA — required.** Read every `out/_preview/<target>__<locale>.jpg` image (they're contact sheets; `out/index.html` shows them all).
   Re-render until every box is true:
   - [ ] exit code 0, no `ERROR` / `WARN` lines
   - [ ] no caption clipped, covered by a device, or visibly smaller than its siblings
   - [ ] every device screen is **full**, with no big empty area under the content (add realistic rows/data to the screen)
   - [ ] no missing glyphs: `#`, `?`, or empty boxes where icons or CJK/Thai/Arabic text should be
   - [ ] highlights land on the benefit words in every locale; RTL locales read right to left
   - [ ] UI strings inside screens are translated too, and correct (plurals, number/date formats)
7. **Deliver:** report the output folder, the targets × locales rendered, and what still needs a human:
   native-speaker review; **if HTML mocks were used, say they must be replaced by real captures before App Store submission**;
   app bugs you noticed while reading the code (e.g. broken plurals), reported, not silently baked into the screenshots.
   `--fastlane` also writes `out/fastlane/` for `fastlane deliver` / `supply` upload (`out/.build/` is scratch; ignore it).

## Quick reference

| Need | Config |
|---|---|
| Which store sizes | `"targets": ["ios-6.9","ipad-13","android-phone","play-feature-graphic"]` (+ `@landscape`); Mac `mac`; Windows `windows`; watch `watch-ultra`, `wear-os` (raw UI only) |
| Device frames | `"device": { "model": "iphone\|iphone-notch\|iphone-home\|ipad\|android\|android-flat\|android-tablet\|apple-watch\|wear-os\|macbook\|desktop\|mac-window\|windows-window\|browser\|none" }` — `examples/devices/` |
| Cross-device | layouts `phone-watch` `watch-hero` `laptop-phone`; slide `targets: ["watch"]` / `["desktop"]` to give a family its own slides |
| Layout (41) | device: `text-top text-bottom hero device-hero screen-hero tilt-left tilt-right corner frameless landscape` · multi: `two-devices three-devices phone-tablet before-after mosaic` · callouts: `pop-out metric annotated` · proof/info: `feature-grid steps stats review awards split-photo caption-only` · wide: `text-left text-right` · `caption-top` (caption band only) · `blank` · **signature**: `spotlight big-type ticker arch orbit lens layers notify deck` (see `examples/signature/`) |
| Colors | `"preset": "aurora\|midnight\|sunset\|ocean\|forest\|mint\|paper\|candy\|citrus\|lilac\|coral\|mono"` on theme or slide |
| Device color / style | `"device": { "style": "real\|clay\|outline\|frameless", "color": "natural-titanium" \| "#hex" }` |
| Background | string CSS, or `{ color, gradient, mesh[], image, overlay, pattern, noise, scene }`; `scene`: ridge/waves/dunes/aurora/stars landscape |
| Highlight words | `"**one tap**"` in copy + `theme.highlight` (or per slide `"highlight"`): `style: color \| marker \| underline \| gradient`, `color` |
| Per-size / per-language tweak | `"byTarget": { "ipad-13": {...} }`, `"byLocale": { "de": {...} }` on slides or elements |
| Slide only on some sizes | `"targets": ["ios"]` / `"skipTargets": ["play-feature-graphic"]` |
| Phone spanning 2 slides | top-level `"panorama"` + element `"seam": 2` (border of slides 2\|3), `"dx"` nudge, `"slide": n` for slide-relative x — see `examples/gallery/panorama.config.json` |
| Ready-made panorama | `"panorama": { "pattern": ... }`: signature `wave-ride timeline giant-word constellation stage ticker` (no device cut), classic `flow peek cascade zigzag bridge crossing landscape-lay scatter giant` (safest first); slide 1 always stands alone; check `_preview/*__store.jpg` (cards with gaps) — see `examples/panorama-patterns/` |
| Elements | `badge` `zoom` (magnified crop) `callout` `arrow` `card` `stars` `laurel` `shape` `image` `text` |
| Mock screen states | `"screen": "screens/stats.html?state=before"` (query reaches the mock) |

## Common mistakes

- **Captions describe UI** ("Settings screen") → write the benefit ("Your data stays on your device").
- **One locale checked** → German/French/Russian run long, CJK short; the renderer auto-shrinks text and warns below 90% — shorten the copy rather than accept small text.
- **iPhone screenshot on an iPad target** → `model: "auto"` picks the frame from the screenshot's aspect, so the iPad slot shows a phone. Capture real iPad screens; Apple rejects stretched phone UI.
- **Ignoring `WARN text is covered`** → a device sits on top of the caption; move one.
- **Feature graphic gets every slide** → mark other slides `"skipTargets": ["play-feature-graphic"]`.
- **Captions or frames on watch store shots** → Wear OS rejects them and Apple masks watch shots itself; the `watch-*`/`wear-os` targets render the bare UI. Put framed watches in phone slides (`phone-watch`) or social images instead.
- **Phone slides leaking into watch/Mac/Windows targets** → give each family its own slides with `"targets": ["watch"]` / `["desktop"]`, and `"skipTargets"` on the phone ones.
- **Fonts missing a script** → the renderer adds Noto fonts for ja/ko/zh/ar/he/th/hi automatically; keep `font.weights` to weights the Google font has.
