# River Run: handoff notes

Read this first in a new session. It describes what exists, where it lives, how to test it,
how to deploy it, and what the owner has asked for so far.

## What it is

A browser boat game in raw WebGL 2 (no libraries). One file: `web/index.html`.
Top down camera tilted 30 degrees, a randomly generated lake with an island, still water with
fine wind ripples, a 10 minute day and night sky, BinbunGrass on the land, five boats with
water jet thrusters, and 46 floating beach balls in four sizes. Open map: no goals, no damage.

- Live: https://river-run-game.vercel.app (also https://river-run-five.vercel.app)
- Repository: `asarjunsethi-dot/Passion`, branch `claude/funny-faraday-avadul` (all work is here; `main` is not used for the game)
- `RESEARCH_AND_PLAN.md` is an older, unrelated plan (an AI creature site); ignore it for the game.

## Owner preferences (follow these)

- Wants an advisor, not an assistant: lead with the answer, rate confidence, separate evidence from inference,
  push back with reasons when they are wrong. No hyphens, no abbreviations in replies.
- Prefers minimal user interface. Prefers the game deployed after each change, with a link.
- Decisions so far (in order): river became a lake with an island; KayKit trees, bushes and rocks were added, then fully
  removed (only BinbunGrass remains); gates, laps and hull damage removed (open map); waves removed, then the owner gave
  free rein on water and fine ripples, caustics and shore ripples came back; thrusters must only fire from the stern;
  thrusters must look realistic (water jet spray, not lasers); boats cannot reverse (S only brakes); minimal popups;
  no graphics or pixel controls; controls live behind a small "?" button; splashes include droplets.

## Map of `web/index.html` (search for these markers)

| Section | Marker or function | Notes |
|---|---|---|
| Lake shape | `Lake definition`, `LAKE`, `bankDist`, `WORLD_GLSL` | Random per visit, `?seed=N` repeats. Harmonic outer shore and island. JavaScript and GLSL share the numbers. `bankDist` is positive on water. |
| World population | `generateGates`, `generateProps` | Gates are disabled (`NG = 0`). `generateProps` is unused now (KayKit removed); `spawn` is the start point. |
| Shared GLSL | `NOISE_GLSL`, `LIGHT_GLSL`, `CLOUD_GLSL`, `SKY_GLSL` | `SKY_GLSL` is a port of the supplied Godot sky shader. |
| Wave simulation | `simFS`, `simStep`, `gatherSources`, `RIPPLES` | GPU height field that follows the boat; draws the wake. |
| Generated textures | `genFS`, `makeWaterTexture` | Wave, foam, caustics, ground noise, wind, clouds, stars. |
| Water and ground | `waterFS`, block starting `/* ================= lake water` | Ripples (six wave trains), Beer Lambert absorption, refraction, caustics, sky reflection, sun glints, shore foam, haze. Depth model in `waterDepth`. |
| Grass | `grassVS`, `grassFS`, `GRASS_CELL`, `GRASS_ATLAS_PNG` | Port of BinbunGrass; atlas embedded as a 128 pixel PNG. |
| Sprites | `SPR_VS`, `SPR_FS`, `pushQuad` | Foam puffs (type 6), spray, and clear water droplets (type 13). Types 7 to 12 are the old glowing beam effect, now unused. |
| Meshes | `MESH_VS`, `MESH_FS`, `drawMeshes` | Boats and beach balls. `uProp` 0 means boat or ball (pitch and roll via `uRP`). Palette row 7 glows. |
| Boats | `BOATS`, `selectBoat`, `buildBoat(spec)` | Five specs: Runabout, Speedster, Hydro (catamaran), Jet Ski, Cruiser. Each has mesh parameters and physics (`thrust`, `boost`, `lin`, `quad`, `grip`, `turn`, `hull`, `hullR`, `podX`). |
| Beach balls | `spawnFloaters`, `updateFloaters`, `buildBall`, `drawBalls` | Sizes 0.42, 0.75, 1.2, 1.8 m radius; mass grows with size. |
| Sky cycle | `CYCLE` (600 s), `updateSky`, `SKY` | About 5 minutes of day then 5 of night. Colors from the Godot sky defaults. |
| Shadows | `ensureShadowTarget`, `COMPOSITE_FS` | Meshes are flattened along the light into a shadow buffer, then multiplied over the scene. |
| Physics | `stepBoat`, `contact`, `jump`, `thrusterState` | Thrust only forward; S brakes; Q/E strafe; Space jump; spin in place at low throttle. All jets leave the stern pods. |
| Spray | `throwSpray`, `updateSparks` (array `sparks`) | Ballistic mist plus about 40% clear droplets (`drop` flag). Fired by thrusters, jump landings, ball hits and shore scrapes. Drawn after meshes in pass 8 of `drawScene`. |
| Render order | `drawScene` | 1 shadow buffer, 2 water and ground, 3 grass, 4 sprites, 5 shadow multiply, 6 glow pass (unused now), 7 meshes, 8 spray. |
| Interface | `#speedo`, `#clockbox`, `#helpbtn`, `#helppanel`, `#start` | Speed and boost line, clock, a small "?" button that shows the controls list (H also toggles). No graphics controls: the owner removed the pixels slider and water style toggle. Render scale is automatic in `resize` (capped at 2.3 million pixels). |
| Leaderboard | `SB_URL`, `loadBoard`, `submitScore` | Supabase code still present but unreachable since there is no game over. |

