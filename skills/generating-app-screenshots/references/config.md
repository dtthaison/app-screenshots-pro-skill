# screenshots.config.json reference

Paths are relative to the config file. Coordinates for every element:

- `x` = horizontal **center** in % of one slide's width (`anchor: "left" | "right"` makes x the left/right edge for text, badge, image, shape)
- `y` = **top** edge in % of slide height
- `w` = width in % of slide width, `h` = max height in % of slide height
- font sizes (`titleSize`, `size`) in % of slide width
- `z` = stacking order (background 0, caption 3, device 2, other elements 4)

## Top level

```jsonc
{
  "app": { "name": "Streakly" },
  "defaultLocale": "en-US",                 // fallback for missing strings and screens
  // Locale lookup: exact code, then its language ("en-US" finds strings stored under "en", e.g. an .xcstrings sourceLanguage).
  // Use region codes where the store wants them (en-US, pt-BR, es-MX); plain language codes (fr, de, ja) are fine otherwise.
  "locales": ["en-US", "vi", "de", "ar", "ja"],
  "targets": ["ios-6.9", "ipad-13", "android-phone", "play-feature-graphic"],
  "output": "out",                          // relative to config
  "format": "png",                          // png | jpeg | webp (webp is not accepted by stores)
  "fastlane": false,                        // or pass --fastlane
  "strings": "copy.json",                   // or inline object, or ["copy.json", "Marketing.xcstrings"]
  "theme": { ... },
  "panorama": { ... },                      // optional, see below
  "slides": [ ... ]                         // order = upload order
}
```

### Targets (`scripts/targets.mjs`)

| id | px | notes |
|---|---|---|
| `ios-6.9` | 1320×2868 | main iPhone slot; App Store Connect scales it down to smaller iPhones |
| `ios-6.7` / `ios-6.5` / `ios-6.3` / `ios-6.1` / `ios-5.5` | 1290×2796 / 1284×2778 / 1206×2622 / 1179×2556 / 1242×2208 | only if you want hand-tuned smaller sizes |
| `iphone-duo-outer` / `iphone-duo-inner` | 1398×2034 / 2007×2853 | required from April 2027 for apps built with the iOS 27.1 SDK or later |
| `ipad-13` | 2064×2752 | required if the app runs on iPad |
| `ipad-11`, `ipad-12.9` | | optional |
| `mac` / `mac-2560` / `mac-1440` | 2880×1800 / 2560×1600 / 1440×900 | Mac App Store, 16:10; default frame `macbook`, family `desktop` |
| `watch-ultra` / `watch-ultra-2` / `watch-s10` / `watch-s7` / `watch-s4` / `watch-s3` | 422×514 / 410×502 / 416×496 / 396×484 / 368×448 / 312×390 | Apple Watch, one size for all locales; **raw** (app UI only), family `watch` |
| `wear-os` | 768×768 | Play Wear OS: 1:1, ≥ 384 px; **raw**: Google forbids frames, extra text and backgrounds |
| `windows` / `windows-4k` / `windows-1366` | 1920×1080 / 3840×2160 / 1366×768 | Microsoft Store desktop: PNG only, ≤ 50 MB, max 10; frame `windows-window`; store `msstore` |
| `android-phone` / `android-phone-hd` | 1080×1920 / 1440×2560 | Play phone, 2–8 per locale |
| `android-tablet-7` / `android-tablet-10` / `chromebook` | | Play large screens, min 4 |
| `play-feature-graphic` | 1024×500 | exactly one image |
| `og-image`, `x-post`, `product-hunt`, `instagram`, `story` | | social promo, not uploaded |

Append `@landscape` (e.g. `"ipad-13@landscape"`). Custom: `{ "id": "promo", "w": 1200, "h": 628, "model": "iphone" }`.

**Raw targets** (`raw: true`: the watches) output just the slide's `screen`, scaled to fill the exact size: no frame, caption,
background or panorama. Give watch slides their own screens and limit them with the family key:
`{ "id": "watch-1", "targets": ["watch"], "screen": "screens/watch.html", "byTarget": { "wear-os": { "screen": "screens/watch-round.html" } } }`.
`byTarget`, `targets` and `skipTargets` accept the target id, base id, store (`ios play msstore social`) or family (`watch desktop`).
Apple changes its table yearly — check the App Store Connect "Screenshot specifications" page when unsure.

