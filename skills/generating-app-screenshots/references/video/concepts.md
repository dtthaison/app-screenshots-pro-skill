# Video concepts

The 11 concepts the recommender (`scripts/concepts.mjs`) chooses from. Each section is cited by `concepts.md#<id>` in
`recommend.mjs` reasons. Beat seconds here match the beat templates in code; keep them in sync by hand.

## Contents
- How a concept is picked
- Signal vocabulary
- Hook types
- hero-moment, feature-loop, ask-answer, before-after, speedrun, results-first, day-in-life
- multi-device, bento, cinematic (Phase 2)
- type-led
- Worked example: AptusFIT

## How a concept is picked

1. The agent reads the code and writes `preview-brief.json`: app category, signals, moments (things that move) and the
   owner's wishes.
2. `recommend.mjs` scores each concept: each signal adds its `useWhen` weight, a matching category adds 2, an owner
   must-show moment adds 3, and an automatable moment adds 0.5 (network -0.5, human-only -2). A concept whose `requires`
   signals are all missing, or whose `avoidWhen` signal is present, is excluded with a reason.
3. It returns three picks: **safe** (only automatable moments), **strongest** (best score, and it must feature a
   must-show moment when the owner named one), and **bold** (a different hook, for social channels).
4. The agent shows the picks in words only, the owner chooses, and every adjective becomes a number (`motion.md`).

Every concept ends on a 2 s end card and starts with a hook beat (the first caption fully visible by 1.0 s).

## Signal vocabulary

A signal is a fact about the app, read from its code. Use only these names (an unknown one is a brief error).

| Signal | Means |
|---|---|
| `ai-stream` | an AI answer streams in live |
| `chat` | a conversation UI |
| `search` | a search box with results |
| `recommendations` | the app suggests things |
| `timer` | a countdown or stopwatch |
| `live-update` | a value changes on screen without navigation |
| `sheet` | a bottom sheet or modal picker |
| `progress` | progress bars, rings or weekly totals |
| `charts` | graphs |
| `counter` | numbers that roll or count |
| `streak` | streak or habit tracking |
| `map` | a map |
| `camera` | the camera is a core input |
| `scan` | scanning a code, receipt or document |
| `media` | audio or video playback |
| `social` | feeds, friends or sharing |
| `watch-app` | a watch companion |
| `tablet-app` | a tablet layout |
| `desktop-app` | a desktop companion |
| `daily-habit` | used every day |
| `replaces-chore` | replaces a tedious manual task |
| `speed` | the pitch is how fast it is |
| `many-features` | broad feature set, no single hero |
| `single-magic` | one feature carries the app |
| `onboarding` | a short setup the app makes easy |
| `paywall` | a subscription paywall |

## Hook types

| Hook | The first 2 s |
|---|---|
| `demo` | the app is already doing the valuable thing |
| `question` | a question caption, the answer follows |
| `contrast` | the painful old way, then the app |
| `bold-claim` | one claim the footage then proves |
| `outcome` | the result first, the how second |
| `proof` | many proof points at once |
| `pattern-interrupt` | something unexpected that stops the scroll |

## hero-moment {#hero-moment}

- **Story:** one feature, shown once, in full.
- **Beats:** hook 2 s, beat 8 s, beat 3 s, end 2 s (the 8 s beat is the one allowed long beat). Hook: `demo`.
- **Use when:** `single-magic` (3), `ai-stream` (2), `scan` (2), `camera` (2), `live-update` (1). Requires one of
  `single-magic`, `ai-stream`, `scan`, `camera`. Suits ai, utilities, productivity.
- **Avoid when:** `many-features`.
- **Recording needs:** one long take of the magic moment; trim waiting with speed ramps (up to 4×).
- **Defaults:** caption-band, ripple on the first tap, one caption per beat.
- **App Store cut:** full-screen or caption-band, no zoom. Zoom-to-tap only in the Play and social cut.

## feature-loop {#feature-loop}

- **Story:** three small features that each loop in 3-4 s: do, see it change.
- **Beats:** hook 2 s, beat 3.5 s, beat 3.5 s, beat 4 s, end 2 s. Hook: `demo`.
- **Use when:** `daily-habit` (3), `live-update` (2), `timer` (2), `sheet` (1), `counter` (1), `progress` (1). Requires one
  of `live-update`, `sheet`, `timer`, `counter`. Suits fitness, health, productivity, finance, food.
- **Avoid when:** nothing.
- **Recording needs:** three short moments, each with a visible reaction to a tap.
- **Defaults:** ripple on every tap, words caption motion.
- **App Store cut:** unchanged; the safest concept for an automated recording.

## ask-answer {#ask-answer}

- **Story:** a question, then the app's answer arrives.
- **Beats:** hook 2 s, beat 8 s, beat 3 s, end 2 s. Hook: `question`. The 8 s beat holds the streamed answer.
- **Use when:** `ai-stream` (3), `chat` (2), `search` (2), `recommendations` (2). Requires one of those. Suits ai,
  fitness, education, travel, shopping.
- **Avoid when:** nothing.
- **Recording needs:** a live or seeded conversation. Live streams vary per take and need the network, so prefer a seeded one
  (`network` moments cost 0.5 points).
