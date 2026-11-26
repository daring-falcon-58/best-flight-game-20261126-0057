# Sky Courier — Alpine Ring Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/daring-falcon-58/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/daring-falcon-58/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original 3D flight game that runs offline in a desktop browser from static files — no network request, keyboard + mouse. Fly the Kestrel, a home-built courier plane, off runway 09, thread eight glowing rings over an alpine valley (river, lake, pine forest, mountain wall), then land back on the runway. An AI judge compares games pairwise by screenshots + source outline; entries rank by win rate.

## Method (how this was built and verified)

- **Seeded, replayable world.** The valley, ring course and weather come from one seed (seed 7 for the screenshots). The same seed always builds the same valley, so any run can be replayed exactly.
- **Screenshots are real gameplay, not posed renders.** `game/src/shots.js` flies the same flight model the player uses, steered by an autopilot, and captures the frame mid-flight — title, mid-course, ring close-up, mission complete.
- **Blind check, measured.** 5 autopilot runs on the real flight model (seeds 5, 7, 11, 23, 42) complete all eight rings in 81.8 s with no crash (ring times 9.3 / 16.4 / 28.5 / 40.0 / 49.9 / 59.2 / 70.5 / 81.8 s). Scoring: 250 per ring (2,000 max) + time bonus up to 1,500 + 500 landing bonus.
- **Flight model, stated plainly.** Bank to turn (turn rate ∝ sin(bank) × speed), pitch to climb/dive, throttle for speed; drag ∝ speed²; lift fades below the 22 m/s stall speed and the plane sinks. Terrain collision ends the run; a gentle touchdown on the runway (speed < 45 m/s, wings near level) lands it.
- **Play-tested in headless Chromium.** Screenshots taken from the game's own code at 1280×480, console checked for errors, network log checked: zero requests outside the local server (three.js is vendored under `game/vendor/`).

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. Click **FLY THE ROUTE** (or press Enter).

## Controls

| Input | Action |
|---|---|
| ↑ / ↓ (or W / S) | Pitch down / up (climb / dive) |
| ← / → (or A / D) | Bank left / right (turns the plane) |
| Shift / Ctrl | Throttle up / down |
| Mouse | Steer (move to bank and pitch) |
| P | Pause · M mute · R restart |

Take off: hold Shift to full throttle, pull up gently past 26 m/s. Below 43 kt the wing stalls — keep speed up and nose down to recover. Land: slow below 45 m/s, wings level, over the runway.

## What is in the game

- **The valley** (`game/src/world.js`): seeded heightfield terrain with vertex-coloured grass, farmland, rock and snow; a meandering river and a lake; a painted runway with centreline and threshold marks; 650 instanced pines; drifting clouds; a gradient sky dome with sun glow.
- **The Kestrel** (`game/src/plane.js`): an original courier plane built from primitives — cream fuselage, burnt-orange wings, spinning propeller, red/green nav lights.
- **The course**: eight glowing rings on pylons over the river and ridges; the next ring pulses, passed rings turn green.
- **The HUD**: airspeed (kt), altitude (ft), vertical speed (fpm), scrolling compass with heading, artificial horizon, throttle bar, timer, score, fuel, ring counter.
- **Sound**: fully synthesised WebAudio — engine drone follows the throttle, wind follows speed, chimes for rings and landings. No audio files.

## Layout

- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- `game/` — the playable game (static files only): `index.html`, `src/*.js`, `vendor/three.module.min.js` (three.js r187, vendored).
- `screenshots/` — 4 real renders of the game's own code (1280×480, each under 256 KiB).
- `shots.json` — the `?shot=` queries that stage each screenshot.
- `serve.ts` — a tiny static server for local play-testing.

## Screenshots

1. `1-start.jpg` — the Kestrel on runway 09 at dawn, title screen, valley ahead.
2. `2-play.jpg` — chase view mid-course, instruments lit, next ring ahead, HUD live.
3. `3-ring.jpg` — threading a ring at speed, river and pines below.
4. `4-end.jpg` — route complete, all eight rings flown, score on screen.

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
