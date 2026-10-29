# ClipBoardLine Windows Glass Clothesline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Windows shelves as glass cards on a clothesline that scale per monitor, add Windows-native keys and rope scrolling, fix startup/multi-monitor bugs, and ship it from the owner's fork.

**Architecture:** All work is in `windows/` (Electron 44). Settings defaults and a one-time migration live in `lib/model.cjs`; sizing, keys, scrolling and markup live in `renderer.js`; look and motion in `styles.css`; window placement and update gating in `main.cjs`.

**Tech Stack:** Electron 44.9.1, plain JS/CSS, `node --test`, Playwright smoke (`npm run test:electron`), electron-builder NSIS.

**Spec:** `docs/superpowers/specs/2026-10-30-windows-glass-clothesline-design.md`

## Global Constraints

- Touch only `windows/` and `docs/superpowers/`. No Swift/macOS changes.
- No feature removal, no storage format change beyond one added settings key (`windowsProfile`), update feed identity unchanged.
- Existing keys keep working; new keys are added as aliases.
- `npm test` must pass at the end of every task (from `windows/`).
- Motion obeys `prefers-reduced-motion` and the new `swayCards` setting.

## Review Focus

1. Text fields: Enter, F2, Ctrl+D, `?`, arrows and wheel inside search/rename/edit fields must keep normal typing behavior — Task 5 adds a test.
2. A rope with 0 or 1 card: wheel/drag/arrow scrolling must not throw or create empty pages — Task 6 adds a test.
3. Enter on an item whose paste target is gone (window closed, elevated app): copies and shows the toast, never loses the selection — Task 5 adds a test.
4. Monitor unplugged while shelves are open: window moves to a live display — Task 7 adds a test.
5. Owner who already changed the toggle hotkey: migration must not overwrite it — Task 2 adds a test.

---

### Task 0: Fork, local clone, toolchain

**Files:** none in repo.

- [ ] **Step 1:** In Chrome (owner logged in), open `https://github.com/orkunisitmak/clipboardline` and create a fork under the owner's account (all branches off; `main` only).
- [ ] **Step 2:** `git clone https://github.com/<owner>/clipboardline.git` into a working folder; `git remote add upstream https://github.com/orkunisitmak/clipboardline.git`; create branch `windows-glass`.
- [ ] **Step 3:** Copy this plan and the spec into `docs/superpowers/`.
- [ ] **Step 4:** In `windows/`: `npm ci`. Then `npm test`. Expected: all pass (baseline). Record any pre-existing failures in the commit message instead of fixing them.
- [ ] **Step 5:** Commit `docs: add Windows glass clothesline spec and plan`.

### Task 1: Startup ACL fix

**Files:**
- Modify: `windows/native/protect-directory.ps1:8,17`
- Test: `windows/tests/security.test.cjs`

- [ ] **Step 1: Failing test** `protect-directory secures a folder without SeSecurityPrivilege`: create a temp dir, spawn `powershell -NoProfile -ExecutionPolicy Bypass -File native/protect-directory.ps1 -Directory <tmp>`, assert exit code 0 and parsed JSON `protected===true` and `principals` includes `S-1-5-18` and `S-1-5-32-544`. Skip when `process.platform!=='win32'`.
- [ ] **Step 2:** Run `node --test tests/security.test.cjs`. Expected: FAIL with `SeSecurityPrivilege` in stderr (non-admin shell).
- [ ] **Step 3:** Replace `Get-Acl`/`Set-Acl` in the write path with `[System.IO.DirectoryInfo]::new($Directory)`, `.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)` and `.SetAccessControl($acl)`. Keep CRLF line endings.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit `fix(windows): secure app data with DACL-only ACL write`.

### Task 2: Settings defaults and one-time migration

**Files:**
- Modify: `windows/lib/model.cjs:12-21` (DEFAULTS), `:37` (boolean keys), `:111` (load)
- Test: `windows/tests/model.test.cjs`

**Interfaces:**
- Produces: settings keys `swayCards: boolean` (default `true`), `windowsProfile: integer` (default `1`); `DEFAULTS.shortcuts.toggle==='Control+Alt+V'`, `DEFAULTS.captureImages===true`, `DEFAULTS.autoCheckUpdates===false`. Function `migrateWindowsProfile(settings) -> settings` exported from `model.cjs`.

- [ ] **Step 1: Failing tests**
  - `defaults use the Windows profile`: assert the four default values above and `swayCards===true`.
  - `migration moves the untouched old hotkey and enables image capture once`: input `{...DEFAULTS, shortcuts:{...,toggle:'Control+Alt+T'}, captureImages:false, autoCheckUpdates:true}` without `windowsProfile` → output `toggle==='Control+Alt+V'`, `captureImages===true`, `autoCheckUpdates===false`, `windowsProfile===1`.
  - `migration keeps a hotkey the owner changed`: input toggle `'Control+Shift+Space'` → unchanged.
  - `migration runs once`: input with `windowsProfile:1`, toggle `'Control+Alt+T'`, `captureImages:false` → unchanged.
  - `Store persists migrated settings on load`: write a `library.json` with old settings to a temp dir, open `Store`, reopen, assert migrated values on disk.
