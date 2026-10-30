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
  "slides": [ ... ],                        // order = upload order
  "previews": [ ... ],                      // optional app preview / creative videos, see "previews"
  "videoSupersample": 1                     // render scale for videos (default 1; --supersample overrides)
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
| `story-video` | 1080×1920 | social video, no store limits; any duration |

**App preview targets** (video, `.mp4`; 15–30 s, up to 3 per target × locale; `asc` = the identifier fastlane `deliver` reads from the file name):

| id | px | `asc` | for |
|---|---|---|---|
| `preview-iphone` | 886×1920 | `IPHONE_67` | iPhone 6.9/6.5/6.3/6.1/5.8", Duo (App Store Connect scales it to the smaller slots) |
| `preview-iphone-16-9` | 1080×1920 | `IPHONE_55` | iPhone 5.5" / 4" (Home button) |
| `preview-iphone-4.7` | 750×1334 | `IPHONE_47` | iPhone 4.7" |
| `preview-ipad` | 1200×1600 | `IPAD_PRO_3GEN_129` | iPad 13" / 12.9" / 11" / 10.5" |
| `preview-ipad-9.7` | 900×1200 | `IPAD_97` | iPad 9.7" |
| `preview-mac` | 1920×1080 | `DESKTOP` | Mac, landscape; family `desktop` |

`@landscape` works on the iPhone and iPad preview targets.

**Creative targets** (family `creative`: the product page header, search results and In-App Event media; **1 per locale**, 500 MB, no alpha; they use the wide layouts, so give them their own slides with `"targets": ["creative"]` or `["app-header"]`, and `skipTargets` on the phone slides):

| image id | px | video id | video |
|---|---|---|---|
| `app-header` | 3840×1646 (21:9), png or jpeg | `header-video` | same size, 5–30 s; muted by default, can be unmuted |
| `app-header-16-9` | 5244×2950, **png only** | | |
| `search-asset` | 3840×2560 (3:2), png or jpeg | `search-video` | same size, 5–30 s; cannot be unmuted |
| `search-asset-16-9` | 5244×2950, **png only** | | |
| `event-card` | 3840×2160 (16:9) | `event-card-video` | same size, 15–30 s |
| `event-details` | 2160×3840 (9:16) | `event-details-video` | same size, 15–30 s |

Apple publishes safe areas only inside its design templates, so the renderer warns when a caption or badge leaves the central 80% of the canvas on a creative target (`caption leaves the safe area`): Apple crops these assets per device. A png-only target with `--format jpeg` is an ERROR (`use --format png`).

Append `@landscape` (e.g. `"ipad-13@landscape"`), or `@styled` to an Apple Watch target (below). Custom: `{ "id": "promo", "w": 1200, "h": 628, "model": "iphone" }`.

**Raw targets** (`raw: true`: the watches) output just the slide's `screen`, scaled to fill the exact size: no frame, caption,
background or panorama. Give watch slides their own screens and limit them with the family key:
`{ "id": "watch-1", "targets": ["watch"], "screen": "screens/watch.html", "byTarget": { "wear-os": { "screen": "screens/watch-round.html" } } }`.
`byTarget`, `targets` and `skipTargets` accept the target id, base id, store (`ios play msstore social`) or family (`watch desktop`).
**Styled Apple Watch shots**: `"watch-ultra@styled"` (any Apple Watch target) keeps the store size but renders background and
caption like a phone slide; App Store Connect accepts these and rounds the corners itself, so keep the caption short and centered.
Watch slides default to `watch-hero` there, with a strap-less watch filling the canvas under a one-line `title`. `--fastlane`
exports them as watch screenshots. Wear OS has no `@styled`: Google Play rejects captioned watch shots.
Apple changes its table yearly — check the App Store Connect "Screenshot specifications", "App preview specifications" and "Creative assets specifications" pages when unsure.

## theme

