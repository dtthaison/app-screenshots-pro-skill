# App previews (video) and App Store creative assets — design

Date: 2026-10-30. Status: draft for review. Target release: 1.1.0.

## Intent

Apple's [asset best practices](https://developer.apple.com/app-store/asset-best-practices/) page lists seven asset types.
The skill covers screenshots only. This release covers the rest, except the app icon:

| Apple asset | Today | After 1.1.0 |
|---|---|---|
| Screenshots | 35 targets | unchanged |
| App previews (video, up to 3 per device size and locale) | — | rendered from the same config, every size × locale |
| Product page header (image, video) | — | image targets; video via the same engine |
| Search results asset (image, video) | — | same |
| In-App Event card and details (image, video) | — | same |
| App icon | — | out of scope (Icon Composer is a different craft) |

Why now: on the App Store an app preview always sits **first**, before every screenshot, in the product page and in search.
The owner's own app, [AptusFIT](https://apps.apple.com/vn/app/aptusfit/id6759816583), shipped a 30-second preview
(four chapters, real screen recordings in a white iPhone, uppercase caption on top, sub-labels such as "SWAPPING" and
"SUPERSET" mid-chapter). It was made by hand, in one language. Everything the skill already does for stills (captions from
the codebase, 12 locales, store-exact output, QA, fastlane) should apply to that video.

## Goals

1. One config renders app previews for every video target × locale, validated against Apple's app preview spec, ready to upload.
2. Two sources of motion, same config shape: **stills with motion** (what every user already has, including HTML mocks) and
   **screen recordings** (what Apple wants in the final submission). A draft from stills becomes the real preview by changing one path per scene.
3. The four static creative assets become ordinary targets, reusing the existing layouts.
4. The agent can QA a video the way it QAs stills: a filmstrip image per output, plus the usual warnings.
5. The AptusFIT showcase gets a preview, in every language it already shows.

## Non-goals

- App icon generation.
- Google Play promo video (a YouTube link in Play Console, not an upload).
- Apple TV and Apple Vision Pro previews. The target table makes them a one-line addition later.
- Uploading itself. `--fastlane` lays files out for `deliver`; creative assets have no upload tool, see "Delivery".
- Voice-over, subtitles, captions burned in from a transcript. Music is a file the user supplies.

## Anti-goals (what would make this a failure even if it works)

- A preview Apple rejects: wrong resolution, outside 15–30 s, over 30 fps, stretched UI, text that Apple's rules forbid.
- Non-deterministic output: two renders of the same config must give the same frames. No screen recording of a live browser.
- Fast motion and quick cuts. Apple's guidance is slow, legible, loops cleanly, works muted.
- A video that needs a video editor afterwards.

## How it gets made (decided)

- **Same renderer, one new module.** `scripts/video.mjs` builds a timeline from scenes, drives one headless Chrome page
  frame by frame with a `window.__seek(t)` function, and pipes PNG frames to ffmpeg. Scenes are rendered by the existing
  layout/element code, so every layout, device, preset, background and `**highlight**` works in video unchanged.