- [ ] **Step 2:** `node --test tests/model.test.cjs` → FAIL.
- [ ] **Step 3:** Implement: add keys to DEFAULTS; add `swayCards` to the boolean list in `settings()`; accept `windowsProfile` as integer 0–100; `migrateWindowsProfile` applies only when `(settings.windowsProfile||0)<1`; call it at `:111` after `settings(parsed.settings)` and `persist()` when it changed anything.
- [ ] **Step 4:** Rerun → PASS. Update any other test asserting `'Control+Alt+T'` as the *default* (not as an arbitrary binding) in `tests/*.test.cjs`; `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(windows): Windows defaults and one-time settings migration`.

### Task 3: Upstream updates off in the fork

**Files:**
- Modify: `windows/lib/updates.cjs` (export), `windows/main.cjs:39,101,389,392,413,471`
- Test: `windows/tests/updates.test.cjs`

**Interfaces:**
- Produces: `FORK_BUILD: true` exported from `lib/updates.cjs`.

- [ ] **Step 1: Failing test** `fork builds never schedule or install upstream updates`: with `FORK_BUILD` true, `new AutomaticUpdateScheduler(updates,{enabled:()=>true})` gated as main does (`enabled: () => !FORK_BUILD && ...`) never calls `updates.check`; assert `FORK_BUILD===true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Export `FORK_BUILD`; in `main.cjs` treat `FORK_BUILD` like `development` for every update path (scheduler `enabled`, notification at `:101`, tray "Check for updates…" and Settings check at `:392` show the existing "official release" message text replaced by `'This is your own build. Updates are applied manually from your fork.'`).
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(windows): disable upstream auto-update in fork builds`.

### Task 4: Per-monitor card size and glass clothesline look

**Files:**
- Modify: `windows/renderer.js:277-290` (`shelfPageSize`, `card`, `shelfRow`), `windows/styles.css` (shelf/card/rope/label/tool rules, `:14`, `:73-74`)
- Test: `windows/tests/renderer-ui.test.cjs`, `windows/tests/shelf-render.test.cjs`

**Interfaces:**
- Produces: `cardWidth(): number` in `renderer.js` = `clamp(innerWidth*0.11, 180, 360) * {small:0.8, medium:1, large:1.3}[cardSize]`, rounded. `shelfPageSize()` and `card()` both use it; `--card-width` is set on `.shelves` from it. Card markup gains `<span class="card-pin" aria-hidden="true"></span>` as first child of `.card` on shelves (not Library).

- [ ] **Step 1: Failing tests**
  - `card width scales with the window`: innerWidth 1920 → 211; 2560 → 282; 1280 → 180; 4000 → 360; `cardSize:'large'` at 2560 → 366 (281.6 × 1.3, rounded once at the end).
  - `page size follows card width` (existing formula `min(9, floor((width-24)/(cardWidth+24)))`): 2560 medium → 8; 1920 medium → 8; 1280 medium → 6.
  - `shelf cards render a clothespin and no rope strip`: rendered shelf HTML contains `card-pin` per card and Library cards do not.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `cardWidth`, pin markup, and CSS: cards are glass panes (`backdrop-filter: blur(20px) saturate(1.7)`, `rgba(255,255,255,.14)` fill, 1px `rgba(255,255,255,.5)` border, inset top highlight, soft drop shadow, radius 18px); thumbnail inside with radius 12px; clothespin 12×26px wood gradient centered on top; rope 2px white 85% with drop shadow keeps the existing `--sag`; row label and per-row tool buttons become glass pills; selected card ring `#ffd54a`. Match mockup `clipboard-clothesline-v3.html` (in the brainstorm folder).
