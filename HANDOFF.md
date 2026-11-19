# River Run: handoff notes

Read this first in a new session. It describes what exists, where it lives, how to test it,
how to deploy it, and what the owner has asked for so far.

## What it is

A browser boat game in raw WebGL 2 (no libraries). One file: `web/index.html`.
Top down camera tilted 30 degrees, a lake with an island, still water with fine wind ripples,
a 10 minute day and night sky, BinbunGrass on the land, five boats with water jet thrusters,
and 46 floating beach balls in four sizes. Open map: no goals, no damage.
Multiplayer: everyone online shares the lake of the day and sees each other's boats.

- Live: https://river-run-game.vercel.app (also https://river-run-five.vercel.app)
- Repository: `asarjunsethi-dot/Passion`. The game lives on branch `claude/friendly-pascal-5j9yp3`
  (it contains all of `claude/funny-faraday-avadul` plus the multiplayer work). `main` does not have the game:
  a session that starts on `main` will not find it. Merging the game into `main` is recommended.
- `RESEARCH_AND_PLAN.md` is an older, unrelated plan (an AI creature site); ignore it for the game.

## Owner preferences (follow these)

- Wants an advisor, not an assistant: lead with the answer, rate confidence, separate evidence from inference,
  push back with reasons when they are wrong. No hyphens, no abbreviations in replies.
- Prefers minimal user interface. Prefers the game deployed after each change, with a link.
- Decisions so far (in order): river became a lake with an island; KayKit trees, bushes and rocks were added, then fully
  removed (only BinbunGrass remains); gates, laps and hull damage removed (open map); waves removed, then the owner gave
  free rein on water and fine ripples, caustics and shore ripples came back; thrusters must only fire from the stern;
  thrusters must look realistic (water jet spray, not lasers); boats cannot reverse (S only brakes); minimal popups;
  no graphics or pixel controls; controls live behind a small "?" button; splashes include droplets;
  multiplayer added so the owner can see other people playing; players can enter a name; inactive players
  drop off the list after 5 minutes; realistic rain that comes and goes at random strengths and builds slowly.

## Map of `web/index.html` (search for these markers)

