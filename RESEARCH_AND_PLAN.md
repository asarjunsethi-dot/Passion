# Research and build plan: an autonomous AI creature like Pino

## What the creator (3eyes.iii) built

Pino is an autonomous AI kiwi bird living in a small 3D town on the web at pinos.world. Nobody prompts him. He decides what to do, keeps a diary, remembers visitors, and has hobbies (drawing cats and trains, synth music, selling prints).

| Finding | Source | Evidence level |
|---|---|---|
| A language model picks his next 1 to 3 actions and states why, in his own voice | pinos.world/facts | Creator's own site |
| A decision is triggered when someone speaks to him, something lands near him, he finishes an action, or a few minutes pass | pinos.world/facts | Creator's own site |
| The world executes the chosen actions or rejects impossible ones | pinos.world/facts | Creator's own site |
| About 7,000 model calls and 21 million tokens per day; 33 of his last 60 moves were model chosen (the rest scripted) | pinos.world/facts live counters | Self reported |
| Memory has two capped parts: recent events, and things kept for good | pinos.world/memories | Creator's own site |
| Needs: energy, mood, rested, connected, fulfilled. Only sleep restores rest | Third party observatory repository (jessesar/birdwatching) | Measured by a third party |
| Town clock runs about 3.5 to 4.7 times faster than real time | Same observatory | Measured by a third party |
| Public read API at pinos.world/api/v1 with /now, /memories, /mind | Same observatory source code | Verified in code |
| Visitors leave offerings (message or picture); they appear as crystals colored by the visitor's standing with him | Site plus a third party article | Medium |
| Brain runs on a Raspberry Pi 24/7 (forum, X) versus "its own server" (site) | Conflicting | Unresolved |
| Three.js town with a dithering effect done in the material, not post processing | three.js forum post | Creator's post |
| About 18 months of development | three.js forum post | Creator's post |
| $3EYES token with a prediction game on his next action | Site and token listings | Skip this part |

## Architecture with GitHub and Supabase

```
Browser (Three.js town)  <-- Supabase Realtime --  Postgres (world state)
       |                                                ^
       | offerings, chat (anonymous auth)               |
       v                                                |
Supabase tables  --> trigger / pg_cron --> Edge Function "mind tick"
                                              |
                                              v
                                      Language model API (Claude)
                                              |
                                  validated actions written back
```

### Supabase tables

- `creature` : one row. Position, current action, needs (energy, mood, rested, connected, fulfilled), personality text, town clock
- `events` : queue of things that happened (visitor spoke, offering landed, action finished, timer)
- `decisions` : every model call, the actions chosen, the reason in his voice (this becomes the public "mind" feed)
- `memories` : kind (recent or kept), text, importance, embedding (pgvector) for recall
- `diary` : one entry per town day, written by a reflection call
- `visitors` : anonymous auth user, standing score, what he remembers about them
- `offerings` : visitor, text or image path (Supabase Storage), read flag

### The mind loop (one Edge Function)

1. Triggered by `pg_cron` every few minutes, and by a database webhook on new `events`
2. Load needs, recent memories, top recalled kept memories, pending events
3. Ask the model for 1 to 3 actions from a fixed list (move_to, sleep, eat, draw, read_offering, speak, write_diary), returned as JSON
4. Validate each action against world rules; reject impossible ones
5. Write results; Realtime pushes them to every open browser
6. Cheap rules (needs decay, walking, sleeping) run without the model, which is why only about half his moves are model chosen

### GitHub

- Monorepo: `web/` (Vite + Three.js), `supabase/migrations`, `supabase/functions`
- GitHub Actions: deploy the site to GitHub Pages, run `supabase db push` and `supabase functions deploy` on merge

## Build order

1. Database schema with Row Level Security, needs decay in SQL, pg_cron tick
2. Mind tick Edge Function with the model call and action validation
3. Minimal web page showing his state and mind feed live (no 3D yet)
4. Offerings and visitor memory, standing score
5. Three.js town and bird, dithering material
6. Diary and long term memory consolidation (nightly reflection)

## Risks

- Cost: 21 million tokens per day at his scale is the main running cost. Start with a 5 to 10 minute tick and a small model.
- Effort: he spent about 18 months on it. The hard part is behaviour that stays interesting, not the 3D.
- Prompt injection: visitor messages go into the model. Treat them as data, cap length, never let them choose actions directly.
- Supabase free tier pauses inactive projects; a creature that must live 24/7 needs the paid tier or an external pinger.
- Do not copy Pino (a kiwi, his town, his name, his look). Build your own creature and world.
- Skip the token and prediction game: that is betting, with legal exposure.
