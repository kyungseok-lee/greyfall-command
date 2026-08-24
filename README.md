# GREYFALL COMMAND

A wave-based military FPS for the browser, built with Three.js. Hold a golden-hour desert
compound against escalating waves of AI soldiers — CoD-style movement, ADS gunplay,
procedural everything (textures, audio, map).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

Click **DEPLOY** (pointer lock + audio require a user gesture). Chrome recommended.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Shift | Sprint |
| C | Crouch |
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
- **World** — procedurally textured compound (buildings, containers, barriers, sandbags,
  watchtower, burnt cars, power lines), physical explosive barrels with chain reactions,
  atmospheric dust, distant smoke columns, animated flags
- **FX** — pooled particles, decals, sparks, blood, explosions with shockwave rings
- **Audio** — 100% synthesized WebAudio: layered gunshots, distance-attenuated enemy fire,
  impacts per material, ambient wind, low-health heartbeat
- **HUD** — rotating radar minimap, compass, dynamic crosshair, kill feed, damage
  indicators, wave banners, mission stats + persistent high score

## Tech

- Three.js r169, EffectComposer (bloom + vignette), ACES tone mapping, PCF soft shadows
- Zero external assets: all textures are CanvasTexture-generated, all audio synthesized
- Vite build; `three` is the only runtime dependency

## Dev

`scripts/shoot.mjs` and `scripts/ab.mjs` drive a local Chrome (puppeteer-core) to capture
gameplay screenshots for visual QA:

```bash
npm run preview -- --port 4319 &
URL=http://localhost:4319/ node scripts/shoot.mjs   # writes /tmp/greyfall/*.png
```
