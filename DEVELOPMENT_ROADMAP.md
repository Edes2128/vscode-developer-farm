# Developer Farm — Development Roadmap

How the game is being built, phase by phase. Each phase must end with a working, testable result, and the next one does
not start until the current one is stable. See [GAME_DESIGN.md](GAME_DESIGN.md) for the design and architecture.

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | **Foundation**: viewport, camera, tiles, movement, collision, first map, visual identity | ✅ done |
| 2 | **First playable farm**: crops, tools, inventory, time, save/load of all of it | ✅ done (report below) |
| 3 | **Core life simulation**: animals, NPCs, dialogue, friendship, quests, economy, shops | ✅ done (report below) |
| 4 | **World expansion**: village, forest, river, fishing, mines, region transitions | ✅ done (report below) |
| 5 | **Advanced gameplay**: crafting, cooking, building, decorating, archaeology, museum | ✅ done (report below) |
| 6 | **Living world**: seasons, weather, festivals, dynamic events, procedural quests | ✅ done (report below) |
| 7 | **Advanced expansion**: the remaining regions, magical farming, rare creatures | ✅ done (report below) |
| 8 | **Polish**: animation, audio, effects, accessibility, performance, balancing | ✅ done (report below) |

---

## Phase 1 report: Foundation

### Starting point

The repository was **empty**: no code, no documentation, no git history, no reference images. The sibling project
`vscode-casino` (same author, same kind of extension) was inspected and its proven choices were adapted rather than copied:
esbuild for the extension host, Vite + React for the webview, a validated message protocol, a CSP-locked webview shell,
`__DEV_TOOLS__` compile-time stripping, corruption-safe saves, and the integration-test harness.

### 1. What was implemented

- **Project scaffold**: TypeScript (strict, `noUncheckedIndexedAccess`), esbuild, Vite, Vitest, VS Code debug/task configs, VSIX packaging.
- **Engine** (`src/engine`, pure TypeScript): coordinate spaces, fixed-step loop with render interpolation, deterministic RNG,
  action-based input with a remappable keymap, axis-separated AABB collision with corner-slide assist and tunnelling protection,
  the player (walk/run, distance-driven animation), a smoothed bounds-clamped camera, interaction + message dialogs, the
  `Game` facade (pause reasons, save/restore with position rescue).
- **Data-driven world**: `TerrainDef`, `ObjectDef`, `MapDef`, `RegionDef`, `Content`; 47-shape autotiling; scatter rules; and a
  validator that proves a map is playable (spawn walkable, everything interactable is reachable, no overlaps, no missing art).
- **Home Farm** (`willowbrook.home_farm`, 64 × 48): farmhouse, well, mailbox, signs, fenced field, road, wooden bridge, river,
  pond, groves, forest edge, and four deliberately closed trails.
- **Rendering** (Pixi v8): atlas loader, chunked + culled + evicted terrain, animated water, depth-sorted objects with shadows,
  chimney smoke, the farmer, bobbing interaction arrow, crisp whole-pixel scaling at any display density.
- **Art pipeline** (`npm run assets`): a dependency-free generator producing the atlas, its manifest, the 9-slice UI frames and
  the extension icon in the brand palette. The first-pass art is generated; see "Known limitations".
- **HUD** (React): location banner, interaction prompt, message box, dismissible how-to-play hints, save toast, notices,
  focus overlay, pause menu (resume, save, zoom, hints, hide HUD), debug overlay, load/error screen, all in the
  wood/parchment/forest style with a reduced-motion fallback.
- **Persistence**: versioned, checksummed saves with backup, archive-on-damage, newer-version protection, migrations framework,
  coalesced writes, autosave, preferences; atomic file storage in the extension host.
- **Extension host**: panel (one tab, kept alive when hidden), Activity Bar welcome view, validated bridge, local log.
- **Documentation**: this file, `GAME_DESIGN.md`, `README.md`, `CLAUDE.md`, `CHANGELOG.md`.

### 2. Files

| Area | Files |
| --- | --- |
| Config | `package.json`, `tsconfig*.json`, `vite.config.mts`, `vitest.config.mts`, `.vscode/*`, `.claude/launch.json`, `.vscodeignore`, `.gitignore` |
| Tooling | `scripts/build-assets.mjs`, `scripts/build-extension.mjs`, `scripts/dev.mjs`, `scripts/preview-atlas.mjs` |
| Art pipeline | `assets/src/{png,canvas,color,rng,packer}.mjs`, `assets/src/sprites/{terrain,objects,characters,ui}.mjs`, `src/assets/generated/*`, `media/*` |
| Engine | `src/engine/{game,interaction,testing}.ts`, `src/engine/{core,math,input,world,player,camera,persistence}/*` |
| Content | `src/data/{palette.json,terrain,objects,content}.ts`, `src/data/regions/willowbrook/*` |
| Rendering | `src/rendering/*` |
| UI | `src/ui/*` |
| Webview | `src/webview/*` |
| Protocol | `src/shared/*` |
| Extension | `src/extension/*` |
| Tests | `src/**/*.test.ts` (13 files), `test/integration/*` |

### 3. What works (verified)

- **130 unit tests pass** (`npm test`): engine, content validation against the real atlas, protocol, save store.
- **9 integration tests pass in the real VS Code** (`npm run test:integration`, throwaway profile): the farm opens; the
  renderer is WebGL; **zero CSP violations**, zero webview errors, the pixel font loads; reopening reuses the tab; a new game
  starts at the door; keys walk the player; a save reaches the disk and is valid; closing and reopening restores the exact
  position; a deliberately damaged save is recovered from its backup and kept; a newer-version save is never overwritten.
- **Typecheck clean** for both the extension and webview projects; **production build and VSIX package succeed** (26 files, ~294 KB;
  no sources; the dev-server prober is compiled out).
- **Seen in the actual game** (browser pane, WebGL): the meadow, farmhouse with chimney smoke, the farmer on the path, walking over
  the bridge, water blocking the way, the pond, depth sorting behind trees, the interaction prompt, the message box, the pause
  menu, the debug overlay, and a 520 × 420 window (zoom drops to 2×, HUD scales down).
- A real bug found by a test along the way: the "closed" north trail could be walked around through the grass beside the log.
  The map was reworked so every closed trail is sealed, and a test keeps it that way.

### 4. What remains incomplete

- Everything in Phases 2–8. In particular there is **no farming, inventory, tools, time of day, weather, NPCs or audio yet**,
  and none of it is faked with placeholder menus.
- Only the farmer's four facing directions with idle/walk; no tool or carry animations.
- One save slot; no export/import; no controls-remapping screen (the keymap structure is ready).
- The art is generated first-pass art, and the reference images were never available (see below).
- The HMR development path (`DEVELOPER_FARM_DEV_SERVER_URL`) is written (adapted from the casino) but was **not** exercised in
  this phase; the production bundle was.

### 5. Known bugs and rough edges

- The river's banks step in whole cells (a staircase). It reads as stylised but a smoothing pass on the map would look better.
- Water shimmer is busier than ideal at the highest zoom; sparkles were already halved once.
- Closing the tab can lose up to 30 s of play (autosave interval): a webview cannot save as it is destroyed.
- Hidden-pane browser previews throttle animation frames and so slow the simulation; VS Code itself is unaffected.
- The hints panel is large on very narrow windows (it is dismissible, and moved to the top-right to avoid the prompt).

### 6. How to test

```bash
npm install
npm test                    # 130 unit tests, ~0.4 s
npm run typecheck
npm run build               # art + extension + webview
npm run test:integration    # launches the installed VS Code (throwaway profile) and drives the real extension
```

Play it: open this folder in VS Code and press **F5** ("Run Extension"), then click the farm icon in the Activity Bar and
**Open Developer Farm** (or run *Developer Farm: Open Farm* from the Command Palette). `npm run dev` + the
"Run Extension (Vite HMR)" launch config gives hot reload. `npm run dev:webview` serves the same page at
<http://localhost:5174> to look at it in any browser (saves then go to `localStorage`).

Things worth trying: walk (`WASD`), run (`Shift`), stand at the farmhouse door and press `E`, read the signs, cross the bridge,
try to walk into the river, open the menu (`Esc`), zoom (`+`/`−`), hide the HUD (`H`), `F3` for the debug overlay, walk away,
close the tab and reopen it.

### 7. Recommended next phase: Phase 2, First playable farm

