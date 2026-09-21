# GREYFALL COMMAND

A wave-based military FPS for the browser, built with Three.js. Hold an urban city block
against escalating waves of AI soldiers, with sprinting, crouching, ADS gunplay,
and locally generated geometry, textures and sound.

## Run

```bash
npm ci
npm run dev      # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

Open the local URL printed by Vite, then click **DEPLOY**. A desktop browser with
WebGL, a keyboard and mouse is required; pointer lock and audio need a user gesture.
The QA scripts target Chrome on macOS. `npm run preview` defaults to port 4173.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| C | Toggle crouch |
| Space | Jump |
| Mouse | Look |
| LMB | Fire |
| RMB (hold) | Aim down sights |
| R | Reload |
| 1-4 / Wheel | Weapons (AR / SMG / Shotgun / Sniper) |
| Esc | Pause |

## Features

- **Gunplay** — 4 weapons with distinct recoil, spread bloom, ADS (sniper scope overlay),
  staged reload animations, tracers, muzzle flash, shell ejection, hitmarkers
- **AI** — soldiers that advance, take cover, peek and burst-fire, flinch, and ragdoll-fall;
  accuracy and health scale per wave
- **Movement** — source-style acceleration/friction, sprint/crouch/jump with coyote time,
  step-up, head bob, trauma-based camera shake
- **World** — procedurally textured city block (buildings, shops, roads, construction areas,
  barriers, sandbags, vehicles and power lines), explosive barrels with chain reactions,
  atmospheric dust, distant smoke columns, animated flags
- **FX** — pooled particles, decals, sparks, blood, explosions with shockwave rings
- **Audio** — 100% synthesized WebAudio: layered gunshots, distance-attenuated enemy fire,
  impacts per material, ambient wind, low-health heartbeat
- **HUD** — rotating radar minimap, compass, dynamic crosshair, kill feed, damage
  indicators, wave banners, mission stats + persistent high score

## Tech

- Three.js r169, EffectComposer (bloom, sharpening, vignette and grain), ACES tone mapping, PCF soft shadows
- Game textures are CanvasTexture-generated and audio is synthesized. The UI loads
  Black Ops One and Rajdhani from Google Fonts and falls back to system fonts.
- Vite build; `three` is the only runtime dependency

## Development and QA

The [implementation guide](docs/SPEC.md) describes the current module interfaces,
game state, scoring and persistence. There is no automated `npm test` script.

`scripts/shoot.mjs` and `scripts/ab.mjs` use `puppeteer-core` with a visible Chrome
window. They currently expect Chrome at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. They produce visual
QA captures, not a pass/fail test verdict. Create their output directories first.

```bash
npm run build
npm run preview -- --port 4319 --strictPort
```

Keep that server running and use another terminal:

```bash
mkdir -p /tmp/gf2 /tmp/greyfall
URL=http://localhost:4319/ node scripts/shoot.mjs  # /tmp/gf2/*.png
URL=http://localhost:4319/ node scripts/ab.mjs     # /tmp/greyfall/*.png
URL=http://localhost:4319/ SECS=20 node scripts/fps.mjs
```

`scripts/qa.mjs` runs broader interactive checks and writes screenshots plus
`summary.json` to `/tmp/gfqa`; it accepts `URL` and defaults to port 4322. Inspect
its reported issues: process exit alone is not a passing test result.
`scripts/qa-barrel.mjs` is a manual diagnostic fixed to port 4322. Its legacy barrel
count assumes destroyed meshes leave the array, while current code retains them
for reset, so that diagnostic's count is not a reliable pass/fail assertion.

## Static deployment

Publish the generated `dist/` directory to a static HTTP(S) host. Vite uses relative
asset paths (`base: './'`) so the build can be served beneath a repository subpath.
The build command does not upload the game. There is no service worker or offline
installation flow; refreshes also request the external UI font stylesheet.
