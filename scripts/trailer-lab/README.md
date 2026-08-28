# Trailer Lab — measured tests for `TrailerPlayer`

The automated browser tab is always `visibilityState: "hidden"`, so the
IntersectionObserver never fires there and playback can never be measured from
a Claude session directly. This lab is the answer: it runs the **real**
`TrailerPlayer.tsx` (bundled byte-for-byte, only `next/image`/`next/link`
shimmed) inside headless Chromium, against a **stub YouTube embed** that
implements the widget postMessage protocol (`listening` → `onReady` →
`infoDelivery`, commands, errors) with configurable latency profiles.

What it measures, per card, with millisecond timestamps:
- mount → iframe load → handshake → first frame → veil lift (startup latency)
- the order of `unMute` vs the veil lift (the sound-before-picture race)
- pause/play commands during scroll (turn-taking, hysteresis, wiggle noise)
- the 9s belt (play button on stall), error → alternative-key fallback
- background/foreground resume (command resume vs. cold rebuild)
- the seconds counter actually ticking

## Run

```bash
npm i --no-save esbuild playwright   # not saved to package.json
node scripts/trailer-lab/run.mjs
```

Chromium: uses `$LAB_CHROMIUM`, else `/opt/pw-browsers/chromium` (the Claude
container's preinstalled build), else Playwright's own download.

Profiles live in the stub inside `run.mjs` (`fast` / `slow` / `err150` /
`silent`). The report is a raw timeline — read it top to bottom; every
behavioural claim about the player should cite a line from it.

D-757 baseline vs. fix numbers live in `07_Design_Decisions.md`.