See below. Phase 1 is stable and nothing blocks it.

---

## Phase 2 report: First playable farm

### 1. What was implemented

- **Time.** `WorldClock` (6:00 am to 2:00 am, ~14 real minutes, running only while the player is out in the world), the game's own
  28-day-season calendar, a day-night tint, going to bed at the farmhouse door, passing out at 2:00 am, and a morning report.
- **Items and pockets.** `ItemDef` data, a 12-slot `Inventory` (quality-aware stacks, a full inventory refuses, unknown items
  dropped on load), a hotbar HUD with icons, counts, quality stars and a water meter, number keys / `Q` `R` / wheel / click.
- **Farming.** A hoe that tills workable ground, seeds that plant in tilled in-season soil, a watering can (24 water, refilled
  at the pond, river or well, and overnight), growth in watered days, regrowing crops, withering at the season's end, picking
  with `E`, and crop quality that raises the sale price. Five crops: radish, strawberry, tomato, sunflower, pumpkin.
- **One targeting rule.** Everything "in front of the player" acts on the cell in front of the player's cell (`facingCell`); a
  green/red cursor shows what an item would do there and a plain-language hint explains a refusal.
- **Economy.** A shipping bin (paid in the morning) and an honesty-box seed stall, both built on **choices in the message box**.
- **World.** A tillable field on Home Farm (15 × 13), a shipping bin, a seed stall, the well as a water source, and the farmhouse
  door that now offers bed.
- **Art** (generated, in the pipeline): dry and wet soil autotiles, 24 crop-stage pictures, 17 item icons, bin, stall, cursor,
  coin, drop, hotbar slot frames.
- **Rendering.** Soil, crops (depth-sorted), cursor, particle bursts, tool swing, day-night light, all culled or rebuilt only
  when something changed.
- **Saves.** **Save v2** with a real v1 → v2 migration, strict validation with hard limits, and reconciliation with the content.
- **Validation.** Content validation now also covers items, crops, shops, the new-game kit, and that a farmable map has soil the
  player can reach and water they can refill from.
