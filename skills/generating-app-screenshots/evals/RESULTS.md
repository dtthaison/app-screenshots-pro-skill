# Eval results — 1.2.0 (real-footage previews)

Run 2026-10-31 on `evals/evals.json`, one run per eval, model Sonnet. Each run used an isolated working folder with only its
`files/`. Assertions were graded against the files each run wrote (`picks.json`, `proposal.md`, `preview.config.json`,
`transcript.md`) and, for eval 3, by re-running `render.mjs --check` on the written config.

Haiku and Opus runs are deferred (plan ruling R3); run them before relying on the skill with those models.

| Eval | With skill (Sonnet) | Without skill (Sonnet) |
|---|---|---|
| 1. Fitness app, streaming AI coach, must-show coach | 7/7 (after the SKILL.md fix below; first run 3/7) | 3/6 |
| 2. Budgeting app, no AI | 5/5 | not run |
| 3. App Store only, config + `--check` | 7/7 | not run |
| 4. Must-avoid paywall | 4/4 | not run |

## Notes

- **Eval 1, first run: 3/7.** The agent saved the recommender's text output to `picks.json`, so every assertion read from
  `picks.json` failed. SKILL.md showed `recommend.mjs preview-brief.json` without `--json`; 3 of the 4 recommender runs
  (evals 1, 2, 4) first saved text and two of them noticed and re-ran with `--json`. SKILL.md step 2 now says the command
  prints text and `--json > picks.json` saves the machine-readable result. The rerun passed 7/7 (it still printed text
  first, then used `--json`).
- **Eval 1 without the skill: 3/6.** The baseline invented its own storylines (ids `safe-coach-plus-progress`,
  `strongest-plan-train-track`, `bold-adapts-to-you`), all opening on the coach. It passes "strongest has the coach",
  "plain-language proposal" and "no Phase-2 concept". It fails running `recommend.mjs`, the concept ids
  `feature-loop`/`ask-answer`, and the take-to-take risk (it says the coach needs the network, not that each take
  differs). Its `picks.json` shape was given in the prompt, so "valid JSON with 3 roles" is not counted for it.
- **Eval 3** used `results-first` (the recommender's strongest for the budget brief), `full-screen`/`caption-band` scenes
  with `draft: files/draft.png`, and an `end-card` last. Final `--check`: exit 0, two NOTEs (no `app.icon`; draft stills),
  no WARN, no frame warning.