- **Deterministic frames.** No CSS animations or `requestAnimationFrame`. Every animated value is a pure function of `t`
  (seconds), evaluated in the page by `__seek(t)`; the renderer then calls `page.screenshot()`. Clip frames are
  pre-extracted images swapped by `__seek`, never a playing `<video>` (Playwright's Chromium cannot decode H.264 anyway).
- **ffmpeg** via the `ffmpeg-static` npm package (optional dependency, fetched on first install), with `FFMPEG_PATH`
  and a system `ffmpeg` on `PATH` as overrides. Verified on the owner's machine: `ffmpeg-static@5.3.0` installs ffmpeg 6.0
  on macOS without Homebrew. If the binary is missing, the renderer says how to get one and skips previews with an ERROR.
- **Output encoding** (Apple's app preview spec): H.264 High profile, level 4.0, progressive, `yuv420p`, 30 fps,
  target 10–12 Mbps (`-b:v 11M -maxrate 12M -bufsize 24M`), `.mp4` with `+faststart`; audio always present:
  stereo AAC 256 kbps 48 kHz, silent (`anullsrc`) unless `music` is given. Creative-asset videos use the same encode;
  they accept 30 or 60 fps and we stay at 30.
- **Render scale.** Video renders at `supersample: 1` by default (the accepted resolutions are small and the store
  re-encodes). Stills keep 2.

## Config

### Video targets (`scripts/targets.mjs`)

All numbers in both tables were copied from Apple's live pages on 2026-10-30 ([app preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications), [creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications)). The tables are authoritative for this release; if the builder finds the live page disagrees, the live page wins and the change is noted in the CHANGELOG.

Video targets carry `video: { minSec, maxSec, fps: 30, maxMB }` and are ignored by the screenshot pass. Screenshot targets
are ignored by the preview pass. Both passes read the same `targets` list, so a config may list both kinds.

| id | px | Apple slot | notes |
|---|---|---|---|
| `preview-iphone` | 886×1920 | 6.9", 6.5", 6.3", 6.1", 5.8", iPhone Duo | the main one; ASC scales down |
| `preview-iphone-16-9` | 1080×1920 | 5.5", 4" | model `iphone-home` |
| `preview-iphone-4.7` | 750×1334 | 4.7" | model `iphone-home` |
| `preview-ipad` | 1200×1600 | 13", 12.9", 11", 10.5" | model `ipad` |
| `preview-ipad-9.7` | 900×1200 | 9.7" | model `ipad` |
| `preview-mac` | 1920×1080 | Mac | landscape only; family `desktop`, model `macbook` |
| `header-video` | 3840×1646 | product page header | 5–30 s, landscape, family `creative` |
| `search-video` | 3840×2560 | search results | 5–30 s, 3:2, family `creative` |
| `event-card-video` | 3840×2160 | In-App Event card | 15–30 s, 16:9, family `creative` |
| `event-details-video` | 2160×3840 | In-App Event details | 15–30 s, 9:16, family `creative` |
| `story-video` | 1080×1920 | social (Story / Reel), not a store upload | no duration limits, store `social` |

`@landscape` works on the iPhone and iPad previews (Apple accepts 1920×886 and 1600×1200). Max 3 previews per
Apple target × locale; the renderer errors above that. Custom video targets: `{ "id": "promo", "w": 1080, "h": 1080, "video": { "minSec": 1, "maxSec": 60 } }`.

### Static creative-asset targets

| id | px | Apple slot | format |
|---|---|---|---|
| `app-header` | 3840×1646 | product page header 21:9 | png or jpeg |
| `app-header-16-9` | 5244×2950 | product page header 16:9 | png only |
| `search-asset` | 3840×2560 | search results 3:2 (max size; min 1920×1280) | png or jpeg |
| `search-asset-16-9` | 5244×2950 | search results 16:9 | png only |
| `event-card` | 3840×2160 | In-App Event card 16:9 | png or jpeg |
| `event-details` | 2160×3840 | In-App Event details 9:16 | png or jpeg |

All: store `ios`, family `creative`, `max: 1`, no alpha, `maxMB: 500` (Apple states 500 MB for event media and nothing for the others; the existing 8 MB warning is a screenshot heuristic and does not apply to this family). Wide ones use the wide layouts (`text-left`, `text-right`,
`hero` in its desktop composition, `landscape`); `event-details` is a tall canvas and uses the phone layouts.
Give them their own slides with `"targets": ["creative"]` / `["app-header"]` and `skipTargets` on the phone slides,
the same way watch and desktop slides work today.
**Safe area (my call):** Apple publishes safe areas only inside its Figma/Photoshop templates. The renderer warns when a
caption or badge leaves the central 80% of width or height on a `creative` target; the builder checks Apple's Universal
Figma template once and adjusts that number if the template says otherwise.

### `previews` (top level)

```jsonc
"previews": [
  {
    "id": "tour",                                   // filename: 01_tour.mp4
    "targets": ["preview-iphone", "preview-ipad"],  // optional; default = every video target in cfg.targets
    "theme": { ... },                               // optional overrides of cfg.theme for this video
    "music": { "src": "assets/loop.mp3", "volume": 0.8, "fadeOut": 1.5 },   // optional; silent stereo track otherwise
    "poster": 5,                                    // seconds (default 5, ASC's default) or a scene id → first rest frame of that scene
    "transition": "crossfade",                      // default between scenes: crossfade | push | cut | fade-through
    "scenes": [ ... ]
  }
]
```

A single object instead of an array is accepted. `previews` and `slides` are independent: a preview does not reuse slides,
but a scene is written exactly like a slide, so copying a slide into a scene is the intended workflow.

### Scenes

A scene is a slide plus time. Every slide field works (`layout`, `eyebrow/title/subtitle`, `screen`, `screen2`, `background`,
`device`, `preset`, `elements`, `targets`, `skipTargets`, `byTarget`, `byLocale`, `highlight`, `caption`).

```jsonc
{
  "id": "session",
  "layout": "text-top",
  "title": "@session.title",
  "duration": 7,                                          // seconds; default 4
  "screen": "recordings/{locale}/session.mov",            // .png/.jpg still, .html mock, or .mov/.mp4/.m4v/.webm clip
  "clip": { "start": 12, "end": 19, "speed": 1 },         // for clips: the part to show (defaults: whole file, 1×)
  "motion": "scroll",                                     // for stills: none | drift | scroll (see below); default drift
  "labels": [                                             // sub-captions that appear during the scene
    { "at": 1.5, "until": 4, "text": "@session.swapping" },
    { "at": 4.5, "text": "@session.superset" }           // until = scene end
  ],
  "in": "rise",                                           // how this scene's device and caption enter: rise | fade | none
  "transition": "push"                                    // overrides the preview default for the cut INTO this scene
}
```

**Timing.** Scene durations include the transition into the next scene (transition 0.5 s overlaps the end of scene n and
the start of scene n+1). Total = sum of durations. The renderer errors when the total is outside the target's
`minSec–maxSec` and prints the sum so the author can fix durations. Apple allows 15–30 s for app previews.

**Stills with motion** (`motion`):
- `drift`: slow 3% scale-up over the scene (Ken Burns). Default.
- `scroll`: the screenshot pans from top to bottom inside the device screen over the scene, when the image is taller than the
  screen's aspect (long captures with `xcrun simctl io screenshot` of scroll views, or an HTML mock with more content than one
  viewport). The renderer measures the overflow; if there is none it falls back to `drift`.
- `none`: static.

**Clips.** Extracted once per (file, start, end, speed, output height) into `out/.build/clips/<hash>/%05d.jpg` with
ffmpeg (`fps=30`, scaled to the height the device screen needs at render scale, JPEG q=2), cached by file size + mtime.
A clip shorter than the scene holds its last frame and the renderer warns. A clip longer than the scene is cut at `end`
or the scene end, whichever is first. Clip aspect must match the device model's screen within 2%; otherwise `fit: "cover"`
crops and the renderer warns (Apple rejects stretched UI). `{locale}` resolves like screens; falling back to the
default locale's clip warns `UI language in the recording does not match the locale`.

**Continuity.** When consecutive scenes resolve to the same layout and the same device position (same layout, no device
override), the device stays put: only the caption, labels and screen content change. This is how a long recording becomes
chapters: one `.mov`, several scenes with `clip.start`/`end`, captions per chapter. The screen content cuts between
scenes (the recording is continuous), the caption crossfades.

**Entrance and loop.** `in: "rise"` (default): device rises 6% and fades in over 0.6 s; caption fades and rises over 0.5 s,
0.1 s later; labels fade 0.3 s. Scene 1 fades in from the background color over 0.4 s and the last scene fades out to it
over 0.6 s, so the loop point has no visible jump (Apple: previews autoplay and loop). `in: "none"` on scene 1 and
`"loop": "hard"` on the preview disables this for authors who cut deliberately.

**Transitions** (into a scene): `crossfade` 0.5 s (default), `push` (new scene slides in from the right while the old one
leaves left, 0.6 s, eased), `cut`, `fade-through` (0.3 s to background color, 0.3 s out). Transition lengths are fixed in
this release (my call: fewer knobs, consistent pacing).

**Labels** render as the existing `badge` element placed under the caption (or above a bottom caption), one at a time,
with the theme's accent as background. `at`/`until` are seconds from the scene start.

### Creative videos show the main flow (owner's requirement)

The header, search results and In-App Event videos are not animated banners. They show **how the app works**: the main
flow, recorded on a device, in motion. So:

- A creative video is the same `previews[]` entry as the app preview, with the creative video targets added to its
  `targets`. The scenes are shared; `byTarget` changes the layout per canvas (a tall phone on the 21:9 header sits at one
  side with the caption beside it: `text-left` / `text-right`; the 3:2 search asset works with `hero` in its desktop
  composition or `two-devices`; the 9:16 event details use the phone layouts unchanged).
- Scenes for creative videos should use recordings (`clip`). When every scene of a creative video resolves to a still, the
  renderer prints a NOTE that the file is a draft, and the delivery report says a recording of the main flow is needed before
  upload, as it already says for HTML mocks.
- Header and search videos may be as short as 5 s. The default when the preview's scenes are longer than the target's
  `maxSec` is to **error**, not to cut, as for app previews; the author picks the scenes with `"scenes"` on `byTarget`
  (`"byTarget": { "header-video": { "scenes": ["session", "swap"] } }`), so the header carries the one flow that sells the app.
- The 21:9 header is wide and short; a tall phone fills under half the height... so `text-left` there defaults the device to
  `landscape: false`, width 22% of the canvas, and the caption to the left half, which the builder tunes on the gallery.
- Search results videos are muted and cannot be unmuted; header videos are muted by default. Nothing in a creative video may
  depend on sound. The renderer warns when `music` is set on a search video.

### Poster frame

App Store Connect picks the poster by time, not by file. The renderer writes `NN_<id>.poster.png` at the poster time and
prints `poster: set 00:05.00 in App Store Connect` per file. It warns when the poster time falls inside a transition or
entrance, and when scene 1's caption is not fully visible there.

### Theme additions

`theme.video: { "entrance": "rise", "transition": "crossfade", "scroll": { "speed": 1 } }` as defaults for every preview.

## Rendering pipeline (`scripts/video.mjs`)

1. **Resolve** previews × video targets × locales. Apply `specialize` per scene as slides do. Resolve screens: stills
   through the existing `resolveScreen`, HTML mocks through the existing pre-render queue (a mock becomes a tall still, so
   `scroll` works on mocks), clips through the extractor.
2. **Build one page** per (preview, target, locale): every scene's DOM, built by `slideElements` + `elementHtml`, stacked
   as absolutely-positioned `.scene` layers, all hidden except what `__seek` shows. The page's `<script>` carries the
   timeline (scene start/end, transition kinds, entrance, motion, labels, clip frame lists) and defines
   `window.__seek(t)`: sets each layer's opacity/transform, the caption/label states, the still's `motion` transform,
   and the clip `<img>`'s `src` for frame `floor((t - sceneStart - clipOffset) * 30)`, then awaits `img.decode()`.
   `__seek` returns only after fonts, images and the frame are decoded.
3. **Fit checks** run once per scene at its rest state (`__seek` at scene middle) with the existing `__fit`, so the same
   warnings apply: overflow, shrunk text, text covered, missing glyph risks.
4. **Capture**: for `f` in `0 … fps×total−1`: `__seek(f / fps)`, `page.screenshot({ type: 'jpeg', quality: 95 })`, write to ffmpeg's
   stdin (`-f image2pipe -framerate 30 -i -`). JPEG at 95 is not visible after H.264 at 11 Mbps and is several times faster
   to capture than PNG. **Hold frames:** `__seek` returns `{ static: true }` when nothing on the timeline changes between
   this frame and the previous one (rest state: still with `motion: none`, no clip, no label or transition in flight);
   the renderer then re-sends the previous buffer instead of taking a screenshot. On the 4K creative targets
   (`header-video`, `search-video`, `event-card-video`, `event-details-video`) capture is 2–4 frames/s, so a 20 s video
   is 3–5 minutes per target × locale; the README states this and recommends rendering creative videos for the default
   locale first, and `motion: none` scenes to profit from hold frames. A `"renderScale": 0.5` option on a video target
   renders at half size and lets ffmpeg upscale (Lanczos), for drafts only; the renderer notes it in the output. ffmpeg is spawned once per output with the encode options above and the
   audio input (`anullsrc` or the music file, trimmed to the total length with `afade` out). Progress prints every 10%.
   Expected speed: 10–15 frames/s at 886×1920, so a 25 s preview takes about 1–2 minutes per target × locale.
5. **Poster**: the frame at the poster time is also written as PNG (exact size, no alpha).
6. **Validate** with `ffprobe` (ships next to ffmpeg in `ffmpeg-static`? No: `ffmpeg-static` has no ffprobe.
   Use `ffmpeg -i` stderr parsing, or trust our own encode parameters and check only the file: size ≤ 500 MB, duration from
   frame count, exact dimensions from the page). **My call:** no ffprobe dependency; duration and size are known from
   what we encoded; file size is checked on disk.
7. **Previews for QA**: `_preview/<target>__<locale>__<id>.jpg`, a filmstrip of one frame per second (max 30 frames,
   10 per row, each 240 px high) with the second number under each frame, built with sharp from frames kept during capture.
   `index.html` gets a "Previews" section per target × locale with a `<video controls loop muted>` and the filmstrip.
8. **manifest.json** lists previews with `kind: "preview"`, duration, poster time, file.

## CLI

`node scripts/render.mjs <config> [--previews tour,launch] [--no-previews] [--only-previews] [--supersample 1]` plus the
existing flags. `--targets` and `--locales` filter both passes. `--slides` filters screenshots only; `--scenes a,b` renders
only those scenes of a preview (for iterating; the duration check is skipped then and a NOTE says so).

## Delivery

- `out/<target>/<locale>/NN_<id>.mp4` and `NN_<id>.poster.png`, like screenshots.
- `--fastlane`: `deliver` **does** upload app previews ([docs](https://docs.fastlane.tools/actions/deliver/)): it reads
  `./fastlane/app-previews/<locale>/`, takes the device type from the filename (matched case-insensitively against
  identifiers such as `IPHONE_67`, `IPHONE_65`, `IPHONE_55`, `IPAD_PRO_3GEN_129`, `IPAD_97`, `DESKTOP`), uploads up to 3 per
  locale and device type ordered by filename, and sets the poster with `preview_frame_time_code` (`HH:MM:SS:CC`, default
  `00:00:05:00`). So the renderer writes `out/fastlane/app-previews/<asc-locale>/NN_<IDENT>_<id>.mp4` with this mapping
  (the builder confirms the identifiers against deliver's source before shipping):

  | target | filename identifier |
  |---|---|
  | `preview-iphone` | `IPHONE_67` (the largest slot; ASC scales it to the smaller Face ID / Dynamic Island sizes) |
  | `preview-iphone-16-9` | `IPHONE_55` |
  | `preview-iphone-4.7` | `IPHONE_47` |
  | `preview-ipad` | `IPAD_PRO_3GEN_129` |
  | `preview-ipad-9.7` | `IPAD_97` |
  | `preview-mac` | `DESKTOP` |

  The delivery report prints the `preview_frame_time_code` to pass when a preview's `poster` is not 5 s (one value for the
  whole upload, so the renderer warns when previews in one config disagree).
- Creative assets (header, search, In-App Events) have no deliver support. They go to `out/fastlane/creative/<asc-locale>/`
  next to the rest, and the report says they are uploaded by hand in App Store Connect.
- Audio: App Store Connect rejects a preview whose file has **no audio track** ("unsupported or corrupted audio"; simulator
  recordings have none). The renderer therefore always writes a stereo AAC track, silent when there is no `music`.
- SKILL.md's deliver step reports: preview files, poster times, and that the preview shows first on the store, so the
  first scene and the poster carry the hook.

## Recording the app (`references/reading-the-app.md`)

New section "Record screens for app previews":
- iOS simulator: `xcrun simctl io <udid> recordVideo --codec h264 --mask ignored recordings/<locale>/<flow>.mov`
  (Ctrl-C stops), status bar overridden first (as in AptusFIT's `capture.sh`), driven by deep links or a Maestro flow
  (`maestro record` also works). One recording per locale; one long recording cut by `clip` is fine.
- Android emulator: `adb shell screenrecord --bit-rate 8000000 /sdcard/flow.mp4` then `adb pull`. (Play has no preview
  upload, but Android recordings are fine inside a `story-video` or a custom target.)
- Keep gestures slow, pause 1 s on each screen, no fast scrolling, no keyboard unless it is the point, no personal data.
- HTML mocks do not record; they animate as stills (`scroll`). Say so in the delivery report, as for mock screenshots.

## Examples and showcase

- `examples/preview/preview.config.json`: one preview from the demo stills (`drift` + `scroll`), 4 scenes, 20 s, en-US + ja,
  `preview-iphone` and `preview-ipad`, plus `app-header` and `event-card` slides. `npm run example:preview`.
- A 6-second synthetic clip committed under `examples/preview/recordings/en-US/walk.mp4` (≤ 1.5 MB), made by rendering the
  demo HTML mock with `scroll` through the engine itself, so the clip path is exercised without a real device.
- `npm test` stays stills-only (fast); a second script `npm run test:video` renders one 15 s preview at `--supersample 1`.
- AptusFIT showcase (`docs/samples/aptusfit/`): one preview per language from one English recording the owner captures
  with the new section's commands, captions localized, embedded as `<video>` in the sample page under the first screenshot slot, as the store shows it.
  The AptusFIT config lives in the owner's app repo (`marketing/store-screenshots/`); the showcase only takes the outputs.
- `docs/index.html` gains a "Previews" section and the README a video row.

## Docs

- `references/config.md`: targets tables, `previews`, scenes, labels, motion, transitions, poster, CLI.
- `SKILL.md`: workflow step 2 gains "(d) recordings"; step 4 "add `previews`"; QA gains the filmstrip checks:
  poster frame readable alone, no text still moving at the loop point, clips not stretched, label timing in every locale;
  quick reference rows for video targets and creative assets; common mistakes: "preview longer than 30 s", "fast cuts",
  "stills-only preview submitted as final", "clip in the wrong language".
- `CHANGELOG.md` 1.1.0, `package.json` version, `README.md` feature list and "Limits" (render time per preview).

## Left to the builder

- Internal shape of the timeline object and `__seek`; easing curves (use ease-out cubic unless a reason appears).
- Clip frame cache layout and eviction (keep it simple: `out/.build/clips/` is scratch).
- Exact ffmpeg argument list, and how a music file is trimmed, faded and mixed. Loudness normalization is optional.
- The `scroll` speed curve (ease in and out, hold 1 s at top and bottom is a good default).
- How the filmstrip is laid out beyond "one frame per second, numbered".
- Whether `preview-iphone-4.7` and `preview-ipad-9.7` ship in 1.1.0 or wait (both are one table row).
- Test strategy: unit tests for timeline math (durations, transitions, poster warnings) without Chrome; one end-to-end
  render in `npm run test:video`.

## Owner decisions (2026-10-30)

- Creative videos (header, search results, In-App Events) are in 1.1.0 and show the main flow from recordings.
- AptusFIT showcase: **one English recording**, captions and labels localized by the skill in all 12 locales. The sample
  page says the UI inside the video is English. The AptusFIT config in the owner's app repo therefore points every locale at
  `recordings/en-US/*.mov`, and the renderer's "UI language does not match" warning is silenced for that config with
  `"clipLocale": "en-US"` on the preview (a declared choice is not a warning).

Items marked "my call" are the author's defaults and can be changed on request.
