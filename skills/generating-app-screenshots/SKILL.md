---
name: generating-app-screenshots
description: Use when making App Store or Google Play screenshots, store listing images, marketing screenshots, a Play feature graphic, app preview videos, product page header, search results and In-App Event assets, or social promo images for a mobile app — framed devices with captions, device colors, gradient or image backgrounds, panoramic sets, or translated/localized screenshot sets — especially when starting from an app's codebase (iOS, Android, Flutter, React Native, Expo, web) or from simulator/device captures. Alternative to screenshots.pro, AppScreens, Picasso, BrandBird.
---

# Generating App Screenshots

One JSON config → App Store / Play screenshots and app preview videos for every store size × locale, rendered by headless Chrome
(`scripts/render.mjs`) and ffmpeg, with CSS device frames and store-rule checks (size, alpha, count, duration).

**Core principle:** screenshots sell *benefits*, not screens. Read the app, caption what users get, render, check every preview, fix.

## Workflow

1. **Read the app** → name, value props, top 4–6 features, brand colors, fonts, supported locales, existing translations.
   Per stack: [references/reading-the-app.md](references/reading-the-app.md).
2. **Get raw screens**, best first: (a) simulator/emulator captures per locale (commands: reading-the-app.md);
   (b) user-supplied PNGs; (c) HTML mocks rebuilt from the app's UI code (`screens/*.html`, read `?locale=`);
   (d) screen recordings for previews (reading-the-app.md §2b). Never invent features the app lacks.
