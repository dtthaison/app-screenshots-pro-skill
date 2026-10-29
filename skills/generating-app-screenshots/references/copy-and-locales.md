# Captions, translation & locales

## Writing captions

- One idea per slide. Lead with the **benefit**, back it with the feature: "Never miss a dose" > "Reminder screen".
- Title 2–6 words (≤ ~32 characters in English); optional subtitle ≤ ~60 characters.
- Highlight 1–3 words with `**…**`, the words that carry the benefit, not filler.
- Slide 1 = the strongest promise plus proof (rating badge, award, user count) only if it's true. Most visitors see only the first 2–3 slides.
- Order: core value → top differentiators → depth features → trust / premium / social proof.
- Verbs and numbers beat adjectives: "Save 3 hours a week", "47-day streaks".
- No prices, "free" claims or ranking claims unless the app actually offers them. Apple rejects misleading screenshots.

## copy.json

```json
{
  "en-US": { "track.title": "Check off your day in **one tap**", "track.subtitle": "Water, reading, running — one list." },
  "vi":    { "track.title": "Hoàn thành ngày mới chỉ với **một chạm**", "track.subtitle": "…" }
}
```
Also accepted: an Xcode String Catalog (`Marketing.xcstrings`) or several files in a list (later files override earlier ones).

## Translating

Translate the copy yourself, as a native marketer would, not word for word:
- Keep the benefit and tone, adapt idioms, keep `**…**` around the equivalent words (the highlight can move position).
- Reuse the app's own terms from its translation files (glossary).
- Lengths: German/Finnish/Russian run 30–40% longer, so pick shorter synonyms; CJK runs shorter, so a slightly larger `titleSize` via `byLocale` is fine.
- Japanese/Chinese: no spaces; break lines with `\n` at natural phrase boundaries if auto-wrap splits badly.
- Arabic/Hebrew/Persian/Urdu: RTL is automatic (direction + left/right alignment swap). Use Western or locale digits consistently.
- Formats: decimal comma (de, fr, vi: "4,9"), thousands separators, currency, and dates per locale.
- Tell the user which locales would benefit from native-speaker review (legal claims, slogans, puns).

## Locale codes

Use the config code; `--fastlane` maps it to each store's folder name (`scripts/targets.mjs` `LOCALE_MAP`).

| Language | config | App Store Connect | Play Console |
|---|---|---|---|
| English (US/UK/AU/CA) | en-US / en-GB / en-AU / en-CA | same | same |
| German | de | de-DE | de-DE |
| French (FR/CA) | fr / fr-CA | fr-FR / fr-CA | fr-FR / fr-CA |
| Spanish (Spain / Latin Am.) | es-ES / es-MX | es-ES / es-MX | es-ES / es-419 |
| Portuguese (BR/PT) | pt-BR / pt-PT | same | same |
| Italian, Dutch, Polish, Swedish, Turkish, Russian | it, nl, pl, sv, tr, ru | it, nl-NL, pl, sv, tr, ru | it-IT, nl-NL, pl-PL, sv-SE, tr-TR, ru-RU |
| Japanese / Korean | ja / ko | ja / ko | ja-JP / ko-KR |
| Chinese Simplified / Traditional | zh-Hans / zh-Hant | zh-Hans / zh-Hant | zh-CN / zh-TW |
| Vietnamese, Thai, Indonesian, Hindi | vi, th, id, hi | vi, th, id, hi | vi, th, id, hi-IN |
| Arabic / Hebrew | ar / he | ar-SA / he | ar / iw-IL |

App Store Connect supports about 40 localizations and Play about 80. Start with the locales the app itself supports.

## Store rules the renderer enforces

- Apple: exact accepted sizes, PNG/JPEG, **no alpha**, 1–10 per size per locale. Larger iPhone/iPad sizes scale down to smaller slots.
- Play: PNG/JPEG without alpha, 320–3840 px, long side ≤ 2× short side, 2–8 phone screenshots, 4+ for tablet/Chromebook.
  Feature graphic: exactly 1024×500.
- Show the real app UI. Don't show other platforms' devices (no iPhone frames on Play, no Android frames on the App Store).