- **Defaults:** question caption on the hook, answer held to its reading time.
- **App Store cut:** unchanged. Do not show a made-up answer the app cannot give.

## before-after {#before-after}

- **Story:** the tedious manual way, then the app doing it.
- **Beats:** hook 2 s, beat 4 s, beat 5 s, beat 2 s, end 2 s. Hook: `contrast`. Bold concept.
- **Use when:** `replaces-chore` (3), `speed` (1), `charts` (1). Requires `replaces-chore`. Suits finance, productivity,
  utilities, health.
- **Avoid when:** nothing.
- **Recording needs:** the "before" is a caption or a static state, never faked footage (2.3.4 allows only app captures).
- **Defaults:** lines caption motion.
- **App Store cut:** keep the before as text over real app footage.

## speedrun {#speedrun}

- **Story:** the whole task done fast, with a clock-like claim.
- **Beats:** hook 2 s, beat 9 s, beat 2 s, end 2 s. Hook: `bold-claim`. Bold concept.
- **Use when:** `speed` (3), `onboarding` (2), `replaces-chore` (1). Requires `speed` or `onboarding`. Suits utilities,
  travel, shopping, finance.
- **Avoid when:** nothing.
- **Recording needs:** one continuous take; the claim ("in 30 seconds") must be true of the footage.
- **Defaults:** speed ramps over waits, tap protection stays on.
- **App Store cut:** unchanged.

## results-first {#results-first}

- **Story:** open on the outcome, then show how it got there.
- **Beats:** hook 3 s, beat 4 s, beat 4 s, beat 2 s, end 2 s. Hook: `outcome`.
- **Use when:** `progress` (3), `charts` (2), `streak` (2), `counter` (1). Requires one of `progress`, `charts`, `streak`,
  `counter`. Suits fitness, health, finance, education.
- **Avoid when:** nothing.
- **Recording needs:** seeded data that already looks good; a settled screen.
- **Defaults:** counters roll in; hold the result 0.3-0.75 s before the payoff.
- **App Store cut:** unchanged. No dates or prices in the result.

## day-in-life {#day-in-life}

- **Story:** the app across a day, three moments.
- **Beats:** hook 2 s, beat 3.5 s, beat 3.5 s, beat 4 s, end 2 s. Hook: `demo`.
- **Use when:** `daily-habit` (3), `timer` (1), `progress` (1). Requires `daily-habit`. Suits health, fitness,
  productivity, food.
- **Avoid when:** nothing.
- **Recording needs:** three moments from different screens; avoid clock times (time-sensitive NOTE).
- **Defaults:** fades between moments (12 frames).
- **App Store cut:** unchanged; no "morning" dates, only generic times.

## multi-device {#multi-device}

- **Phase 2.** Phone plus watch, tablet or desktop together. Hook: `demo`. Bold concept.
- **Use when:** `watch-app` (3), `tablet-app` (2), `desktop-app` (2). Suits fitness, health, productivity.
- **Phase 1:** excluded with "needs Phase 2 (cinematic renderer)". Mention it to the owner as a later option.

## bento {#bento}

- **Phase 2.** A grid of features appearing at once. Hook: `proof`. Bold concept.
- **Use when:** `many-features` (3). **Avoid when:** `single-magic`. Suits productivity, utilities, finance.
- **Phase 1:** excluded as needs Phase 2.

## cinematic {#cinematic}

- **Phase 2.** 3D tilt, parallax and motion blur around the device. Hook: `pattern-interrupt`. Bold concept, no
  requirements, any category. Play and social only, since Apple has rejected frames (`store-rules.md`, `apple-frames`).
- **Phase 1:** excluded as needs Phase 2.

## type-led {#type-led}

- **Story:** big type carries the message; the app appears in short real clips.
- **Beats:** hook 2 s, beat 4 s, beat 4 s, beat 3 s, end 2 s. Hook: `bold-claim`. Bold concept.
- **Use when:** nothing in particular; it has base score 1 and is the fallback when nothing else fits. Suits social, games,
  media.
- **Avoid when:** nothing.
- **Recording needs:** the least; any three short clips.
- **Defaults:** pop or words caption motion, large type.
- **App Store cut:** keep captions over footage, not instead of it (2.3.4: only screen captures of the app).

## Worked example: AptusFIT

An Expo fitness app with an AI coach (`fitness-brief.json` in `evals/files/`).

- **Brief:** category `fitness`; signals `ai-stream`, `timer`, `live-update`, `sheet`, `progress`, `counter`, `watch-app`,
  `daily-habit`; moments `log-set`, `swap`, `progress`, `coach` (network, varies per take), `paywall`. The owner must show
  the coach.
- **Picks:**
  - **safe: feature-loop.** Uses only automatable moments: log-set (3.5 s), progress (3.5 s), swap (4 s), end card.
  - **strongest: ask-answer.** The coach writes a workout. Features the owner's must-show; the answer is a seeded
    conversation (`marketing?action=coach`) to avoid per-run variation.
  - **bold:** a concept with a different hook from the other two.
- **Excluded:** `multi-device` (watch app) as needs Phase 2.
- **Caption sketch (feature-loop):** "Log a set in one tap" over the rest-timer slide-in; "Swap any exercise" over the
  swap sheet; "See your week at a glance" over the counters rolling in.