| Section | Marker or function | Notes |
|---|---|---|
| Lake shape | `Lake definition`, `SEED`, `LAKE`, `bankDist`, `lakeTable`, `lakeD`, `WORLD_GLSL` | Lake of the day: the seed comes from the UTC date, so everyone online gets the same lake; it changes at midnight UTC. `?seed=N` opens lake N (also a private multiplayer room). `bankDist` (exact, positive on water) is sampled once at load into a 1024 x 1024 table over a 448 m square. Shaders read it as the texture `uLake` on unit 15 (`LAKE_UNIT`, set in `makeProgram`); JavaScript uses `lakeD` for bulk lookups and keeps `bankDist` for boat collisions. `spawn` is the start point. |
| Shared GLSL | `NOISE_GLSL`, `LIGHT_GLSL`, `CLOUD_GLSL`, `SKY_GLSL` | `SKY_GLSL` is a port of the supplied Godot sky shader. |
| Wave simulation | `simFS`, `simStep`, `gatherSources`, `simC` | GPU height field centred on the boat the camera follows; every boat near it adds a wake. Sources skip texels too far away to matter. At most two catch up steps per frame. The water shader fades the field out before its wrapping edge (`uSimC`). |
| Generated textures | `genFS`, `makeWaterTexture` | Foam, caustics, ground noise, wind, clouds, stars. |
| Water and ground | `waterFS`, block starting `/* ================= lake water` | Ripples (six wave trains), light absorption, refraction, caustics, sky reflection, sun glints, shore foam, haze. Depth from the shore distance (`depthAt`). |
| Grass | `grassVS`, `grassFS`, `GRASS_CELL`, `GRASS_ATLAS_PNG` | Port of BinbunGrass. Clumps over water exit the vertex shader early. Wet grass is darker. |
| Sprites | `SPR_VS`, `SPR_FS`, `pushSprite` | Foam and spray puffs (type 6) and clear droplets (type 13). |
| Meshes | `MESH_VS`, `MESH_FS`, `drawMeshes`, `INST` | Boats and beach balls. Each instance holds x, y, z, heading, scale, tint, roll, pitch, so all balls are one draw call and each boat type is one. Palette row 7 glows. |
| Boats | `BOATS`, `selectBoat`, `buildBoat(spec)`, `boatMeshFor` | Five specs: Runabout, Speedster, Hydro (catamaran), Jet Ski, Cruiser, with mesh parameters and physics. |
| Beach balls | `spawnFloaters`, `updateFloaters`, `buildBall` | Every hull pushes them (other sailors' too). Each player keeps their own copy, so balls can differ between screens. |
| Sky cycle | `CYCLE` (600 s), `updateSky`, `SKY` | About 5 minutes of day then 5 of night. Each player has their own clock. Overcast dims direct light, greys the ambient light and fades shadows. |
| Weather | `wxRegime`, `wxShower`, `wxAt`, `weather`, `updateWeather` | Two time scales. A regime drifts over hours (noise with 90 and 30 minute periods) between settled and unsettled weather. Unsettled spells thicken the clouds over tens of minutes and spawn showers (at most one starting per 8 minute window): each builds from a drizzle over 1 to 4 minutes to a random peak, swells and eases in bands, holds 0.5 to 5 minutes, clears over 1 to 3.5. The wettest spells add a steady frontal rain for an hour or more, and only they bring downpours. Sampled over a week: raining 25% of the time, about 35 rain spells a day, usually 7 to 17 minutes, sometimes up to almost 2 hours; peaks median 0.43, top 10% above 0.77, highest 0.96. All from the real clock and the lake seed, so all players share it with no network messages. `weather.gust` sways the rain every few seconds; `weather.wet` soaks up in a few minutes and dries over about five. |
| Rain | `RAIN_VS`, `RAIN_FS`, `drawRain`, `RAIN_CELL`, `RAIN_PER_CELL`, `rainRings` in `waterFS` | Entirely on the graphics card: the lake is cut into fixed 10 m cells and only cells around the view are drawn, up to 65 drops each. A drop's cell, number and the clock give its landing spot, size (big drops fall faster and splash larger) and cycle: a speed blurred, wind slanted streak, then a splash crown. On the lake each drop also leaves a ring with a smaller trailing ring (water shader, two cell grids) plus a fine stipple from tiny drops. Rain adds haze, roughens ripples, greys the sky reflection, hides glints and stars and the drifting cloud shadows, darkens wet ground and grass, bends the grass and pushes the beach balls. Umbrella next to the clock. |
| Shadows | `drawMeshes(true, ...)`, stencil in `drawScene` step 5 | Meshes flattened along the light and multiplied straight over the scene; the stencil buffer lets each pixel darken once. No separate shadow buffer or full screen pass. |
| Physics | `stepBoat`, `contact`, `jump`, `thrusterState(b, side)` | Thrust only forward; S brakes; Q/E strafe; Space jump; spin at low throttle. Boats bump each other (each client moves only its own boat, half impulse each). |
| Effects | `boatEffects(b, dt)`, `throwSpray`, `updateSparks` | Wake foam, jet spray and landing splashes for any boat, yours or a remote one near the camera. |
| Multiplayer | `NET_URL`, `netConnect`, `netMessage`, `remoteState`, `updateRemotes`, `netSend` | Supabase Realtime channel `river-run-<seed>`, raw Phoenix protocol over a WebSocket. Presence lists who is online; broadcasts carry boat state. See below. |
| Watching | `followed`, `setWatching`, `cycleWatch`, `updateTags` | F (or clicking the "other sailors" line under the clock) cycles the camera through other sailors and back. Any movement key returns to your boat. Name tags sit over boats, or at the screen edge pointing to them. |
| Render order | `drawScene` | 1 water and ground, 2 grass, 3 foam, 4 shadows (stencil), 5 meshes, 6 spray, 7 rain, then tags. |
| Interface | `#speedo`, `#clockbox`, `#netbox`, `#tags`, `#helpbtn`, `#helppanel`, `#start`, `#nick` | Speed of the followed boat and your boost, clock, sailor count, "?" controls list (H toggles). `#nick` is the name field on the start screen (`setName`), saved on the device; empty keeps a random "Sailor NN". |
| Away | `AWAY_MS`, `markActive`, `away` | After 5 minutes without a key, click, touch or mouse movement you leave the other sailors' list (presence untrack) and stop sending, but still see them. Any input rejoins at once. A hidden tab counts as inactive. |
| Render scale | `adaptScale`, `resize`, `pixelCap` | Automatic: starts at 2.3 million pixels, drops a fifth after 2 slow seconds (down to 0.6 million), climbs back after 8 smooth seconds but never above a budget that was slow. |

Controls: W thrust, S brake, A/D steer, Q/E strafe, Shift boost, Space jump, 1 to 5 boat, F watch others, H help, R reset.
URL options: `?rain=0.7` (force a rain level from 0 to 1; `?rain=0` forces dry, useful for repeatable tests), `?seed=N` (lake N, private room), `?name=Ana` (name shown to others, remembered), `?offline` (no network).

## Multiplayer details

- Transport: `wss://yghxquvblqkqyzqjfvbx.supabase.co/realtime/v1/websocket` with the public publishable key,
  `vsn=1.0.0`, heartbeat every 25 seconds, reconnect with backoff (1, 2, 4 ... 30 seconds).
- Message: `{i: id, n: name, d: [x, y, heading, z, vz, vx, vy, yaw rate, roll, pitch, throttle, steer, strafe, boat, flags]}`,
  flags 1 boosting, 2 sailing, 4 jumping. Every field is validated and clamped on receipt; names are stripped to 16 characters.
- A rename arrives from the service as a join plus a leave for the same player in one message; leaves that the same message rejoins are ignored.
- Rate: nothing while alone or away. With company, up to 10 per second, lowered to keep a crowd near 60 deliveries a second,
  and 1 per second while moored or idle.
- Cost: Supabase counts each broadcast once sent plus once per receiver. Free plan quota is 2 million a month, so two
  players sailing nonstop use about 40 a second, roughly 14 hours of shared play a month. Watch the usage page.
- Trust: the channel is public. Anyone with the key can send fake boats; validation limits damage to fake positions.

## Testing

Debug handle: `window.__river` exposes `boat`, `cam`, `input`, `state`, `ready`, `floaters`, `seed`, `pixelCap`,
`id`, `weather` (rain, cloud, wet, regime, drops drawn), `setRain(v)` (null returns to the schedule), `wxAt(seconds)`, `away`, `setIdle(ms)`, `setName(name)`, `net` (status, online names, shown remotes), `watching`, `watch()`, `setManual(true)`, `tick(dt)`
(update and draw), `step(dt)` (physics only, fast), `setClock(seconds)`, `startGame()`, `resetGame()`, `bankDist(x, y)`.

```bash
cd web && python3 -m http.server 8765 --bind 127.0.0.1
```

```bash
NODE_PATH=$(npm root -g) node tools/tests/shore.js name 150 boat 0 13
```

Scripts in `tools/tests/`: `shore.js` (screenshot: name, clock seconds, camera x or `boat`, y, half height),
`modes.js` (strafe, spin, brake, jump), `boats.js` and `five.js` (boat speeds and close ups), `balls.js` (ramming),
`names.js` (name entry and the away rule, live), `multiplayer.js` (two browsers on one lake through the live Supabase service; needs the session network to allow
`yghxquvblqkqyzqjfvbx.supabase.co`, which the cloud environment "Passion (River Run)" does).
Headless Chromium uses SwiftShader, so it is slow: prefer `step()` for physics and take few screenshots.

## Deploying

The Vercel project is connected to GitHub. After pushing the branch, deploy to production with the Vercel tool
`create_deployment`: team `team_lbiXOtqjHT5IDaKipDJH6sHF`, project `river-run`, target `production`,
gitSource `{type: github, org: asarjunsethi-dot, repo: Passion, ref: claude/friendly-pascal-5j9yp3, sha: <commit>}`,
with `skipAutoDetectionConfirmation: 1`. Root directory is `web`, no build step. Vercel login protection is off.
Pushing alone only makes preview builds because production follows the default branch.

## Supabase

Project `river-run` (id `yghxquvblqkqyzqjfvbx`, region ap-south-1). Realtime carries the multiplayer channel.
Table `public.scores` is left over from the removed leaderboard and is no longer used by the game (anyone can read
it and insert into it); dropping it is reasonable. Another older project `ember` exists and was never touched.

## Asset packs supplied by the owner

- Godot water shader: ported, then heavily reworked.
- BinbunGrass (grass shader and clump atlas): ported; the atlas is embedded.
- Godot sky shader (`SourceCode.zip`): ported into `SKY_GLSL`.
- BinbunVFX beam pack: ported as thruster beams, later replaced by water spray; the code was deleted.
- KayKit Forest Nature Pack (CC0): used, then removed. Its loader and `tools/build_nature.py` were deleted;
  both are in git history if ever wanted.

## Known gaps and ideas

- Frame rate on real graphics cards has still not been measured; the automatic render scale is the fallback.
  A 30 hertz display reads as slow and will settle at a lower resolution.
- Balls, sky clock and spray are local to each player; only boats are shared. Weather is shared through the clock.
- Tests that move the beach balls depend on the current weather (the breeze freshens in rain); pass `?rain=0` for repeatable numbers.
- Camera is fixed north up; the tilted view, grass and shadows depend on that.