- [ ] **Step 4:** Run → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(windows): glass cards on a clothesline, sized per monitor`.

### Task 5: Motion and Windows keys

**Files:**
- Modify: `windows/styles.css` (keyframes), `windows/lib/shelf-motion.cjs` (open/close timing if it owns them), `windows/renderer.js:9-22` (keys/aliases), key dispatch, card `contextmenu`, new cheat-sheet modal; `windows/main.cjs:229` (paste fallback)
- Test: `windows/tests/shelf-motion.test.cjs`, `windows/tests/renderer-ui.test.cjs`, `windows/tests/paste-target.test.cjs`

**Interfaces:**
- Consumes: `swayCards` (Task 2).
- Produces: action `shortcutsHelp` (default `'F1'`, alias `'Shift+/'`); `DEFAULT_ALIASES` becomes `{paste:['Enter'], pin:['Ctrl+P','Ctrl+D'], name:['F2'], …rest unchanged}` and `copy` loses the `Enter` alias. Main returns `{pasted:false, copied:true, reason}` from the paste command when the target refuses; renderer shows toast `'Copied — paste target unavailable'` (add to `locales.js` for en/tr: `'Kopyalandı — yapıştırılacak yer bulunamadı'`).

- [ ] **Step 1: Failing tests**
  - `Enter pastes, Ctrl+C copies`: dispatching Enter on a focused shelf card calls the `paste` command; Ctrl+C calls `copy`.
  - `F2 renames and Ctrl+D pins`: F2 opens the name modal; Ctrl+D toggles pin; `Alt+P` and `P` still work.
  - `F1 and ? open the shortcuts sheet`: sheet lists the current context's actions with their keys.
  - `right-click opens Actions for that card`: `contextmenu` on a card focuses it and opens the Actions bar scoped to it; default browser menu prevented.
  - Review Focus 1 `typing keys stay in text fields`: Enter/F2/Ctrl+D/`?` inside the search input and rename input do not trigger shelf actions.
  - Review Focus 3 `Enter falls back to copy`: paste command rejects → clipboard written, toast shown, selection unchanged.
  - `sway respects settings and reduced motion`: `.shelves` has class `sway` only when `swayCards` and not reduced motion.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Motion: open = cards drop from `translateY(-40px) rotate(-6deg)` with `cubic-bezier(.2,1.4,.4,1)` 700ms, 70ms stagger per index; idle sway = `rotate` 0→1.2deg, 6s ease-in-out infinite, phase offset by index; hover/focus pauses sway and applies `translateY(6px) scale(1.05)` in 350ms; close = 160ms fade+rise. Keyboard focus moves immediately (no awaiting animations). Add a `swayCards` checkbox next to the existing card-size control in Settings.
- [ ] **Step 4:** Run → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(windows): clothesline motion and Windows-native keys`.

### Task 6: Scrolling along a rope

**Files:**
- Modify: `windows/renderer.js` (`shelfRow`, key handler for `previous`/`next`, document `wheel` listener `:897`, pointer handlers), `windows/styles.css`
- Test: `windows/tests/renderer-scroll.test.cjs`

**Interfaces:**
- Produces: `scrollRope(kind: string, direction: -1|1): boolean` — moves `ui.pages[kind]` by one within bounds, returns false at an edge; the row's card track gets `transform: translateX(...)` with a 320ms `cubic-bezier(.2,.8,.2,1)` transition so page changes slide.

- [ ] **Step 1: Failing tests**
  - `arrow past the last visible card slides the rope`: focus last card of page 0, ArrowRight → page 1, focus on its first card, numbers 1–9 refer to page 1.
  - `wheel over a rope scrolls that rope`: `deltaY>0` over Images row → `scrollRope('image',1)`; `deltaX` and Shift+wheel do the same; wheel over image preview keeps existing zoom behavior.
  - `drag on empty rope space scrolls`: pointer drag ≥ 60px left → next page; drag starting on a card keeps existing card drag-out behavior.
  - Review Focus 2 `short ropes do not scroll`: rope with 0 or 1 card → `scrollRope` returns false, no throw, page stays 0.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; throttle wheel to one page per 250ms.
- [ ] **Step 4:** Run → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(windows): scroll a rope with arrows, wheel and drag`.

### Task 7: Monitor changes

**Files:**
- Modify: `windows/main.cjs` (near `:125-131`), `windows/lib/window-bounds.cjs`
- Test: `windows/tests/window-bounds.test.cjs`

**Interfaces:**
- Produces: `relocate(windowBounds: Rect, displays: Display[], cursorPoint: Point) -> Rect` in `lib/window-bounds.cjs`: shelves → work area of the display under the cursor; normal window → kept if it intersects a live work area, else centered on the cursor's display.

- [ ] **Step 1: Failing tests**
  - Review Focus 4 `shelves move when their display disappears`: bounds on a removed display → work area of the cursor display.
  - `normal window stays when still visible`, `off-screen normal window is centered on cursor display`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `relocate`; in `main.cjs` subscribe to `screen.on('display-added'|'display-removed'|'display-metrics-changed')` and apply `relocate` when the window is visible.
- [ ] **Step 4:** Run → PASS; `npm test` → PASS.
- [ ] **Step 5:** Commit `fix(windows): keep shelves on a live display after monitor changes`.

### Task 8: Build, verify on the real desktop, install, publish

**Files:** none (release steps).

- [ ] **Step 1:** `npm test` and `npm run test:electron` → PASS.
- [ ] **Step 2:** `npm run dist` → `windows/dist/ClipBoardLine Setup <version>.exe` exists.
- [ ] **Step 3:** Back up `%APPDATA%\ClipBoardLine\library.json` to the scratch folder. Quit ClipBoardLine. Uninstall the current build via its uninstaller in `%LOCALAPPDATA%\Programs\clipboardline-desktop`. Install the new setup. Confirm a Desktop shortcut exists (create one to the installed exe if NSIS did not).
- [ ] **Step 4:** Manual checks on all three monitors (4K@150%, 2560×1440, 1920×1080): `Ctrl+Alt+V` opens shelves on the cursor's monitor with large readable cards; `Win+Shift+S` and `Print Screen` captures appear on the Images rope; Enter pastes into Notepad; wheel/drag/arrows scroll a rope; old history is present.
- [ ] **Step 5:** Push `windows-glass` to the fork and merge into the fork's `main`.
