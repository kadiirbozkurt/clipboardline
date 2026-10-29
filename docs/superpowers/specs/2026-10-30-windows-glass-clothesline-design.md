# ClipBoardLine Windows: glass clothesline redesign

Date: 2026-10-30. Scope: the Windows Electron app in `windows/` only, in the user's own fork.

## Intent

The owner uses ClipBoardLine on Windows across three monitors (4K at 150% scaling,
2560x1440, 1920x1080). The shelves feel small and hard to read on a busy wallpaper,
the motion feels stiff, and several shortcuts follow macOS habits instead of Windows
ones. The owner likes the clothesline idea and wants it kept, with an iPhone-style
glass look, smoother animation, larger cards and Windows-native shortcuts.

Success: on every monitor the shelves open under the cursor with cards that read at
a glance, clips are reachable with Windows-familiar keys, and the app starts reliably.

## Goals

1. **Clothesline layout kept** (approved mockup "A, v3"): three ropes for Images,
   Texts and Links. No frosted strip behind the rope. Each clip is its own frosted
   glass card hanging from the rope by a clothespin, showing preview, name and its
   1–9 number.
2. **Glass styling**: cards, row labels and the per-row tool buttons use translucent
   blur with a light top highlight and soft shadow, so they stay legible over any
   wallpaper. Ropes get a faint shadow for the same reason.
3. **Size**: cards about twice today's size by default. Size follows the monitor:
   compute the card width from the display work area so a card covers a similar
   share of the screen on 4K@150%, 2K and 1080p. The existing small/medium/large
   setting stays and scales on top of that.
4. **Animation**
   - Open: cards drop in from above with a slight spring, staggered left to right.
   - Idle: a very gentle sway. A setting turns it off.
   - Hover/focus: sway stops, card lifts and scales slightly.
   - Close: quick fade/rise. Keyboard focus moves without delay.
   - `prefers-reduced-motion` and the sway setting disable non-essential motion.
5. **Shortcuts (Windows)**
   - Default show/hide shelves: `Ctrl+Alt+V` (was `Ctrl+Alt+T`). Still rebindable.
   - `Win+V` stays with Windows (owner's choice: no OS setting changes, no keyboard hook).
   - `Enter` pastes the selection into the previous app (like Win+V). `Ctrl+C`
     copies and keeps browsing. Existing `Ctrl+Enter` keeps working as paste.
   - `F2` renames (name and pin, today `Alt+P`). `Ctrl+D` toggles pin. `Delete`
     keeps deleting. Right-click on a card opens the Actions menu for that card.
   - `F1` or `?` shows a glass cheat-sheet of the keys valid in the current view.
   - Image capture on by default (owner's choice): images from `Win+Shift+S` and the
     `Print Screen` key land on the Images rope. `captureImages` defaults to true and
     the owner's existing settings file is switched on during the same migration as
     the hotkey. Verify both capture paths end up on the clipboard watcher.
6. **Fixes from user feedback** (evidence: GitHub issues on Tendedero and
   ClipBoardLine, HN comments; small sample, directional)
   - Startup crash "could not be secured … Set-Acl" (ClipBoardLine issue #29):
     `native/protect-directory.ps1` must read and write only the DACL section.
   - Multi-monitor robustness (issue #22): reposition on `display-added`,
     `display-removed` and `display-metrics-changed`; never leave the window
     off-screen.
   - Paste as plain text: dropped. Stored clips already paste as `text/plain` only,
     so a separate key would duplicate `Ctrl+Enter`.

## Decisions settled after the builder check

- **Updates (owner's words: "we update it ourselves when we want")**: the fork turns
  off the upstream auto-update check by default and never installs upstream builds
  silently. A manual "check for updates" may stay but must point at nothing or the
  fork; upstream's feed identity is not reused for the fork's own releases.
- **Existing hotkey**: on first run of the new build, migrate the saved `toggle`
  value from `Control+Alt+T` to `Control+Alt+V` only when it still equals the old
  default. A value the owner changed is kept. Same settings file and format.
- **Enter**: pastes into the previous app in shelves, Library and previews. If
  pasting is refused (no editable target, secure or elevated window), Enter falls
  back to copy and shows a short toast saying it was copied instead.
- **Card count**: bigger cards mean fewer per page. Keep the existing paging; the
  1–9 numbers keep following the visible cards on the current page.
- **Scrolling along a rope (owner's request at approval)**: the cards of a rope can be
  scrolled smoothly with the arrow keys (moving focus past the last visible card
  slides the rope instead of jumping a page), with the mouse wheel over a rope
  (vertical wheel scrolls that rope sideways; Shift+wheel and touchpad horizontal
  swipe also work), and by click-dragging empty rope space. Scrolling uses an eased
  slide; the 1–9 numbers update to the cards now in view. Paging keys stay as they are.
  Interpretation note: "kaydırmak" read as scrolling, not reordering cards.
- **F2 / Ctrl+D**: added alongside today's `Alt+P` / `P`, not replacing them.

## Non-goals

- macOS app, Swift sources, Mac release feeds: untouched.
- No feature removal, no storage format change, no change to the update feed identity.
- Nashi is out of scope for this document.

## Anti-goals

- Motion that slows down keyboard use or makes cards hard to click.
- Glass so transparent that text becomes unreadable on bright wallpapers.
- Shortcut changes that silently break typing inside text fields.

## Constraints

- Electron 44, plain `renderer.js` + `styles.css`, no new UI framework.
- Keep the existing Windows test suites (`npm test`, `npm run test:electron`) passing;
  update tests whose expected defaults change (hotkey, Enter behavior).
- Builds are unsigned community builds; installer via `npm run dist`.

## Delivery

- Fork `orkunisitmak/clipboardline` to the owner's GitHub (via Chrome) and push work there.
- Build the NSIS installer, uninstall the current ClipBoardLine
  (`%LOCALAPPDATA%\Programs\clipboardline-desktop`), install the new build, keep the
  user's clipboard history in `%APPDATA%\ClipBoardLine`, put a shortcut on the Desktop.

## Builder's calls

- Exact blur radius, colors, spring curves and card width formula.
- Where the sway toggle sits in Settings.
- How right-click maps onto the existing Actions bar.