Controls: W thrust, S brake, A/D steer, Q/E strafe, Shift boost, Space jump, 1 to 5 boat, H help, R reset.

## Testing

Debug handle: `window.__river` exposes `boat`, `cam`, `input`, `state`, `ready`, `floaters`,
`setManual(true)`, `tick(dt)` (update and draw), `step(dt)` (physics only, fast), `setClock(seconds)`,
`startGame()`, `resetGame()`, `bankDist(x, y)`.

```bash
cd web && python3 -m http.server 8765 --bind 127.0.0.1
```

```bash
NODE_PATH=$(npm root -g) node tools/tests/shore.js name 150 boat 0 13
```

Scripts in `tools/tests/`: `shore.js` (screenshot: name, clock seconds, camera x or `boat`, y, half height),
`modes.js` (strafe, spin, brake, jump), `boats.js` and `five.js` (boat speeds and close ups), `balls.js` (ramming),
`lakebot.js` (old lap bot, gates are gone). Headless Chromium uses SwiftShader, so it is slow: prefer `step()`
for physics and take few screenshots. A screenshot right after thousands of `step()` calls can time out.

## Deploying

The Vercel project is connected to GitHub. After pushing the branch, deploy to production with the Vercel tool
`create_deployment`: team `team_lbiXOtqjHT5IDaKipDJH6sHF`, project `river-run`, target `production`,
gitSource `{type: github, org: asarjunsethi-dot, repo: Passion, ref: claude/funny-faraday-avadul, sha: <commit>}`,
with `skipAutoDetectionConfirmation: 1`. Root directory is `web`, no build step. Vercel login protection is off.
Pushing alone only makes preview builds because production follows the default branch.

## Supabase

Project `river-run` (id `yghxquvblqkqyzqjfvbx`, region ap-south-1) holds table `public.scores` with row level
security (anyone can read; inserts must satisfy `score <= distance + gates*50 + 50`). Currently unused by the game.
Another older project `ember` exists and was never touched.

## Asset packs supplied by the owner

- Godot water shader (`water.gdshader`, `water_toon.gdshader`): ported, then heavily reworked.
- BinbunGrass (grass shader and clump atlas): ported; the atlas is embedded.
- Godot sky shader (`SourceCode.zip`): ported into `SKY_GLSL`.
- BinbunVFX beam pack: ported as thruster beams, later replaced by water spray (code remains, unused).
- KayKit Forest Nature Pack (CC0): used, then removed at the owner's request. `tools/build_nature.py` can repack it.

## Known gaps and ideas

- Frame rate on real graphics cards has never been measured. The owner removed the pixels slider, so if weak laptops
  struggle, lower the pixel cap in `resize` rather than adding a control back.
- Unused code worth deleting when convenient: beam sprite types 7 to 12, gates, arrow, KayKit loader, leaderboard.
- Camera is fixed north up; the tilted view, grass and shadows depend on that.
