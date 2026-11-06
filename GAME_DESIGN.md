# Developer Farm — Game Design & Architecture

> **A cozy little world of your own.**

This is the central design document. It records what the game is meant to be, how it is built, the formats
that content and saves use, and honestly which parts exist yet. For the schedule and what to build next, see
[DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

The game is called **Developer Farm**. (An early draft of the design used another working title; it is not used anywhere.)

---

## 1. Identity and principles

A massive, expandable, single-player pixel-art farming and exploration world with hundreds of hours of
discoveries, played in an editor tab of VS Code. Farming, exploration, collecting, crafting, fishing,
animals, villagers, building and a living world, in one place that keeps revealing new things.

**Non-negotiable principles**

- **Single-player only.** No multiplayer, no co-op.
- **Offline-first.** Core gameplay never needs the internet, an account or a server.
- **Local saves.** Everything lives in files on the player's computer.
- **No tracking of any kind.** No coding-activity tracking, productivity rewards, telemetry or developer-session
  mechanics. The game is just a game. (Nothing in the extension reads the player's workspace or editor.)
- **No calendar dependence.** Seasons, festivals and events run on the game's own simulated calendar, never real dates.
- **No artificial grind.** Hundreds of hours should come from variety, discovery and creativity, and nothing should be
  mandatory every day.
- **Honest progress.** A system that is not finished is not presented as finished. No empty menus for features that
  do not exist.

## 2. Art direction

Detailed, colourful, charming pixel art in an **isometric-inspired 3/4 top-down** view. Cozy, nostalgic, magical,
detailed enough to reward exploration, consistent across world, characters, buildings, items and UI.

**Brand palette** (single source of truth: [`src/data/palette.json`](src/data/palette.json))

| Name | Hex | Used for |
| --- | --- | --- |
| Forest green | `#527B50` | foliage, UI framing |
| Sage green | `#8FAF69` | grass |
| Wheat gold | `#D9B76C` | farmhouse walls, straw hat, highlights |
| Terracotta | `#B97855` | roofs, clay |
| River blue | `#668FA1` | water, overalls |

Shadows lean cool and deep, highlights lean warm (see `ramp()` in `assets/src/color.mjs`), so shaded surfaces stay lively.

**UI** follows the same language: dark forest-green framing, wooden panels, golden parchment, pixel icons, warm
borders, clear typography (Pixelify Sans, an open-licence pixel font). The HUD never covers much of the world and can
be hidden entirely (`H`).

> **Visual references.** The brief mentions attached reference images. None were available in the repository when
> Phase 1 was built, so the look above follows the written direction and palette. Put the reference images in
> `docs/reference/` and the Phase 1 art should be revisited against them (see "Asset pipeline").

**Perspective decision.** The world is an orthogonal 3/4 top-down view on a 16 px grid, not true isometric. It reads as
"isometric-inspired", while collision, map authoring, autotiling and sprite art stay tractable at the scale this game
needs. Tall things (trees, the farmhouse) are drawn taller than their footprint and depth-sorted, so you walk behind them.

## 3. Architecture

```
┌──────────────────────────── VS Code ────────────────────────────┐
│ extension host (Node)                  webview (browser)        │
│ ┌────────────────────┐   messages     ┌────────────────────────┐│
│ │ FarmHost           │ ◄────────────► │ session (platform glue)││
│ │  validates every   │  typed,        │  keyboard, saves, HUD  ││
│ │  message           │  validated     │ ┌───────┐ ┌──────────┐ ││
│ │ FileSaveStore      │                │ │engine │ │renderer  │ ││
│ │  atomic files      │                │ │(pure) │ │(Pixi v8) │ ││
│ └────────────────────┘                │ └───────┘ └──────────┘ ││
│                                       │ React HUD (UI store)   ││
│                                       └────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**The simulation runs in the webview; the extension host is a thin platform adapter.** A 60 fps loop cannot cross
a message boundary, and this keeps the engine free of VS Code so it could become a standalone web or desktop game.
(The sibling `vscode-casino` project is host-authoritative because gambling needs integrity; a single-player farm
does not.) The host's whole job: keep files for the game, keep a local log, and refuse anything malformed.

### Source layout

| Folder | Role | May import |
| --- | --- | --- |
| `src/engine/` | The game: world, collision, player, camera, input, interaction, time, items, inventory, farming, economy, **path (A*), social (villagers, friendship, dialogue), ranch (animals), quests, conversations, nodes, fishing, mine (the generated floors), crafting, museum, digging, buildings**, persistence. **Pure TypeScript** — no `vscode`, no DOM, no Pixi. Tested in plain Node. | itself only |
| `src/data/` | Content as data: terrain, objects, items, crops, shops, villagers, animals, quests, nodes, fish, interiors, **recipes, museum, buildings**, regions, maps, palette. | `engine` types |
| `src/rendering/` | Draws a `Game` with Pixi v8: atlas, **one `MapView` per map** (chunked terrain, soil, crops, depth-sorted objects, rocks and ore, **objects placed later: furniture and buildings**), player view and tool swing, villagers and animals (`ActorLayer`), **the fishing line and timing bar**, cursor, particles, day-night light (or the steady light of a room or cave). Reads game state, never changes it. | `engine`, `pixi.js` |
| `src/ui/` | React HUD: banner, prompt, dialog with choices **and a villager's portrait and hearts**, hints, pause menu, debug, hotbar, clock and money, morning report, journal (quests, and a **collection** page with the museum) and quest tracker. Reads a small external store. | `engine` types, `rendering` helpers |
| `src/webview/` | The platform glue: host connection, storage backends, keyboard, and the **session** that wires everything together. | all of the above |
| `src/shared/` | The host ↔ webview message protocol, with runtime validation. No `vscode`, no DOM. | `engine` (storage key rule) |
| `src/extension/` | VS Code only: activation, the panel, the message bridge, file saves, logging. | `shared`, `engine/persistence` |
| `src/assets/generated/` | Output of the art pipeline (atlas, manifest, UI frames). Committed. | — |
| `assets/src/` | The art pipeline's sources (pixel-art generators). | — |
| `scripts/` | Build tooling (assets, extension bundle, dev loop). | — |
| `test/integration/` | End-to-end tests that run inside a real VS Code. | — |

Future systems (fishing, crafting, building, …) become new folders under `src/engine/`, each with its own data under
`src/data/`, following the suggested module list in the original brief. They are **not** created empty in advance.

### Data flow each frame

1. The renderer's ticker calls `game.frame(dt)`.
2. `Game` runs fixed 1/60 s simulation steps (`FixedStepLoop`), reading `InputState`; it returns an interpolation alpha.
3. The camera follows the *interpolated* player position (smooth at any refresh rate) and is snapped to whole device pixels.
4. The renderer culls and draws terrain chunks and objects, positions the player, animates water and smoke.
5. Events (`promptChanged`, `dialogChanged`, `statusChanged`, `hint`, `effect`, `daySummary`, `mapChanged`) go to the session, which writes the UI store; React re-renders only what changed. The renderer reads the farm's `version` and redraws soil and crops only when it changed, and swaps to another map's `MapView` when `game.map` changes (the last three are kept built, so walking back and forth across an exit costs nothing).

The simulation moves the same distance at 30, 60, 144 or 240 fps (tested).

## 4. Status of the systems

| System | Status |
| --- | --- |
| Viewport, camera, coordinates | ✅ Phase 1 |
| Chunked tile rendering, autotiled water/paths, animated water | ✅ Phase 1 |
| Player movement, collision (slide + corner assist), walk animation | ✅ Phase 1 |
| Data-driven world (terrain/object/map/region definitions, validation) | ✅ Phase 1 |
| Interaction + message box (signs, door, well, mailbox) | ✅ Phase 1 |
| Save foundation (versioned, checksummed, backup, recovery, migrations) | ✅ Phase 1 |
| HUD: banner, prompt, hints, pause menu, zoom, hide-HUD, debug overlay | ✅ Phase 1 |
| World clock, 28-day seasons, day-night tint, going to bed | ✅ Phase 2 |
| Items, 12-slot inventory, hotbar, money | ✅ Phase 2 |
| Tilling, planting, watering, growth, regrowth, withering, harvest, crop quality | ✅ Phase 2 |
| Shipping bin, honesty-box seed stall, morning report | ✅ Phase 2 |
| Villagers who walk their day between maps (A* paths, schedules as data) | ✅ Phase 3 |
| Dialogue by conditions, speaker portrait and hearts, chat and gifts, friendship rewards | ✅ Phase 3 |
| A pre-built chicken coop: feeding, eggs, petting, animal friendship | ✅ Phase 3 |
| Quests (ship, pick, deliver, collect, feed, visit, friendship) and the journal | ✅ Phase 3 |
| A staffed shop (opening hours, prices that vary, selling produce, buying animals) | ✅ Phase 3 |
| Map exits and a second map (the Village Green) | ✅ Phase 3 |
| Weather (deterministic by day), forecast, rain that waters fields, rain/snow/storm drawn | ✅ Phase 6 |
| The seasons' look (colour grading, autumn oaks) and a calendar page | ✅ Phase 6 |
| Four festivals with activities and prizes, a notice board of daily requests, a Sunday market | ✅ Phase 6 |
| Schedules by weather, weekday and festival | ✅ Phase 6 |
| Interiors (three buildings), villagers going home at night, steady indoor light | ✅ Phase 4 |
| The rest of the village (general store, two more villagers), the riverbank, Whispering Wood | ✅ Phase 4 |
| Region unlocks (a closed way turns the player back with a reason) | ✅ Phase 4 |
| Fishing: rod, timing mini-game, six fish by water, season and hour, a collection page | ✅ Phase 4 |
| The old mine: ten generated floors, a pickaxe, rocks and ore, ladders, a cave light | ✅ Phase 4 |
| The farmhouse inside: a bed to sleep in, a kitchen, a workbench | ✅ Phase 5 |
| Cooking and making: 13 recipes, some taught by friends; metal bars; dishes worth more than their ingredients | ✅ Phase 5 |
| Furniture: bought, placed and picked up in the farmhouse (and saved) | ✅ Phase 5 |
| A carpenter and a greenhouse: ordered, built over three nights, crops grow in any season under glass | ✅ Phase 5 |
| Archaeology: dig spots each day, six artifacts | ✅ Phase 5 |
| A museum with eighteen things to collect and six rewards | ✅ Phase 5 |
| Two new regions: Windcrest Heights (highland and a ruin) and Marlow Marsh (shallows, fen and a lodge), unlocked by quests | ✅ Phase 7 |
| Fertilizer, sprinklers and a crop that grows only in the rain | ✅ Phase 7 |
| Six rare creatures: seen by walking up quietly, befriended with a gift, kept in a bestiary | ✅ Phase 7 |
| Procedural sound: effects, backgrounds, a season's tune, volumes and mute | ✅ Phase 8 |
| Comfort: text size, contrast, calm motion; a balance test; performance guards | ✅ Phase 8 |

Home Farm's **north and south trails are blocked on purpose** with a fallen log and a sign, because the regions behind them
do not exist yet; a test checks they really are closed. The **east road is open**: it leaves the farm at the map's edge and
arrives on the Village Green (Phase 3).

## 4b. Farming, time and the economy (Phase 2)

**The day.** `WorldClock` runs from 6:00 am to 2:00 am (about 14 real minutes), only while the player is out in the world:
it stops for messages, menus, a hidden tab and the morning report. At 2:00 am the day ends by itself ("You stayed out far too
late and nodded off where you stood") and the player wakes at the farmhouse door; at the door they can also choose to go to
bed any time. The calendar (`src/engine/time/calendar.ts`) is the game's own: 28 days to a season, 4 seasons to a year.
`ambientColor(minutes)` gives the tint the renderer multiplies the world by: warm at dawn, clear by day, amber at dusk, blue
at night. It tints the world, never the HUD.

**The night.** `Game.endDay`: the shipping bin is paid for, every farm's crops grow, the soil dries, the can is refilled, the
player wakes at the door, and a morning report is shown (what sold, how many crops grew, are ripe, or withered).

**Items and pockets.** `ItemDef` is data (`src/data/items.ts`): tools (hoe, watering can), seeds, and crops. `Inventory` has 12
slots; stacks merge by item **and quality**, a full inventory refuses instead of dropping things, and loading drops items the
game no longer knows. The hotbar is the inventory: keys `1`–`0` for the first ten, `Q`/`R` or the wheel to cycle all twelve,
or click.

**Using things: one rule.** Everything done "to the thing in front of you" (reading a sign, swinging a hoe, picking a crop)
acts on the **cell in front of the player's cell** (`facingCell`), so where inside a cell you stand never matters, and the
green or red cursor shows exactly the cell the action will hit. `planUse` is a pure function that decides what an item would
do on a cell, with a reason when it cannot; the game calls it each step for the cursor and again when the swing lands.

| Item | On… | Effect |
| --- | --- | --- |
| Hoe | workable ground (inside a map's `tillable` area, free of objects) | tills it |
| Seeds | tilled, empty soil, in the crop's season | plants one |
| Watering can | tilled soil | waters it (1 water; the can holds 24) |
| Watering can | the pond, the river or the well | refills it |

`E` picks a ripe crop or uses what you face (door, sign, stall, bin). A failed action says why in plain language.

**Crops.** `CropDef` (`src/data/crops.ts`): `seasons`, `stageDays` (watered days per stage), `frames` (one per stage plus ripe),
optional `regrowStage`. Growth is counted in **watered days**, never real time, so it is identical everywhere and easy to test.
A crop still in the ground when its season ends **withers** (the soil stays worked). Picking a regrowing crop sends it back to
`regrowStage`. **Quality** (normal / good / excellent) is decided by `hash(cell, day)`, not by a random generator, so it never
needs saving; it changes the sale price (×1, ×1.25, ×1.5). A `luck` input exists for the mastery system to use later.

| Crop | Season | Days | Regrows | Sells | Seeds |
| --- | --- | --- | --- | --- | --- |
| Radish | spring | 6 | – | 40g | 5 for 50g |
| Strawberry | spring | 8 | every 4 | 60g | 3 for 90g |
| Tomato | summer | 11 | every 3 | 55g | 3 for 75g |
| Sunflower | summer, autumn | 8 | – | 80g | 5 for 100g |
| Pumpkin | autumn | 13 | – | 200g | 2 for 100g |
| Moonbloom | spring to autumn | 3 rainy nights | – | 320g | 2 for 220g (Fern's shelf) |

A test checks every crop sells for more than its seed costs, the stall only sells seeds for crops that can grow in the season
it sells them, and every spring crop ripens inside a season. Nothing grows in winter yet (greenhouses come in Phase 5).

**Money.** The shipping bin sells the selected whole stack and pays **in the morning**. The seed stall was an unattended honesty box
in Phase 2; since Phase 3 it has a keeper (Willa, see §4c) who sells at her stall during opening hours and buys produce on the
spot at a price that changes from day to day. Choices appear in the message box, unaffordable ones are greyed out and skipped by
the highlight.

**Choices in messages.** `DialogState` can carry options on its last page (go to bed, buy seeds). `↑/↓` move a highlight that
skips disabled options, `E` selects, a click works too; presses made while reading earlier pages are forgotten so they cannot
move the highlight when the choices appear.

## 4c. Villagers, animals and quests (Phase 3)

**Two maps.** Home Farm and the **Village Green** (`willowbrook.village_green`, 40 × 30: Willa's and Tobias's cottages, a
fountain, benches, signs, a grove around it). A map can list `exits`: rectangles of cells that send the player to a cell of
another map with a facing. Walking into one changes the map: a message box is closed, the camera snaps to the new map, a quick
fade plays, `visited:<map>` is set and quests hear about it. The arrival cell is never inside an exit, so nothing bounces you back;
every exit has a matching one on the other side (validated). Sleeping always wakes the player at the farmhouse door, wherever
they were.

**Villagers** (`src/data/npcs.ts`, `NpcDef`) have a home, a birthday, a **schedule** (`from` minute, map, cell, facing, and an
optional shop they mind), tastes (`loves`, `likes`, `dislikes`, `hates`), dialogue rules, gift reactions, friendship rewards
and the quests they give. Four exist (Phase 3 made two; §4d adds Hollis and June): **Willa Thorne**, the seed seller (she walks the east road each morning, crosses the
bridge and minds the stall on Home Farm from eight until five, then spends the evening by the fountain), and **Tobias Marsh**,
a retired miller (the bench, the bridge, the fountain, home).

- **Movement.** `findPath` (`src/engine/path/astar.ts`) is a 4-neighbour A* over the map's collision grid with no corner cutting.
  Villagers are really simulated only on the **player's map**. On any other map they are placed at the cell their schedule says;
  when a schedule sends someone to another map they hop one exit per update while nobody watches, and when the player is on the
  map they are walking to or from, they walk to the exit and appear on the far side, so the player sees them come down the road.
  A gap in the data never strands anyone (they are placed at their goal). Villagers are **solid for the player** (a step into one is
  undone, sliding along the axis that still works, and never when the player is already overlapping one, so nobody is trapped);
  they do not avoid the player, each other or the hens.
- **Talking.** `E` on a villager (they turn to face you) opens a greeting and a menu: *Chat*, *Give* the selected item, *Buy or
  sell* if they are minding a shop right now, hand over quest items, report a finished quest, and *Ask about* up to two quests
  that can be offered.
- **Dialogue is data.** A rule has an id, optional `when` conditions and lines; the first rule whose conditions hold wins, and a
  `once` rule is used one time. Conditions: `friendship` (hearts), `season`, `time`, `flag`, `quest` (a status), `firstMeeting`,
  `birthday`, and `not`. Adding things for a villager to say needs no engine change.
- **Friendship** is 0–1000 points, 100 to a heart. One chat a day gives 20. A gift is one per day and two per week (weeks count
  from day 1), and its reaction depends on the villager's tastes: loved +80, liked +45, neutral +20, disliked −20, hated −40; on
  their birthday kind gifts count four times. Only things you grew or collected can be given, not tools or seeds. At set hearts a
  villager hands over a reward (items or money) **once**, and only when the pockets have room, otherwise it waits.
- **The seed stall has a keeper.** `ShopDef.keeper` names who minds it; when that villager is at their post the stall's `E`
  speaks to them and *Buy or sell* opens the shop; when they are not, the stall says who is away and when they will be back.
  The shop buys produce at **today's price** (`buys.variance`; the multiplier is `hash(day, item)`, so it never needs saving and
  stays between 85 % and 115 %), and sells seeds by the season, chicken feed and chickens.

**The coop** is pre-built on Home Farm (`MapDef.ranch`: the fenced yard, a capacity of four, a trough that holds twelve scoops).
`AnimalDef` (`src/data/animals.ts`) names a product, a feed, a price and the frames. A hen wanders the yard (the pathfinder
again) and pecks. `E` on a hen pets her once a day (+15 friendship). Fill the trough with chicken feed (the trough's `E`); each
**night** a hen that found feed leaves one egg in the coop's basket (quality from friendship and `hash`, not a random
generator) and likes you a little more (+10); a hungry hen lays nothing and minds (−5). Collect the eggs at the coop (`E`).
Animals are bought at Willa's stall or earned from a quest; if the coop is full the stall says so and a quest pays money instead.

**Quests** (`src/data/quests.ts`, `QuestDef`) are authored. Objectives: `ship` (counted when the bin is paid for),
`harvest`, `deliver` an item to a villager, `collect` from the basket, `feed` (once per hen fed in a night), `visit` a map,
`friendship` (hearts). A quest is *none → active → ready → done*; a ready quest is reported to its giver, who pays money,
items, an animal (with a fallback sum if the coop is full), friendship and/or a story flag. Taking a quest primes objectives
that were already met (a map you have visited, hearts you have earned), so nothing is asked twice. Eight exist (four from Phase 3, four more in §4d). The first four:
*Welcome to the Green*, *A Good First Crop* (ship five radishes, paid in a hen), *A Feathered Friend* (feed and collect, unlocked
by the last), and Tobias's *Sweet on Strawberries*. The **journal** (`J`, or from the menu) lists what is open and what is done,
with progress and the reward; a small tracker under the clock says how many are open and when one is ready; the morning
report mentions eggs and ready quests. Quests never ask for the impossible: see Validation.

**One conversation layer.** `src/engine/conversations.ts` builds every dialog that has choices (bed, shop, villager, quest,
coop, trough) and carries each choice out; a choice has an id (`npc:chat:willa`, `buy:2`, `coop:collect`, …). `Game`
implements a small `ConversationHost` interface for it, so the dialog rules stay out of the game loop.

## 4d. Interiors, the wider valley, fishing and the old mine (Phase 4)

**Interiors are maps.** A building's door is an open cell in its footprint (walk into it); the cell is an `exit` to a small interior
map (`ambient: 'indoor'`: a steady warm lamp light that ignores the clock), whose own door in the bottom wall leads back out. Three
exist: Willa's and Tobias's cottages and Reed's General Store. Villagers' schedules name interior maps like any other, so Willa and
Tobias walk through their doors at nine in the evening and Hollis spends the night behind his counter; the pathfinder crosses as many
maps as the route needs (breadth-first over the map graph). Arriving by an exit shuts every exit to the player until they have let go
of the movement keys once, so a held key cannot carry them straight back out.

**The wider valley.** From the Village Green a trail runs south-west to **Silverbend** (the river, a dock, a bench, June at her post) and
a trail north to **Whispering Wood** (a pond, a clearing, and the mouth of the old mine in the rock). A new villager runs each: **Hollis
Reed** (storekeeper, open nine to five behind the counter, buys fish, ore and produce at a price that moves daily, sells the rod and the
pickaxe once each) and **June Hale** (an angler who is always by the water). Four more quests use all this (see Quests).

**Regions can be locked.** `RegionDef.unlock` is `always` or `conditions` (the same conditions dialogue uses) plus a message. A way
from one region into a locked one turns the player back with that message (said now and then, not every step); nothing else is
closed. Whispering Wood opens when *Gone Fishing* is done. Validation proves an unlock can be earned without entering the region.

**Fishing** (`src/engine/fishing`). The rod casts at **fishing water**: a water cell inside one of the map's `fishing` zones, each naming a
kind of water (`river`, `pond`, `wood_pond`). What can bite is `FishDef` data: its waters, seasons, hours (minutes on the game clock) and a
difficulty from 1 to 5. A cast is a small state machine, `FishingSession`, driven by the game (and a hash of the cell, the day and the
minute, so it never needs saving): *waiting* (two to eight seconds) → *bite* (a window of a second or less to press) → *reeling* (a
marker sweeps a bar; press while it is over the green sweet spot, which is narrower and faster for harder fish; the closer to the
middle, the better the fish) → caught, or it gets away. Walking away pulls the line in, except with a fish on the hook. Nothing is
ever lost to a failure; a catch with full pockets slips back. Six fish: minnow (everywhere, all year), perch, carp, trout, catfish (after
dark) and pike (only the wood pond). Every kind of water is guaranteed something that bites all year by day. Fish and minerals go in
the **collection** (journal, second page).

**The old mine** (`src/engine/mine`, `src/data/nodes.ts`). Ten floors, **generated deterministically** from the floor number (a cave
carved by cellular automata, made one connected region, with a ladder up and a ladder down against walls and arrival cells beside
them). `World` knows the `mine.floor_N` ids without them being in the content; each floor is built when first visited, kept for the rest
of the day (so broken rocks stay broken), and **forgotten every morning**, so every rock is whole again. Floors are validated like written maps (all ten, at every
start). Rocks and ore are **nodes** (`NodeDef`: frame, swings to break, drops with chances decided by a hash of the cell and the day):
solid while standing, they stop blocking the moment the last swing lands. Stone and copper from floor 1; coal from 3; iron from 5; quartz
from 7; amethyst from 9. The mine is lit by a dim cool cave light, ignores the clock (the day still ends at 2:00 am and you wake at home),
and the deepest floor reached is saved. There is no combat; the floors keep their secrets for later phases.

**Tools.** The rod and pickaxe are items with `tool: 'fishing_rod'` / `'pickaxe'`, used with `Space` on the cell in front like the hoe
(the cursor goes green over fishing water or a node). `planUse` decides, as before.

## 4e. The farmhouse, crafting, furniture, buildings and the museum (Phase 5)

**The farmhouse has an inside.** Its door is an open cell (an exit to `willowbrook.farmhouse`, `decorate: true`, indoor light). Inside are
the **bed** (`E` to turn in for the night; the morning begins at the door), the **kitchen** and the **workbench**. Sleeping at the door is
gone: the bed is the only way to end the day on purpose.

**Making things** (`src/engine/crafting`, `src/data/recipes.ts`). The kitchen and workbench open a menu of recipes, like a shop's: each is
a `RecipeDef` (station, ingredients, output). A choice is enabled when the pockets hold every ingredient (any quality, lowest used first)
and the result would fit once the ingredients are gone; a made thing is added at normal quality and counts for quests. A recipe can be
**taught** (`unlock`: the same conditions dialogue uses: hearts with a villager, a quest done) and stays off the menu until then, with
the kitchen saying there is more to learn. Thirteen exist: eight dishes at the kitchen (fried egg, radish salad, tomato soup, omelette,
and four taught by Tobias, Willa, June and a finished quest), and at the workbench copper and iron bars, a lantern, a vase and a
grandfather clock. A recipe's product is always worth at least a fifth more than what went in (validated), so cooking is a reason to keep a
few crops back.

**Furniture and placing** (`GameMap.addObject`/`removeObject`). Furniture is an item (`kind: 'furniture'`, `places: <object id>`). With one
selected in a `decorate` map, the cursor goes green over a free cell and `Space` puts it down; `E` on placed furniture picks it up again.
Buying (Hollis stocks seven kinds) and crafting (lantern, vase, clock) are the two ways to get it. A placed object is a `PlacedObject` with
its own uid: its solid cells block, its interaction works, it is drawn by `ExtrasLayer`, and only furniture is saved (`placed`, by map id).
`canPlace` refuses cells that are blocked, outside the map, a way out, the spawn, or taken. The same mechanism puts up buildings.

**The carpenter and the greenhouse** (`src/engine/buildings`, `src/data/buildings.ts`). **Bram Oakley** stands on the green and, if asked, builds
what `BuildingDef`s offer on a map's `sites`: the greenhouse costs 800g, 50 stone and 6 copper bars. Ordering takes the money and materials at
once, puts up **scaffolding** at the site, and sets the morning it is done (three nights later). At that morning the scaffolding is replaced by
the building and its **door** (a `BuildingDef.door` exit) opens on the farm, to `willowbrook.greenhouse`: a glass room with its own tillable
soil, two rain barrels to refill the can, and `sheltered: true`. **Under glass the seasons do not matter**: seeds can be planted in winter and
nothing withers when a season ends. Orders and finished buildings are saved (`buildings`); the farm is laid out afresh from them whenever it is built.

**Digging and the museum** (`src/engine/digging`, `src/engine/museum`). A map with `dig` hides a few things each day: deterministic cells (a hash of
the map and the day, among open walkable cells) show a **dig spot** (a mark on the ground you walk over), and the **hoe** uncovers it, giving
an artifact from the map's table (the farm meadow, the river bank and the wood each bury different ones). Six artifacts exist. The **museum**
(a building on the green with a curator, **Ines Calloway**, and display cases) takes one of each of 18 things (six fish, six minerals, six
artifacts), and pays a reward at 3, 6, 9, 12, 15 and 18 (gold, feed, a lantern, bars and quartz, and a grandfather clock at the end). Rewards
that do not fit in the pockets wait until they do. What is donated is saved (`museum`), and the journal's collection page marks it with a star.

**Quests** grew five new kinds of objective (`craft`, `place`, `build`, `donate`, `dig`) and five quests (*A Proper Meal*, *Make Yourself at Home*,
*Glass and Sunshine*, *First Finds*, *Buried Things*).

**What the review of Phase 4 changed.** Rocks broken and dig spots dug **today** are saved (`spent`), so closing the game cannot bring them
back; each water gives only a few bites a day (`FishingZone.stock`, default 6) so fishing cannot out-earn farming; a drop that does not fit
is never counted; and every reward (quests, friends, the museum) is checked against the pockets *as a whole*.

## 4f. Weather, the seasons, festivals, requests and the market (Phase 6)

**Weather** (`src/engine/weather`). `weatherOn(day, clearDays, seed)` gives `sun`, `cloud`, `rain`, `storm` or `snow` from `hash(day)` and a weight table per
season (`SEASON_WEATHER`: no snow outside winter, no rain in winter). Day 1 and every festival day are always sun. **Nothing about the weather is saved**: the same
day always gives the same sky, and the forecast is simply tomorrow's answer (`game.weather`, `game.forecast`). What it does:

- Rain and storms **water every outdoor field overnight** (`Farm.waterAll`; the morning report says so). A glass house (`MapDef.sheltered`) is never rained on.
- Fishing: two more bites per water on a rainy or stormy day, on top of the daily stock.
- The light: `dimming(weather)` multiplies the daylight (storms darkest, cloud and snow a little).
- The HUD: today's weather and tomorrow's as small icons under the clock; the morning report says what the night did and what tomorrow brings.
- Schedules: see below.

**Schedules by weather and weekday.** `ScheduleEntry` may have `when` (`rain`, meaning rain or storm, or `dry`) and `days` (0 = Monday … 6 = Sunday), and a map named
`AWAY` ("not in the valley today"). The entry in force is the last one that has started *and applies today*; two entries may share a minute only if the later one is
conditional, and the first entry of a schedule must apply every day (the validator checks both). The day's kind (`DayContext`: rainy, weekday, festival) is set each
morning (`Villagers.setDay`). In the shipped data **Tobias stays in his cottage on rainy days and Bram works in the general store**; shopkeepers never move for the weather
(a test asserts it), so a shop is not closed by the sky alone. A closed stall says when it will next open: later today, tomorrow, or the weekday it next keeps hours ("Back on Sunday at 8:00 am", or "perhaps back" when only the weather decides). The validator forbids a shopkeeper any weather-dependent entry.

**The seasons' look** is colour, not new ground. The outdoor daylight is multiplied by a season colour (fresh spring, warm summer, amber autumn, cool pale winter) in
`AmbientLight`, and an object can list frames to use in a season (`ObjectDef.seasonal`): the oaks turn in autumn. The renderer redraws its maps when the season changes.
There is no snow lying on the ground and no seasonal grass.

**Weather drawn** (`WeatherLayer`): rain streaks, a denser storm with an occasional flash, and drifting snow, in screen space and sized in art pixels so they match the
world at any zoom. Only outdoors (not inside, in the mine, or from within the glass house). With reduced motion nothing falls or flashes; the dimmer light and the
icon still say what the weather is.

**Festivals** (`src/engine/festivals`, `src/data/festivals.ts`): four, one a season, each with a host who runs it from a spot on the map.

| Festival | When | Where | Activity |
| --- | --- | --- | --- |
| The Egg Hunt | spring 13, 9:00–17:00 | Village Green, host Willa | Eight painted eggs are hidden in the grass (the same cells all day and after a reload); stepping on one picks it up |
| The Silverbend Fishing Contest | summer 11, 9:00–17:00 | the riverbank, host June | Every fish landed on the riverbank counts |
| The Harvest Fair | autumn 16, 10:00–18:00 | Village Green, host Tobias | One entry: the best of what you hold of the selected item, scored by its price and quality |
| Lantern Night | winter 25, 18:00–22:00 | Village Green, host Ines | Speak to each villager once; each word counts, and warms them 20 more |

While a festival is open, the villagers it names stand where `places` says (their usual day is overridden). The player's score is compared with three rivals drawn from
the festival and the day (`rivalScores`, so a reload cannot reroll them); the rank picks a prize row (`prizeFor`), and the host hands it over **once** after "Ask how you
did", only if the pockets can take all of it (`canAddAll`). Activities only count while the festival is open, but the prize can be asked for at any time after it has begun until bedtime (once it has closed, the host answers wherever they are found); a prize still unclaimed when the day ends is brought round in the night (the money always, the items if they fit) and the morning report says so, so nothing taken is ever left unpaid. Progress is saved for the day it belongs to and forgotten the next morning. Eggs are drawn by `TokenLayer` and are never hidden under someone who stands in one place all day. Lantern Night hangs lanterns (`FestivalDef.decorations`: ordinary objects put up while it is open and taken down when it closes; one waits until nobody is standing on its cell); the other festivals have no decorations yet.

**The notice board** (`src/engine/requests`, `src/data/requests.ts`) stands on the green by the road from the farm. It shows **three requests a day**, the same all day and after a
reload (the day seeds the draw; ids are `req:<day>:<slot>`), each from a villager and drawn from a validated pool (items obtainable in the season they are asked for, paying
at least the item's sale price and at most three times it). Handing one in takes the items, pays the gold (+5 % per heart), and the giver gains 15 friendship; each is done
once a day and the record is saved for the day.

**Market day.** Rowan Ash, a travelling merchant, is in the valley on Sundays from 8:00 to 18:00, standing behind his cart on the green (his schedule has `days: [6]` and the
rest of the week `AWAY`). He sells every seed in every season, at about four tenths over Willa's price (a glass house is what makes that worth it), and buys goods at prices that move by
up to 20 % a day.

**The calendar** is a page of the journal: this season in four weeks with today ringed, festivals and birthdays marked, market days shaded, the next four things coming up, and
the game's year. It is built from the content (`src/engine/time/agenda.ts`), never from a real clock.

**What the review of Phase 5 changed.** A rug could never be placed (it had no footprint): it now lies under furniture on its own layer. Dig spots were laid out differently
after a reload than live (leftover spots changed the pool): they are the same either way now. Quests that ask for a building, a donation or furniture count what was done
*before* the quest was taken up, and "Make Yourself at Home" counts the furniture out now rather than the number of placements. Furniture is never put down on a cell the
player's feet or a villager occupy, and a saved piece of furniture is only put back as furniture, in a room made for it. The museum remembers a paid reward by the number of
displays that earned it, not by its place in the list.

## 4g. Windcrest, Marlow, magical farming and rare creatures (Phase 7)

**Two new regions**, behind the farm's two trails (the fallen logs are gone; each region turns the player back at its first exit with a reason until it is earned, like the wood):

- **Windcrest Heights** (north trail; opens when *Buried Things* is done): a windswept highland meadow with a tarn, ore outcrops, standing stones and four open clearings, and a flagstone ruin to the north with a broken courtyard and an arch into an inner yard.
- **Marlow Marsh** (south trail; opens when *Gone Fishing* and *First Finds* are done): the shallows (pools, reed beds, boardwalks, Fern's stilted lodge), and the fen beyond them, wetter and wilder. Fern's lodge has an interior.

Both have dig spots, fishing (the existing `pond` water), and plenty of open ground. Their ground is new (`highland_grass`, `marsh_grass`, `ruin_floor`) and so are their things (birches, standing stones, ruin walls, pillars and an arch, cairns, boardwalk planks, heather and reeds, the lodge): all data in `src/data/expansion.ts`.

**Fertilizer.** A supply (`ItemDef.fertilizes`), made at the workbench from two chicken feed and a stone (two come out), or bought at Fern's. Used on tilled soil it enriches it (`SoilCell.fertilized`, a slightly darker, warmer earth): the harvest's luck goes up by 0.3, a good one four times in ten instead of one in ten (`FERTILIZER_LUCK`, the same hash dice as ever, so it is never saved or rerolled). It lasts as long as the crop in the soil: gone when the last harvest or a withering takes the crop, kept through a strawberry's or tomato's regrowing.

**Sprinklers.** A placeable object (`ObjectDef.sprinkles`, the radius) made at the workbench from a copper bar and an iron bar. They go down with the use key on bare ground inside the field (never on tilled soil, never indoors), are picked up with `E` like furniture, are saved with the furniture, and every night water the tilled soil in the eight cells around them, on any map, whether or not the player is there, and in the greenhouse too.

**Moonbloom** is a crop that grows only on nights it rains (`CropDef.needsRain`): watering by can or sprinkler is not enough, a glass house is never rained on, it grows in spring, summer and autumn, ripens after three rainy nights, and sells for 320. The seeds are Fern's, or the reward for befriending a creature.

**Rare creatures** (`src/engine/creatures`, `src/data/creatures.ts`): six, each about only in the weather, season and hours its data names, on only some days (`chance`), and on one of its maps: a **fen heron** (cloudy or rainy mornings), a **kingfisher** (fine summer mornings), a **moon moth** (after dark, in the fen), a **mountain hare** (winter, on the heights), a **ruin owl** (nights, in the ruin) and a **white stag** (only in autumn rain or storms, on the heights: the rarest thing in the game). Where one stands is a pure function of the day and the map (`placeCreatures`), like dig spots: **never saved**, and a reload puts it exactly back. A creature is **seen** when the player stands within three cells of it and is not running (so it enters the journal; running never sees anything); the bestiary page of the journal then shows what it is, where and when it is about, and what it likes. Face a *seen* creature with something it likes selected and use it: the gift is taken (once, never before it has been seen, never from a friend), the creature becomes a **friend**, and leaves a keepsake (a feather, a pinch of moth dust, a tuft of fur, an antler) if the pockets have room; if they do not, nothing is taken. `E` on a creature says what the journal says. Seen and friends are saved (`bestiary`); creatures are not solid.

**What the review of Phase 7 changed.** A rain crop no longer grows under glass (it did, on any rainy night), and moonbloom seeds are refused in a glass house. Rocks on written maps (the heights have ore veins) come back every morning without closing the game, and creatures and eggs are placed as if every rock were still there, so a reload after mining cannot move one. Creatures and eggs are never put where a tree crown or a roof would hide them (`GameMap.isOverhung`, now measured from the picture's anchor correctly for tall buildings). Quests that ask to see or befriend creatures count those already seen and befriended; the journal's Creatures page updates the moment one is seen; fertilizer goes with a withering crop; sprinklers are not counted as furniture in the farmhouse; dig spots never lie on a boardwalk; a creature must be about at some time after six in the morning to be meetable; and the white stag walks the heights in any autumn rain or storm (it was storms only, which came about once in two years).

**Fern Alder**, the naturalist in the marsh lodge, keeps a shelf (moonbloom seeds, fertilizer) and gives three quests (*Field Notes*: see three creatures; *A Gentle Friend*: befriend one; *The Moonlight Crop*: pick three moonblooms), with two new objective kinds (`see`, `befriend`, tracked as levels like hearts). Ines has a new quest, *Echoes in Stone*, that takes the player up to the ruin.

## 4h. Sound, comfort, balance and speed (Phase 8)

**Sound is made, not shipped.** Every sound is synthesised in the webview with the Web Audio API from data recipes (`src/data/sounds.ts`): 29 short sounds (a hoe's thud, a trickle of water, a coin, three kinds of footstep, a door, a lullaby when the day ends, thunder, a chime for something found, a fanfare for a prize, ...) and 9 backgrounds that are looped, filtered noise (breeze or wind by day, rain or a storm, a hush under snow, crickets on a summer night, the sound of water near it, a low hum indoors, a cave's drone) chosen from the weather, the season, the hour and the place by a pure function (`bedsFor`). A slow tune per season (`tuneFor`: a different scale and tempo each, generated from the bar number, so it is the same on every machine) plays about a third of the time, with long silences between phrases. Nothing is a file and nothing is fetched. The pure part is `src/engine/audio` and the recipes; the Web Audio part is `src/webview/audio/engine.ts`, written against a minimal context interface so it is tested in plain Node with a fake.

The rules: nothing plays until the player has pressed a key or clicked (browsers do not allow it sooner); nothing plays while the window is hidden or has lost focus (a menu or the journal keeps its background and its clicks); the master volume and the mute are always honoured; and nothing here may throw if audio is missing. The game only *asks* for sounds: `Game` emits a `sound { id }` event (a footstep when a foot lands, by what is underfoot; a coin when money comes in; a bite, a reel and a catch; a discovery; a prize; the lullaby; the little ticks of the message box), `effect` events map to their sounds (`soundForEffect`), a map change is a door, and lightning in the weather layer is thunder. Volumes (master, effects, ambience, music) and a mute are in the pause menu and saved with the preferences.

**Comfort.** The pause menu has a *Text* size (normal or large), a *Contrast* switch (black ink on the parchment, white on the wood, stronger focus rings) and a *Motion* choice: *System* (follow the computer's reduced-motion setting), *Calm* (rain, snow, lightning, bobbing and sparkles off) or *Full*. All of it is saved. The interface was already built from real buttons, labelled slots and `role`s; the long menu now scrolls in a short window. **Not done:** rebinding keys (the keymap is data and ready for it, but there is no screen), a screen reader pass beyond labels, and colour-blind palettes.

**Balance** is now a test (`src/data/economy.test.ts`) that works the economy out from the data and holds it between guard rails. A field of forty plants earns 300 to 1,000 gold a day in any season something grows outdoors; one mine floor is worth at most two days of that and the whole mine at most a dozen; a day at the water never beats half a day on the farm; cooking and smelting pay 1.2 to 2.5 times their ingredients; every seed costs less than its crop; a prize is at most a day and a half of farming. The numbers moved in this phase: ore, coal, crystals and bars about 40 % cheaper (so mining no longer out-earns everything), fish a fifth to a quarter cheaper, five bites a water a day instead of six, and pumpkins and pumpkin pie dearer (autumn was the poor season).

**What the review of Phase 8 changed.** The pause menu could not be used from the keyboard (the game swallowed the arrow, Enter and Space keys everywhere): inside the menu and the journal only the interface's own keys are taken now, and the sliders and buttons use theirs. Requests had not been rescaled with the price cuts (a request for coal paid two and a half times the bin): they pay at most 1.5 times it now, and a test says so. The Harvest Fair's rivals range 25 to 90 so that one good dish no longer always wins. Thunder is heard in Calm mode and indoors (only the flash is a picture), the sound's unlock listeners stay on for the whole session, the journal's click plays only when it really opens, footsteps are data on the terrain (`TerrainDef.footstep`) and not terrain ids in code, the high-contrast focus ring shows on parchment, and the Calm choice quiets the interface's own animations too and follows the computer's setting live.

**Speed.** The simulation costs about 0.005 ms a frame on the busiest maps (a guard test allows 0.5 ms), the renderer ran above 200 frames a second on the busiest scene (Lantern Night with a crowd and lanterns) in the browser pane, and a game starts in a few milliseconds, so no optimisation was needed beyond the caches the earlier phases already had. `game.ts` was split: the weather, festivals and notice board, and the creatures and sprinklers, each live in their own class behind the same public API.

## 5. World content: formats

Content is plain, typed data (`src/engine/world/types.ts`). A new region or object is data, not engine code.

### Terrain (`src/data/terrain.ts`)

`TerrainDef`: `id`, `glyph` (one character used in ASCII maps), `render` (`base` or `autotile`), `frames` (atlas stem),
`variants`, `animationFrames`/`animationFps`, `solid`, `opaque`, optional `waterSource` (the can can be refilled here).

- `base` terrain (grass) fills the cell and picks a variant by cell hash.
- `autotile` terrain (dirt path, water) is drawn **over grass** and shapes itself to its 8 neighbours: 47 distinct
  shapes (`CANONICAL_MASKS`). Where it ends, it is transparent and the grass shows through, so any shape of path or
  pond uses one set of frames. Map edges count as connected.

### Objects (`src/data/objects.ts`)

`ObjectDef`: `id`, `name`, `layer`, `frames` (or `connect` for fences), `anchor`, `footprint`, optional `shadow`,
`interact`, `smoke`, `waterSource`.

- `layer`: `ground` decals are painted into terrain chunks; `floor` objects lie under everything (a bridge);
  `standing` objects are depth-sorted with the player.
- `anchor` is where the **anchor cell's top-left** sits inside the sprite, in pixels. The anchor cell is the
  bottom-left cell of the footprint, so a sprite grows up and to the right from where it is placed.
- `footprint`: cells relative to the anchor, each `solid` (blocks) or `open` (walkable even over water: a bridge).
  A sprite can be taller than its footprint: the farmhouse blocks four rows and its roof peak overlaps the row behind it.
- `connect`: fences pick `framePrefix + mask` from their 4 neighbours in the same group.
- `interact`: `verb`, `title`, `lines` (pages), optional `cells` (defaults to the solid footprint), optional `action`
  (`sleep`, `shop` with a shop id, or `ship`). The farmhouse is only interactable at its door cell.

### Maps (`src/data/regions/<region>/<map>.ts`)

A `MapDef` has two ASCII layers you can edit by hand, plus a legend and scatter rules.

```
terrain   .  grass     d  dirt path     ~  water
props     .  nothing   T/P oak/pine   b/B bush/berry bush   r/m rock   s stump   f fence
          H farmhouse  W well  M mailbox  =  bridge  X shipping bin  K seed stall
          F/N/S/E signs   L/l fallen logs   O rockslide
```

`scatter` rules sprinkle ground decals (flowers, tufts, pebbles, mushrooms) over matching terrain, deterministically by
seed, optionally limited to an `area`; they never land in a `tillable` area, so the field is clean. `tillable` lists the
rectangles of cells where the soil can be worked (Home Farm: the 15 × 13 fenced field west of the south trail). `spawn` is a
cell plus a facing.

Home Farm (`willowbrook.home_farm`) is 64 × 48 cells: the farmhouse, well, mailbox, shipping bin, seed stall, a fenced field, a
two-lane road over a wooden bridge, a river and a pond, groves and a forest edge, and four closed trails.

### Items, crops, shops and the new-game kit

`ItemDef` (`id`, `name`, `description`, `kind`, `icon`, `maxStack`, `sellPrice`, `tool`, `plants`), `CropDef` (above), `ShopDef`
(`id`, `name`, `offers[]` of `item`, `quantity`, `price`, optional `seasons`) and `Content.newGame` (`money`, `items[]`) are plain
data in `src/data`. Adding a crop is: an item for the seed, an item for the produce, a `CropDef`, a shop offer, and the frames.

### Villagers, animals, quests, exits and the coop (Phase 3)

- `NpcDef` (`src/engine/social/types.ts`): `id`, `name`, `role`, `about`, `sprite` (frame stem under `char/`), `home` (a map), `birthday`
  (`season`, `day`), `schedule[]` (`from`, `map`, `x`, `y`, `facing?`, `serves?`), `tastes`, `greetings[]`, `chats[]`,
  `reactions` (`loved`…`hated`), `birthdayThanks`, `rewards[]` (`hearts`, `message`, `items?`, `money?`) and `quests[]` (ids).
  Schedules are in order of `from`; the first starts at or before 6:00 am. Times are minutes since midnight.
- `AnimalDef`: `id`, `name`, `product`, `feed`, `price`, `names[]` (given in turn), `sprite` (stem; see the frame contract).
- `QuestDef` (`src/engine/quests/types.ts`): `id`, `title`, `giver`, `summary`, `offer[]`, `accepted`, `done[]`, optional `requires`
  (conditions), `objectives[]`, `rewards`.
- `ShopDef`: `id`, `name`, optional `keeper` (a villager), `offers[]` (an `item` **or** an `animal`, `quantity`, `price`,
  `seasons?`) and optional `buys: { variance }` (the shop buys produce).
- `MapDef.exits[]`: a cell rectangle plus `to: { map, x, y, facing }`. `MapDef.ranch`: `yard` (a rectangle), `capacity`,
  `troughCapacity`. Objects can have the actions `coop` and `trough`, which need a `ranch` on their map.
- Map legend additions: `Q` coop (3 cells wide), `v` trough, `C`/`G` cottages, `U` fountain, `h` bench, `Z`/`z` signs.

### Interiors, nodes, fish and fishing zones (Phase 4)

- `MapDef.ambient`: `outdoor` (default, follows the clock), `indoor` or `cave` (a steady light). `MapDef.nodes[]`: `{ x, y, def }` rocks the
  map starts with. `MapDef.fishing[]`: `{ x, y, w, h, water }` zones; fishing needs a water terrain cell inside one.
- `NodeDef` (`src/engine/nodes/types.ts`): `id`, `name`, `frame` (`node/<id>`), `tool: 'pickaxe'`, `hits`, `drops[]` (`item`, `min`, `max`,
  `chance`; one drop must always appear).
- `FishDef` (`src/engine/fishing/types.ts`): `id`, `name`, `item`, `waters[]`, `seasons[]`, `from`, `to`, `difficulty` (1–5), `weight`.
- `ItemDef.kind` adds `fish` and `mineral`; crops, fish and minerals are all **goods** (shippable, sellable to a shop that buys, giftable).
  `ShopOffer.once` marks a one-off tool, offered again only while the player does not hold one.
- `RegionDef.unlock`: `{ kind: 'always' }` or `{ kind: 'conditions', all: Condition[], message }`.
- Quest objectives add `catch` (a count, optionally of one fish) and `mine` (a count of an item dug out of nodes).
- Terrain additions: `wood_floor` (`_`), `plaster_wall` (`#`, solid), `cave_floor` (`,`), `cave_wall` (`%`, solid): plain base tiles.

### Recipes, buildings, the museum and digging (Phase 5)

- `RecipeDef` (`src/engine/crafting/types.ts`): `id`, `name`, `station` (`kitchen` | `workbench`), `description`, `inputs[]` (`item`, `count`), `output`
  (`item`, `count`), optional `unlock { all: Condition[], hint }`.
- `BuildingDef` (`src/engine/buildings/types.ts`): `id`, `name`, `description`, `object`, `scaffolding`, `cost { money, items[], days }`, `door` (an
  `ExitDef` on the map that holds the site). `MapDef.sites[]`: `{ id, building, x, y }`, the anchor cell of the building.
- `MuseumDef` (`src/engine/museum/types.ts`): `slots[]` (`item`, `section`), `milestones[]` (`count`, `message`, `reward`). `Content.museum` is optional.
- `MapDef.sheltered` (crops ignore the seasons), `MapDef.decorate` (furniture may be placed), `MapDef.dig { areas[], count, artifacts[] }`.
- `ItemDef.kind` adds `dish`, `material`, `artifact`, `furniture`; goods are crops, fish, minerals, artifacts, dishes and materials. `ItemDef.places`
  names the object a furniture item puts down. `NodeDef.tool` may be `hoe` and `NodeDef.solid` may be false (the dig spot).
- Interact actions add `craft { station }`, `museum` and `bed`. `NpcDef.carpenter` marks a villager who builds.
- Terrain additions: `greenhouse_floor` (`g`), `glass_wall` (`w`, solid), `marble_floor` (`m`).

### Weather, festivals, requests and schedules (Phase 6)

- `ScheduleEntry` adds `when` (`rain` | `dry`) and `days` (weekdays, 0 = Monday); `map: 'away'` (`AWAY`) means not in the valley. `NpcDef.schedule` rules are in GAME_DESIGN §4f.
- `FestivalDef` (`src/engine/festivals/types.ts`): `id`, `name`, `season`, `day` (1–28), `map`, `from`, `to` (minutes), `host`, `places[]` (`npc`, `x`, `y`, `facing?`), `huntAreas?`, `decorations?[]` (`object`, `x`, `y`), `intro[]`,
  `rivals { count, min, max }`, `activity` (`hunt { tokens }` | `fishing-contest` | `harvest-fair { priceStep }` | `lantern-night { bonus }`), `prizes[]` (`rank`, `money`, `items?`, `message`: rows rise from rank 1; the last also covers every worse place).
- `RequestPool` (`src/engine/requests/types.ts`): `givers[]` (villagers) and `offers[]` (`item`, `min`, `max`, `seasons?`, `pay` per piece).
- `ObjectDef.seasonal?`: frames drawn instead of `frames` in a season. Interact actions add `board` (the notice board). `Content` gains `festivals` and `requests`.
- Map legend additions on the green: `Y` notice board (two cells), `K` Rowan's cart (three cells).

### Regions, creatures, fertilizer and sprinklers (Phase 7)

- `CreatureDef` (`src/engine/creatures/types.ts`): `id`, `name`, `description`, `sprite` (frames `creature/<sprite>_0` and `_1`, 16 x 16, drawn facing right), `maps[]`, `seasons[]`, `weather[]`, `from`, `to` (minutes), `chance` (0 to 1), `likes[]` (goods) and `keepsake { item, count }`. `Content.creatures`; the bestiary saves what is seen and who is a friend.
- `ItemDef.fertilizes` (a supply that enriches tilled soil), `ObjectDef.sprinkles` (the radius, in cells, of a sprinkler's nightly watering), `CropDef.needsRain` (grows only on rainy nights).
- Quest objectives add `see { count }` and `befriend { count }`. `UseEffect` adds `fertilize` and `befriend`; `UseContext.creatureAt` lets the cursor and the swing agree on what a gift to a creature would do.
- Terrain: `highland_grass` (`;`), `marsh_grass` (`:`), `ruin_floor` (`+`), plain base tiles with four variants each.

### Regions and content packs

`RegionDef` (`id`, `name`, `description`, `biome`, `unlock`, `startMap`) groups maps. `unlock` is a discriminated union
that currently has one member (`always`); quests, tools and seasons will be added as new members when those systems
exist. A content pack is a `Content` value (`terrains`, `objects`, `regions`, `maps`, `startMap`); `src/data/content.ts`
assembles the shipped one. Expansions will export their own.

### Validation (`validateContent`)

Runs in `npm test` **and at every start** of the game. It rejects: duplicate ids, unknown references, rows of the wrong
length, unknown glyphs, footprints off the map, overlapping solid objects, objects standing in water, a spawn that is not
walkable, interactables that cannot be reached from the spawn, frames missing from the atlas, **crops with the wrong number of
stage pictures or a seed that does not plant them, shops selling unknown items or at no price, a new-game kit that does not fit
in the pockets, and a farmable map with no reachable soil or no water to refill the can from**; and, from Phase 3, **villagers
whose schedule goes to a map that does not exist or is out of order, who serve a shop that does not name them, or whose dialogue
ids repeat; quests that ask for an item nobody can get, a crop out of season, a map that cannot be reached through the exits, a
collection with no animal that makes the product, or feeding with no coop; shops that sell an item and an animal at once; exits
that do not fit the map, lead nowhere, land on a blocked cell or inside another exit, or have no way back; and a coop with no yard
room, no trough, or objects that need a coop on a map that has none**; and, from Phase 4, **nodes with no drop that always
appears or that drop unknown items, fish that live in water no map lets you fish in, that live in no season or bite outside the day,
water with no fish that bites all year by day, fishing zones that do not fit or have no water to stand beside, nodes standing in walls
or on objects, an unlock that cannot be earned without going in (or a region with none that can be reached), quests that ask for a
catch with no reachable water or no rod on sale, or a dig for something no mine floor has, and one-off offers that are not tools;
the ten mine floors are checked as if they had been written by hand**; and, from Phase 5, **recipes that need or make unknown items, ingredients nobody
can get, a station that no map has, or a product worth less than 120 % of its ingredients; buildings with no site (or two), a site where the
scaffolding or the building does not fit, a door that is not on an open cell of the building or has no way in; dig spots with too few places
to dig, buried items that are not artifacts, and artifacts that nothing buries; a museum that wants something nobody can get, lists a thing
twice, has rewards out of order or no display case on any map; furniture that places nothing; quests that ask for something no recipe makes, a
donation count beyond the museum, a building nobody can build, or furniture with nowhere to put it; and a villager who likes something that can
never be given as a gift**. The goal is the brief's
rule: *the system must avoid generating impossible quests or inaccessible rewards.* A map is only valid if it can be played.

## 6. Coordinates and rendering

- **Tile** coordinates are integer cells. **World** coordinates are pixels at 1× (`world = tile × 16`); the whole
  simulation lives here. **Screen** coordinates are logical pixels (`(world − camera) × zoom`); only the renderer and HUD use them.
- **Crisp pixels.** One art pixel always covers a whole number of *device* pixels (`crispScale`): the camera and every
  sprite are snapped, nearest-neighbour filtering is used, and the atlas has edge-extruded padding. On a 1.25× display, a
  zoom of 3 becomes 4 device pixels per art pixel instead of shimmering at 3.75.
- **Zoom.** Auto picks a whole zoom (2–5) for about 18 × 12 visible cells; `+`/`−` or the menu pick 1–6. Saved as a preference.
- **Chunks.** Terrain is cut into 16 × 16 cell chunks, built the first time they are in view, hidden when out of view, and
  freed least-recently-seen-first beyond 48 built. Each chunk is a render group, so a static chunk costs almost nothing.
- **Objects** are culled against the view (with a margin for tall sprites); depth sort is `zIndex = bottom of the footprint`,
  with the player's feet as their key.
- **Farming layers.** Tilled soil (autotiled like terrain, dry or wet) and crops are rebuilt only when the farm's `version`
  changes. Crops join the depth-sorted layer, so you walk behind a tall sunflower and in front of a seedling. A cursor shows the
  cell in front of you (green if the item would work, red if not); small 2 × 2 pixel particles burst on tilling, watering,
  planting, picking and shipping.
- **Time of day.** One screen-sized sprite multiplies the world by the ambient colour.
- **Tool swing.** The farmer's standing picture plus the tool moved through three poses and a one-pixel lean. It reads as a
  swing without new character art; proper swing frames are a later art job.
- **Animation.** Water has 4 frames per tile (2 variants), each tile phase-shifted; smoke puffs rise from chimneys. Both stop
  with the game when paused. `prefers-reduced-motion` freezes water, smoke, particles and the cursor and arrow bobbing.
- **No `eval`.** The webview's policy forbids it, so the renderer imports `pixi.js/unsafe-eval` (Pixi's eval-free shader
  paths), and the atlas loads through a plain `<img>`; nothing is fetched. A test launches the real extension and asserts
  zero policy violations.

## 7. Input and controls

Input devices map to **actions** through a keymap, so the game never reads raw keys and remapping is swapping a table
(`DEFAULT_KEYMAP`). Codes are `KeyboardEvent.code` values plus `Mouse0`, `WheelUp` and `WheelDown`, which the page feeds in as if
they were keys. Remapping UI is planned for Phase 8; the structure is ready now.

| Action | Keys |
| --- | --- |
| Move | `W A S D` / arrows |
| Run | `Shift` |
| Use the selected item on the cell in front (hoe, can, seeds, rod, pickaxe; **furniture is put down**; the hoe also **digs up a dig spot**) | `Space` / click |
| Look, pick a ripe crop, talk to a villager, pet a hen, use what you face (cook, make, give to the museum), pick furniture up | `E` / `Enter` |
| Choose an item | `1`–`0`, `Q` / `R`, mouse wheel, or click a slot |
| In a message with choices | `↑` / `↓`, then `E` |
| Menu (also closes a message box first) | `Esc` |
| Journal (quests, collection) | `J` |
| Zoom | `+` / `−` |
| Hide the HUD | `H` |
| Debug overlay | `F3` |

Keys with Ctrl, Cmd or Alt are never swallowed, so VS Code's own shortcuts keep working. The game pauses itself when the
window loses focus or the tab is hidden, and a click brings it back.

## 8. Save structure

Saves are plain JSON files in the extension's global storage, on the player's computer
(`<VS Code user data>/globalStorage/thesulce.developer-farm/saves/`). They were chosen over `globalState` because game saves
will grow, and files allow atomic writes, a backup, recovery, and later export/import.

| File | Contents |
| --- | --- |
| `slot-1.json` | the current save |
| `slot-1.backup.json` | the previous good save (made before every write, only if the current one is valid) |
| `slot-1.damaged-<time>.json` | a save that could not be read, kept rather than deleted |
| `preferences.json` | zoom, HUD visibility, hints dismissed (separate, so a new game never resets them) |

**Envelope** (`SaveEnvelope`): `format: "developer-farm-save"`, `version`, `savedAt`, `checksum` (FNV-1a of the serialised
state, to catch cut-off or hand-edited files), `state`.

**State v7** (`GameSaveState`): `mapId`, `player { x, y, facing }`, `playTimeMs`, `time { day, minutes }`, `money`,
`inventory { slots[], selected, canWater }`, `bin[]` (what is waiting to be paid for), `farms` (worked soil and growing crops,
by map id, so maps that are not loaded yet keep theirs), and, new in v3, `npcs` (by villager id: friendship, met, last chat and gift
days, gifts this week, rewards already handed over, one-time lines used), `ranches` (by map id: each animal's id, kind, name,
friendship, last petted and fed day; the trough's feed; the egg basket), `quests` (id, status, progress per objective) and
`flags`. **v4** adds `collection` (item id → how many fish and minerals the player has caught or dug up) and `mine { deepest }` (the deepest floor reached). **v5** adds `placed` (furniture by map id: object and anchor cell), `buildings { built[], pending[] }` (finished buildings, and orders with the morning each is ready), `museum { donated[], claimed[] }` and `spent { day, cells, fished }` (what was used up *today*: rocks broken and spots dug, as cells per map, and bites per water, so reloading cannot bring them back). **v6** adds `festival { day, score, found[], entered, talked[], claimed }` (how the player is doing at *today's* festival: eggs found as cells, fish landed, the entry's score, villagers spoken to, and whether the prize was taken) and `board { day, done[] }` (the requests handed in today); both belong to the day they name and are forgotten on any other. v6 also changes what `museum.claimed` holds: the number of displays that earned each reward (3, 6, 9…), not its position in the list. **v7** adds `bestiary { seen[], friends[] }` (rare creatures met and befriended) and an optional `fertilized` mark on a soil cell. Weather and the places of rare creatures are **not** saved: they follow from the day. Villagers' **positions are not saved**: they follow from the schedule and the clock. Every later system adds its own
section.

**Version history.** v1 (Phase 1): where the player was. v2 (Phase 2): the clock, pockets, money, bin and farms. v3 (Phase 3):
villagers, hens, quests and flags. v4 (Phase 4): the collection and the mine's depth. v5 (Phase 5): furniture, buildings, the museum and the day's used-up record. v6 (Phase 6): today's festival and board, and the museum's claims by count. v7 (Phase 7): the bestiary and fertilized soil. The migrations (`migrations.ts`) fill the new parts with literal starting values (v1 → v2: day 1,
6:00 am, 150g, the starter kit; v2 → v3: nobody met, no hens, no quests; v3 → v4: nothing found, the mine unvisited; v4 → v5: nothing placed, built or given, nothing spent today; v5 → v6: in no festival, nothing handed in, and each museum claim turned from a position into the literal count the six rewards asked for in v5: 3, 6, 9, 12, 15, 18; v6 → v7: no creature met, no soil enriched), so a Phase 2 farm opens exactly as it was with the villagers
meeting the player for the first time. Tests cover each with a real old save (v1 to v6), and the integration suite opens a v1, a v2, a v3, a v4, a v5 and a v6 file
from disk in the real extension and writes them back as v7. A save made inside the mine reopens on the same floor (its rocks whole again).

**Safety rules** (all tested):

- Writes go to a temp file, are flushed to disk, then renamed into place: never a half-written save.
- Before writing, the current save is copied to the backup *only if it decodes*, so a damaged file never replaces a good backup.
- A save that fails to read is archived, then the backup is tried, then a new game starts: nothing is lost silently, and the
  player is told.
- A save from a **newer** version is never overwritten: saving switches off for the session and the player is told.
- Loading rescues a saved position that is no longer valid (the map changed) by moving to the nearest walkable cell, and falls
  back to the start map if the saved map no longer exists.
- Writes are coalesced (many requests, few writes, last one wins). Autosave runs every 30 s, when the menu opens, and when the
  window loses focus or is hidden.
- Loading checks the state strictly (whole numbers, ranges, array and size limits) so a hand-edited or corrupt file cannot ask
  for absurd amounts of memory, and then reconciles it with the content: unknown items and crops are dropped, cells off the map
  are dropped, a crop with no soil under it is dropped, a stage or day count too big for its crop is clamped; villagers, animals
  of a kind and quests the content no longer has are dropped. A farm or coop saved for a map the game no longer has (or has not
  built yet) is kept, not lost.
- Storage keys are restricted to `^[a-z0-9][a-z0-9._-]{0,63}$` and validated on **both** sides, so a message from the webview
  cannot reach outside the save folder.

**To change the format:** bump `SAVE_VERSION`, add `MIGRATIONS[oldVersion]` (old state → next version), add tests. Old saves
are migrated in memory and written back in the new version; the previous good file becomes the backup.

Known limit: closing the tab loses at most the last 30 s of play (a webview cannot save as it is destroyed). Multiple slots
and export/import are not built yet; the manager is already keyed by slot.

## 9. Asset pipeline

The art is produced by a script, so it is reproducible, palette-correct and replaceable.

```
npm run assets   →   src/assets/generated/world.png      the atlas (1024 × 512, 908 frames)
                     src/assets/generated/world.json     the manifest (frame rectangles): the contract with the renderer
                     src/assets/generated/ui/*.png       9-slice UI frames (CSS border-image)
                     media/icon.png                      the extension icon
```

> **Phase 1 art is generated, not hand-drawn.** It is a first pass in the brand palette that proves the pipeline, the
> data and the look. It is meant to be improved or replaced with hand-drawn art against the reference images; because the
> renderer only knows frame *names* and rectangles, replacing art never touches code.

### Frame naming contract

| Prefix | Frames | Size |
| --- | --- | --- |
| `terrain/grass_v{0-7}` | seamless base tiles | 16 × 16 |
| `terrain/dirt_m{mask}_v{0-2}` | path autotile, 47 masks | 16 × 16 |
| `terrain/water_m{mask}_v{0-1}_f{0-3}` | water autotile, 47 masks, 4 animation frames | 16 × 16 |
| `object/oak_a/_b`, `object/pine_a/_b` | trees | 48 × 56 (anchor tile at 16, 40) |
| `object/bush`, `bush_berry`, `rock_small`, `rock_mossy`, `stump` | small things | 16 × 16 |
| `object/boulder`, `object/log` | trail blocks | 32 × 24, 32 × 16 |
| `object/fence_m{0-15}` | fence, 4-neighbour mask (N=1, E=2, S=4, W=8) | 16 × 16 |
| `object/signpost_left/_right`, `object/mailbox` | props | 16 × 24 |
| `object/well` | well | 32 × 40 |
| `object/farmhouse` | house, door at cell (2, 4) | 96 × 80 |
| `object/shipping_bin`, `object/seed_stall` | bin (2 cells), stall (2 cells) | 32 × 24, 32 × 40 |
| `object/bridge_h` | bridge, 5 × 2 cells | 80 × 32 |
| `decal/flower_{red,yellow,blue,white,pink}_{0,1}`, `tuft_{0-2}`, `pebbles_{0,1}`, `mushroom` | ground decals | 16 × 16 |
| `char/{player,willa,tobias,hollis,june}/{down,up,left,right}_{idle,walk}_{frame}` | the farmer and each villager (a villager's stem is its `NpcDef.sprite`), idle × 1, walk × 4 | 16 × 24, feet at the bottom edge |
| `animal/{kind}_{idle,walk_0,walk_1,peck_0,peck_1}` | an animal (stem from `AnimalDef.sprite`), drawn facing right, mirrored for left | about 16 × 16 |
| `object/cottage_blue`, `object/cottage_green`, `object/coop`, `object/trough`, `object/fountain`, `object/bench` | the village and coop props | various |
| `item/egg`, `item/chicken_feed` | produce and supply icons | 16 × 16 |
| `terrain/{wood_floor,cave_floor}_v{0-3}`, `terrain/plaster_wall_v{0-1}`, `terrain/cave_wall_v{0-3}` | interior and cave base tiles | 16 × 16 |
| `object/store`, `object/cave_mouth` | the general store (96 × 80, door at cell 2 of the bottom row) and the mine entrance (48 × 40, middle cell open) | various |
| `object/{bed,table,chair,bookshelf,counter,stove,barrel,crate,pot_plant,shelf_goods,rug}` | interior furniture (`rug` lies on the floor) | various |
| `object/ladder_down`, `object/ladder_up`, `object/dock_h` | mine ladders (flat, 16 × 16) and the fishing dock (64 × 32) | various |
| `node/{stone,copper,iron,coal,quartz,amethyst}` | rocks and ore the pickaxe breaks | 16 × 16 |
| `item/{fishing_rod,pickaxe,minnow,perch,carp,trout,catfish,pike,stone,copper_ore,iron_ore,coal,quartz,amethyst}`, `tool/{pickaxe,fishing_rod}` | tools, fish and minerals | 16 × 16 |
| `fx/bobber_{0,1}`, `fx/bite_mark`, `fx/ripple_{0-2}`, `fx/splash_{0-2}`, `fx/dust_{0-2}` | fishing and mining effects | 8 × 8, 8 × 12, 16 × 16 |
| `fx/fish_bar`, `fx/fish_zone`, `fx/fish_marker` | the timing bar (48 × 8), its stretchable sweet spot (4 × 4) and the marker (3 × 10) | various |
| `decal/{fern,bluebell}_{0,1}` | forest floor plants | 16 × 16 |
| `terrain/greenhouse_floor_v{0-1}`, `terrain/glass_wall_v{0-1}`, `terrain/marble_floor_v{0-3}` | greenhouse floor, glass wall (solid), museum floor | 16 × 16 |
| `object/{kitchen,workbench,wardrobe,armchair,lantern,vase,clock,rain_barrel,case,pedestal}` | the farmhouse and museum furniture (a kitchen counter is 48 × 24, a workbench 32 × 24) | various |
| `object/greenhouse`, `object/construction` | the glass house and its scaffolding, same footprint (96 × 64, door at x 32..48) | 96 × 64 |
| `object/museum` | the museum (96 × 80, door at x 32..48) | 96 × 80 |
| `node/dig_spot` | a mound of earth with something pale showing | 16 × 16 |
| `item/{fried_egg,omelette,radish_salad,strawberry_jam,tomato_soup,pumpkin_pie,baked_trout,fish_stew}` | dishes | 16 × 16 |
| `item/{copper_bar,iron_bar}`, `item/{clay_pot,arrowhead,old_coin,fossil,rusty_key,glass_bead}` | bars and artifacts | 16 × 16 |
| `item/{chair,table,bookshelf,rug,pot_plant,lantern,armchair,wardrobe,vase,clock}` | furniture icons | 16 × 16 |
| `fx/sparkle_{0-2}` | crafting and donating sparkle | 16 × 16 |
| `char/{bram,ines}/…` | the carpenter and the curator | 16 × 24 |
| `soil/{dry,wet}_m{mask}` | tilled soil autotile, 47 masks each | 16 × 16 |
| `crop/{id}_{stage}` | one picture per growth stage and one for ripe | 16 × 16, or 16 × 32 for tomato and sunflower |
| `item/seeds_{crop}`, `item/{crop}`, `item/hoe`, `item/watering_can` | item icons | 16 × 16 |
| `tool/hoe`, `tool/watering_can` | the tool in hand while swinging | 16 × 16 |
| `fx/cursor_ok`, `fx/cursor_no` | the placement cursor | 16 × 16 |
| `icon/coin`, `icon/water_drop` | small HUD icons | 10 × 10, 9 × 11 |
| `fx/shadow_*`, `fx/smoke_{0-3}`, `fx/interact_arrow` | effects | various |
| `ui/{panel-wood,panel-parchment}.png` | 9-slice, 8 px corners | 24 × 24 |
| `ui/{button,button-hover,button-down}.png` | 9-slice, 5 px corners | 16 × 16 |
| `ui/frame.png` | viewport frame, 7 px border, transparent centre | 24 × 24 |
| `ui/keycap.png` | key hint, 4 px corners | 12 × 12 |
| `ui/{slot,slot-selected}.png` | hotbar slot, 3 px corners | 12 × 12 |

`npm test` fails if the content asks for a frame the atlas does not have, or if the generator and the engine disagree on
the autotile masks.

### Art still needed (identified, not yet drawn)

Real swing and carry animations for the farmer (the tool swing is the standing picture with a moving tool), a tilled-soil
look that also reads when planted rows are watered, more crop varieties, fertilised soil, more animals (the hen has idle, walk and
peck, drawn facing right and mirrored; up and down views, eating and sleeping are not drawn), hand-drawn **portraits** (a dialog
shows the villager's standing sprite for now), more villagers, more furniture (the three interiors share one set), edge pieces where cave or interior walls meet the floor (a wall is a plain repeated square), pictures of fish in the water, seasonal variants of every tree, bush and terrain tile (the autumn oak
exists as `object/oak_autumn`, unused), UI icons for menus and the journal (it is text and colour for now), and a barn, greenhouse and shed. Each will
follow the same naming scheme.

## 10. Testing

| Layer | How | Count |
| --- | --- | --- |
| Engine, data, protocol, save store | `npm test` (Vitest, plain Node) | 1,342 (end of Phase 8) |
| Real extension | `npm run test:integration` launches the installed VS Code with a throwaway profile | 40 |
| The actual picture | `npm run dev:webview` serves the same page in a browser tab at <http://localhost:5174> | manual |

The integration suite opens the real webview and checks: WebGL draws, the strict policy reports zero violations, the pixel
font loads, the player walks, a save reaches the disk, the farm restores after the tab is closed, a damaged save is recovered
from its backup (and kept), a newer-version save is never overwritten, a real version-1 save file is upgraded, and a farm
survives till → plant → water → sleep → save → close → reopen with the hotbar and clock drawn under the strict policy. Since
Phase 3 it also opens a real **version-2** save and writes it back as v3 with the farm unchanged, walks east off the farm onto the
Village Green (drawn under the strict policy with no errors), saves there, reopens on the green, walks back to the farm with its
crop intact, and sleeps away from the farm and wakes at the door.

Phase 4 to 6 added tests in the same spirit: `worldExpansion` (the village, the wood, fishing, the mine), `homesteading` (the farmhouse, cooking, furniture, the greenhouse, digging, the museum), `phase5Fixes` (what an independent review of Phase 5 found, each pinned down), and
`livingWorld` (weather and the forecast, rain on fields, rainy-day schedules, the notice board, the market, and each festival played through the real maps). The integration suite also opens real v4 and v5 saves and writes them back as v6, draws rain, snow, a storm, the Egg Hunt with its eggs and the autumn oaks under the strict policy, reads the notice board, talks to the merchant at his cart, and reopens a festival in progress.

`src/engine/lifeSimulation.test.ts` plays Phase 3 through the real maps and data: Willa leaving the green at eight and minding
her stall, her return in the evening while the player is elsewhere, first meetings, chats, gifts and their limits, birthdays,
friendship rewards (and the full-pockets case), buying a hen, a full coop, petting, trough → night → egg → basket, hungry hens, the
quest chains (including the walk through the exit), and a save written and restored with everything.

## 11. Known limitations

- The art is generated first-pass art (above) and the reference images were not available.
- Closing the tab can lose up to 30 s of play.
- One save slot; no export/import yet.
- Twelve inventory slots and no inventory screen yet: the hotbar is the inventory. Fine for five crops; a backpack comes with more items.
- Nothing grows outdoors in winter; the greenhouse is the way round it (Phase 5), and Rowan's out-of-season seeds are for it (Phase 6).
- Crop quality is luck only: farming mastery will feed into it (Phase 8 balancing).
- The shipping bin ships the whole selected stack (there is no "ship one"), and a shipped stack cannot be taken back.
- **Villagers (Phase 3, 4):** four people and eight quests. Only the two cottages and the store have interiors (the farmhouse is still entered
  by its door only to go to bed), and friendship never fades. A villager talks with their standing sprite instead of a drawn portrait.
  Villagers are only simulated while the player shares their map; on other maps they are placed by the schedule. There is no way to ask where someone is.
- **Fishing and mining (Phase 4):** six fish and six minerals, no fish pictures in the water, and no way to keep a fish alive or fight one
  (a catch is just a catch). The mine has ten floors of rocks and ladders and nothing else: no creatures, no hazards, no light source to
  manage, and the deepest floor has no way down. Rocks only drop materials that can be sold or given until crafting (Phase 5). A save made
  in the mine reopens on the same floor with every rock whole again. Interiors and the cave use plain wall tiles, with no edge where a wall
  meets the floor.
- **Phase 5:** one building (the greenhouse) and one site; no storage chest, no moving or demolishing a building, and furniture only in the
  farmhouse (the greenhouse and cottages cannot be decorated). Recipes cost no time and no energy, and there is no inventory screen to see
  what a dish is made of beyond its menu line. Dig spots are laid out each morning and uncovered by the hoe: nothing else can be buried.
  Only one thing can be given to the museum at a time (one trip per item), and its rewards cannot be re-read once taken.
- **Phase 8:** the sound has been checked by tests and by running the real engine without errors, but nobody has listened to it: the levels in `src/data/sounds.ts` are a first pass and want a human ear. There is no key rebinding screen, no screen-reader pass beyond labels, and no new character animation (the polish was audio, comfort, balance and speed).
- **The coop:** one pre-built coop, chickens only, and no player building or moving of it (Phase 5). A hen has no up or down view
  and no eating or sleeping picture. Animals are not drawn indoors (there is no inside).
- **The journal** is text only: it has no map, no tracking arrow and no way to abandon a quest (a quest is never lost either).
- **The village** is one map of a village. The fade that covers a map change is a quick CSS fade; a one-frame flash of the new
  map before it starts is possible on a slow machine.
- Depth sorting is one sorted container per map: fine for hundreds of objects, to be split per chunk for very large maps. The
  renderer keeps the last three maps built (and the game keeps all ten mine floors until morning); a world of many more maps will need
  streaming and a smarter cache.
- Soil and crop layers rebuild all their sprites when the farm changes: fine for a few hundred worked cells, to be made
  incremental and chunked for very large farms.
- The browser dev page throttles `requestAnimationFrame` when its pane is hidden, which slows the simulation (by design, the
  simulation never runs more than 5 steps per frame) and the game also pauses itself while hidden; this does not affect VS Code.
- `extensionKind` is `ui`, so the game runs on the local machine under Remote SSH/WSL; it is not a web extension (it needs
  Node file access), so it does not run on vscode.dev.
- Keyboard and mouse only; there is no gamepad or touch input.
- Publisher in `package.json` (`thesulce`) matches the sibling extension and may need changing before publishing.
