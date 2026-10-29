# Competitive research (Oct 2026) — what store-screenshot tools offer, and where this skill covers it

Sources: screenshots.pro (site + developers.screenshots.pro API docs), appscreens.com, theapplaunchpad.com AppScreens review,
getpicasso.com, brandbird.app, App Store Connect "Screenshot specifications", Play Console help "Add preview assets".

| Capability | screenshots.pro | AppScreens | Picasso | BrandBird | This skill |
|---|---|---|---|---|---|
| Device frames | 23, real / clay, any color | real, clay, 3D, outline, frameless; many Android brands | 40+ Apple, auto-picked from screenshot size | iPhone/Mac/iPad/Watch/browser mockups | CSS-drawn iPhone / iPhone-home / iPad / Android / Android tablet / none; styles real, clay, outline, frameless; any color; auto-pick by aspect |
| 3D angles | paid | 3D frames, 2 angles | — | 3D presets | free `tiltX/tiltY/perspective` per device, `tilt-left/right` layouts |
| Text | drag, font size, align | rich text, auto-size, 1500+ Google Fonts, custom fonts | — | headings, emojis | captions (eyebrow/title/subtitle), `**highlight**` in 4 styles, auto-shrink to box, any Google or local font, script fallbacks |
| Backgrounds | templates | solid, gradient, image, tiled, panoramic | gradients | solid, gradient, pattern, image | solid, linear/radial/conic, mesh, image (blur/brightness), overlay, pattern, noise, panorama |
| Spanning / panorama | panorama templates | panoramic backgrounds | items span screenshots | — | `panorama` canvas: shared background + elements across seams |
| Annotations | — | badges, shapes, SVGs | add images | arrows, rectangles, emoji, highlight | `badge`, `shape`, `image`, `arrow`, `zoom` (magnified crop) |
| Localization | auto-translate (paid) | AI translation, 80+ languages, RTL, per-locale overrides | import .xcstrings | — | agent translates copy.json, `.xcstrings` import, auto RTL, per-locale screens/fonts/overrides (`byLocale`) |
| Multi-size export | yes | responsive engine | App Store sizes | custom sizes, PNG/JPEG/WebP | all current iOS/iPad/Play sizes + social presets, per-target overrides (`byTarget`), PNG/JPEG/WebP |
| Store upload | API (alpha, $49/mo) | one-click ASC + Play, CPP/PPO | ASC upload | — | `--fastlane` folder layout for `deliver` / `supply` |
| AI captions | — | AI suggested captions | — | — | agent reads the codebase and writes benefit-led captions |
| Validation | — | — | ASC processing check | — | exact size, alpha, count limits, text overflow, text covered by device, missing strings/screens |
| Price | free / $19 / $49 per month | free (5 shots) / $25 / $50 | App Store | free / Pro | free, local, scriptable, CI-friendly |

Takeaways baked into the skill:
- Users expect **real + clay + frameless** styles and **colorable** frames, so all are parameters, not assets.
- Reviewers flag **auto-scaled iPad layouts** as a rejection risk, so the skill picks frames by screenshot aspect and recommends real iPad captures.
- The hard part of localization is **text expansion and RTL**, not translation. Auto-fit, warnings and `byLocale` overrides cover it.
- **Panoramic sets** and **spanning devices** are a top differentiator in templates. One wide canvas cut into slides makes them seamless.

## Panorama / spanning research

How a connected set is actually seen:
- Each screenshot is uploaded on its own. The App Store and Play show them as separate rounded cards with a gap between them,
  so a device across a seam is visibly cut. Apple does not publish the gap size, so judge with the store-view preview.
- Search results show only the first 1–3 slides, often small. Slide 1 must work alone: it carries the hook, a full device and no cut-offs on its left.
- Only backgrounds should flow freely (gradients, skies, mountain ridges, waves, dunes, a ribbon line). Headlines, faces and
  key UI should stay clear of seams. A caption split across two cards is unreadable in search.
- A small cut-off at slide 1's right edge (a phone corner or a ribbon) invites the swipe ("peek"). Hook → journey → resolution over about 5 frames.
- Design iPhone and iPad panoramas separately, because the aspect ratios differ and one canvas does not fit both.
- 3–6 connected frames work best; beyond that, the story loses people.

Sources: appscreenshotstudio.com (panoramic-app-store-screenshots; blog: panoramic dimensions & slicing 2026, layout patterns 2026,
mockup styles 2026), dev.to/appscreenshotstudio (screenshot story flows), dev.to/shotlingo (15 screenshot designs),
butterkit.app (panoramic template), storepilot, stora.sh, apptweak, adalo, appscreens.com/templates (patterns only; no assets copied).