3. **Write copy + translations** → `copy.json`. Rules and locale codes: [references/copy-and-locales.md](references/copy-and-locales.md).
4. **Write `screenshots.config.json`** ([references/config.md](references/config.md)).
   Start from `examples/demo/screenshots.config.json` (normal set), `examples/demo/panorama.config.json` (connected set),
   or copy slides from `examples/gallery/layouts.config.json` (every layout × preset).
   Pick a brand-matching `theme.preset`; vary `preset`/`layout` per slide for rhythm.
   Add `previews` for a preview video (start from `examples/preview/`). It plays **first** on the store, so scene 1 and the poster carry the hook.

   **Preview video from real footage** (App Store app previews; iPhone only in this release):
   1. **Brief.** From the code write `preview-brief.json` next to the config: category, signals, moments (things that move, with how to reach each), and the owner's wishes (must-show, must-avoid, channels, tone, `disclose`). Ask the owner anything the code can't say. Fields: [config.md → Real footage previews](references/config.md#real-footage-previews); vocabulary: [concepts.md](references/video/concepts.md).
   2. **Recommend:** `node <skill-dir>/scripts/recommend.mjs preview-brief.json` gives 3 picks (safe, strongest, bold).
   3. **Tell the owner the 3 storylines in words**, no JSON, and let them choose. Don't reorder the ranking; you may note a disagreement.
   4. **Storyboard.** The pick becomes a `previews[]` entry with `concept`, `record` and scenes (`full-screen` / `caption-band` / `end-card`, `moment`, `draft` stills). Run `node <skill-dir>/scripts/render.mjs <config> --check`; fix every ERROR and WARN. Start from `examples/preview-recorded/`.
   5. **Record:** `node <skill-dir>/scripts/record.mjs <config> --preview <id> [--takes 3]` (needs Maestro 2.6+ and a booted simulator; setup and fallback: [reading-the-app.md §2b](references/reading-the-app.md)).
   6. **Review `recordings/<locale>/<preview>.sheet.jpg`** (read the image). Do not render until none of these is true:
      - [ ] personal data (names, emails, phone numbers) other than the seeded persona
      - [ ] error states or toasts
      - [ ] debug overlays, dev-client banners, "Preparing capture…" or other scaffolding screens
      - [ ] the keyboard, unless it is the point
      - [ ] spinners longer than 1 s that the speed ramp will not absorb
      - [ ] text that appears pasted rather than typed
      - [ ] the status bar is not 9:41

      Fix by trimming with marks (`clip.from`/`to`), adding `wait`s, or re-taking. Never paint over the UI.
   7. **Render and QA** (workflow steps 5–6), then **hand over** with `out/_preview/<id>.report.md` (workflow step 7).

   Knowledge base, read when you need the reasons or the numbers: [concepts](references/video/concepts.md), [categories](references/video/categories.md), [store-rules](references/video/store-rules.md), [motion](references/video/motion.md), [sources](references/video/sources.md).
5. **Render:**
   ```bash
   cd <skill-dir> && [ -d node_modules ] || npm install --no-fund --no-audit
   node <skill-dir>/scripts/render.mjs path/to/screenshots.config.json [--locales en-US,vi] [--targets ios-6.9] [--slides hero] [--fastlane] [--previews tour] [--scenes hero,stats]
   ```
   Iterate on one locale and target, then run all. A preview takes 1–2 min per locale (4K: 3–5): iterate with `--scenes`, `--only-previews`, `"renderScale": 0.5`.
6. **QA — required.** Read every `out/_preview/<target>__<locale>.jpg` contact sheet; play the videos in `out/index.html`.
   Re-render until all are true:
   - [ ] exit code 0, no `ERROR` / `WARN` lines; `NOTE` lines read too (draft previews, poster time, clips)
   - [ ] no caption clipped, covered by a device, or visibly smaller than its siblings
   - [ ] every device screen is **full**, no big empty area under the content (add realistic rows/data)
   - [ ] no missing glyphs (`#`, `?`, empty boxes) in icons or CJK/Thai/Arabic text
   - [ ] highlights land on the benefit words in every locale; RTL locales read right to left
   - [ ] UI strings in screens are translated and correct (plurals, number/date formats)
   - [ ] previews: read every `_preview/*__<id>.jpg` filmstrip; the poster frame reads alone; nothing moves at the loop point; clips are not stretched; labels are timed right in every locale
7. **Deliver:** report the output folder, targets × locales, and what still needs a human:
   native-speaker review; **if HTML mocks were used, say real captures must replace them before App Store submission**;
   for previews: the files, the poster time for App Store Connect, a draft notice when scenes are stills or mocks, and the hand-over report `out/_preview/<id>.report.md` (what was cut, WARN and NOTE lines, what a human must still do: native-speaker caption review, accepting a network take, uploading);
   app bugs noticed in the code (e.g. broken plurals), reported, not baked into the screenshots.
   `--fastlane` writes `out/fastlane/` for `deliver` / `supply`: screenshots and app previews (`deliver` takes one `preview_frame_time_code` per upload, so give all previews the same poster time); creative assets go to `out/fastlane/creative/` for manual upload in App Store Connect. `out/.build/` is scratch.

## Quick reference

| Need | Config |
|---|---|
| Which store sizes | `"targets": ["ios-6.9","ipad-13","android-phone","play-feature-graphic"]` (+ `@landscape`); `mac`, `windows`, `watch-ultra` (raw; `@styled`), `wear-os` (raw); Play extras `android-tv` `tv-banner` `android-xr` `android-auto` (raw) `play-promo` (video for YouTube) |
| Device frames | `"device": { "model": "iphone\|iphone-notch\|iphone-home\|ipad\|android\|android-flat\|android-tablet\|apple-watch\|wear-os\|macbook\|desktop\|mac-window\|windows-window\|browser\|none" }` — `examples/devices/` |
| Cross-device | layouts `phone-watch` `watch-hero` `laptop-phone`; family slides with `targets: ["watch"]` / `["desktop"]` |
| Layout (41) | `text-top text-bottom hero device-hero screen-hero tilt-left tilt-right corner frameless landscape` · `two-devices three-devices phone-tablet before-after mosaic` · `pop-out metric annotated` · `feature-grid steps stats review awards split-photo caption-only` · wide `text-left text-right` · `caption-top` `blank` · **signature** `spotlight big-type ticker arch orbit lens layers notify deck` (`examples/signature/`) |
| Colors | `"preset": "aurora\|midnight\|sunset\|ocean\|forest\|mint\|paper\|candy\|citrus\|lilac\|coral\|mono"` on theme or slide |
| Device color / style | `"device": { "style": "real\|clay\|outline\|frameless", "color": "natural-titanium" \| "#hex" }` |
| Background | CSS string, or `{ color, gradient, mesh[], image, overlay, pattern, noise, scene }` (`scene`: ridge/waves/dunes/aurora/stars) |
| Highlight words | `"**one tap**"` in copy + `theme.highlight` (or slide `"highlight"`): `style: color\|marker\|underline\|gradient`, `color` |
| Per-size / per-language tweak | `"byTarget": { "ipad-13": {...} }`, `"byLocale": { "de": {...} }` on slides or elements |
| Slide only on some sizes | `"targets": ["ios"]` / `"skipTargets": ["play-feature-graphic"]` |
| Phone spanning 2 slides | `"panorama"` + element `"seam": 2` (slides 2\|3), `"dx"` nudge, `"slide": n` — `examples/gallery/panorama.config.json` |
| Ready-made panorama | `"panorama": { "pattern": ... }`: `wave-ride timeline giant-word constellation stage ticker` (no device cut), `flow peek cascade zigzag bridge crossing landscape-lay scatter giant` (safest first); check `_preview/*__store.jpg` — `examples/panorama-patterns/` |
| Elements | `badge` `zoom` (crop) `callout` `arrow` `card` `stars` `laurel` `shape` `image` `text` |
| Preview videos | targets `preview-iphone` `preview-iphone-16-9` `preview-iphone-4.7` `preview-ipad` `preview-ipad-9.7` `preview-mac`: 15–30 s, max 3 per size and locale |
| Creative assets | images `app-header` `search-asset` `event-card` `event-details` (+ `-16-9`, png only), videos `header-video` `search-video` `event-card-video` `event-details-video`: 1 per locale; wide slides need `"targets": ["creative"]` |
| `previews` | `id targets music poster transition loop clipLocale byTarget scenes` — [config.md → previews](references/config.md#previews) |
| Footage preview | `concept` (picks the checks), `record` (steps `open tap swipe type wait mark`), scene `clip: { from, to, speed: "auto" }`, `tap` (`ripple\|ring\|spotlight\|none`, default ripple), `captionMotion` (`rise\|words\|lines\|pop\|none`), `draft`, `moment`; `--check` — [config.md](references/config.md#real-footage-previews) |
| Footage layouts | `full-screen` (recording edge to edge, scrim caption), `caption-band` (solid band, screen below), `end-card` (icon, name, tagline) |
| Mock screen states | `"screen": "screens/stats.html?state=before"` (query reaches the mock) |

## Common mistakes

- **Captions describe UI** ("Settings screen") → write the benefit ("Your data stays on your device").
- **One locale checked** → German/French/Russian run long; the renderer shrinks text and warns below 90% — shorten the copy.
- **iPhone screenshot on an iPad target** → `model: "auto"` frames by aspect, so the iPad slot shows a phone; capture real iPad screens.
- **Ignoring `WARN text is covered`** → a device sits on the caption; move one.
- **Feature graphic gets every slide** → `"skipTargets": ["play-feature-graphic"]` on the others.
- **Captions or frames on watch store shots** → Wear OS rejects them; `wear-os` and `watch-*` render bare UI (`@styled` adds background and a short caption on Apple Watch). Framed watches go in `phone-watch`.
- **Phone slides leaking into watch/Mac/Windows** → own slides per family (`"targets": ["watch"]` / `["desktop"]`), `"skipTargets"` on phone ones.
- **Fonts missing a script** → Noto fonts for ja/ko/zh/ar/he/th/hi are added automatically; keep `font.weights` to ones the font has.
- **Preview over 30 s, or fast cuts** → an ERROR before capture; give each scene 3–5 s, pick scenes per target with `byTarget.<target>.scenes`.
- **Stills-only or wrong-language preview as final** → Apple wants the main flow recorded in the store language (§2b): one recording per locale, or `clipLocale` and say so; the "draft" NOTE means this.
- **Relying on sound** → Product page header videos are muted by default and can be unmuted; search results videos cannot be unmuted. Nothing in a creative video may depend on sound.