## theme

```jsonc
"theme": {
  "font": { "family": "Plus Jakarta Sans", "weights": [400, 600, 800] },   // Google Font
  // local font: { "family": "Brand", "src": "fonts/Brand-Variable.ttf" }; system font: { "family": "SF Pro Display", "google": false }
  "caption": { "color": "#fff", "accent": "#ffcf5c", "titleWeight": 800, "subtitleOpacity": 0.85, "uppercase": false, "textShadow": "0 2px 12px rgba(0,0,0,.3)" },
  "highlight": { "style": "color", "color": "#ffcf5c" },   // color | marker | underline | gradient (+ "gradient": {...})
  "background": { ... },                                    // default for every slide
  "device": { "style": "real", "color": "black-titanium", "shadow": true, "glare": false }
}
```

## Backgrounds

A CSS string (`"#101020"`, `"linear-gradient(160deg,#ff8a5c,#7c5cff)"`) or an object; layers stack in this order:

```jsonc
{
  "color": "#14112e",
  "gradient": { "type": "linear", "angle": 160, "stops": ["#ff8a5c", "#ff5c8a 55%", "#7c5cff"] },  // or radial (+ "at") / conic, or a CSS string
  "mesh": [ { "color": "#7c5cff", "x": 15, "y": 10, "size": 55, "opacity": 1 } ],                 // soft blobs → mesh gradient
  "image": { "src": "bg/photo.jpg", "fit": "cover", "position": "center", "blur": 20, "brightness": 0.7, "opacity": 1 },
  "overlay": "linear-gradient(180deg,rgba(0,0,0,.5),transparent 40%)",                              // readability over photos
  "pattern": { "type": "dots", "color": "rgba(255,255,255,.15)", "size": 48 },                       // dots | grid | diagonal
  "noise": 0.08,                                                                                     // film grain 0–0.2
  "scene": { "type": "ridge", "colors": ["#4c3b8f", "#2e2366", "#1a143f"], "height": 34, "seed": 7 }  // drawn landscape, see below
}
```

`scene` draws a landscape over the gradient: `type` `ridge` (mountains) · `waves` · `dunes` · `aurora` (blurred light bands) · `stars`.
`colors` go back → front, `height` is % of the canvas, `seed` changes the shape. Add stars to any type with `"stars": true`
(`count`, `starsTo`: how far down as 0–1). Scenes are made for `panorama.background`, where one landscape runs through the whole set.

## slides

```jsonc
{
  "id": "track",                       // used in filenames: 02_track.png
  "layout": "text-top",
  "eyebrow": "@track.eyebrow", "title": "@track.title", "subtitle": "@track.subtitle",  // "@key" → strings; literal text also OK
  "screen": "screens/{locale}/home.png",   // {locale} → en-US, then language (de), then defaultLocale. .html screens are rendered @3x
  "screen2": "screens/{locale}/detail.png",// second device in "two-devices"
  "background": { ... },               // overrides theme.background
  "device": { "color": "cosmic-orange", "tiltY": -12 },     // merged into the layout's device
  "device2": { ... },
  "caption": { "y": 8, "titleSize": 8 },                    // merged into the layout's caption
  "highlight": { "style": "marker", "color": "#fff3d6" },   // overrides theme.highlight on this slide
  "elements": [ ... ],                 // extra elements; one with id "device"/"caption" overrides that layout element
  "targets": ["ios"], "skipTargets": ["play-feature-graphic"],   // ids, base ids or stores (ios | play | social)
  "byTarget": { "ipad-13": { "layout": "text-bottom" } },
  "byLocale": { "ja": { "caption": { "titleSize": 6.5 } } }
}
```

### Layouts

Every layout adapts to tall (phone), tablet and wide canvases. Layouts marked → fall back to `text-left` on wide canvases.
See all of them rendered: `examples/gallery/out/index.html` (config: `examples/gallery/layouts.config.json`).

