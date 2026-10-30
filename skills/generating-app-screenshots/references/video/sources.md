# Sources

Every source behind the knowledge base. `verified_on` is the date the source was last read. Apple and Google pages were
re-fetched on 2026-10-31. Sources marked 2026-10-30 were read for the research notes and not re-fetched. Status is
`verified` (first-party or directly read) or `reported` (third party, search snippet or opinion).

## Contents
- Store sources
- Motion and craft sources
- Recording sources
- Prior art
- Not used

## Store sources

| Source | URL | Supports | verified_on | Status |
|---|---|---|---|---|
| Apple app preview specifications | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | length, count, sizes, encoding, audio, poster frame | 2026-10-31 | verified |
| Apple "App previews" | https://developer.apple.com/app-store/app-previews/ | on-device footage, no hands, native resolution, hotspots, transitions, legible text, no dates or prices, disclosure | 2026-10-31 | verified |
| Apple App Review Guidelines 2.3.3 and 2.3.4 | https://developer.apple.com/app-store/review/guidelines/ | previews are screen captures only; overlays allowed | 2026-10-31 | verified |
| Apple forum: 2.3.4 rejection | https://developer.apple.com/forums/thread/656342 | frames rejected under 2.3.4 (reported by developers, three posts). Only "reported": Apple's own text does not mention frames | 2026-10-31 | reported |
| Apple forum: 2.3.4 rejection | https://developer.apple.com/forums/thread/689232 | the same rejection; the post does not say "app preview" outright, so weaker | 2026-10-31 | reported |
| Matte: App Store previews | https://matte.app/help/app-store-previews/ | vendor advice: no zooms or bezel in the App Store cut | 2026-10-31 | reported |
| Google Play Console Help, preview assets | https://support.google.com/googleplay/android-developer/answer/9866151 | promo video requirements and recommendations | 2026-10-31 | verified |
| Appalize: preview video design | https://www.appalize.com/blog/creative-optimization/how-to-design-app-store-preview-videos-that-convert | hook and pacing | 2026-10-30 | reported |
| App Screenshot Studio: 2026 guide | https://appscreenshotstudio.com/blog/app-store-preview-videos-the-2026-conversion-guide | hook and pacing | 2026-10-30 | reported |
| Yellowhead: 11 commandments | https://www.yellowhead.com/blog/11-commandments-app-preview-videos/ | shot lengths, captions | 2026-10-30 | reported |

## Motion and craft sources

| Source | URL | Supports | verified_on | Status |
|---|---|---|---|---|
| HyperFrames (HeyGen) `references/motion.md` | https://github.com/heygen-com/hyperframes | easing by role, springs, holds, stagger, shot lengths, wrapper rule | 2026-10-30 | verified |
| joanseg/app-preview-videos | https://github.com/joanseg/app-preview-videos | tap ring timing, 12-frame fades, ramp bounds, caption rules | 2026-10-30 | verified |
| Cap (CapSoftware) | https://github.com/CapSoftware/Cap | auto-zoom constants (Phase 2). AGPL: numbers and ideas only, no code copied | 2026-10-30 | verified |
| Remotion LICENSE | https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md | spring defaults; company licence, so ideas only | 2026-10-30 | verified |
| Craft values (ripple size, spotlight, springs, kinetic text, tilt, blur) | none: no source | opinion of the research notes | 2026-10-30 | reported |

## Recording sources

| Source | URL | Supports | verified_on | Status |
|---|---|---|---|---|
| `simctl io recordVideo` local help | none: local `xcrun simctl io --help` | flags, h264 vs HEVC, SIGINT stop | 2026-10-30 | verified |
| Screenify: simctl recordVideo | https://www.screenify.studio/blog/2026-08-13-simctl-recordvideo-ios-simulator | variable frame rate, hazards | 2026-10-30 | reported |
| Maestro startRecording docs | https://docs.maestro.dev/api-reference/commands/startrecording | 2-minute cap | 2026-10-30 | verified |
| Maestro tap indicators on iOS | https://maestro.dev/blog/showing-tap-indicators-on-ios-recordings | iOS tap dots not shipped | 2026-10-30 | verified |
| Maestro 2.6.1 (installed) | none: local `maestro` | `--debug-output` commands JSON, `hierarchy` | 2026-10-30 | verified |

## Prior art

| Source | URL | Supports | verified_on | Status |
|---|---|---|---|---|
| gabrielmoreira/app-preview-video | https://www.skillsdirectory.com/skills/gabrielmoreira-app-preview-video | beat template, three variants by hook | 2026-10-30 | reported |
| Agent skill best practices | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | size, references, table-of-contents rules | 2026-10-30 | verified |
| skill-creator | https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md | benchmark mode | 2026-10-30 | reported |

## Not used

Conversion-lift statistics circulate in blog posts, none traceable to primary data. They are not quoted anywhere in the
skill or its output.

| Claim | Why not used |
|---|---|
| "15-35% conversion lift" | no primary data |
| "65% of completers install" | no primary data |
| "78% more downloads" | no primary data |
| "85% watch muted" | no primary data; the skill relies on the Apple and Google text that previews autoplay muted |
