# Research and build plan: a site in the style of 3eyes.iii

## What 3eyes.iii actually is

Not a photo account. It is a 3D web artist who posts short videos of interactive websites they build.

| Finding | Evidence level |
|---|---|
| About 32K followers, 52 posts; bio says they make websites, not art | Search result preview of the Instagram page (could be out of date) |
| Stack: Three.js, React Three Fiber (R3F), React, Blender for modelling | Their TikTok captions and hashtags |
| Signature effects: interactive grass (compute shaders), instanced 3D trees, a Blender style triangle effect that is pushed away by the mouse, MeshTransmissionMaterial glass sphere, Custom Shader Material | Their TikTok captions |
| Moving toward WebGPU and TSL (Three Shading Language) | Hashtags and one caption only (weak) |
| Built an interactive 3D world site for an art exhibition | TikTok caption |
| Monetizes through Patreon (tutorials / workflow) | Patreon page title in search |
| Side project: DegenBox, a Solana lootbox platform using Switchboard VRF, plus a pump.fun token "3EYES" | Their Medium article preview and a Coinbase listing |

I could not open the Instagram, TikTok, Medium, Patreon, Linktree or X pages directly (network blocked in this environment). Everything above comes from search engine previews.

## What "similar" should mean

The value of that account is the 3D interactive websites. Supabase is not what makes their work look good; it is only useful for the data layer around the 3D scene.

Recommended build: an interactive 3D landing world plus a small Supabase backed social layer.

- 3D layer: Vite + React + `@react-three/fiber` + `@react-three/drei`
  - Instanced grass field that bends away from the cursor (custom vertex shader)
  - Instanced trees or rocks (Blender exported glTF, compressed with Draco or Meshopt)
  - Glass sphere with `MeshTransmissionMaterial`
  - Later: WebGPU renderer with TSL once the WebGL version works
- Data layer (Supabase):
  - `guestbook` table: visitors leave a message that appears as a floating object in the world
  - `reactions` table: likes per scene or per object, updated live with Supabase Realtime
  - Storage bucket for `.glb` models and textures (keeps the GitHub repo small)
  - Row Level Security on every table; anonymous insert allowed only with length limits and rate limiting
- GitHub:
  - Source control
  - GitHub Actions builds the site and deploys to GitHub Pages (free) or Vercel (better preview links)
  - Supabase migrations stored in `supabase/migrations` so the schema is versioned

## Build order

1. Scaffold Vite + R3F, one scene, deploy to GitHub Pages through Actions (proves the pipeline)
2. Grass shader with mouse interaction (the effect that gets views)
3. Supabase schema with RLS, guestbook and reactions, Realtime subscription
4. Blender assets via Supabase Storage, performance pass (instancing, compressed glTF, capped device pixel ratio)
5. Mobile fallback (lower blade count, no transmission material)

## Risks

- Performance: the creator's whole craft is keeping heavy scenes smooth. A naive build will run badly on phones.
- Supabase free tier pauses projects after inactivity. Your existing project "ember" is currently INACTIVE.
- Anonymous writes to Supabase without RLS and limits will be spammed within days of going public.
- Do not copy the lootbox / token side. Lootboxes paid with tokens are treated as gambling in many jurisdictions.
- Do not copy their exact scenes, models or branding. Recreate the techniques, not the work.
