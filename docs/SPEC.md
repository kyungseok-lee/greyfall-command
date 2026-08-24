# GREYFALL COMMAND - AAA-quality browser FPS (Three.js)

Wave-based military FPS. Golden-hour desert compound. CoD-style feel: snappy movement, ADS,
recoil, regenerating health, kill feed, minimap, waves of AI soldiers, explosive barrels.

## Hard rules for every module

- ES2022 ESM. Import three as `import * as THREE from 'three'`, addons as `'three/addons/...'`.
- NO external assets (no image/audio files). All textures procedural (CanvasTexture), all audio synthesized (WebAudio).
- No comments unless truly needed. Clean production code.
- Performance budget: total draw calls target < 350. Use InstancedMesh and shared geometries/materials.
- Only import from your own files plus `src/core/contracts.js`. Never import other agents' modules.
- Do NOT modify files you do not own. Do NOT create a main entry point; `src/main.js` is owned by the integrator.
- Units: meters, seconds, radians. +Y up. Player eye height ~1.7m.
- Every class must have a `dispose()` that frees geometries/materials where practical.

## Shared config: src/core/contracts.js (already written, read-only)

Contains CONFIG (player movement/health, weapon stats, enemy stats, wave rules) and WEAPONS data.
Read it and use its values everywhere. Do not duplicate tuning numbers in your modules.

## Exact module contracts

### src/world/world.js  (owner A)
```js
export class World {
  constructor(scene)            // builds entire environment synchronously
  update(dt, elapsed)           // animate flags/cloth/dust ambience
  colliders        // THREE.Box3[] for player+enemy movement collision (walls, crates, buildings)
  raycastGroup     // THREE.Group of bullet-hittable meshes; each mesh userData.materialType in {'concrete','metal','sand','wood','barrel'}
  coverPoints      // [{pos:THREE.Vector3, dir:THREE.Vector3}] AI cover spots beside obstacles
  spawnPoints      // THREE.Vector3[] enemy spawn locations away from center
  playerSpawn      // THREE.Vector3
  minimapRects     // [{x,z,w,d,rot?}] top-down footprints for minimap drawing
  barrels          // Mesh[] explosive barrels; userData.explosive=true, userData.hp=30
}
```

### src/player/player.js  (owner B)
```js
export class Player {
  constructor({ camera, input, world })   // camera becomes the FPS view; adds view-model group to camera
  position       // Vector3 eye position (read-only usage by others)
  yaw, pitch     // radians
  health, maxHealth, alive
  weapons        // WeaponSystem instance (same owner B)
  addShake(t)    // trauma-based camera shake 0..1
  takeDamage(amount, fromPos)
  onDamaged?: (hp)=>void      // assigned by integrator
  onDeath?: ()=>void
  onFootstep?: ()=>void
  update(dt)
  reset()
}
```

### src/player/weapons.js  (owner B)
```js
export class WeaponSystem {
  constructor({ camera, input })
  setCombat(combat)   // combat = { raycast(origin,dir,maxDist)->hit|null, damageEnemy(enemyRef,dmg,isHead,point,dir), damageBarrel(barrelMesh,dmg,point), fx, audio }
  // hit = { point, normal, type:'world'|'enemy'|'barrel', enemy?, isHead?, materialType? }
  equip(id)           // 'ar' | 'smg' | 'shotgun' | 'sniper' (keys 1-4 handled here via input)
  currentId
  get ammo()          // { mag, reserve } of current weapon
  onAmmoChange?: (mag,reserve)=>void
  onReloadProgress?: (p01|null)=>void
  onWeaponSwitched?: (id,name)=>void
  setAdsChanged?(cb)  // cb(isAds:boolean) -> HUD crosshair/scope toggles; sniper shows scope overlay
  update(dt)
  reset()
}
```
Weapon feel requirements: procedural low-poly-but-crisp view models per weapon attached to camera;
ADS lerp (FOV 75->60, sniper->24 with scope overlay via onAdsChange), recoil kick + recovery spring,
per-weapon spread/bloom, tracers + muzzle flash via combat.fx, shell eject, reload animation,
sprint tilt, idle sway, walk bob. Fire rates/damage from CONFIG.WEAPONS.