```jsonc
"theme": {
  "font": { "family": "Plus Jakarta Sans", "weights": [400, 600, 800] },   // Google Font
  // local font: { "family": "Brand", "src": "fonts/Brand-Variable.ttf" }; system font: { "family": "SF Pro Display", "google": false }
  "caption": { "color": "#fff", "accent": "#ffcf5c", "titleWeight": 800, "subtitleOpacity": 0.85, "uppercase": false, "textShadow": "0 2px 12px rgba(0,0,0,.3)" },
  // optional "titleSize" / "subtitleSize" / "eyebrowSize" (% of width) replace every layout's default size; slide "caption" sizes still win
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
| `phone-watch` | phone with a watch in front, lower right | `screen2` (watch UI), `watchModel` (`apple-watch` default, `wear-os` on Play), `phoneModel`, `watch: {color, band}` (`band: false` for the case alone) | "also on your wrist" |
| `watch-hero` | one big watch with straps under the caption (strap-less on a `@styled` watch target) | `screen` = watch UI, `watchModel`, `device: {color, band}` (`band: false` hides the straps) | watch launch, social, website, styled watch store shots |
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

## previews

App previews (the video that plays **first** on the App Store product page) and the creative videos share one top-level `previews` list. A preview is a list of **scenes**; the renderer lays the scenes out like slides, animates them, captures 30 fps frames in Chrome and encodes them with ffmpeg. `previews` and `slides` are independent: a preview does not reuse slides, but a scene is written exactly like a slide, so copy a slide into a scene to start. A single object instead of an array is accepted. Teaching examples: `examples/preview/preview.config.json` (stills, a clip, `byTarget`, every video and creative target) and `examples/preview/clip.config.json` (a scrolling recording, no frame).

```jsonc
"previews": [
  {
    "id": "tour",                                   // file name: 01_tour.mp4
    "targets": ["preview-iphone", "preview-ipad"],  // optional; default = every video target in cfg.targets (skipTargets works too)
    "theme": { ... },                               // optional overrides of cfg.theme for this video (and "preset")
    "music": { "src": "assets/loop.mp3", "volume": 0.8, "fadeOut": 1.5 },   // optional (a string is just the src); silent stereo AAC otherwise
    "poster": "stats",                              // seconds (default 5) or a scene id: the first rest frame of that scene
    "transition": "crossfade",                      // default between scenes: crossfade | push | cut | fade-through
    "loop": "soft",                                 // soft (default) | hard
    "clipLocale": "en-US",                          // which locale's recording the other locales use
    "renderScale": 1,                               // drafts: 0.5 renders at half size and upscales
    "byTarget": { "header-video": { "scenes": ["stats", "remind"], "transition": "push" } },   // also byLocale
    "scenes": [ ... ]
  }
]
```

Defaults for every preview come from `theme.video`: `{ "entrance": "rise", "transition": "crossfade", "scroll": { "speed": 1 } }` (`scroll.speed` is accepted but not used yet: a scroll always spans the scene). Merge order: `theme.video` < preview < scene.

**Always an audio track.** Every file has a stereo AAC track, silent unless `music` is set, because App Store Connect rejects a video with no audio track and simulator recordings have none. Product page header videos are muted by default and can be unmuted; search results videos cannot be unmuted. Nothing in a creative video may depend on sound (`music` on `search-video` warns). Music is cut to the video length and faded out with `fadeOut` seconds.

**Encoding.** H.264 High, 30 fps, yuv420p, `.mp4` with faststart; Level 4.0 at 11 Mbps for the app preview sizes, a higher level and 20 Mbps for the 4K creative videos (picked automatically from the frame size).

**ffmpeg** is looked up as `FFMPEG_PATH`, then the bundled `ffmpeg-static`, then `ffmpeg` on `PATH`. `ffmpeg-static` is an optional dependency: `npm install` downloads its ffmpeg binary (GPL-3.0) at install time; this repo is MIT and does not redistribute it. With no binary the renderer prints `ERROR previews need ffmpeg: npm install (ffmpeg-static), set FFMPEG_PATH, or brew install ffmpeg — or run with --no-previews`. A `FFMPEG_PATH` that does not exist is its own ERROR. Either way the screenshot pass still renders and the run exits 1.

### Scenes

A scene is a slide plus time. Every slide field works (`layout`, `eyebrow/title/subtitle`, `screen`, `screen2`, `background`, `device`, `preset`, `elements`, `targets`, `skipTargets`, `byTarget`, `byLocale`, `highlight`, `caption`).

```jsonc
{
  "id": "session",                                        // required, unique in the preview
  "layout": "text-top",
  "title": "@session.title",
  "duration": 7,                                          // seconds; default 4
  "screen": "recordings/{locale}/session.mov",            // .png/.jpg still, .html mock, or .mov/.mp4/.m4v/.webm clip
  "clip": { "start": 12, "end": 19, "speed": 1 },         // clips only: the part to show (default whole file, 1x)
  "motion": "scroll",                                     // stills only: drift (default) | scroll | none
  "labels": [                                             // sub-captions that appear during the scene
    { "at": 1.5, "until": 4, "text": "@session.swapping" },
    { "at": 4.5, "text": "@session.superset" }            // until = scene end
  ],
  "in": "rise",                                           // how the device and caption enter: rise (default) | fade | none
  "transition": "push"                                    // overrides the preview default for the cut INTO this scene
}
```

- **Timing.** Durations include the transition into the next scene (a 0.5 s crossfade overlaps the end of scene n and the start of n+1), so the total is the sum of the durations. Transition lengths are fixed: crossfade 0.5 s, push 0.6 s (new scene slides in from the right), fade-through 0.6 s (to the background color and back), cut 0. A scene must be longer than its transitions.
- **Duration limits.** App previews 15–30 s; header and search videos 5–30 s; In-App Event videos 15–30 s. Outside the range the renderer errors before capture (it does not cut, and nothing is rendered for that preview) and prints the sum: `preview is 9s; preview-iphone wants 15–30s`. Scene times are rounded to the millisecond, so `3 + 3.4 + 11.8 + 11.8` is exactly 30 s. `duration` must be a number of seconds (`"7"` is an ERROR). Pick the scenes for a shorter target with `byTarget.<target>.scenes`. Count per target × locale: up to 3 previews for the Apple preview targets, 1 for creative targets and images; the extras are not rendered (`preview-iphone|en-US: 4 previews, store max is 3`).
- **Stills.** `drift` is a slow 3% zoom (the default); `none` is static; `scroll` pans the screen from top to bottom inside the device and needs content taller than the screen. A mock with `motion: "scroll"` is rendered full-page. When the still does not overflow the device screen by more than 2%, `scroll` falls back to `drift`.
- **Clips.** A recording is cut into frames once (30 fps, cached under `out/.build/clips/`) and played on the scene's **main device** only (id `device`; a clip on another element is an ERROR). `{locale}` resolves like a screen. A clip shorter than the scene holds its last frame (WARN `clip … is 2.0s but scene "x" lasts 4s — the last frame holds`). A clip longer than the scene is cut at `clip.end` or the scene end. A clip whose aspect is more than 2% off the device screen is cropped to fill (WARN `clip 400×960 does not match the iphone screen`): record on the same device class as the frame.
- **Continuity.** When two consecutive scenes share the layout and the main device's position, the device stays put (no re-entrance) and only the caption, labels and screen change. One long recording cut with `clip.start`/`end` into several scenes with their own captions becomes chapters. Continuity is meant for `crossfade` and `cut`; with `push` the whole scene slides in while the device stays put, which contradicts itself, so pick another transition between continuous scenes.
- **Labels.** A badge under the caption (above it for bottom captions), aligned with the caption's x, in the theme accent; `at`/`until` are seconds from the scene start, fading in and out over 0.3 s. Only object labels are timed; the `before-after` layout keeps its own string `labels`.
- **Entrance and loop.** `in: "rise"`: the device rises 6% while fading in over 0.6 s, the caption follows 0.1 s later over 0.5 s; `fade` is the same without the rise; `none` shows both at once. Scene 1 fades in from the background color over 0.4 s and the last scene fades out to it over 0.6 s, so the loop point has no jump (the store autoplays previews on a loop). `"loop": "hard"` on the preview turns both fades off, for authors who cut on purpose.
- **Recording per locale.** `clipLocale: "en-US"` declares that the other locales use the en-US recording and silences the warning `[ja] no recording for this locale — using en-US; UI language in the recording does not match`. Without it the warning stays, because Apple wants the UI in the store language. It prints once per preview × target × locale, however many scenes use the fallback recording.
- **`byTarget.scenes`.** A list of scene ids picks and orders the preview's own scenes for that target (an unknown id is an ERROR); a list of scene objects replaces them. Use it so the 21:9 header carries only the one flow that sells the app.

### Creative videos

The header, search and In-App Event videos are the same `previews[]` entry with the creative targets added; they should show how the app works, so use recordings (`clip`). The 21:9 header is wide and short: switch the layout with `byTarget` (`text-left` / `text-right`, the phone at one side), keep text inside the safe area, and pick fewer scenes. When every scene of a creative video is a still, the renderer notes that the file is a draft (`header-video/en-US/chap.mp4 is a draft: every scene is a still; Apple wants the main flow recorded (see reading-the-app.md §2b)`); the same holds, as `NOTE … every scene is a still — fine for a draft`, for app preview targets. The 4K targets render at about 2–4 frames/s: render them for the default locale first, and use `motion: "none"` scenes, which reuse the previous frame.

The example's three tweaks are specific to its content; do not copy them blindly:

- `"poster": "stats"` takes the poster from that scene's rest frame instead of the 5 s default, which would land in that scene's entrance.
- `byTarget.header-video.caption` on the stats scene moves the caption (`y: 14, h: 44`) so labels stay inside the 21:9 header's safe area.
- `"caption": { "h": 13 }` on the stats scene makes the caption box shorter, so the label badge sits above the phone instead of on its top edge.

### Poster frame

App Store Connect picks the poster by **time**, not by file. `poster` is seconds (default 5, the App Store Connect default) or a scene id (the first frame where that scene is at rest, kept inside the scene and before the next scene starts covering it). The renderer writes `NN_<id>.poster.png` at that time as a reference and WARNs when the time falls inside a transition, an entrance or the loop fade (`poster 5.00s falls inside the entrance of scene "stats"`). Scene 1 and the poster carry the hook: the poster is what shoppers see before the video plays. When the time is not 5 s, the report prints `NOTE deliver: pass preview_frame_time_code "00:00:04:10"`; `deliver` takes one code for the whole upload, so previews with different poster times in one run WARN.

## CLI

`node scripts/render.mjs <config> [--out dir] [--locales a,b] [--targets a,b] [--slides a,b] [--format png|jpeg|webp] [--supersample 2] [--fastlane] [--no-preview]`
`  [--previews a,b] [--scenes a,b] [--no-previews] [--only-previews]`
Rendering happens at `supersample`× (default 2; config `"supersample"`) and is downsampled with Lanczos for crisp edges. Use 1 for quick drafts.
`--supersample` applies to both passes; the video default is 1 (`videoSupersample` in the config sets it). `renderScale` on a video target (or in a preview's `byTarget`) renders at that fraction and upscales: drafts only (`NOTE … rendered at 0.5× — drafts only`).
`--targets` and `--locales` filter both passes. `--slides` filters screenshots only. `--previews tour` renders only those previews. `--scenes a,b` renders only those scenes of a preview (for iterating; the duration check is skipped and a NOTE says so). `--no-previews` skips the video pass and `--only-previews` skips the screenshot pass (`--no-preview`, singular, is the QA sheets). A video target in `targets` with no `previews` in the config is an ERROR.
Screens may carry a query (`screens/stats.html?state=before`) that the HTML mock reads, so one mock can show several states.
Exit code 0 = clean; 1 = validation errors (wrong size, alpha, too many files, overflowing text, missing screen/string, duration out of range); 2 = crash.
Outputs: `out/<target>/<locale>/NN_<id>.png`, `out/_preview/*.jpg` contact sheets (rows of 6, for QA),
`out/index.html` (full-resolution gallery with slide + layout labels), `out/manifest.json`,
and with `--fastlane`: `out/fastlane/screenshots/<asc-locale>/` + `out/fastlane/metadata/android/<play-locale>/images/...`.
Previews add `out/<target>/<locale>/NN_<id>.mp4` and `NN_<id>.poster.png`; a filmstrip `out/_preview/<target>__<locale>__<id>.jpg` (one frame per second, numbered; read it); and in `index.html` a `<video>` per file. With `--fastlane`: `out/fastlane/app-previews/<asc-locale>/NN_<IDENT>_<id>.mp4` (for example `01_IPHONE_67_tour.mp4`), which `fastlane deliver` uploads (identifiers `IPHONE_67`, `IPHONE_55`, `IPHONE_47`, `IPAD_PRO_3GEN_129`, `IPAD_97`, `DESKTOP`); creative files (images and videos) go to `out/fastlane/creative/<asc-locale>/<baseId>_<slide-or-preview-id>.<ext>` (for example `app-header_header.png`, `header-video_tour.mp4`) and are uploaded by hand in App Store Connect. A preview with an ERROR (duration, count, size) is not copied and not listed in `manifest.json`.
A filtered run (`--targets`, `--previews`, `--scenes`, `--slides`) rewrites `manifest.json` and `index.html` with only that run's output.
Render time: about 1–2 minutes per preview per locale on a laptop, 3–5 minutes for a 4K creative video.
Set `CHROME_PATH` if Chrome isn't installed in the default place.
