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
