# Categories

Which concepts suit which app category, with reasons. The category lists match `categories` in
`scripts/concepts.mjs`; a category match adds 2 points to a concept. `recommend.mjs` cites these sections as
`categories.md#<category>`. Concept details are in `concepts.md`.

## Contents
- fitness, health, finance, ai, productivity, social, education, travel, shopping, games, utilities, media, food

For categories with no strong match, `type-led` is the fallback and `feature-loop` is the safe pick.

## fitness {#fitness}
Suits `feature-loop`, `ask-answer`, `results-first`, `day-in-life`, `multi-device` (Phase 2). Fitness is a loop of do, log,
see progress, so small tap-and-react beats and visible counters read well. An AI coach suits `ask-answer`.

## health {#health}
Suits `feature-loop`, `before-after`, `results-first`, `day-in-life`, `multi-device` (Phase 2). Habit and tracking apps win
on daily use and visible change. Avoid health claims the footage cannot show, and no medical results.

## finance {#finance}
Suits `feature-loop`, `before-after`, `speedrun`, `results-first`, `bento` (Phase 2). The pitch is time saved and clarity.
Use seeded demo data, and show no real balances. Prices and currencies are an Apple WARN (`store-rules.md#price`).

## ai {#ai}
Suits `hero-moment`, `ask-answer`. One magic moment shown in full beats a tour. Live model output varies per take, so seed
the conversation or accept a `network` risk.

## productivity {#productivity}
Suits `hero-moment`, `feature-loop`, `before-after`, `day-in-life`, `bento` (Phase 2), `multi-device` (Phase 2). Show the
chore disappearing. With a broad feature set, prefer `feature-loop` over a tour.

## social {#social}
Suits `type-led`. Real feeds contain other people's content and private data: use seeded content only. Bold hooks suit the
social channel.

## education {#education}
Suits `ask-answer`, `results-first`. Show a question answered or a streak and score growing.

## travel {#travel}
Suits `ask-answer`, `speedrun`. The pitch is planning or booking fast. Avoid dates and prices (`time-sensitive`, `price`).

## shopping {#shopping}
Suits `ask-answer`, `speedrun`. Product prices on screen trip the Apple price WARN: use a flow that avoids price screens
or seed neutral data.

## games {#games}
Suits `type-led`. Show real gameplay, not cutscenes (Apple and Google both want real experience, at least 80% on Play).

## utilities {#utilities}
Suits `hero-moment`, `before-after`, `speedrun`, `bento` (Phase 2). One job done fast; the before-after contrast is the
sale.

## media {#media}
Suits `type-led`. Show real playback; licensed content on screen needs rights (Apple: only content you have the rights to
display).

## food {#food}
Suits `feature-loop`, `day-in-life`. Meal logging and planning loop well in short beats. Avoid seasonal references.