| layout | composition | extra slide fields | use for |
|---|---|---|---|
| `text-top` | caption top, device bleeds off bottom → | | most slides |
| `text-bottom` | device top, caption bottom → | | variety |
| `hero` | big caption, large device low → | (add a rating `badge`) | slide 1 |
| `device-hero` | huge device, small corner caption → | | striking UI |
| `screen-hero` | device clipped ~30% off the top, caption below → | | games, video, immersive |
| `tilt-left` / `tilt-right` | 3D-tilted device (14°) → | | lifestyle, fitness, social |
| `corner` | big rotated device from bottom-right, left caption → | | energy |
| `two-devices` | back + front phone → | `screen2` | two related screens |
| `three-devices` | fan of three → | `screen2`, `screen3` | overview |
| `phone-tablet` | iPad behind, phone in front → | `screen2` (tablet) | cross-device |
| `landscape` | landscape device; on tall canvases stacks two | `screen2` (optional) | games, video, maps |
| `pop-out` | device + 2 magnified UI cards → | `popouts: [{crop:[x,y,w,h]}]` | point at details |
| `metric` | device + floating white achievement card → | `metric: {icon,value,label,color}` | streaks, savings |
| `annotated` | flat device + chips with lines to UI spots → | `callouts: [{text, at:[x%,y%] of screen, side}]` | productivity, B2B |
| `before-after` | two devices + labels, left half dimmed → | `screen2`, `labels: [a,b]` | transformations |
| `frameless` | rounded screenshot, no frame | | UI focus |
| `mosaic` | tilted 2×2 collage of frameless screens | `screens: [...]` | breadth |
| `feature-grid` | caption + icon tiles (2 cols; 3 on wide) | `features: [{icon,title,text}]` | slide 4+ |
| `steps` | caption + numbered rows | `steps: [{title,text}]` | how it works |
| `stats` | caption + big numbers (+ small device) | `stats: [{value,label}]`, `screen` optional | data-led proof |
| `review` | stars + headline + quote card + clipped device | `review: {stars,quote,author}` | social proof (real reviews only) |
| `awards` | caption + laurel wreaths + device | `awards: [{title,subtitle}]` | real awards only |
| `split-photo` | lifestyle photo top, device overlapping → | `photo` | context |
| `caption-only` | big statement | | closing slide |
| `text-left` / `text-right` | caption one side, device other | | wide canvases |
| `caption-top` | caption band only; panorama patterns place the devices | | panoramas |
| `blank` | nothing; place `elements` yourself | | custom |

#### Cross-device layouts

| layout | composition | extra slide fields | use for |
|---|---|---|---|
| `phone-watch` | phone with a watch in front, lower right | `screen2` (watch UI), `watchModel` (`apple-watch` default, `wear-os` on Play), `phoneModel`, `watch: {color, band}` | "also on your wrist" |
| `watch-hero` | one big watch with straps under the caption | `screen` = watch UI, `watchModel`, `device: {color, band}` | watch launch, social, website |
| `laptop-phone` | laptop with a phone in front (tall and wide canvases) | `screen2` (desktop UI), `laptopModel` (`macbook`; `desktop` on Windows), `device2: {color}` | cross-platform, sync |

All device frames rendered: `examples/devices/out/index.html` (config: `examples/devices/devices.config.json`).

#### Signature layouts (our own look: light, type, motion, depth)

All work on phone and tablet canvases (→ `text-left` on wide). Rendered: `examples/signature/out/index.html`
(config: `examples/signature/signature.config.json`).

