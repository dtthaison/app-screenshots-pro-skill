# Motion values

Every motion value the renderer and recorder use, with its source. Every animated value is a pure function of time `t`
(no CSS transitions, no `Date.now()` in render paths), so the same recording and config give the same frames. Source tags:
`verified` = read directly from the source, `reported` = craft opinion or a third-party report (see `sources.md`).

## Contents
- Easing and springs
- Tap effects
- Kinetic captions
- Speed ramps
- Holds and shot lengths
- Detection thresholds
- Phase 2 values
- Feedback fixes

## Easing and springs

| Role | Value | Source | Status |
|---|---|---|---|
| Arrivals | expo-out, `1 - 2^(-10p)` (or power4.out) | HyperFrames `references/motion.md` | verified |
| Camera moves | power2.inOut | HyperFrames | verified |
| Exits | power3.in, 40-50% shorter than the entrance | HyperFrames | verified |
| Ease-out reveal | `cubic-bezier(.16,1,.3,1)` | craft value | reported |
| In-out move | `cubic-bezier(.65,0,.35,1)` | craft value | reported |
| Spring damping ratio | 0.7-0.85 premium, 0.4-0.6 playful, below 0.3 cartoonish | HyperFrames | verified |
| Pop spring | zeta 0.8, omega0 10 rad/s (stiffness 170, damping 18 gives zeta about 0.7) | HyperFrames range plus craft value | reported |
| Tight UI spring | stiffness 300, damping 30 | craft value | reported |

Springs are advanced per frame with a closed-form solution, as Remotion does (ideas only; its licence forbids copying
code).

## Tap effects {#tap-effects}

Apple allows graphic elements such as touch hotspots (`store-rules.md`, row `apple-touch-hotspots`), so tap effects are
App Store safe. The tap's real time comes from the reaction frame in the recording (see Detection thresholds), and every
effect starts the frame before the reaction so the ripple leads the screen change, as `joanseg/app-preview-videos` does.

| Effect | Values | Source | Status |
|---|---|---|---|
| Ripple | radius 3% to 12% of the screen width over 600 ms, expo-out easing; opacity 0.5 to 0; stroke 3 px to 1 px | craft values (range 9-12% over 500-700 ms) | reported |
| Ring | same timing as the ripple, 3 px stroke | joanseg/app-preview-videos (at most 0.6 s, ends before a hard cut) | verified |
| Press dot | 7-9% of the screen width, white at 35-55% alpha | craft value | reported |
| Spotlight | 10-25% black over the rest of the screen, radial cut-out 18% of the screen width; fade in 200 ms, hold 600 ms, fade out 300 ms | craft values | reported |

Two taps closer together than the ripple's 600 ms each draw their own ripple, and neither is cut off.

## Kinetic captions {#kinetic-captions}

Each word translates from 110% to 0 inside an `overflow:hidden` clipping box. Optional blur from 8 px to 0. Keep text at
least 48 pt equivalent.

| Style | Values | Source | Status |
|---|---|---|---|
| Words | 70 ms stagger (research range 60-120 ms), 450 ms per word (range 350-600 ms), `1 - 2^(-10p)` expo-out, rise from 110% | HyperFrames and craft values | verified (stagger range), reported (rest) |
| Lines | the same, with a 120 ms stagger per line | craft value | reported |
| Pop | scale 0.92 to 1 and opacity 0 to 1, spring with zeta = 0.8 and ω0 = 10 rad/s | craft value | reported |
| Reading time | visible for at least 0.5 s + 0.3 s per word, otherwise WARN `reading-time` | HyperFrames; Apple: text "remains on the screen long enough" | verified |

Scene 1 keeps its caption complete at frame 0 (the owner disliked an empty frame 0, and the hard loop cuts back to it).
Languages without spaces (ja, zh, th) animate the whole title as one unit.

## Speed ramps {#speed-ramps}

Ramps only compress, never below 1×. They hide waiting (network, loading, typing), not the product.

| Value | Setting | Source | Status |
|---|---|---|---|
| Top speed | 4× | joanseg/app-preview-videos (waits at 2-4×) | verified |
| Idle floor | stills count as idle at 0.5 s or more | craft value | reported |
| Rate edges | 300 ms smoothstep (research range 250-400 ms) | research notes section 6 | reported |
| Tap protection | 0.4 s before a tap and 0.8 s after it stay at 1× | craft value | reported |
| Static review screens | 0.5-0.8× (not used: ramps never go below 1×) | joanseg | verified |
| Time map | monotone `src(t_out)` from the integral of the rate; frames at `floor(src * fps)` | research notes section 6 | reported |

