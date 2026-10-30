# Store rules for app preview videos

Re-check by: 2027-04-30 (six months after `verified_on`). Apple and Google change these pages without notice.

## Contents
- How to read the table
- Apple App Store rules
- Google Play promo video rules
- Pacing guidance (reported)
- Enforcing checks (anchors)

## How to read the table

- **status** is `verified` when the rule is first-party Apple or Google text that was re-fetched on `verified_on`, and
  `reported` when it comes from a third party, a developer forum or craft opinion.
- **enforcing check** is the renderer check that flags the rule (see "Enforcing checks" below), `existing: duration` for the
  15-30 s total, or `agent QA` when a human or the agent must look at the footage.
- Apple's wording is guidance, not always a prohibition. Where a row says "guidance", treat a breach as a rejection risk.
- Untraceable statistics are never quoted here. See `sources.md#not-used`.

## Apple App Store rules

| Rule id | Rule | Store | Source | verified_on | Status | Enforcing check |
|---|---|---|---|---|---|---|
| apple-length | 15 to 30 s long | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | existing: duration |
| apple-count | Up to 3 previews per device size and language | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | existing: duration |
| apple-iphone-size | iPhone with Dynamic Island or Face ID: 886x1920 portrait (or 1920x886). This release makes only `preview-iphone` | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | iphone-only |
| apple-encoding | .mov, .m4v or .mp4; H.264 High Profile up to Level 4.0 at 10-12 Mbps; max 30 fps; max 500 MB | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | agent QA |
| apple-audio | Stereo AAC 256 kbps at 44.1 or 48 kHz, all tracks enabled | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | agent QA |
| apple-poster | Poster frame defaults to 5 s; it can be changed, and changing it on an approved preview needs a new version | Apple | https://developer.apple.com/help/app-store-connect/reference/app-preview-specifications/ | 2026-10-31 | verified | agent QA |
| apple-screen-capture | Guideline 2.3.4: previews may only use video screen captures of the app itself; narration and video or textual overlays are allowed | Apple | https://developer.apple.com/app-store/review/guidelines/ | 2026-10-31 | verified | agent QA |
| apple-no-hands | Stay within the app: no over-the-shoulder shots or fingers tapping the screen | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | agent QA |
| apple-native-res | Guidance: capture the native UI resolution rather than zooming in on the view. Zoom effects are therefore left out of the App Store cut | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | agent QA |
| apple-touch-hotspots | Graphic elements such as touch hotspots are allowed (guideline 2.3.3 allows an animated touch point on screenshots) | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | agent QA |
| apple-transitions | Use straightforward transitions such as dissolves and fades; a transition must not imply functionality the app lacks | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | agent QA |
| apple-legible-text | Text is legible and stays on screen long enough to read | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | reading-time |
| apple-seasonal | Avoid seasonal references and dates ("new for spring"); they age the video | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | time-sensitive |
| apple-prices | Show no specific prices or currencies; they vary by region | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | price |
| apple-disclose | Disclose an in-app purchase, subscription or login requirement in the footage or on the end frame | Apple | https://developer.apple.com/app-store/app-previews/ | 2026-10-31 | verified | disclose |
| apple-frames | Device frames and device images have been rejected under 2.3.4 in three developer forum threads (2020, July 2024, December 2024); one earlier approval was also reported. Apple's guidance does not mention frames. Default to full-screen or caption-band | Apple | https://developer.apple.com/forums/thread/656342 | 2026-10-31 | reported | framed-device |
| apple-frames-2 | Second forum thread reporting the same 2.3.4 rejection ("include framing ... device images and/or device frames"); the post does not say "app preview" outright | Apple | https://developer.apple.com/forums/thread/689232 | 2026-10-31 | reported | framed-device |
| apple-zoom-vendor | A vendor advises leaving camera moves and zooms out of the App Store version and the bezel off preview videos | Apple | https://matte.app/help/app-store-previews/ | 2026-10-31 | reported | agent QA |

Apple publishes no rule about looping.

## Google Play promo video rules

Source for every row: Google Play Console Help, "Add preview assets". The page splits rules into "Requirements" (mandatory)
and "Highly recommended". Rows say which.

