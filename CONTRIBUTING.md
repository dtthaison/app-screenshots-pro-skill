# Contributing

Thanks for helping. Bug reports with a config that reproduces the problem are the most useful thing you can send.

## Setup

```bash
cd skills/generating-app-screenshots
npm install
npm test               # renders the demo (iPhone, English) and fails on store-rule errors
npm run examples       # renders every example (about 10 minutes)
npm run site           # rebuilds the GitHub Pages showcase in ../../docs from those renders
```

## Before opening a pull request

- Run `npm run examples` and open each `examples/*/out/index.html`. Check that no example prints an `ERROR` or `WARN` line.
- For a new layout, pattern, device or target, add it to the matching example config and to `references/config.md`.
- For a change to how Claude works through the task, edit `SKILL.md` and keep it short (under ~1,100 words). Put details in `references/`.
- Keep example assets original or openly licensed. Don't add photos, logos, fonts or screenshots from real apps or other screenshot tools.

## Code style

The scripts are plain ES modules with no build step. Match the surrounding code: compact, few comments, explaining *why* rather than *what*.