- **Tests and docs.** See below; `GAME_DESIGN.md` §4b describes the systems.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/time/*`, `src/engine/items/*`, `src/engine/inventory/*`, `src/engine/farming/*`, `src/engine/economy/*` |
| Changed engine | `game.ts` (rewritten around the new systems), `interaction.ts` (facing cell, choice dialogs), `world/{types,gameMap,content,validate}.ts`, `input/actions.ts`, `persistence/{saveFormat,migrations}.ts` |
| Content | `src/data/{items,crops,shops}.ts`; `objects.ts`, `terrain.ts`, `content.ts` and the Home Farm map changed |
| Art pipeline | `assets/src/sprites/farming.mjs` (new); `objects.mjs`, `ui.mjs`, `terrain.mjs` extended; `scripts/build-assets.mjs` |
| Rendering | `soilLayer.ts`, `cropLayer.ts`, `effectsLayer.ts`, `ambientLight.ts` (new); `playerView.ts`, `gameRenderer.ts`, `frameNames.ts` changed |
| HUD | `src/ui/components/Farm.tsx` (new), `Hud.tsx`, `store.ts`, `keyLabels.ts`, `atlasImage.ts` (new), styles |
| Webview / protocol / host | `session.ts`, `keyboard.ts`; `shared/messages.ts`; `FarmHost.ts`, `extension.ts` (test hooks) |
| Tests | `time.test.ts`, `inventory.test.ts`, `farming.test.ts`, `economy.test.ts`, `farmingLoop.test.ts` (new); `content`, `persistence`, `game`, `actions`, `messages` tests extended; `test/integration/suite/index.ts` +3 |

### 3. What works (verified)

- **233 unit tests pass** (`npm test`), including the whole loop played through the real Home Farm map: till, plant, water, sleep,
  growth only on watered nights, picking, strawberries fruiting again, withering at the season change, shipping and being paid,
  buying seeds, going to bed, passing out at 2:00 am, the clock stopping for messages and menus, and a full save/reload.
- **12 integration tests pass in the real VS Code** (9 from Phase 1 plus 3): a version-1 save file from disk is upgraded and
  written back as v2; a new farm is tilled, planted and watered with keys; the hotbar and clock draw with **zero** policy
  violations and zero webview errors; sleeping grows the crop, shows the morning report and the farm survives closing the tab.
- **Seen in the actual game** (browser pane, WebGL): the tilled and planted patch, the placement cursor, the hotbar and clock, the
  seed stall's choice dialog (with the purchase note and money updating), the morning report (310g sold, 5 crops grew), the dusk
  tint, and the tool swing frozen mid-strike. A real Phase 1 save in the browser's storage migrated on load.
- Typecheck clean; production build and VSIX package succeed.
- Bugs found and fixed by tests along the way: tool and interaction reach depended on where inside a cell the player stood (now
  one tile-based rule); direction presses made while reading page 1 of a message moved the highlight when the choices appeared;
  the save sanitizer accepted a negative crop stage; the shipping bin sat visibly under the well's roof (moved).

### 4. What remains incomplete

- Everything in Phases 3–8: animals, villagers, quests, a real shop, crafting, weather, festivals, audio.
- Only the farmer's four directions with idle/walk, plus the simple tool swing; no carry or fishing animations.
- Twelve slots and no inventory screen; one save slot; no export/import; no remapping screen.
- Rain does not water crops; winter has nothing to grow; farming mastery does not exist yet so quality is luck only.
- The hot-reload (HMR) development path is still not exercised; the production bundle is.

### 5. Known bugs and rough edges

- The tool swing is a moving tool over the standing picture, not drawn swing frames; the watering-can pose in particular is crude.
- The wet-soil colour reads purple-grey next to dry soil; a hand-tuned pair would look better.
- Pumpkin vines in their middle growth stages look like flat green blobs.
- The hints panel scrolls on very small windows (it never covers the hotbar).
- Closing the tab can lose up to 30 s of play (a day's end saves immediately).
- Pressing `E` on a ripe crop while an object is in front of the player uses the object first (by design; a crop and an object are never in the same cell).

### 6. How to test

```bash
npm test                    # 233 unit tests
npm run typecheck
npm run build
npm run test:integration    # 12 tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview` at <http://localhost:5174>): select the hoe (`1`) and walk into the fenced field south of
the path; `Space` tills the cell in front of you; select the seeds (`3`) and `Space` to plant; select the can (`2`), `Space` to
water, and refill it at the pond or the well; go to the farmhouse door, `E`, and go to bed; read the morning report; water and
sleep until the crop is ripe, then `E` to pick it; stand at the shipping bin (east of the well) with the crop selected and `E`;
buy more seeds at the stall below the well. `F3` shows the debug overlay.

### 7. Recommended next phase: Phase 3, Core life simulation

Done: see the Phase 3 report below.

---

## Phase 3 report: Core life simulation

### 1. What was implemented

- **A second map and map exits.** `MapDef.exits` (a cell rectangle → a cell of another map, with a facing). Walking into one swaps the
  map: the message box closes, the camera snaps, a quick fade plays, `visited:<map>` is set and quests hear of it. The east road of
  Home Farm is now open and leads to the **Village Green** (40 × 30: two cottages, a fountain, benches, signs). Sleeping always wakes
  the player at the farmhouse door.
- **Villagers.** Willa Thorne (the seed seller) and Tobias Marsh (a retired miller), each with a home, a birthday, a **schedule as data**
  that sends them across the bridge and between the two maps, tastes, dialogue and gift reactions. They walk with a **grid A\* pathfinder**
  (`src/engine/path`) and are really simulated only on the player's map; elsewhere they are placed by the schedule, and a cross-map
  trip is walked in front of the player when they are watching. Drawn from the same body as the farmer in their own colours.
- **Talking, friendship and gifts.** `E` on a villager opens a greeting with the speaker's portrait and ten hearts, then *Chat* (+20 a
  day), *Give* the selected item (loved +80 … hated −40, birthdays ×4 on kindness, one a day and two a week), quest options, and the
  shop. **Dialogue is data**: rules with conditions (`friendship`, `season`, `time`, `flag`, `quest`, `firstMeeting`, `birthday`,
  `not`) and one-time lines. Friendship rewards are handed over once, and only when the pockets have room.
- **A staffed shop.** Willa minds the stall from eight until five; when she is not at her post the stall says who is away and
  when she will be back. The shop **buys produce at a price that changes daily** (85–115 %, from `hash(day, item)`), and sells seeds by the
  season, chicken feed and chickens.
- **A pre-built chicken coop.** A fenced yard, a trough, a basket. Hens wander and peck (the pathfinder again), can be petted once a
  day, lay one egg each night if they found feed (quality from friendship and `hash`), like you more when fed and less when hungry.
  Bought at the stall or earned from a quest.
- **Quests and a journal.** Seven kinds of objective, authored quests (four), taken from and reported to villagers, paying money, items,
  an animal, friendship and flags. The journal (`J`) shows progress and rewards; a tracker under the clock shows what is open and
  what is ready; the morning report mentions eggs and ready quests.
- **Saves: v3** with a real v2 → v3 migration, strict validation with hard limits for villagers, hens, quests and flags, and
  reconciliation with the content (and farms, coops, quests for maps/kinds that are not loaded are kept, not lost).
- **Validation** now also covers villagers (schedules, serving a shop, tastes, dialogue ids, quest references), quests
  (every item obtainable, crops in season, maps reachable through the exits, collections need an animal that makes the product), shops
  (item xor animal, keeper, variance), exits (fit, walkable, target exists, arrival not inside an exit, a way back) and the coop.
- **Rendering.** A `MapView` per map (the last three kept built), an `ActorLayer` for villagers and hens (depth-sorted with
  everything else, hens mirrored for left), a petting effect. **HUD:** speaker portrait and hearts, journal, tracker, quick map fade.
- **Art** (generated): villager bodies in two styles, the chicken (idle, walk ×2, peck ×2), two cottages, coop, trough, fountain,
  bench, egg and chicken-feed icons. The atlas is now 797 frames.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/path/*`, `src/engine/social/*` (types, conditions, friendship, dialogue, villagers), `src/engine/ranch/*`, `src/engine/quests/*` (log, types, descriptions), `src/engine/conversations.ts` |
| Changed engine | `game.ts` (rewritten: two maps, villagers, ranches, quests, conversations), `interaction.ts` (speaker, choice contexts), `testing.ts`, `world/{types,gameMap,content,validate,frames}.ts`, `economy/{types,shop}.ts`, `items/types.ts`, `input/actions.ts` (+`journal`), `persistence/{saveFormat,migrations}.ts` (v3) |
| Content | `src/data/{npcs,animals,quests}.ts` (new); `items`, `shops`, `objects`, `content`, `regions/willowbrook/homeFarm.ts` (east road, coop, exit) changed; `regions/willowbrook/villageGreen.ts` (new) |
| Art pipeline | `assets/src/sprites/animals.mjs` (new); `characters.mjs` (styles), `objects.mjs`, `farming.mjs` extended; `scripts/build-assets.mjs` |
| Rendering | `mapView.ts`, `actorLayer.ts` (new); `gameRenderer.ts`, `playerView.ts`, `effectsLayer.ts`, `frameNames.ts` changed |
| HUD | `src/ui/components/Journal.tsx` (new), `Hud.tsx` (portrait, hearts), `Farm.tsx`, `PauseMenu.tsx`, `store.ts`, `keyLabels.ts`, `App.tsx`, `hud.css` |
| Webview | `session.ts` (map change, journal, quest sync, speaker), `keyboard.ts` |
| Tests | `astar`, `social`, `ranch`, `quests`, `describe`, `lifeSimulation` (new); `economy`, `persistence`, `content`, `farmingLoop` updated; `test/integration/suite/index.ts` +3 |

### 3. What works (verified)

- **327 unit tests pass** (`npm test`), including `lifeSimulation.test.ts`, which plays the phase through the real maps and data:
  Willa leaving the green at eight, crossing to the farm and standing at her stall; her walk home in the evening while the player is on
  the green; talking, gifts by taste and their limits, birthdays, friendship rewards; buying a hen, the coop being full, petting,
  trough → night → egg → basket, hungry hens; the quest chains (including walking through the exit and being paid in a hen); and a
  full save written, decoded and restored. A real v2 save envelope is migrated to v3 with the farm unchanged.
- **15 integration tests pass in the real VS Code** (12 from earlier plus 3): a real v2 save file from disk opens, is upgraded and is
  written back as v3; walking east off the edge of the farm arrives on the Village Green (drawn with WebGL under the strict policy,
  zero violations, zero errors), the save and a reopened tab keep the player there and the farm's crop survives while they are away;
  sleeping away from the farm wakes the player at the door.
- **Seen in the actual game** (browser pane, WebGL): Willa leaves the green at 8:00, crosses the bridge and is at her stall by
  8:33; her dialog with portrait, role and an empty row of hearts; the Village Green with the fountain, benches and Tobias on his bench;
  the journal with a ready and an active quest; `J` pausing and resuming the game.
- Typecheck clean; production build and VSIX package succeed.
- Found and fixed along the way: the content validator caught a duplicated dialogue id for Tobias the first time it ran on the
  new data; a test helper stopped reading a multi-page greeting on its first page (the helper, not the game).

### 4. What remains incomplete

- Everything in Phases 4–8: fishing, mines, crafting, building, weather, festivals, audio, the rest of the village and the other regions.
- Two villagers and four quests. Nobody goes indoors: the cottages have doors but no interiors (interiors will be maps reached
  through exits; the exit system already supports it). Friendship never fades.
- The dialog shows a villager's standing sprite as their portrait; hand-drawn portraits do not exist yet.
- One coop, chickens only, not placeable or movable (building is Phase 5). No up/down hen pictures, no eating or sleeping pictures.
- The journal is text: no map, no tracking arrow, no abandoning a quest.
- Villagers are simulated only on the player's map; schedules ignore weather and festivals (Phase 6).

### 5. Known bugs and rough edges

- On a slow machine the new map can show for one frame before the quick fade covers it.
- Willa reaches her stall at about 8:30, not on the hour (she walks the road), though the sign says "from nine until five".
- Villagers are solid for the player (a step into one is undone and the player slides along them), but they do not step around
  the player, each other or the hens: they path around the map's walls, not around people, and simply pass through. Nobody can be
  trapped, but a villager can walk through you.
- A hen is drawn mirrored for left; the shadow under her is a generic small one.
- Everything from earlier phases still stands (generated art, one slot, up to 30 s of play lost on closing the tab).

### 6. How to test

```bash
npm test                    # 327 unit tests
npm run typecheck
npm run build
npm run test:integration    # 15 tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview` at <http://localhost:5174>): the farm is empty of people until about half past eight, when Willa
walks in from the east and takes her place by the stall (`E` on her, then *Buy or sell*); ask her about a quest (*Welcome to the
Green*), take the east road across the bridge to the end of the map, and you arrive on the green; talk to Tobias on his bench, report
back to Willa, and read the journal (`J`). Ship five radishes for *A Good First Crop* and she will give you a hen: put chicken feed
in the trough by the coop (south of the field), sleep, and collect the egg at the coop. Pet a hen with `E`. In the dev page,
`window.farm.debug()` gives `{ game, renderer }`; step it with `game.frame(1/60)`.

### 7. Recommended next phase: Phase 4, World expansion

Done: see the Phase 4 report below.

---

## Phase 4 report: World expansion

Phase 4 was built with three self-contained pieces handed to subagents against exact contracts (the pixel art, the mine's floor
generator, the fishing state machine) while the tightly coupled engine, data and rendering work was done in the main session; the
subagents' code was then checked by their tests and by the whole suite, and the integration suite exercises all of it together.

### 1. What was implemented

- **Interiors.** Door cells that are exits to small interior maps with a steady lamp light (`ambient: 'indoor'`): Willa's cottage, Tobias's
  cottage and Reed's General Store, each furnished from new objects. Villagers go indoors for the night through their doors (the schedule
  names interior maps; the pathfinder crosses as many maps as needed). Arriving through an exit shuts exits to the player until they release
  the movement keys, so a held key cannot carry them straight back.
- **The wider valley.** The Village Green gained a general store and two trails: south-west to **Silverbend** (river, dock, bench) and north to
  **Whispering Wood** (a pond, a clearing and the mouth of the old mine). Two new villagers, **Hollis Reed** (storekeeper) and **June Hale**
  (angler), with schedules, tastes, dialogue, gift reactions and friendship rewards.
- **Region unlocks.** `RegionDef.unlock` can require conditions (a quest done, hearts, a flag). A way into a locked region turns the player
  back with a message; validation proves the unlock can be earned without going in.
- **Fishing.** A rod, fishing water (zones on the farm river and pond, the riverbank and the wood pond), six fish by water, season and hour, and
  a timing mini-game (cast → wait → bite → reel) that never costs the player anything. A fishing line, float, ripples and a timing bar are drawn
  in the world. Catches go to the pockets and the **collection** page of the journal.
- **The old mine.** Ten generated floors (deterministic, validated like written maps, rebuilt whole every morning), a pickaxe, rocks and ore as
  nodes (stone, copper, coal, iron, quartz, amethyst by depth), ladders, a dim cave light, and the deepest floor saved.
- **A real general store.** Hollis sells the rod and pickaxe once each and buys fish, minerals and produce at a price that moves daily.
- **Quests.** Four more (*Gone Fishing*, *The Angler's Favour*, *Copper for the Store*, *Deep Down*) with two new kinds of objective (`catch`,
  `mine`); the first one opens the wood.
- **Saves: v4** (the collection and the mine's depth) with a v3 → v4 migration and strict validation.
- **Validation** now covers nodes, fish, fishing zones, ambient light, region unlocks, quests that catch or dig, one-off offers, villagers'
  schedule cells (walkable and reachable), and all ten mine floors.
- **HUD.** The journal has two pages (Quests, Collection: fish and minerals with counts, question marks for the unfound, and the mine's depth).
- **Art** (generated, by a subagent against a frame contract): wood floor, plaster and cave tiles; the store and interior furniture; mine nodes,
  ladders, the cave mouth and a dock; fish, ore and tool icons; fishing effects; two more villager styles. See GAME_DESIGN §9.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/nodes/*`, `src/engine/fishing/*` (rules, session), `src/engine/mine/*` (generator, ids) |
| Changed engine | `game.ts` (mining, fishing, region locks, arrival lock, collection), `world/{types,gameMap,world,content,validate}.ts`, `farming/tools.ts`, `economy/{types,shop}.ts`, `items/types.ts`, `quests/*`, `social/friendship.ts`, `persistence/{saveFormat,migrations}.ts` (v4), `testing.ts` |
| Content | `src/data/{nodes,fish,interiors}.ts` (new); `items`, `npcs`, `shops`, `quests`, `objects`, `terrain`, `content` changed; `regions/willowbrook/{interiors,riverbank}.ts`, `regions/whisperingWood/*` (new); the green and the farm changed |
| Art pipeline | `assets/src/sprites/*` extended by the art subagent; `scripts/build-assets.mjs` |
| Rendering | `mapView.ts`, `nodeLayer.ts`, `fishingView.ts` (new); `gameRenderer.ts`, `playerView.ts`, `effectsLayer.ts`, `ambientLight.ts`, `frameNames.ts` changed |
| HUD / webview / protocol | `Journal.tsx` (collection page), `store.ts`, `hud.css`; `session.ts`; `shared/messages.ts` (test probe) |
| Tests | `fishing`, `mine/generator` (by subagents), `worldExpansion` (new); `content`, `persistence`, `lifeSimulation`, `messages` updated; `test/integration/suite/index.ts` +5 |

### 3. What works (verified)

- **The unit tests pass**, including `worldExpansion.test.ts`, which plays the phase through the real maps and data: walking through a
  door and back, villagers going to bed indoors and waking outside, the store (a one-off rod and pickaxe, selling fish and ore, closed hours),
  the brambled trail turning the player back until the quest is done, a held key not bouncing the player out of a door, casting → bite →
  reeling → a catch landing in the pockets, the collection and the quest, a missed press, walking away, a full pocket, mining a rock (swings,
  drops, the way opening), pockets too full to break a rock, every rock whole again after a night, ladders down and up, passing out in the mine,
  and a save made in the mine reopening there.
- **The integration tests pass in the real VS Code**: a real v3 save is upgraded to v4; walking into a cottage door draws its inside under the
  strict policy and the door out leads back; the north trail is shut until the quest is done; with the quest done the old mine draws (WebGL, zero
  violations, zero errors), saves, and a reopened tab is still down there; casting a line at the river shows the float and walking away pulls it in.
- Typecheck clean; production build and VSIX package succeed.

### 4. What remains incomplete

- Everything in Phases 5–8: crafting, cooking, building and decorating, archaeology and a museum, weather, festivals, remaining regions, audio.
- The mine has no creatures, no hazards and no deeper secrets: ten floors of rocks and ladders. Floor 10 has no way down.
- Nodes drop materials that can only be sold or given: there is nothing to craft with them yet (Phase 5).
- The farmhouse still has no inside (you go to bed at its door).
- Fish have no pictures in the water (only the float and the timing bar), and a hen or a fish has one icon each.

### 5. Known bugs and rough edges

- The cave and the interiors are plain base tiles (a wall is a repeated square), without an edge or shadow where floor meets wall.
- A node that has taken a hit shakes by one pixel; there are no hit frames.
- Because the mine is rebuilt each morning, a save made in the mine reopens with the rocks whole again.
- Hollis and the stall keeper both buy produce, so Willa's stall also buys fish and ore (every shop that buys takes any goods).
- The quick map fade can show one frame of the new map first on a slow machine (as in Phase 3).

### 6. How to test

```bash
npm test                    # unit tests
npm run typecheck
npm run build
npm run test:integration    # integration tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview`): walk to the village and into Reed's General Store (the big building south of the fountain), buy a
rod, and press `Space` facing water (the farm's river, the pond, or Silverbend): wait for the float to dip, press once, then press again as the
marker crosses the green. Catch three fish and tell Hollis (the *Gone Fishing* quest): the north trail from the green opens. Follow it to the
cave mouth, buy a pickaxe first, and go down: rocks break in a few swings, ladders go up and down, and `J` shows your collection.

### 7. Recommended next phase: Phase 5, Advanced gameplay

Done: see the Phase 5 report below.

---

## Phase 5 report: Advanced gameplay

Phase 5 followed the Phase 4 way of working: the pixel art and three small pure modules (crafting, the museum, digging) were written by
subagents against exact contracts, and the dynamic-object system, the farmhouse, the carpenter, the data, the dialogs and every integration
were done in the main session. A fresh-eyes review of Phase 4 ran in parallel; its findings were fixed first (see "What the review of Phase 4 changed" in
GAME_DESIGN §4e).

### 1. What was implemented

- **The farmhouse inside.** The door is an exit; inside, a bed (the only way to end the day on purpose), a kitchen and a workbench.
- **Cooking and making.** `RecipeDef` data, a craft menu at both stations, 13 recipes (dishes, bars, a lantern, a vase, a clock), recipes taught by
  friendship or quests, a rule that products are worth 20 % more than their ingredients, and atomic crafting that accounts for slots the ingredients free.
- **Furniture and placing.** `GameMap.addObject`/`removeObject` for objects put on a map after it is built; furniture items; a green/red
  cursor; pick-up with `E`; Hollis sells seven kinds; saved per map (**save v5**).
- **The carpenter and the greenhouse.** Bram builds what `BuildingDef`s offer on a map's building sites: the greenhouse (800g, 50 stone, 6 copper
  bars, three nights), with scaffolding while it is built and a door that opens at dawn into a glass room where the **seasons do not matter**.
- **Archaeology and the museum.** A few dig spots appear each morning (deterministic) on the farm, the river bank and in the wood; the hoe uncovers
  an artifact (six exist). The museum, in a new building on the green with a curator (Ines), collects 18 things once each and pays six rewards.
- **Five quests** with five new objective kinds, **two new villagers**, the journal's collection page now with artifacts and a star for what is on display.
- **Review fixes from Phase 4.** Used-up rocks, dug spots and the day's bites are saved; fishing has a daily stock per water; drops that do not fit are never
  counted; a save naming a map the game no longer has no longer breaks the night; rewards are checked against the pockets as a whole.
- **Saves: v5** with a v4 → v5 migration tested against a real v4 save (and a real v3 fixture added), and strict validation.
- **Validation** covers recipes (obtainable, paying), buildings (site fits, door, way in), dig spots, the museum, new quest objectives, furniture, and that
  every taste can actually be given.
- **Rendering and HUD.** `ExtrasLayer` for placed objects, dig spots under the player's feet, new effect bursts, long menus that scroll, the morning
  report mentioning finished buildings.
- **Art** (generated by a subagent against a frame contract): three interior floors and walls, the kitchen and workbench, five more furniture pieces, the
  greenhouse and its scaffolding, the museum and its cases, dig spots, 26 item icons for dishes, bars, artifacts and furniture, two villagers.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/crafting/*`, `museum/*`, `digging/*` (subagent), `buildings/types.ts`, `inventory/take.ts` |
| Changed engine | `game.ts` (furniture, buildings, digging, spent state, fishing stock), `conversations.ts` (kitchen, workbench, museum, carpenter), `world/{types,gameMap,world,content,validate}.ts`, `farming/{tools,farm}.ts`, `quests/*`, `persistence/*` (v5), `interaction.ts`, `items/types.ts` |
| Content | `src/data/{recipes,museum,buildings}.ts` (new); `items`, `npcs`, `quests`, `shops`, `terrain`, `nodes`, `interiors`, `objects`, `content` changed; the farm, the green, the riverbank and the wood changed; `regions/willowbrook/interiors.ts` (farmhouse, greenhouse, museum) |
| Art pipeline | `assets/src/sprites/*` extended by the art subagent |
| Rendering | `extrasLayer.ts` (new); `mapView.ts`, `nodeLayer.ts`, `effectsLayer.ts`, `gameRenderer.ts`, `frameNames.ts` changed |
| HUD / webview / protocol | `Journal.tsx`, `Hud.tsx`, `Farm.tsx`, `store.ts`, `hud.css`; `session.ts`; `shared/messages.ts` |
| Tests | `homesteading`, `world/dynamicObjects`, `crafting`, `museum`, `digging` (new); `worldExpansion`, `persistence`, `content`, `farmingLoop`, `game`, `lifeSimulation`, `messages` updated; `test/integration/suite/index.ts` +6 |

### 3. What works (verified)

- **The unit tests pass.** `homesteading.test.ts` plays the phase through the real maps and data: walking into the farmhouse and out, the bed, a kitchen menu enabled by
  the pockets, cooking and the quest hearing of it, friendship teaching a recipe, smelting a bar and making a lantern, a result that does and does not fit, buying a chair,
  placing furniture in the farmhouse only, picking it up, a full pocket, the quest and a save restoring every piece, the carpenter's price and refusal, the order taking money and
  materials, scaffolding on the site, the greenhouse finished on the third morning with its door, a save at every stage, walking in, a pumpkin growing through the first winter
  night under glass while the same one in the field withers, a seed planted in winter only under glass, dig spots (three a day, different each day), an artifact for the hoe,
  museum donations once each, rewards at milestones and held back when the pockets are full.
- **The integration tests pass in the real VS Code**, including a real v4 save upgraded to v5, the farmhouse drawn under the strict policy and the bed ending the day, the kitchen
  menu, a chair surviving a save and a reopened tab, a built greenhouse standing on the farm with its glass room drawn, and the museum drawn.
- Typecheck clean; production build and VSIX package succeed.

### 4. What remains incomplete

- Everything in Phases 6–8: weather, the seasons' look, festivals, events and procedural quests, the remaining regions, magical farming, creatures, audio and polish.
- One building and one site. No storage chest, no moving or demolishing, and furniture only in the farmhouse.
- Recipes take no time. The kitchen has no fire to tend and no hunger to feed: food is for selling, giving and the museum's neighbours. (There is no energy or health system.)
- Artifacts can only come from the hoe; the museum has no tour, no guestbook, no way to take a thing back.

### 5. Known bugs and rough edges

- The greenhouse's two rain barrels are the only water inside; a long field row means a walk back to a barrel.
- Furniture that is placed against a wall overlaps the wall tiles (like all tall furniture), and there is no rotation.
- A donated item is taken from the lowest-quality stack first, so a good fish may stay in the pockets while a plain one goes on show.
- Mining still out-earns farming at depth (the fish cap fixed fishing; the ore prices are for Phase 8's balance pass).

### 6. How to test

```bash
npm test                    # unit tests
npm run typecheck
npm run build
npm run test:integration    # integration tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview`): walk into the farmhouse door and use the kitchen counter with an egg in your pockets (fry it for *A Proper Meal*); buy a chair at Reed's General Store
and put it down in the farmhouse with `Space` (pick it up with `E`); swing the hoe at a mound of fresh earth on the farm for an artifact, and take it to the museum (the pale building
south-east of the plaza) for Ines; ask Bram (by the plaza) about a greenhouse once you have the money, stone and copper bars (made at the workbench from ore and coal), and sleep three nights.

### 7. Recommended next phase: Phase 6, Living world

See below.

---

## Phase 6 report: Living world

Phase 6 followed the same way of working: pure modules with exact contracts were written by subagents (weather and its tests, festival rankings, the request generator), the pixel art by another,
and the game integration, the data, the dialogs, the rendering and the HUD in the main session. An independent review of Phase 5 ran while the phase was being built; its five real bugs
were fixed first and each has a test (`phase5Fixes.test.ts`).

### 1. What was implemented

- **Weather.** `weatherOn(day)` from `hash(day)` and a weight table per season: sun, cloud, rain, storm, snow. Never saved; festival days and day 1 are always sun. Tomorrow's weather is the forecast.
  Rain and storms water every outdoor field overnight (the greenhouse is never rained on), give two more bites a day, dim the light, and are drawn (`WeatherLayer`: rain, a storm with a flash, snow).
- **The seasons' look**: a season colour multiplied into the daylight, and the oaks turn in autumn (`ObjectDef.seasonal`); the renderer redraws its maps when the season changes.
- **Schedules by weather, weekday and festival.** `ScheduleEntry.when` / `days` and a map `away`; Tobias stays in on rainy days, Bram works in the store; the shopkeepers never move for the weather.
- **Four festivals** with hosts, places for the villagers, an activity each (an egg hunt with eight painted eggs on the green, a fishing contest, a harvest fair with one entry, a lantern night where
  words count double), a rank against three rivals, and a prize collected once. The festival ribbon at the top of the screen says what is on and how you are doing. A prize can be asked for until bedtime, and one never asked for is brought round in the night. Lantern Night hangs lanterns on the plaza.
- **The notice board**: three requests a day from a validated pool, handed in for gold and goodwill.
- **Market day**: Rowan Ash, a travelling merchant who is in the valley on Sundays, with a cart on the green and every seed in every season.
- **The calendar page** in the journal, the weather and forecast under the clock, weather and festival lines in the morning report.
- **Save v6** (festival and board for the day; museum claims by count) with a v5 → v6 migration tested against a real v5 save.
- **Validation** covers festivals (date, hours, host, places, hunt areas, prizes), the request pool (givers, items, pay, per-season supply), schedule rules and seasonal frames.
- **Fixes from the Phase 5 review:** the rug (placed, laid under furniture), dig-spot layout the same after a reload, quests that count what was done before they were accepted,
  furniture never put on someone, the furnishing quest counting the furniture out and not the placements, saved furniture only put back as furniture in a room made for it, and the museum's
  claims by count.
- **Art** (generated by a subagent against a frame contract): the notice board, Rowan's cart, a painted egg, five weather icons, and Rowan.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/weather/*`, `festivals/*` (types, calendar, rankings), `requests/*` (subagents, except `festivals/types.ts` and `festivals.ts`), `time/agenda.ts` |
| Changed engine | `game.ts` (weather, festivals, board, rain, fixes), `conversations.ts` (board, festival, lantern chats), `social/{types,villagers}.ts`, `farming/{farm,tools}.ts`, `world/{types,gameMap,content,validate}.ts`, `quests/*`, `museum/*`, `persistence/*` (v6), `interaction.ts`, `testing.ts` |
| Content | `src/data/{festivals,requests}.ts` (new); `npcs` (Rowan, rain schedules), `shops` (the cart), `objects` (board, cart, oak), `interiors` (rug), the green |
| Art pipeline | `assets/src/sprites/*` extended by the art subagent |
| Rendering | `weatherLayer.ts`, `tokenLayer.ts` (new); `ambientLight.ts`, `gameRenderer.ts`, `mapView.ts`, `objectLayer.ts`, `frameNames.ts`, `effectsLayer.ts` changed |
| HUD / webview / protocol | `Farm.tsx` (weather, morning report), `Hud.tsx` (festival ribbon), `Journal.tsx` (calendar), `store.ts`, `hud.css`; `session.ts`; `shared/messages.ts` |
| Tests | `livingWorld`, `phase5Fixes`, `time/agenda` (new); `content`, `persistence`, `museum`, `homesteading`, `messages` updated; `test/integration/suite/index.ts` +7 |

### 3. What works (verified)

- **915 unit tests pass.** `livingWorld.test.ts` plays the phase through the real maps and data: the weather is the same on every look and after a reload and never rains on a festival day; the forecast
  comes true; rain waters the farm but not the glass house; a rainy day puts Tobias indoors and Bram in the store, and no shopkeeper is moved by it; Rowan is on the green on Sundays only and sells seeds in winter;
  the board shows three requests a day, is fair about what is handed in, pays with a friend's bonus, and remembers through a save; each festival on its day (the villagers gather, the eggs are the same ones
  after a reload and picked up by stepping on them, fish landed at the river count and fish landed elsewhere do not, the best of a stack is the one entered and only once, each villager spoken to counts
  once on Lantern Night with twenty more friendship); prizes given once, never to someone who took no part, held back for full pockets; progress forgotten the next day.
- **All 33 integration tests pass in the real VS Code**, including a real v5 save upgraded to v6 with the museum's claims renamed, rain, snow and a storm drawn under the strict policy, the Egg Hunt open
  at ten with eight eggs drawn and closed at eight, the notice board and the merchant answering, festival progress surviving a close and reopen, and the autumn oaks.
- Typecheck clean; production build and VSIX package succeed.

### 4. What remains incomplete

- Everything in Phases 7 and 8: the remaining regions, magical farming, creatures, audio and polish.
- **Events**: the only recurring event is the Sunday market. No meteor night, no random visitors.
- **The seasons are colour, not ground:** no snow lying on the grass, no seasonal grass or flowers (only the oaks change), so winter looks cool rather than white.
- Fish do not differ by weather (only the daily stock grows in the rain); animals and the coop ignore it too.
- **Only Lantern Night is decorated** (lanterns along the plaza): the other festivals have no banners or stalls, the villagers just gather and the host explains. The forecast is not read at the mailbox (the HUD shows it).
- Rivals are anonymous (only a rank is shown) and there is no leaderboard.

### 5. Known bugs and rough edges

- The lightning flash is a plain white wash and thunder is silent (there is no audio until Phase 8).
- Rain and snow are drawn over the whole screen, including over a roof you stand under (inside is exempt, a porch is not).
- An egg lying behind the crown of a tree may be hidden by it until you walk round (the crown draws over anything standing behind it).
- A closed stall's "back at" time ignores a festival: on a festival morning it may promise the usual hour while its keeper is at the festival.
- The notice board shows each request's base pay; a friend's bonus is added when it is paid.
- If a request asks for something you gave away yesterday there is no hint where to find it: the board does not say where an item comes from.

### 6. How to test

```bash
npm test                    # 915 unit tests
npm run typecheck
npm run build
npm run test:integration    # 33 tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview`): the clock panel shows today's weather and tomorrow's; on a rainy morning the fields are already watered and Tobias is indoors. Read the notice board on the green
(west of the plaza) and hand a request in; walk to the green on spring 13 for the Egg Hunt (walk over the eggs, then ask Willa how you did); on a Sunday find Rowan's cart on the green; open the journal's
Calendar page. To jump in time in the dev page, `window.farm.debug().game` exposes the clock.

### 7. Recommended next phase: Phase 7, Advanced expansion

See below.

---

## Phase 7 report: Advanced expansion

Phase 7 was built the same way: the pure creatures module, the pixel art, and the maps of the two regions were written by subagents against written contracts (disjoint files, the validator as their referee), and everything that touches the game loop, the saves, the data, the HUD and the wiring was done in the main session. An independent review of Phase 6 ran first and its findings were fixed (a festival prize can no longer be lost to the clock, a closed stall says the right day, lanterns wait for whoever stands on their cell, and the festival numbers moved into data); a second review of Phase 7 ran at the end.

### 1. What was implemented

- **Two new regions**, behind the farm's north and south trails (the fallen logs are gone): **Windcrest Heights** (a highland meadow with a tarn, ore and standing stones, and a flagstone ruin with an arch and an inner yard; opens when *Buried Things* is done) and **Marlow Marsh** (the shallows with boardwalks and Fern's stilted lodge, the fen beyond, and the lodge's interior; opens when *Gone Fishing* and *First Finds* are done). Five maps, three new kinds of ground and a dozen new things, all validated like the old ones.
- **Magical farming.** *Fertilizer* (a supply: richer soil, and a good harvest four times in ten instead of one), *sprinklers* (placed in the field, saved with the furniture, water the eight cells round them every night on any map), and **moonbloom**, a crop that grows only on nights it rains (no can or sprinkler will do, and a greenhouse is never rained on).
- **Six rare creatures**: a fen heron, a kingfisher, a moon moth, a mountain hare, a ruin owl and a white stag (autumn storms only). Each is about only in its weather, season and hours, on some days, on one map; where it stands follows from the day and is never saved. Walk up quietly (not running) to see it; give a seen one something it likes to befriend it and it leaves a keepsake. **The bestiary** page of the journal shows what has been seen (and where and when it is about, and what it likes).
- **Fern Alder**, the naturalist, with a shelf (moonbloom seeds, fertilizer) and three quests; a new Ines quest to the ruin; two new quest objectives (`see`, `befriend`).
- **Save v7** (bestiary; fertilized soil) with a v6 → v7 migration tested against a real v6 save.
- **Validation** covers creatures (maps, weather that can really happen in their seasons, likes, keepsakes), sprinklers, fertilizer, rain crops and the new quest objectives.
- **Fixes from the review of Phase 6**: see GAME_DESIGN §4f. Also: eggs and creatures are never put where a tree crown would hide them (`GameMap.isOverhung`).
- **Art** (a subagent, against a frame contract): three terrains, the objects of the two regions, the lodge, a sprinkler, ten item icons, four moonbloom stages, six creatures with two idle pictures each, and Fern.

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/creatures/*` (subagent: types, creatures, bestiary; main: habitat) |
| Changed engine | `game.ts` (creatures, befriending, fertilizer, sprinklers, rain crops), `farming/{farm,tools,types}.ts`, `world/{types,gameMap,content,validate}.ts`, `quests/*`, `items/types.ts`, `persistence/*` (v7), `testing.ts` |
| Content | `src/data/{creatures,expansion}.ts` (new); `items`, `crops`, `recipes`, `shops`, `npcs` (Fern), `quests`, `objects`, `content`; `regions/windcrest/*`, `regions/marlow/*` (subagents); the farm (two exits) |
| Art pipeline | `assets/src/sprites/expansion*.mjs`, `characters.mjs` (Fern), regenerated atlas (1024 x 1024, 1099 frames) |
| Rendering | `creatureLayer.ts` (new); `soilLayer.ts`, `gameRenderer.ts` changed |
| HUD / webview / protocol | `Journal.tsx` (Creatures page), `store.ts`, `hud.css`; `session.ts`; `shared/messages.ts` |
| Tests | `expansion`, `creatures/*` (new); `content`, `persistence`, `messages` updated; `test/integration/suite/index.ts` +5 |

### 3. What works (verified)

- **1,070 unit tests pass.** `expansion.test.ts` plays the phase through the real maps and data and a small test world: fertilizer (its luck, use, once, its end with the crop, a save), sprinklers (where they go and where not, the eight cells, a map the player is not on, after a reload, picking them up), moonbloom (dry nights, rainy nights, ripe after three, never under glass), creatures (the same place all day and after a reload, only in their hour and weather, seen by walking not running, befriended with a liked gift once, never unseen, never when the pockets could not take what they leave), what a tree crown hides, and the quest levels.
- **All 38 integration tests pass in the real VS Code**, including a real v6 save upgraded to v7, the north trail turning the player back and then opening onto the heights, Marlow's shallows, fen and lodge drawn (and Fern answering), a creature seen and still in the journal after a reopen, and a sprinkler and fertilized soil surviving a close and reopen.
- Typecheck clean; production build and VSIX package succeed.

### 4. What remains incomplete

- Everything in Phase 8: audio, animation polish, accessibility, performance, balance, and splitting `game.ts`.
- **No new villagers beyond Fern** and no festival in the new regions; the creatures have no sounds, no movement (they stand and idle) and do not flee, and a friend does not follow or visit.
- **No mining in the heights beyond a few surface veins**, no cave, and the ruin has no inside: it is an open courtyard.
- Fertilizer comes in one grade; sprinklers one size; moonbloom the only rain crop. No scarecrow, no automation beyond the sprinkler, no seed maker.
- The marsh's water edges draw over ordinary grass (the renderer picks one base tile for the whole map), so ponds and paths there show a thin pale rim instead of sedge. Cosmetic.
- Creatures show only in the bestiary once seen; there is no map of where, and no photo, and the quests that ask for them have no tracking arrow.

### 5. Known bugs and rough edges

- A creature does not move out of the way: the player can walk through one.
- `E` on a creature and using a liked item on it are two different keys, and the only hint of the second is the journal's page and Fern's line.
- A moonbloom planted when the forecast is dry takes as long as the weather decides: there is no way to call rain, only to plan for it (the forecast under the clock helps).
- Windcrest's tarn and Marlow's pools use the existing `pond` fish, so there is nothing rare to catch in them yet.

### 6. How to test

```bash
npm test                    # 1,070 unit tests
npm run typecheck
npm run build
npm run test:integration    # 38 tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview`): finish *Buried Things* and walk up the farm's north trail to Windcrest Heights; finish *Gone Fishing* and *First Finds* and walk down the south trail to Marlow Marsh and Fern's lodge; walk up to a heron in the fen on a grey morning (without running), and open the journal's Creatures page; buy moonbloom seeds and fertilizer from Fern, and plant them in the open on the evening before rain. In the dev page, `window.farm.debug().game` exposes the clock and `creaturesHere()`.

### 7. Recommended next phase: Phase 8, Polish

See below.

---

## Phase 8 report: Polish

Phase 8 added no new system: it made what exists audible, comfortable, fairer and checked. As before, the self-contained pieces went to subagents against written contracts (the procedural audio engine, with its pure recipes and its Web Audio interpreter; the split of `game.ts`), and the wiring, the balance and the UI were done in the main session. A review of Phase 7 ran first and its findings were fixed; a review of Phase 8 ran at the end.

### 1. What was implemented

- **Procedural sound.** 29 recipes (footsteps by surface, tools, water, coins, doors, bites, catches, a lullaby at day's end, thunder, a chime for discoveries, a prize fanfare, little UI ticks) and 9 looped backgrounds (breeze, wind, rain, storm, snow's hush, crickets, water, an indoor hum, a cave's drone) chosen by weather, season, hour and place; a slow generative tune per season that plays about a third of the time. Made in the webview with the Web Audio API: nothing is a file or is fetched. Silent until the first key press or click, silent while the window is hidden, honours master volume and mute. Volumes (master, effects, ambience, music) and a mute are in the pause menu and saved with the preferences.
- **The game asks, the webview plays.** `Game` emits `sound` events (footsteps by what is underfoot, coins when money comes in, bites, catches, discoveries, prizes, the lullaby, message-box ticks); `effect` events map to sounds; a map change is a door; lightning is thunder.
- **Comfort.** Text size (normal/large), high contrast, and a motion choice (system / calm / full) in the pause menu, saved; the long menu scrolls in a short window.
- **Balance as a test.** `src/data/economy.test.ts` works out what a field, a day of fishing and a mine floor are worth from the data, with guard rails (see GAME_DESIGN §4h). Prices moved: ore, coal, crystals and bars about 40 % down, fish 20 to 25 % down, five bites a water a day (was six), pumpkins and pumpkin pie up.
- **Speed.** Measured, not guessed: the simulation costs about 0.005 ms a frame on the busiest maps, the renderer ran above 200 fps on the busiest scene, a game starts in milliseconds. A guard test (`performance.test.ts`) keeps it so.
- **`game.ts` split.** The weather, festivals and notice board became `LivingWorld`, the creatures and sprinklers became `Wildlife` (about 300 lines out of `game.ts`, same public API, identical behaviour, checked by the whole suite).
- **Fixes from the review of Phase 8**: the pause menu works from the keyboard, requests were rescaled with the price cuts, thunder is heard in Calm mode, footsteps are terrain data (see GAME_DESIGN §4h).
- **Fixes from the review of Phase 7** (a rain crop grew under glass; rocks on written maps never came back; creatures moved after mining and a reload; see/befriend quests ignored what was already done; and more: see GAME_DESIGN §4g).

### 2. Files

| Area | Files |
| --- | --- |
| New engine modules | `src/engine/audio/*` (subagent), `src/engine/living/livingWorld.ts`, `src/engine/wildlife/wildlife.ts` (subagent) |
| Changed engine | `game.ts` (sound events, `pausedFor`, delegation), `persistence/preferences.ts`, `farming/*`, `world/{gameMap,world,validate}.ts` |
| Content | `src/data/sounds.ts` (new, subagent); `items`, `requests`, `creatures`, `npcs` (prices, the stag) |
| Webview / rendering / HUD | `src/webview/audio/engine.ts` (subagent), `session.ts` (audio, comfort), `weatherLayer.ts`, `gameRenderer.ts`, `PauseMenu.tsx`, `store.ts`, `hud.css`, `shared/messages.ts` |
| Tests | `audio` (250, new), `economy`, `performance`, `soundEvents` (new); `expansion`, `persistence`, `worldExpansion`, `economy`, `messages` updated; `test/integration/suite/index.ts` +2 |

### 3. What works (verified)

- **1,342 unit tests pass.** The audio recipes and rules are tested for sanity (levels, envelopes, filters), the engine is tested against a fake audio context (nothing before unlock, voices capped and released, pause fades and suspends, backgrounds crossfade and are not rebuilt, music only when allowed and with its rests, no call ever throws), the game's sound events are tested through real play (footsteps on grass, on wood indoors and on boardwalk planks, none while paused; coins; the lullaby; the prize fanfare), preferences are read leniently, the economy is held between its rails, and the whole suite was the safety net for the split of `game.ts`.
- **All 40 integration tests pass in the real VS Code**, including the sound unlocking on the first key press and the farm running under the strict policy with it on, and old, muted, large-text and calm-motion preferences opening without errors.
- Typecheck clean; production build and VSIX package succeed.

### 4. What remains incomplete

- **Nobody has listened to the sound.** It was verified by tests, by arithmetic on the levels (about -25 to -6 dBFS peaks before volume), and by running the real engine in the browser pane without errors, but the mix is a first pass that wants a human ear (and a lower master default if it is too bold).
- **No key rebinding screen** (the keymap is data and ready), no screen-reader pass beyond labels, no colour-blind palette, and no new character animation: the polish chose sound, comfort, numbers and speed.
- The interface's text-size and contrast choices change the HUD and menus but not the pixel-art panels' pictures; the minor findings of the review (no hysteresis on the water sound at the shoreline, no tests of `LivingWorld` and `Wildlife` apart from through `Game`) were left.
- Balance is guard rails, not play-testing: nobody has played a month of the game to see whether it is fun to earn, only checked that no way of earning swamps the others.

### 5. Known bugs and rough edges

- The browser may keep the audio context suspended until a real gesture (a synthetic key event is not one): sound starts at the player's first real key press or click.
- A creature, an egg or a sound cannot be re-listened to in the journal: there is no sound test button beyond the sample coin when a volume is moved.
- Large text and high contrast change the look of the HUD and the menus, but the pixel-art panels are images, so contrast there is only modestly stronger.

### 6. How to test

```bash
npm test                    # 1,342 unit tests
npm run typecheck
npm run build
npm run test:integration    # 40 tests in the real VS Code (throwaway profile)
```

Play it (F5, or `npm run dev:webview`): press a key, walk on grass, dirt, boards and a floor indoors and listen to the steps; open the pause menu (`Esc`) and move the sliders; stand by water in rain; try Text, Contrast and Motion.

### 7. The roadmap is complete

See "The game at the end of the roadmap" below.

---

## The game at the end of the roadmap

**What it is now (version 0.8.0).** A cozy single-player farming and exploration game in a VS Code tab, offline and private, with: a farm (tilling, planting, watering, growth by watered days, crop quality, rain, fertilizer, sprinklers, a glass house, a crop that only grows in the rain); a village of seven people with schedules that follow the day, the weekday and the weather, friendship, gifts, 17 quests; a coop; fishing with a timing game; an old mine of ten generated floors; cooking and making, furniture, a carpenter and a museum; digging; four festivals, a notice board and a Sunday market; two further regions (Windcrest Heights, Marlow Marsh) with six rare creatures to befriend and a bestiary; weather by day with a forecast; a calendar; saves that survive every version since the first; sound; and comfort options. 1,300+ unit tests, 40 integration tests in the real VS Code, a content validator that runs at every start.

**What it is not.** There are no animals but chickens, no cooking time or energy or health, no multiplayer or accounts (by design), no rebinding screen, nothing listened to, and no art by a human hand: everything is generated first-pass art and sound waiting for replacement.

**Recommended next work (beyond the roadmap).** In this order: (1) play it for a while and tune by feel: the sound levels, the prices, the length of a day; (2) replace generated art with hand-drawn art frame by frame (the renderer only knows names), starting with the farmer and the villagers; (3) the key rebinding screen and a screen-reader pass; (4) more of everything that is data: villagers, festivals, creatures, recipes, regions; (5) animals beyond chickens and a barn; (6) a second save slot and export/import.

---

## Decision log

| Decision | Choice | Why |
| --- | --- | --- |
| Where the simulation runs | In the webview; the host is a thin file/log adapter | 60 fps cannot cross IPC; keeps the engine portable to standalone web/desktop |
| Perspective | Orthogonal 3/4 top-down, 16 px grid | Tractable collision, authoring and art while reading as "isometric-inspired" |
| Save storage | Files in global storage, not `globalState` | Atomic writes, backups, recovery, future export/import, size |
| Map authoring | Two ASCII layers + a legend, validated | Hand-editable, diffable, and provably playable |
| Art | Generated by a script behind a manifest contract | Reproducible and in-palette; replaceable by hand-drawn art without code changes |
| Engine framework | None: plain TypeScript classes, data-driven | Smallest surface, easiest to test and to port |
| TypeScript version | 5.9 (the sibling project's), not 7 | The proven toolchain; revisit later |
| Game location | Editor tab, opened from an Activity Bar entry | A world needs room; a sidebar is too narrow |
| Test-mode hooks | Gated by `__DEV_TOOLS__` and an `init.testMode` flag the packaged host never sets | The packaged extension cannot be driven from outside |
| What "in front of the player" means | The cell next to the player's own cell, in the facing direction (`facingCell`), for tools, signs and crops alike | Pixel-offset probing made reach depend on where inside a cell you stood; one rule also makes the cursor exact |
| How crops grow | In watered days counted by the game, never real time; quality from `hash(cell, day)` | Deterministic, identical everywhere, testable, and nothing extra to save |
| Controls | `Space`/click uses the item, `E` looks and picks | `E` and `Space` used to mean the same; using an item needs its own key |
| Where a tool's effect lands | Partway through the swing (45%), re-checked at that moment | The animation matches the result, and a swing cannot apply to something that changed mid-swing |
| The seed shop | An unattended honesty box that uses choices in the message box | A real shop needs villagers (Phase 3); this keeps the loop self-sufficient now without a new UI system |
| Shipping | Whole selected stack, paid next morning | Simple, and makes the morning report meaningful |
| Water | The can refills overnight as well as at water | Less tedium (the brief wants automation that does not remove the enjoyment); water still limits one trip |
| Crops at the end of a season | They wither (the soil stays worked) | Gives the seasons meaning now and a reason to plan, without punishing a forgotten crop with lost fields |
| Save migrations | Literal starting values, never reading live content | A migration must stay correct forever, even after the content changes |
| Where villagers are simulated | Only on the player's map; elsewhere they are placed by the schedule (one exit hop per update unwatched) | Cheap, deterministic, and impossible for two unseen maps to drift apart |
| Saving villagers | Memories only (friendship, gifts, rewards); never positions | A position follows from the schedule and the clock, so there is nothing to corrupt or migrate |
| Interiors | Will be small maps reached through exits | The exit system and schedules already cover them; no new kind of space |
| Dialogue and quests | Data with conditions, validated for achievability | Writing content never needs engine changes, and an impossible quest cannot ship |
| Daily shop prices | `hash(day, item)`, not a stored random | Deterministic, testable, nothing to save |
| Egg quality and animal luck | `hash` of the animal, the slot and the day | Same reason as crop quality: never saved, always reproducible |
| Who owns dialog flows | `Conversations`, behind a small `ConversationHost` interface | `Game` stays a loop and a set of rules; every choice id is in one place |
| Test content | `makeContent` has no villagers, quests or shop keepers; `farmGameAt` uses the real data | Small test maps stay small, and the real villagers are tested on the real maps |
| Interiors | Small maps reached through exit doors, with a steady `ambient` light | The exit system and schedules already cover them; no new kind of space |
| Locked regions | `RegionDef.unlock` with the same conditions dialogue uses; a locked way turns the player back with a message | One condition system for dialogue, quests and the map; nothing is a hidden wall |
| The mine | Generated floors keyed by number, validated at every start, forgotten each morning | Nothing to save but the depth; every rock whole each day; deterministic and testable |
| Nodes | Map state (`GameMap.nodes`) that blocks until broken, drops decided by hash of cell and day | No random to store; a rock is a rock until the swing lands |
| Fishing | A pure state machine (`FishingSession`) driven by a hash of cell, day and minute; failure never costs an item | Testable without a clock, nothing to save, and friendly |
| Held keys at a door | Exits are shut after arriving until the movement keys are released once | A held key must never carry the player straight back out |
| Subagents | Used for art, the mine generator and the fishing machine, against written contracts with disjoint files | Self-contained work in parallel, checked by tests; coupled engine work stays in one hand |
| Placing things | One mechanism for furniture and buildings: `GameMap.addObject`, saved by map for furniture and derived from `buildings` for buildings | A single, small API that collision, drawing and saving all understand |
| A building's life | Ordered (money and materials taken now) → scaffolding → finished on a set morning, with its door | The player sees progress and cannot lose their materials; deterministic and testable |
| Greenhouse | A `sheltered` interior map, entered by a door that appears when it is built | Reuses interiors and farms per map; no special case for seasons beyond one flag |
| Daily used-up record | `spent` in the save, valid for one day | Reloading must never undo today's mining, digging or fishing |
| Rewards and pockets | Every multi-item reward is checked against the pockets as a whole, and waits if it does not fit | A reward must never be half given, or lost |
| Weather | A pure function of the day (`weatherOn`), never stored; festival days are always clear | Deterministic and the same on every reload, so nothing to save and nothing to exploit; a festival is never rained off |
| The seasons' look | Season colour in the daylight, and a data list of seasonal frames (`ObjectDef.seasonal`), instead of redrawing every tile | Gets a visible change of season for the cost of a multiply and one object's frames; honest about not being new ground |
| Weather and shops | Shopkeepers never have a `rain` entry; only people nobody depends on go indoors | A stall must not close by the sky alone: the seed shop is how the loop starts |
| Festival results | Compared with rivals drawn from (festival, day), the prize taken once and only when the pockets fit it | Same rule as every reward; a reload cannot reroll or repeat anything |
| Festival and board progress | Saved with the day it belongs to, forgotten on any other | The record is tiny and can never carry over into a day it does not belong to |
| Museum claims | Saved by the count that earned each reward, not by position | Editing the list of rewards must never hand a paid one out again |
| Quest progress | Levels (hearts, furniture out now) are taken as a level; one-off events that may have happened before the quest are read from the world when it is accepted | A quest must be finishable whatever order things were done in, and a single chair put down five times is not five chairs |
| Rare creatures | Placed by a pure function of the day and the map (like dig spots), never saved; only seen/friend is saved | A reload cannot move or reroll them; the same rule the dig spots needed fixing to obey |
| Rain crops | Grow only on rainy nights, never under glass; sprinklers do not count | Gives the weather a reason to be read, and the glass house its own trade-off |
| Sound | Synthesised in the webview from data recipes; the game only emits `sound` events | No files to ship or license, a pure and testable engine, and the host never plays anything |
| Audio start | Nothing until the first key press or click; nothing while the window is hidden | Browsers require a gesture; a game left in a background tab must be silent |
| Balance | An economy test with guard rails, changed in data | One price can no longer quietly make one way of earning swamp the others |
| Preferences | Lenient, field by field, with a default for anything missing or junk | A preferences file from any earlier version always opens |
