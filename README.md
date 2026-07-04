# F-91W New Tab ⌚

A faithful **Casio F-91W** LCD for your browser's new tab page — a live segmented clock, plus a stopwatch and a days-capable countdown timer, with **neon backlight themes**. Every new tab becomes the watch.

Pure HTML/CSS/vanilla JS. No backend, no tracking, no build step. The real **DSEG7 / DSEG14** segment fonts are bundled locally.

## Features

- **Clock** — segmented `HH:MM` + seconds, day-of-week and date, `24H` / `AM·PM`.
- **Stopwatch** — `MM:SS` with live centiseconds; rolls up into hours and days.
- **Timer** — set **days + HH:MM:SS**, edit each field with the arrow keys.
- **Neon themes** — click the **WR** badge to pick the LIGHT gradient (top/bottom) and digit colors; press **LIGHT** for the gradient fill and a circular outer glow.
- **Fixed-cell LCD** — like a real segmented display, every cell holds its position (ghost segments show the unlit matrix); nothing reflows between modes.
- Settings persist via `localStorage`. Fully responsive from a small window to fullscreen.

## Controls

The three watch buttons are context-sensitive:

| Button | Clock | Stopwatch / Timer |
|--------|-------|-------------------|
| **LIGHT/RESET** | toggle backlight | reset |
| **MODE** | — | cycle Clock → Stopwatch → Timer |
| **START-STOP/24HR** | toggle 24H / 12H | start / stop |

**Keyboard:** `←/→` pick a timer field · `↑/↓` adjust it · `Space` start-stop · `L` toggle light.

## Install (Load unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions`, enable **Developer mode** (top-right).
3. **Load unpacked** → select this folder.
4. Open a new tab. 🎉

Works in Chrome, Edge, Brave, and any Chromium browser (Manifest V3).

## Credits

The LCD watch-face design is ported and adapted (screen only, restyled, re-themed) from
[**Manz.dev**'s Casio F-91W CodePen](https://codepen.io/manz/pen/KKWmWLb). Segment fonts by
[DSEG (keshikan)](https://www.keshikan.net/fonts-e.html), SIL Open Font License.

## License

MIT