### src/enemies/enemies.js  (owner C)
```js
export class EnemyManager {
  constructor({ scene })
  setRefs({ world, player, fx, audio })   // called once after construction
  spawnWave(n)         // count from CONFIG.WAVE; spawns at world.spawnPoints farthest-ish from player
  update(dt)
  hitGroup             // Group of invisible-ish hitbox meshes; userData.enemyRef, head box userData.isHead=true
  damage(enemyRef, amount, isHead, point)  // returns true if killed
  aliveCount
  remainingInWave      // spawned-alive count for HUD (integrator computes wave end when 0 and allSpawned)
  allSpawned           // bool
  clear()              // remove all enemies instantly
  onKill?: (enemyRef, isHead)=>void
  onPlayerHit?: (dmg, fromPos)=>void
  minimapEnemies(): Vector3[]
  dispose()
}
```
AI requirements: soldier mesh (helmet, vest, limbs, rifle) with procedural walk/aim/death animations,
states patrol/advance/combat/reposition using world.coverPoints, line-of-sight checks against
world.raycastGroup via Raycaster, burst fire at player with spread; on successful shot call
onPlayerHit(dmg, fromPos); misses produce fx.impact near player. Health/flinch/headshot multiplier
from CONFIG.ENEMY. Deaths: ragdoll-ish fall then sink+remove after 4s. Slight difficulty scaling per wave.

### src/fx/fx.js  (owner D)
```js
export class FXManager {
  constructor(scene, camera)
  muzzleFlash(pos, dir, scale=1)     // additive sprite + brief PointLight
  tracer(from, to)                   // glowing projectile streak
  impact(point, normal, materialType)// sparks/dust puff + pooled decal dot
  blood(point, dir)
  explosion(pos)                     // flash light, smoke column, sparks, shockwave ring; also calls this.onShake?.(0.6)
  shellCasing(pos, rightDir)
  onShake?: (t:number)=>void         // wire to player.addShake
  update(dt)
  dispose()
}
```
Pools everything. Decals capped ~64 (fade oldest out). Muzzle light budget 2 concurrent.

### src/core/audio.js  (owner D)
```js
export class AudioManager {
  init()                    // create AudioContext (call from user gesture); safe to call again
  resume(); suspend()
  shootRifle(); shootSMG(); shootShotgun(); shootSniper(); dryFire();
  reloadClick(stage)        // stage 0|1|2
  enemyShot(dist)           // distance-attenuated crack
  impact(materialType)
  hitmarker(kill)
  explosion(dist)
  footstep(sprinting); land()
  hurt(); heartbeat(on)     // low-health pulse loop toggle
  waveHorn(); uiClick(); victory sting?
  startAmbient(); stopAmbient()
  update(dt)                // nothing heavy
  dispose()
}
```
All synthesized. Gunshots: layered noise burst + body thump + tail. Keep levels sane (-6dB peaks).

### src/ui/hud.js  (owner D)
```js
export class HUD {
  constructor(root=document.getElementById('hud'))
  setHealth(hp,max); setAmmo(mag,reserve); setWeapon(name);
  setWave(w); setEnemiesLeft(n); setScore(s);
  killfeed(text, headshot); hitmarker(kill);
  damageFrom(angleToSourceRad); flashDamage(intensity01);
  crosshairSpread(px); showCrosshair(b); scopeOverlay(b);
  banner(main, sub, ms=2200);
  compass(yawRad);                 // N/E/S/W strip
  minimap(playerPos, playerYaw, enemies[], rects[]);  // draws #minimap canvas
  lowHealth(on);
  reset()
}
```
Also owns `src/ui/style.css` (imported from hud.js). Visual language: modern military HUD,
thin lines, amber/olive accents, subtle glass panels, Rajdhani/Black Ops One via Google Fonts link
already in index.html. All element IDs already exist in index.html - use them exactly:
crosshair, hitmarker, scope-overlay, health-fill, health-num, ammo-mag, ammo-reserve, weapon-name,
reload-bar, reload-wrap, minimap, compass-strip, wave-num, enemies-left, score-num, killfeed, banner,
banner-sub, damage-vignette, blood-overlay, hud, menu, pause, gameover, deploy-btn, resume-btn,
restart-btn, redeploy-btn, sensitivity-range, sens-value, final-score, final-wave, final-kills,
final-accuracy, final-time, menu-highscore.
```

## Integration notes (integrator owns src/main.js)

Game states: MENU -> PLAYING <-> PAUSED -> GAMEOVER. Pointer lock on DEPLOY/RESUME.
Wave director in main: startWave(n), when EnemyManager reports cleared -> intermission banner ->
partial heal + reserve refill -> next wave. Score: kill 100 (+50 headshot bonus), streak x1..x5.
Track shots fired/hits for accuracy stat. localStorage highscore key 'greyfall_highscore'.
```