| layout | composition | extra slide fields | use for |
|---|---|---|---|
| `spotlight` | light beam from above, device standing on a glowing floor | `beam: {color, floor, opacity}` | launches, premium; dark backgrounds |
| `big-type` | giant gradient word + offset outline echo, device rising over it | `word` (default: the `**highlight**` of the title), `upper` | bold one-word messages |
| `ticker` | two marquee bands of repeated words, one behind and one in front of the device | `ticker: "text"` or `["back", "front"]`, `tickerColor`, `tickerBackground` | energy, sports, sales, launches |
| `arch` | device rising out of a glowing arch portal with a halo and a sun dot | `arch` (fill), `haloColor`, `sun` | calm, wellness, travel, premium |
| `orbit` | device inside a 3D orbit ring (passes behind and in front); chips ride the ring | `orbit: [{icon,text}]` (≤ 4) | feature overview |
| `lens` | magnifier circle enlarging one spot, joined to it by a line | `lens: {at:[x%,y%] of screen, span, x, w, color}` | one small but key detail |
| `layers` | 3D-tilted device with UI pieces lifted off the screen toward you | `layers: [{crop:[x,y,w,h]}]` (≤ 3) | what a screen is made of |
| `notify` | notification banners cascading onto the device | `notifications: [{icon,title,text}]` (≤ 3) | reminders, messages, alerts |
| `deck` | three phones stacked like a deck of cards, back ones dimmed | `screen2`, `screen3` | flows, sequences |

`lens.at` depends on the screen layout, so set it per size with `byTarget` (the iPad screen differs from the iPhone one).

### Presets

`theme.preset` sets the whole set; `slide.preset` re-themes one slide (background, caption colors, highlight, card style, accent, device color).
`aurora midnight sunset ocean forest mint paper candy citrus lilac coral mono` (`scripts/presets.mjs`). Explicit keys win;
`background`, `highlight` and `card` are replaced as a whole, never mixed.

## Elements

All accept `x y w h z rotate opacity hidden byTarget byLocale`.

| type | key props |
|---|---|
| `caption` | `eyebrow title subtitle align(left/center/right) valign(top/center/bottom) titleSize subtitleSize color accent font subtitleFont hyphens` — auto-shrinks to fit `h`; words hyphenate only in de/nl/nordic/slavic/hu/tr/el (`hyphens: "auto"` or `"manual"` overrides) |
| `device` | `screen model style(real/clay/outline/frameless) color tiltX tiltY rotate perspective shadow(true/false/css) glare landscape fit(cover/contain) buttons cutout radius dim`(0–1 darken). Watches: `band` (strap color, or `false`). Windows: `title chrome(light/dark) icon` (Windows) `url` (browser) |
| `text` | `text size weight color align font lineHeight` (+ `h` to auto-fit). Display type: `stroke` (outline width, % of slide width) `strokeColor` `gradient` (fill) `nowrap` `tracking` (em) `upper` `italic` `fit:"width"` (one line sized to `w`) `pick:"highlight"` (use only the `**marked**` words) |
| `badge` | `text size background color weight shadow` — pill, e.g. "⭐ 4.9 · 20K ratings", "Editor's Choice" |
| `image` | `src fit radius shadow` — logo, award laurel, sticker; `{locale}` allowed in src |
| `shape` | `shape(circle/rect) fill(color or gradient) blur radius(number or CSS string, e.g. "9999px 9999px 0 0" for an arch) stroke shadow blend clip` (CSS clip-path, e.g. a light-beam polygon) — glows, beams, arches, rings |
| `zoom` | `screen crop:[x,y,w,h]% radius border shadow tiltX tiltY` — magnified crop as a floating card; lens: `circle:true focus:[x,y] span` |
| `arrow` | `from:[x,y] to:[x,y] color width curve head(false = plain line) dash:[on,off] dot(end-dot radius) dotColor` — pointers, journey lines |
| `callout` | `text to:[x,y] anchor(left/right) size background color dotColor` — chip with a line + dot |
| `card` | `icon(emoji or image path) number value title text direction(row/column) align padding background border shadow color muted accent iconSize titleSize textSize valueSize quote` |
| `stars` | `count rating(e.g. 4.5) size color emptyColor anchor` |
| `laurel` | `title subtitle w color` — award wreath |
| `band` | `text x y w(length) rotate size background color separator offset upper pick` — a ticker strip of repeated words |
| `ribbon` | `from to y amp period width colors[] phase` — a sine-wave band; in a panorama `from`/`to` are global x (0…N×100), so one ribbon threads through every slide |

