# Reading the app & capturing raw screens

## 1. Extract context from the codebase

Collect into a short brief before writing copy: **name, one-line promise, 4–6 features ranked by user value, audience,
brand colors (primary/accent/background), font, supported locales, existing translation files, tone**.

| Stack | App name / locales | Colors & fonts | Features & screens |
|---|---|---|---|
| iOS (SwiftUI/UIKit) | `Info.plist` `CFBundleDisplayName`, `*.xcstrings`, `*.lproj/` dirs, `knownRegions` in `project.pbxproj` | `Assets.xcassets/*.colorset/Contents.json`, `AccentColor`, `Color("…")`, `.font(.custom(…))`, `UIAppFonts` | `*View.swift` names, `TabView` tabs, `NavigationStack` roots, App Store `fastlane/metadata/*/description.txt` |
| Android (Compose/XML) | `strings.xml` `app_name`, `res/values-*/` dirs, `locales_config.xml` | `ui/theme/Color.kt`, `Theme.kt`, `res/values/colors.xml`, `res/font/` | `*Screen.kt`, `NavHost` routes, bottom nav items, `fastlane/metadata/android/*/full_description.txt` |
| Flutter | `pubspec.yaml`, `l10n.yaml`, `lib/l10n/*.arb` | `ThemeData`/`ColorScheme.fromSeed`, `pubspec.yaml` fonts | `lib/**/screens|pages/*.dart`, `GoRouter` routes |
| React Native / Expo | `app.json`/`app.config.*` `name`, `i18n/locales/*.json` | `theme.ts`, `tailwind.config.*`, `expo-font` loads | `app/` (expo-router) or `screens/` + navigator config |
| Web / PWA | `manifest.json`, `<title>`, i18n json | CSS variables, Tailwind config | routes / pages |

Also read: README, marketing site copy, existing store description (`fastlane/metadata`), onboarding screens (they state the value props),
paywall screens (they list the premium benefits), and review prompts. Use the app's own translations as a **glossary** so captions say
"Streak" the way the app does in every language.

Pick the 4–6 screens that prove the best benefits: the core loop first, then differentiators, then social proof/premium.

## 2. Capture real screens (best quality)

Set clean demo data first (realistic names, numbers, no "Test User", no debug banners). Clean the status bar.

**iOS Simulator**
```bash
xcrun simctl list devices available | grep -E "iPhone 1[6-9] Pro Max|iPad Pro 13"
xcrun simctl boot "iPhone 17 Pro Max"; open -a Simulator
xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
xcrun simctl launch booted com.example.app -AppleLanguages "(vi)" -AppleLocale vi_VN    # per locale
xcrun simctl io booted screenshot screens/vi/home.png
xcrun simctl ui booted appearance dark   # if the marketing style needs dark mode
```
Automate many screens × locales with fastlane `snapshot` (UI tests + `snapshot("01Home")`), XCUITest, or Maestro flows.

**Android Emulator**
```bash
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
adb shell cmd locale set-app-locales com.example.app --locales vi-VN     # Android 13+, per-app locale
adb exec-out screencap -p > screens/vi/home.png
```
Automation: fastlane `screengrab`, Maestro, or Compose/Espresso tests with `Screengrab.screenshot("home")`.

**Flutter:** `integration_test` + `binding.takeScreenshot('home')`, or run on a simulator and use the commands above.
**Expo / RN:** run in the simulator and capture as above, or Maestro `takeScreenshot`.
**Web/PWA:** Playwright `page.screenshot()` at a 430×932 viewport, `deviceScaleFactor: 3`; desktop web at 1280×800 for the `browser` frame.
**watchOS:** boot a watch simulator (`xcrun simctl list devices available | grep -i "watch ultra"`), run the watch app, then
`xcrun simctl io <watch-udid> screenshot screens/watch/home.png`. Upload watch shots raw; the App Store masks them itself.
**Wear OS:** use a round Wear OS emulator (e.g. "Wear OS Large Round"), then `adb -s <emulator> exec-out screencap -p > screens/wear/home.png`.
The Play upload must be the bare UI: no frame, caption or background (the `wear-os` target is raw).
**macOS:** run the app, then `screencapture -o -l $(osascript -e 'tell app "System Events" to id of window 1 of process "App"') win.png`
or ⌘⇧4 + Space on the window (`-o` drops the shadow). Use `model: "none"` if the capture already has its title bar; otherwise crop
to the content and let `mac-window` draw it.
**Windows:** Win+Shift+S → Window snip, or `Alt+PrtSc`. Crop the title bar off and let `windows-window` redraw it at any size.

