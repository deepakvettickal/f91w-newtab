# CLAUDE.md

Guidance for working in this repository.

## What this is

A Chrome (Manifest V3) new-tab extension that renders a Casio **F-91W** LCD watch:
a clock, stopwatch, and timer, with a themeable neon backlight. Pure static
assets — no build step, no dependencies, no backend.

## Layout

- `manifest.json` — MV3 manifest; `chrome_url_overrides.newtab` → `index.html`.
- `index.html` — the whole markup: the LCD face, the three watch buttons, and the
  in-place colour-edit UI (hidden until the WR badge is clicked).
- `styles.css` — all styling. The face scales from a single `--face` unit on
  `.lcd-inner`; everything else is in `em`, so it stays proportional at any size.
- `app.js` — all behaviour (see below).
- `fonts/` — bundled DSEG7 / DSEG14 segment fonts (woff2), preloaded in the head.
- `icons/` — extension icons.
- `assets/` — README screenshots only (not shipped logic).

## Architecture notes

- **Fixed-cell LCD.** Every display position is a fixed "cell": a static ghost
  segment (`~~` / `88`) defines the slot, and the lit value overlays it. Modes only
  change which cells are lit — the layout never reflows. The top row is a rigid
  3-column grid so changing one field (e.g. `24H`→`AM`) can't move the others.
- **Modes** live in `app.js` (`MODES = CLOCK / SW / TIMER`). `tick()` runs every
  50 ms and paints the current mode; `updateUI()` handles selection/hints on state
  change only.
- **Timer editing.** Arrow keys pick a field (days/hours/min/sec) and adjust it;
  the selected cell blinks via the `.sel` class.
- **Theming.** The WR badge toggles `.editing`. Colours are CSS custom properties
  (`--grad-top`, `--grad-bottom`, `--ink`, `--accent`, `--glow`, `--lite`) set from
  `theme` in `app.js` and persisted via `chrome.storage.local` (the `storage`
  permission), with a `localStorage` fallback for the `file://` preview. A
  synchronous cache is filled by `loadStore()` before the first render.
  - The **LIGHT** gradient + circular glow only show when `.lit` is on.
  - A **transparent** border sets `.borderless`; combined with `.lit`, a `:has()`
    rule turns the whole viewport into the gradient (the screen box dissolves).
  - Brightness (`--lite`) is a `brightness()` filter keyed so the default (0.7)
    equals the original look.

## Running / testing

There is no test suite. To view or verify a change:

- Load the folder via `chrome://extensions` → Developer mode → **Load unpacked**,
  or just open `index.html` in a browser.
- For headless screenshots (fonts load with `--virtual-time-budget`):
  ```
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --disable-gpu --window-size=1500,800 \
    --virtual-time-budget=1600 --screenshot=out.png "file://$PWD/index.html"
  ```
  Note: headless may fall back to a system font unless virtual-time lets DSEG load —
  verify font-dependent layout in a real browser too.

## Conventions

- Vanilla JS/CSS only; match the existing terse, comment-light style.
- Keep changes to one concern per commit.
