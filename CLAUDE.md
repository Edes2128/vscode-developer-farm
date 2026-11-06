# Developer Farm

A single-player pixel-art farming/exploration game as a VS Code extension. **The game is called Developer Farm** (never
"EVERGREEN"). Tagline: *A cozy little world of your own.* Read [GAME_DESIGN.md](GAME_DESIGN.md) (architecture, data formats,
save structure, asset contract) and [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) (phases, current status, next steps).

## Non-negotiables

- Single-player, offline-first, local saves, no accounts, no servers.
- **No coding-activity tracking, telemetry, productivity rewards or developer-session mechanics.** Never read the user's workspace or editor.
- Calendar, seasons and events run on the game's own clock, never real dates.
- Never present an unfinished system as finished; no placeholder menus for features that do not exist.
- All eight phases of the roadmap are done (foundation, first playable farm, core life simulation, world expansion, advanced gameplay, living world, advanced expansion, polish). Work from here is new content and fixes, built the same way. See DEVELOPMENT_ROADMAP.md.
- Build in phases; do not start the next until the current one is stable. End each phase with: what was implemented, files changed,
  what works, what is incomplete, known bugs, how to test, recommended next phase. Keep both docs current.

## Architecture rules

- `src/engine` is **pure TypeScript**: no `vscode`, no DOM, no Pixi. It must stay testable in plain Node and portable to a standalone game.
- The simulation runs in the **webview**; the extension host only keeps files and a log. Do not move game state to the host.
- Content is **data** (`src/data`), validated by `validateContent` (runs in tests and at every start). Add content as data; do not hardcode crops, NPCs, items or regions in logic.
- Rendering reads game state and never changes it. HUD reads the `UiStore`; React must not re-render per frame.
- Saves: change `GameSaveState` only with a `SAVE_VERSION` bump, a migration, and tests. Never overwrite a save from a newer version.
- Everything the player does "to the thing in front of them" (signs, tools, crops) acts on `facingCell(player)`: one tile-based rule, never pixel offsets. `planUse` decides what an item would do; the cursor and the swing both ask it.
- Crops grow in **watered days counted by the game**, never real time; quality comes from `hash(cell, day)`. Keep simulation deterministic and testable.
- Villagers are simulated **only on the player's map**; elsewhere they are placed by their schedule (data). Save their memories, never their positions. Dialogue, schedules and quests are data in `src/data`, with conditions; every dialog with choices lives in `src/engine/conversations.ts` (option ids like `npc:chat:willa`).
- Weather is a pure function of the day (`weatherOn` in `src/engine/weather`), **never stored**; festival days are always clear. Anything that depends on it (rain watering fields, schedules, fishing stock, the light) reads `game.weather`; rendering only draws it. Festivals (`src/data/festivals.ts`), the notice board's pool (`src/data/requests.ts`) and schedule conditions (`when`, `days`, the `away` map) are data, validated by `validateContent`. Festival and board progress is saved for the day it belongs to and forgotten on any other; prizes and rewards are checked against the pockets with `canAddAll`.
- Rare creatures (`src/engine/creatures`, `src/data/creatures.ts`) stand where a pure function of the day and the map says (`placeCreatures`), **never saved**; only what the player has seen and befriended is (`bestiary`). Fertilizer, sprinklers and `needsRain` crops are data (`ItemDef.fertilizes`, `ObjectDef.sprinkles`, `CropDef.needsRain`). Anything meant to be seen on the ground (an egg, a creature) avoids `GameMap.isOverhung` cells, where a tree crown would hide it.
- Sound is made in the webview from data recipes (`src/data/sounds.ts`, `src/engine/audio` pure, `src/webview/audio` Web Audio): no audio files, nothing plays before the first key press or click, nothing while the window is hidden. The engine only *asks* for sounds with `sound` events; it never makes any. The economy is a test (`src/data/economy.test.ts`): change prices in data and keep the guard rails green.
- Interiors are small maps entered by a door cell (an exit); the mine is generated (`src/engine/mine`), validated like written maps, forgotten each morning. Fishing is a pure state machine (`FishingSession`); a region can be locked by conditions. Arriving through an exit shuts exits to the player until the movement keys are released.
- Things put on a map after it is built (furniture, buildings, scaffolding) go through `GameMap.addObject`/`removeObject`; only furniture is saved (`placed`), buildings are derived from `buildings`. Anything the day uses up (rocks, dig spots, fish bites) is recorded in `spent` so a reload cannot undo it. Check a multi-item reward against the pockets with `canAddAll`, never item by item.
- A new map is data plus `exits` on both sides (validated: fit, walkable, arrival not inside an exit, a way back). The renderer keeps a `MapView` per map.
- Save migrations (`persistence/migrations.ts`) use literal values, never live content. Each `SAVE_VERSION` bump needs a migration, a test with a real old-format save, and a check in the integration suite.
- Everything from the webview is untrusted: validate in `src/shared/messages.ts`, keep storage keys to `^[a-z0-9][a-z0-9._-]{0,63}$`.
- The webview CSP forbids `eval`, inline script/style and fetch: Pixi comes via `pixi.js/unsafe-eval`, textures load through `<img>`.
- Dev/test hooks live behind `__DEV_TOOLS__` / `init.testMode`; the packaged extension must not be drivable from outside.

## Commands

```bash
npm test                    # Vitest (engine, data, protocol, save store)
npm run typecheck           # extension + webview projects
npm run build               # assets + extension + webview
npm run test:integration    # real VS Code, throwaway profile (needs /Applications/Visual Studio Code.app or VSCODE_EXECUTABLE_PATH)
npm run assets              # regenerate src/assets/generated (committed, deterministic)
npm run dev:webview         # page in a browser at http://localhost:5174 (saves to localStorage)
```

In the dev page, `window.farm.debug()` gives `{ game, renderer }`; step the simulation with `game.frame(1/60)` (a hidden or
throttled pane runs `requestAnimationFrame` slowly, and the game pauses itself while the page is hidden: call
`game.setPaused('hidden', false)` in scripted checks, and `mcp__ccd_view__show_pane` to bring the pane into view).

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; explicit `import type`.
- Art is generated by `assets/src` into `src/assets/generated`; the renderer knows only frame **names** (see the naming contract in GAME_DESIGN.md §9).
  Hand-drawn art replaces generated frames without code changes. Brand palette lives in `src/data/palette.json` only.
- Maps are two ASCII layers (see `src/data/regions/willowbrook/homeFarm.ts`); a closed trail must actually be sealed (a test checks it).
- Prefer small modules and data over big files; add a test next to whatever you add.
- Reference images were not available when Phase 1 was built; if `docs/reference/` exists, check the art against it.