Save as `screens/<locale>/<name>.png`. Missing locales fall back to the language folder, then to `defaultLocale`
(the renderer warns). The frame is chosen from the image's aspect ratio, so phone captures always get phone frames.

## 2b. Record the app for previews

App previews and the creative videos (header, search results, In-App Event) show **how the app works**, so they want a recording of the main flow. Stills work for a draft only. The recorder, `scripts/record.mjs`, films a scripted take on the iOS Simulator and writes everything the renderer needs: the `.mov`, a tap sidecar (`.taps.json`, with marks) and a 1 fps contact sheet (`.sheet.jpg`). This release records on iPhone only; record on the same device class as the target (886×1920 for `preview-iphone`).

### Moments, deep links and test IDs

A take is a short script of **moments**: things that move, such as a timer starting, a sheet opening, a number counting up. Find them while you read the code (§1), write them in `preview-brief.json`, and for each one note how to reach it without hand-driving the app:

- **Deep links.** The most reliable start. Look for the URL scheme (`Info.plist` `CFBundleURLSchemes`, `app.json` `scheme`, Android `intent-filter` with `<data android:scheme=…>`) and the route table. A step of `{ "open": "myapp://session" }` then lands on the same screen every take.
- **Expo Router.** A `(dev)` or `(marketing)` route group is a good place for seeded screens: `app/(dev)/marketing.tsx` reads `?action=session|swap|progress` and loads fixed data, so the link `exp+<slug>://marketing?action=session` (dev client) or `<scheme>://marketing?action=session` shows a seeded state. Ship it behind `__DEV__` only, and tell the owner you added it.
- **Android intents.** `adb shell am start -a android.intent.action.VIEW -d "myapp://session" <package>` is the equivalent of an `open`. For apps without a link, `adb shell am start -n <package>/.DebugActivity --es screen session`.
- **Flutter keys.** Give the widgets a stable key, `Key('set-done-4-0')`, and expose it as a semantics identifier (`Semantics(identifier: 'set-done-4-0', child: …)`), which Maestro reads as an `id`. `integration_test` finders on the same keys keep the take and the tests in step.
- **Test IDs.** React Native: `testID="set-done-4-0"`; SwiftUI: `.accessibilityIdentifier("set-done-4-0")`; Compose: `Modifier.testTag("…")` with `testTagsAsResourceId = true`. A `tap` step uses `{ "id": "set-done-4-0" }`. Without an ID, `{ "text": "Arnold Press" }` matches the visible text or accessibility label.
- **Seed data and locale.** Use `record.setup` (a `shell` step, for example a script that resets the app and sets the language) so every take starts from the same state. Never record a real person's data.

### The record block

Add a `record` block to the preview (config.md → Real footage previews has every field):

```jsonc
"record": {
  "app": "com.example.app",
  "setup": [ { "shell": "bash marketing/set-locale.sh {udid} {locale}" } ],
  "steps": [
    { "open": "myapp://session", "wait": 6, "mark": "start" },
    { "tap": { "id": "set-done-4-0" }, "wait": 3, "mark": "log" },
    { "open": "myapp://session?sheet=swap", "wait": 6, "mark": "swap" }
  ]
}
```

