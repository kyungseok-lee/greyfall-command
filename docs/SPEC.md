# GREYFALL COMMAND implementation guide

The current game is a desktop browser FPS in a procedural urban city block. This
reference describes the implemented modules; the initial parallel-development
assignments are no longer module ownership restrictions. See [README](../README.md)
for installation, controls and local QA commands.

## Runtime and conventions

- ES modules with an ES2022 Vite build target. Import Three.js from `three` and its
  addons from `three/addons/...`.
- `src/core/contracts.js` exports **CONFIG**. Weapon definitions are in
  `CONFIG.WEAPONS`; there is no separate `WEAPONS` export.
- World coordinates use meters, seconds and radians, with +Y up. Standing eye
  height is 1.7 m; crouched eye height is 1.15 m.
- World geometry, texture maps and sound are generated locally. `index.html`
  separately loads Black Ops One and Rajdhani from Google Fonts; the game is not
  completely independent of external resources.
- Shared geometry, instancing, reusable soldier rigs and FX pools limit allocations.
  Performance is measured with `scripts/fps.mjs`; no fixed draw-call result is
  guaranteed for every scene or device.

## Module interfaces

| Module | Construction and main interface |
| --- | --- |
| `src/core/engine.js` | `new Engine(container)` creates the scene, camera, renderer and postprocessing. `resize()`, `render()`, `setDamageIntensity(value)`, `dispose()`. |
| `src/core/input.js` | `new Input(canvas)` tracks keys, mouse, wheel and pointer lock. `isDown(code)`, `consumeMouse()`, `consumeWheel()`, `requestLock()`, `releaseLock()`, `setSensitivity(value)`; `onLockChange(locked)`. |
| `src/world/world.js` | `new World(scene)` builds buildings, streets, construction/rubble areas, cover, vehicles, barrels and atmosphere. `update(dt, elapsed)`, `dispose()`. |
| `src/player/player.js` | `new Player({ camera, input, world, scene, combat })` creates its `WeaponSystem` and connects combat. `update(dt)`, `reset()`, `takeDamage(amount, fromPos)`, `addShake(trauma)`, `dispose()`. |
| `src/player/weapons.js` | `new WeaponSystem({ camera, input })`; `setCombat(combat)`, `equip(id)`, `equipNext(direction)`, `tryReload()`, `update(dt)`, `reset()`, `dispose()`. IDs: `ar`, `smg`, `shotgun`, `sniper`. |
| `src/enemies/enemies.js` | `new EnemyManager({ scene })`; `setRefs({ world, player, fx, audio })`, `spawnWave(count)`, `damage(enemy, amount, isHead, point)`, `minimapEnemies()`, `update(dt)`, `clear()`, `dispose()`. |
| `src/fx/fx.js` | `new FXManager(scene, camera)`; `muzzleFlash(pos, dir, scale)`, `tracer(from, to)`, `impact(point, normal, materialType)`, `blood(point, dir)`, `shellCasing(pos, rightDir)`, `explosion(pos, trauma)`, `update(dt)`, `dispose()`. |
| `src/core/audio.js` | `new AudioManager()`; `init()` from a user gesture, `resume()`, `suspend()`, weapon/impact/footstep cues, `heartbeat(on)`, `startAmbient()`, `stopAmbient()`, `update(dt)`, `dispose()`. |
| `src/ui/hud.js` | `new HUD(root)` defaults to `#hud` and imports `style.css`. Health/ammo/weapon/wave/score setters, `setReload(progressOrNull)`, hit/damage feedback, scope/crosshair, compass/minimap, `update(dt)`, `reset()`. |

`World` exposes `colliders` (`THREE.Box3[]`), `raycastGroup`, `coverPoints`,
`spawnPoints`, `playerSpawn`, `minimapRects` and `barrels`. A barrel has
`userData.barrel`, `hp`, `gone` and, for upright barrels, a stored `collider`.
The barrel array retains destroyed meshes for mission reset; use `gone` or
visibility to count active barrels.

`Player.position` is the eye position. Its public state includes `yaw`, `pitch`,
`health`, `maxHealth`, `alive`, `adsT`, `isSprinting`, `damageFlash01` and
`angleToLastHit`. Callbacks are `onDamaged(hp)`, `onDeath()` and `onFootstep()`.
Crouch toggles with C; movement includes acceleration, friction, jump buffering,
coyote time, collision step-up, head bob and trauma-based camera shake.

`WeaponSystem` exposes `currentId`, `ammo`, `state`, `root`, `adsT`, `isAds`,
`getCrosshairPx()` and `setAdsChanged(callback)`. HUD callbacks are
`onAmmoChange(mag, reserve)`, `onReloadProgress(progressOrNull)` and
`onWeaponSwitched(id, name)`. Hip FOV is 75; ADS FOV comes from
`CONFIG.WEAPONS` (AR 58, SMG 60, shotgun 62, sniper 22). The integrator shows the
sniper scope when `player.adsT > 0.85`.

`EnemyManager.hitGroup` contains hitboxes with `userData.enemyRef` and
`userData.isHead`. `remainingInWave` includes queued and living soldiers;
`allSpawned` becomes true when the queue is empty. `spawnWave(count)` receives the
enemy count, not the displayed wave number; that same value currently drives the
manager's difficulty state. `damage()` returns whether the hit killed the soldier
and invokes `onKill(enemy, isHead)`. Successful enemy fire invokes
`onPlayerHit(damage, fromPos)`, connected to the player's damage handler in `main.js`.

## Integration and game state

`src/main.js` constructs and connects the modules. The states are `MENU`,
`PLAYING`, `DYING`, `PAUSED` and `GAMEOVER`. Death enters a 1.7-second sequence;
its simulation runs at 0.45 speed before the game-over overlay. Deploy/redeploy
reset the mission and request pointer lock. Losing pointer lock during play
pauses simulation and audio; Resume requests the lock again.

The combat adapter passed to weapons exposes `raycast`, `damageEnemy`,
`damageBarrel`, `onShot`, `fx` and `audio`. Raycasts return `null` or a world,
enemy or barrel hit. Enemy hits include the enemy and headshot flag; barrel hits
include `barrelMesh`; world hits include the material type.

The displayed wave starts at 1 and supplies `4 + 2 * (wave - 1)` soldiers, with
at most 9 alive at once. Clearing a wave restores up to 40 health and half each
weapon's maximum reserve, capped at that maximum. A 6-second intermission precedes
the next wave. The player also regenerates health after the configured delay.

Direct weapon kills award 100 points plus 50 for a headshot. Consecutive kills
less than 4 seconds apart add 25 points per streak step, capped at 125 bonus
points; this is an additive bonus, not a score multiplier. Barrel damage reaches
enemies through `EnemyManager.damage()` and does not pass through the direct-hit
score callback. The accuracy statistic counts successful damage calls relative
to fired rounds and is clamped to 0–100% in the final display.

Barrels start with 30 HP. Explosions damage nearby soldiers and the player;
intervening world geometry halves player blast damage. Nearby barrels chain
with a delay. Restart restores barrel visibility, HP, hit meshes and stored
colliders. The HUD provides mission score, wave, kills, accuracy and time.

Browser storage keys are `greyfall_highscore` and `greyfall_sens`. Progress within
a mission is not saved. `window.__GREYFALL` exposes engine/world/player/enemies/input
for local inspection and the repository's QA scripts.