Device models (`model`, or `auto` = picked from the target and the screenshot's aspect):

| model | looks like | mock viewport (CSS px, rendered @3x) |
|---|---|---|
| `iphone` | Dynamic Island iPhone | 440×956 |
| `iphone-notch` | iPhone X–14 notch | 390×844 |
| `iphone-home` | iPhone 8-style home button | 414×736 |
| `ipad` | iPad, thin bezels | 1032×1376 |
| `android` / `android-flat` | Android phone, punch-hole camera; rounded / flatter corners | 412×915 |
| `android-tablet` | Android tablet | 800×1280 |
| `apple-watch` | rectangular watch with crown, side button, sport band | 211×257 |
| `wear-os` | round watch with crown and two buttons, band | 227×227 |
| `macbook` | laptop: lid with notch + aluminum base | 1440×900 |
| `desktop` | monitor on a stand | 1600×900 |
| `mac-window` | macOS window: traffic lights + title | screen's own size (mock: 1280×800) |
| `windows-window` | Windows 11 window: icon + title + min/max/close | screen's own size (mock: 1280×800) |
| `browser` | browser window with an address bar (web apps, PWAs) | screen's own size (mock: 1280×800) |
| `none` | the screenshot only | — |

`el.w` is the visible width, including a laptop base; watch straps add height. On wide canvases with a laptop, monitor or window
(the Mac and Windows targets), `text-top hero device-hero tilt-left tilt-right text-left text-right` switch to desktop
compositions: caption on top or at the side, and the device large.

Device colors: `black-titanium natural-titanium white-titanium desert-titanium deep-blue cosmic-orange silver space-black
midnight starlight sky-blue pink teal ultramarine lavender sage obsidian porcelain hazel bay mint jet-black rose-gold gold graphite
space-gray aluminum clay-white clay-black` or any `#hex`.
Use the brand color, or a neutral that contrasts with the background.

## panorama (connected set)

The whole set renders as one wide canvas and is cut into slides, so the background flows and elements can straddle two slides
(Picasso and screenshots.pro call this "spanning").

```jsonc
"panorama": {
  "targets": ["ios-6.9"],               // optional; default = all targets
  "background": { "gradient": { "angle": 90, "stops": ["#160f3a", "#6d28d9 38%", "#ea580c 80%", "#f59e0b"] } },
  "elements": [
    { "type": "device", "seam": 1, "dx": 22, "y": 38, "w": 66, "rotate": 11, "screen": "screens/stats.html" },  // straddles slides 1|2
    { "type": "device", "seam": 3, "dx": -34, "y": 32, "w": 56, "rotate": -9, "screen": "screens/remind.html" }, // crossing pair on 3|4
    { "type": "device", "seam": 3, "dx": 18, "y": 42, "w": 56, "rotate": 8, "screen": "screens/profile.html", "z": 5 },
    { "type": "device", "seam": 5, "y": 34, "w": 118, "landscape": true, "rotate": -7, "screen": "screens/focus.html" }, // lying across 5|6
    { "type": "arrow", "from": [30, 97], "to": [575, 93], "curve": 0.012, "width": 0.45 },                         // one line through the set
    { "type": "badge", "slide": 2, "x": 70, "y": 30, "text": "New" }                                                // x relative to slide 2
  ]
}
```

Positioning across slides: `x` is in % of ONE slide and runs 0…N×100 over the set (x=150 = middle of slide 2).
`"seam": n` centers the element on the border between slide n and n+1; `dx` nudges it (−: left, +: right).
`"slide": n` makes `x` (and arrow `from`/`to`) relative to slide n. All panorama elements accept `byTarget`/`byLocale`.

Slides keep their own layouts; use `layout: "blank"` + a `caption` element when a spanning device should own the slide.
Leave out a slide's `background` so the panorama shows through. Keep captions ≥ 6% away from seams; never split a caption
across a seam (each slide is uploaded and shown alone in search results). The renderer warns when a spanning device covers text,
and `out/index.html` shows a seamless **joined view** of the set above the individual files.
Full example: `examples/gallery/panorama.config.json`.

### Patterns (no hand placement)

`"pattern"` places one device per slide from each slide's `screen`. Slides then default to the `caption-top` layout
(caption band only), so the pattern owns the devices. Add your own `elements` on top if needed.

```jsonc
"panorama": {
  "pattern": "peek",
  "patternOptions": { "w": 70, "y": 27 },             // device width / top in % of one slide; also landscapeScreen for landscape-lay
  "background": { "gradient": { "angle": 180, "stops": ["#ffb48a", "#ff7e8a"] }, "scene": { "type": "dunes", "height": 30 } }
}
```

| pattern | seam risk | what it does |
|---|---|---|
| `flow` | none | One centered device per slide; only the background connects. Every card stands alone. |
| `peek` | low | Each device sits off-center, so its edge peeks into the next card and invites the swipe. |
| `cascade` | low | Devices step down and lean into the next card, like a staircase. |
| `zigzag` | low | Devices alternate high/low and left/right, hugging the seams in a wave. |
| `bridge` | medium | Slide 1 stands alone; later devices straddle every other seam (2\|3, 4\|5). |
| `crossing` | medium | Crossed phone pairs over seams 2\|3 and 4\|5. |
| `landscape-lay` | medium | Landscape phones lie across seams 2\|3 and 4\|5. |
| `scatter` | medium | Many small tilted phones float across the set like a collage. |
| `giant` | high | One oversized tilted device spans slides 2–3. |

**Signature patterns:** the connection is drawn by light, type and lines, so no phone is cut by the store gap (all risk: none).

| pattern | what it does | patternOptions |
|---|---|---|
| `wave-ride` | a glowing wave runs through the set; each phone rides it, rising and tilting with the curve | `waveY`, `period`, `color` |
| `timeline` | dashed journey line with numbered stops; each phone hangs from its stop | `labels: [...]`, `labelColor`, `color` |
| `giant-word` | one giant gradient + outline word runs along the bottom of the set behind the phones | `word` (default `app.name`), `wordY` |
| `constellation` | phones at different heights joined by dotted star-map lines (use a `stars` scene) | `color` |
| `stage` | one stage floor across the set with a spotlight on each phone; dark themes | `beam` |
| `ticker` | two marquee bands run through the whole set, behind and in front of the phones | `ticker: ["back", "front"]`, `tickerColor` |

Pick by risk. Each slide is uploaded as its own image, and the stores show them as separate rounded cards with a gap,
and the gap cuts any device that crosses a seam. Shoppers mostly see slides 1–3, often as search thumbnails. So every pattern
keeps slide 1 self-contained. Use a signature pattern or `flow`/`peek` when in doubt; keep `giant`/`crossing` for bold brands that check the store view.
Make separate panoramas per device class (iPhone vs iPad aspect differs); use `byTarget` in `patternOptions` or per-target configs.
All 15, rendered: `examples/panorama-patterns/index.html` (configs: `examples/panorama-patterns/<pattern>.config.json`).

### Seam checks and previews

- **WARN**: a caption within 3.5% of a seam. Keep captions ≥ 6% away and never split one across slides.
- **NOTE**: a device crosses a seam, with the share on the smaller side. Under ~10% reads as a teaser; 30–50% is a deliberate split.
- `_preview/<target>__<locale>__strip.jpg` is the joined design. `__store.jpg` is the **store view**: the same slides as
  rounded cards with gaps, which is what shoppers actually see. Judge spanning devices in the store view, not the strip.

## CLI

`node scripts/render.mjs <config> [--out dir] [--locales a,b] [--targets a,b] [--slides a,b] [--format png|jpeg|webp] [--supersample 2] [--fastlane] [--no-preview]`
Rendering happens at `supersample`× (default 2; config `"supersample"`) and is downsampled with Lanczos for crisp edges. Use 1 for quick drafts.
Screens may carry a query (`screens/stats.html?state=before`) that the HTML mock reads, so one mock can show several states.
Exit code 0 = clean; 1 = validation errors (wrong size, alpha, too many files, overflowing text, missing screen/string); 2 = crash.
Outputs: `out/<target>/<locale>/NN_<id>.png`, `out/_preview/*.jpg` contact sheets (rows of 6, for QA),
`out/index.html` (full-resolution gallery with slide + layout labels), `out/manifest.json`,
and with `--fastlane`: `out/fastlane/screenshots/<asc-locale>/` + `out/fastlane/metadata/android/<play-locale>/images/...`.
Set `CHROME_PATH` if Chrome isn't installed in the default place.