Then:
```bash
node scripts/render.mjs <config> --check                      # the storyboard, against draft stills
node scripts/record.mjs <config> --preview <id> [--udid U] [--locales a,b] [--takes 3]
```
It needs [Maestro](https://maestro.mobile.dev) 2.6+, Xcode's `xcrun simctl`, one booted simulator (or `--udid`) and the app installed. It rehearses every step first and stops with an ERROR for an element it cannot find or a system alert (permission prompt, notification banner): grant or turn off the permission in the simulator first. A failed run leaves the previous recording untouched.

Rules for a good take:
- **Slow, deliberate gestures**, and about 1 s of pause on every screen (`wait`). Idle stretches are sped up later with `speed: "auto"`; taps stay at 1×.
- **Mark every moment** you want as a scene, and cut with `clip: { "from": "log", "to": "swap" }`.
- No keyboard unless it is the point, no personal data, no debug banners, status bar 9:41 (the recorder sets it).
- **One recording per locale**: `--locales`, with `record.locales` mapping store locale to app locale. Or one English recording with `"clipLocale": "en-US"` on the preview (the other locales then reuse it and the renderer stops warning that the UI language does not match).
- **Review `recordings/<locale>/<preview>.sheet.jpg` before rendering** with the must-not-ship checklist in SKILL.md.
- Apple wants the previews to show real in-app use. Simulator recordings carry no audio; the renderer adds a silent stereo track (or your `music`).

### Fallback: record by hand

When Maestro or a simulator is not available (a physical device, an Android emulator, a web app), record by hand and point scenes at the file. Without a sidecar, `tap` effects are skipped (with a NOTE only when `tap` is set explicitly; the default is silent), `speed: "auto"` still works because it needs only frames, and `clip.from`/`to` marks are an ERROR (use `clip.start`/`end`). A hand-written `.taps.json` next to the recording restores marks and tap effects (`examples/preview/recordings/en-US/walk.taps.json`).

**iOS Simulator** (set the status bar override from §2 first)
```bash
mkdir -p recordings/en-US
xcrun simctl io <udid> recordVideo --codec h264 --mask ignored recordings/en-US/flow.mov     # Ctrl-C stops (wait for it to finish writing)
```
Drive the app while it records: deep links (`xcrun simctl openurl booted myapp://stats`), `maestro test flow.yaml`, or by hand.

**Android Emulator / device**
```bash
adb shell screenrecord --bit-rate 8000000 /sdcard/flow.mp4      # stops after 180 s or on Ctrl-C
adb pull /sdcard/flow.mp4 recordings/en-US/flow.mp4
```

The same rules apply, plus: one long recording can become several scenes with `clip: { "start": 12, "end": 19 }` and a caption per chapter; HTML mocks do not record (a mock is a still, and a preview made only of stills and mocks is a draft). A clip is cropped when its aspect is more than 2% off the frame's screen.

Point scenes at recordings with `"screen": "recordings/{locale}/flow.mov"` (see config.md → previews, `examples/preview/` and `examples/preview-recorded/`).

## 3. When no build can run: HTML mock screens

Rebuild each chosen screen as `screens/<name>.html` from the real UI code: same layout, colors, icons, copy and realistic data.
Shared CSS/JS next to them is fine. Read `new URLSearchParams(location.search).get('locale')` and use the app's own
translation files for UI strings, so screens localize along with captions. The renderer opens each one at the device's viewport
(iPhone 440 pt wide, Android 412 dp, iPad 1032 pt, Apple Watch 211×257, Wear OS 227×227, MacBook 1440×900, windows 1280×800)
at @3x; the full list is in config.md → Device models. Use `@media (min-width:700px)` for tablet layouts. Watch mocks: black
background, one glanceable thing, big type. Wear OS: keep content inside the circle. Desktop mocks: sidebar + content; add an
optional menu bar for laptop/monitor frames (see `examples/devices/screens/desktop.html?state=full`).
Tell the user that mocks stand in for real captures. Apple requires screenshots to show the real app, so they should swap
in real captures before submitting.

Rules for mocks:
- **Fill the screen.** The device shows the whole viewport (440×956 on iPhone), so add enough realistic rows, cards or charts to
  reach the bottom. Sparse sample data from code previews leaves half the phone empty.
- **Icons:** use emoji or inline SVG. SF Symbols / Material Symbols codepoints render as `#` or boxes in Chrome.
- **Strings:** take them from the app's translation files. Where the app has a bug (e.g. "1 days left", a missing plural), render
  the correct text in the mock and list the bug in your report.
- Match the app's real appearance (light/dark, system font, nav-bar style, tab bar).

Skeleton (copy per screen; put shared CSS/JS in sibling files if there are several):

```html
<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0} body{font:17px -apple-system,system-ui,sans-serif;background:#f2f2f7;color:#111;min-height:100vh}
  .status{height:54px;padding:18px 32px 0;display:flex;justify-content:space-between;font-weight:600;font-size:16px}
  main{padding:8px 20px 24px} h1{font-size:34px;font-weight:700;margin:6px 0 14px}
  .row{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px}
  @media (min-width:700px){ main{padding:16px 48px} }              /* iPad / tablet layout */
</style>
<div class="status"><span>9:41</span><span>100%</span></div>
<main>
  <h1 data-t="title"></h1>
  <div class="row">🥬 <span data-t="item1"></span></div>
  <!-- …enough rows to fill to the bottom… -->
</main>
<script>
  const loc = new URLSearchParams(location.search).get('locale') || 'en-US', lang = loc.split('-')[0];
  const T = { en: { title: 'My Pantry', item1: 'Spinach' }, fr: { title: 'Mon garde-manger', item1: 'Épinards' } };
  const t = T[loc] || T[lang] || T.en;
  document.documentElement.lang = loc;
  if (['ar', 'he', 'fa', 'ur'].includes(lang)) document.documentElement.dir = 'rtl';
  document.querySelectorAll('[data-t]').forEach((e) => (e.textContent = t[e.dataset.t] ?? T.en[e.dataset.t]));
</script>
```