A clip span entirely idle runs at 4×. A span too long even at 4× is an ERROR with both lengths. A span too short holds its
last frame, with the existing WARN.

## Holds and shot lengths

| Value | Setting | Source | Status |
|---|---|---|---|
| Caption hold | 0.5 s + 0.3 s per word | HyperFrames | verified |
| Average shot | 1.8-3 s; a demo hold can last 7-10 s | HyperFrames | verified |
| Beats | 2-5 s; one beat up to 8 s in `hero-moment` and `ask-answer` | store pacing guidance | reported |
| First caption | fully visible by 1.0 s | store pacing guidance | reported |
| End card | last, 1.5-3 s | store pacing guidance | reported |
| Total | 15-30 s, measured after ramping (an ERROR) | Apple spec | verified |
| Payoff | hold 0.3-0.75 s before it | HyperFrames | verified |
| Scene fades | 12 frames | joanseg/app-preview-videos | verified |

## Detection thresholds {#detection-thresholds}

Tuned on a spike against a real simulator. Both are mean absolute differences between downscaled grayscale frames on a
0-255 scale, computed in Node (deterministic and tunable, unlike `freezedetect`).

| Constant | Value | Meaning |
|---|---|---|
| `SYNC_MAD = 8` | in `scripts/align.mjs` | a frame-to-frame change that counts as the full-screen sync flash. It was 30. At 30 the sync was found 6 frames late in the spike |
| `REACT_MAD = 3` | in `scripts/align.mjs` | a change that counts as a tap reaction inside the tap command's window |
| `IDLE_MAD = 1.5` | in `scripts/ramp.mjs` | a frame-to-frame change under which a frame is idle; a run of at least 0.5 s plays up to 4×. On `walk.mp4` the still tail is 0-0.7 (encoder noise) and motion starts at 1.2+. AptusFIT tuning follows in Task 13 |

How the timeline is aligned:
- The sync is anchored on the end of the opening `openLink` command, not its start. This cut the Maestro-to-video jitter
  from about 30 frames to about 4.
- A tap's real time is the reaction frame inside its command window. Maestro reports a command's start time and a duration
  that includes waiting and retries, so the command window only bounds the search.
- Target accuracy is plus or minus 1 frame. The spike did not fully reach it: re-check on the first real app (AptusFIT).
- Each Maestro call costs about 15-30 s, so rehearse and record in few calls.

## Phase 2 values

Not rendered in this release.

| Effect | Values | Source | Status |
|---|---|---|---|
| Auto-zoom segments | pre-padding 0.6 s, post-padding 1.6 s, merge gap 0.6 s, minimum 1.3 s, zoom 2.0, drop the stop click within 0.8 s, dedupe double clicks within 400 ms, edge snap ratio 0.25 | Cap (AGPL): numbers and ideas only, no code copied | verified |
| Camera spring | stiffness 200, mass 2.25, damping 40; rest snap at \|d\| < 1e-5 and \|v\| < 1e-4 | Cap (AGPL), same terms | verified |
| Phone zoom | 1.35-1.6×, hold 1.2-1.8 s | research notes section 5 | reported |
| 3D tilt | rotate 8-20 degrees, perspective 1.5-2× device height, origin 50% 40%; `overflow:hidden` or `filter` on an ancestor flattens 3D | craft values | reported |
| Motion blur | 4-8 sub-frames at a 180 degree shutter, only during zooms and ramps | craft values | reported |
| Floating device | 4-8 s sine drift of 8-20 px | craft values | reported |

Zoom conflicts with Apple's native-resolution guidance (`store-rules.md`, `apple-native-res`), so it stays out of the App
Store cut. Camera and zoom go on a wrapper element, never on the media element.

## Feedback fixes {#feedback-fixes}

Turn every adjective into a number. When the owner says:

| Owner says | Change |
|---|---|
| "Too fast" | scale the stagger and ripple timings by 1.3 (slower); also scale zooms and pans to 0.7× |
| "Too slow" | scale the stagger and ripple timings by 0.75 |
| "Can't read it" | raise the hold to the reading-time rule, 0.5 s + 0.3 s per word, and shorten the caption |
| "Too busy" | drop the spotlight, keep only the ripple; fewer captions |
| "Boring" | try a stronger hook concept (`concepts.md`), not more effects |