| Rule id | Rule | Store | Source | verified_on | Status | Enforcing check |
|---|---|---|---|---|---|---|
| play-youtube | Mandatory: one YouTube video URL (no playlist, no parameters such as timecodes), public or unlisted, embeddable, not age-restricted, monetization off | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | agent QA |
| play-first-10s | Highly recommended: show the real app experience in the first 10 s | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | hook-timing |
| play-80-percent | Highly recommended: at least 80% of the video is real user experience; limit title screens, logos and promotional content | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | agent QA |
| play-autoplay-30s | Only the first 30 s autoplay, muted; keep the video short. No fixed length | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | existing: duration |
| play-no-hands | Highly recommended: no fingers or people tapping the device, unless the core use is off-device | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | agent QA |
| play-no-black-bars | Highly recommended: no black bars on the sides of a portrait video | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | agent QA |
| play-text-legible | If you add on-screen text for muted autoplay, keep it legible and on screen long enough to read; add captions | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | reading-time |
| play-phrases | Avoid calls to action such as "Download now" and claims such as "Best" or "#1" (Play "Best Of" awards are allowed) | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | play-phrases |
| play-time-sensitive | Avoid time-sensitive taglines; swap out time-bound content promptly | Play | https://support.google.com/googleplay/android-developer/answer/9866151 | 2026-10-31 | verified | time-sensitive |

Not addressed by the page for videos: device frames (it discourages device imagery for feature graphics) and zoom.

## Pacing guidance (reported)

Craft guidance, not store rules. Third-party sources, not re-fetched on 2026-10-31, so `verified_on` is the date the
research notes read them.

| Rule id | Rule | Store | Source | verified_on | Status | Enforcing check |
|---|---|---|---|---|---|---|
| pace-hook | Open on the app doing the valuable thing; first caption fully visible by 1.0 s | Both | https://www.appalize.com/blog/creative-optimization/how-to-design-app-store-preview-videos-that-convert | 2026-10-30 | reported | hook-timing |
| pace-beats | Shots last 2-5 s; never hold a static screen longer than 2 s | Both | https://www.yellowhead.com/blog/11-commandments-app-preview-videos/ | 2026-10-30 | reported | beat-length |
| pace-end-card | End frame about 2 s, last in the film (1.5-3 s) | Both | https://appscreenshotstudio.com/blog/app-store-preview-videos-the-2026-conversion-guide | 2026-10-30 | reported | end-card |

## Enforcing checks

These names are implemented by `scripts/storecheck.mjs`. Levels never change the exit code: WARN and NOTE exit 0, ERROR
exits 1.

## framed-device
WARN on `preview-*` targets. A device model other than `none`, or a style other than `frameless`, risks rejection under
2.3.4. Message: `device frames risk rejection under 2.3.4 — use full-screen or caption-band`. Rows: `apple-frames`.

## price
WARN on Apple preview and creative targets. Matches a currency symbol next to a digit (`$ € £ ¥ ₩ ₫ ฿ ₹ ₱`, `RM`, `Rp`,
`R$`), ISO codes before or after digits, and period words (`/month`, `/mo`, `/year`, `/yr`, `/week`, `/Monat`, `/mois`,
`/mes`, `/月`, `/tháng`, `/年`). Works in every locale. Rows: `apple-prices`.

## play-phrases
WARN on `play-promo`. Matches "install now", "download now", "best" and "#1". Rows: `play-phrases`.

## time-sensitive
NOTE on all video targets. A 4-digit year from 1990 to 2099, or a month name in the locale. Rows: `apple-seasonal`,
`play-time-sensitive`.

## reading-time
WARN. A caption must be visible for at least 0.5 s + 0.3 s per word (see `motion.md#kinetic-captions`). Rows:
`apple-legible-text`, `play-text-legible`.

## hook-timing
WARN on previews with a `concept`. The first caption must be fully visible by 1.0 s. Rows: `play-first-10s`, `pace-hook`.

## beat-length
WARN on previews with a `concept`. Beats last 2-5 s; `hero-moment` and `ask-answer` allow one beat up to 8 s. Rows:
`pace-beats`.

## end-card
WARN on previews with a `concept`. The end card comes last and lasts 1.5-3 s. Rows: `pace-end-card`.

## iphone-only
ERROR on previews with a `concept`: `iPhone only in this release (preview-iphone)`. This is a scope rule of this release,
backed by the 886x1920 size row `apple-iphone-size`.

## disclose
NOTE on previews with a `concept`. `owner.disclose` is set but no `end-card` scene exists. Rows: `apple-disclose`.
