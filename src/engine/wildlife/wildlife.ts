/**
 * The rare creatures of the valley and the field's nightly sprinklers. It owns where the creatures are on the map being shown (worked
 * out from the day and the map alone, cached for a few game minutes, never saved), how a creature is first spotted, watched and
 * befriended, and the night's watering by sprinklers. It is created by `Game`, which stays the façade: `creaturesHere()` and the rest
 * of the game's use of creatures delegate here, and the prompt (what `E` would do) stays with the game.
 *
 * What it asks of the game (`WildlifeHost`): the world and the clock, the season and the weather, the map and the player, the pockets
 * and the bestiary (the book of what has been met), the farms and the furniture put down (for the sprinklers), and the usual hint,
 * dialog, status and quest hooks. It never reaches further into the game than that.
 */
import type { Bestiary } from '../creatures/bestiary';
import { canSee, placeCreatures } from '../creatures/creatures';
import type { CreaturePlacement } from '../creatures/types';
import type { Emitter } from '../core/emitter';
import type { MapFarm } from '../farming/farm';
import type { GameEvents } from '../game';
import { openDialog, type DialogState } from '../interaction';
import type { Inventory } from '../inventory/inventory';
import { canAddAll } from '../inventory/take';
import type { ItemDef } from '../items/types';
import { worldToTile } from '../math/coords';
import type { PlacedSave } from '../persistence/saveFormat';
import type { PlayerState } from '../player/player';
import type { QuestEvent } from '../quests/types';
import type { Season } from '../time/calendar';
import type { WorldClock } from '../time/clock';
import type { Weather } from '../weather/types';
import type { GameMap } from '../world/gameMap';
import type { World } from '../world/world';

/** What the wildlife needs from the game. The game implements it; nothing here reaches into the game's insides. */
export interface WildlifeHost {
  readonly world: World;
  readonly clock: WorldClock;
  readonly season: Season;
  /** Today's weather (creatures come out for some weather and not for others). */
  readonly weather: Weather;
  /** The map being shown (it changes when the player walks through an exit). */
  readonly map: GameMap;
  readonly player: PlayerState;
  readonly inventory: Inventory;
  /** The rare creatures the player has seen and befriended. */
  readonly bestiary: Bestiary;
  readonly events: Emitter<GameEvents>;
  item(id: string): ItemDef | undefined;
  hint(text: string, tone: 'info' | 'warn'): void;
  showDialog(dialog: DialogState): void;
  syncStatus(): void;
  notifyQuests(event: QuestEvent): void;
  /** The worked soil and crops of any map, for the sprinklers' nightly watering. */
  farmOf(mapId: string): MapFarm;
  /** The furniture that is put down, by map id: sprinklers are among it. */
  placedToSave(): Record<string, PlacedSave[]>;
}

export class Wildlife {
  /** Where the rare creatures are on the map being shown, worked out from the day and cached for a few game minutes. */
  private creatureCache: { key: string; list: readonly CreaturePlacement[] } = { key: '', list: [] };
  private readonly creatureCells = new WeakMap<GameMap, { x: number; y: number }[]>();

  constructor(private readonly host: WildlifeHost) {}

  /** Cells a creature may stand on: walkable, reachable on foot, not a way out and not something to use. Worked out once per map. */
  private creatureCandidates(map: GameMap): { x: number; y: number }[] {
    let cells = this.creatureCells.get(map);
    if (cells === undefined) {
      cells = [];
      const reach = map.reachableFromWithRocks(map.spawn.x, map.spawn.y);
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const free = map.isWalkable(x, y) && reach[y * map.width + x] === 1 && map.interactableAt(x, y) === undefined && map.extraAt(x, y) === undefined && !map.isOverhung(x, y);
          if (free && !map.exits.some((e) => x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h)) cells.push({ x, y });
        }
      }
      this.creatureCells.set(map, cells);
    }
    return cells;
  }

  /** The rare creatures about on this map right now. Where they stand follows from the day and the map alone: it is never saved. */
  creaturesHere(): readonly CreaturePlacement[] {
    const defs = this.host.world.index.content.creatures;
    if (defs.length === 0) return [];
    const key = `${this.host.clock.day}|${this.host.map.id}|${this.host.weather}|${Math.floor(this.host.clock.minutes / 10)}`;
    if (this.creatureCache.key === key) return this.creatureCache.list;
    const list = placeCreatures({ day: this.host.clock.day, map: this.host.map.id, defs, candidates: this.creatureCandidates(this.host.map), season: this.host.season, weather: this.host.weather, minutes: this.host.clock.minutes });
    this.creatureCache = { key, list };
    return list;
  }

  creatureAt(x: number, y: number): { seen: boolean; friend: boolean; accepts: (itemId: string) => boolean } | undefined {
    const placement = this.creaturesHere().find((c) => c.x === x && c.y === y);
    const def = placement === undefined ? undefined : this.host.world.index.creatureById.get(placement.creature);
    if (placement === undefined || def === undefined) return undefined;
    return { seen: this.host.bestiary.hasSeen(def.id), friend: this.host.bestiary.isFriend(def.id), accepts: (itemId) => def.likes.includes(itemId) };
  }

  /** Walking up to a creature without running is how it is seen for the first time. */
  spotCreatures(): void {
    const here = this.creaturesHere();
    if (here.length === 0) return;
    const at = { x: worldToTile(this.host.player.x), y: worldToTile(this.host.player.y - 3) };
    for (const placement of here) {
      if (!canSee(at, placement, this.host.player.running)) continue;
      const def = this.host.world.index.creatureById.get(placement.creature);
      if (def === undefined || !this.host.bestiary.see(def.id)) continue;
      this.host.hint(`You spotted a ${def.name.toLowerCase()}! It is in your journal now.`, 'info');
      this.host.events.emit('sound', { id: 'discover' });
      this.host.notifyQuests({ kind: 'see', seen: this.host.bestiary.seenCount });
      this.host.syncStatus();
    }
  }

  /** `E` on a creature: what the journal says about it, and what it might want. */
  watchCreature(placement: CreaturePlacement): void {
    const def = this.host.world.index.creatureById.get(placement.creature);
    if (def === undefined) return;
    const friend = this.host.bestiary.isFriend(def.id);
    const lines = [def.description, friend ? 'It knows you now. It looks at you for a moment, and does not run.' : 'It watches you, and does not run. Perhaps it would take something from your hand: select an item and use it on the creature.'];
    this.host.showDialog(openDialog(def.name, lines));
  }

  /** Gives a creature what it likes (taken from the pockets slot the swing started with). It becomes a friend, once, and leaves a keepsake. */
  befriend(slot: number, x: number, y: number): void {
    const placement = this.creaturesHere().find((c) => c.x === x && c.y === y);
    const def = placement === undefined ? undefined : this.host.world.index.creatureById.get(placement.creature);
    if (def === undefined || !this.host.bestiary.hasSeen(def.id) || this.host.bestiary.isFriend(def.id)) return;
    const given = this.host.inventory.take(slot, 1);
    if (given === undefined) return;
    const keepsake = [{ id: def.keepsake.item, count: def.keepsake.count, quality: 0 as const }];
    if (!canAddAll(this.host.inventory, keepsake, (id) => this.host.item(id))) {
      this.host.inventory.add(given); // not taken: there would be no room for what it leaves
      this.host.hint('Your pockets are too full for what it might leave. Make some room first.', 'warn');
      return;
    }
    this.host.bestiary.befriend(def.id);
    for (const stack of keepsake) this.host.inventory.add(stack);
    this.host.events.emit('effect', { kind: 'pet', x, y });
    const gift = this.host.item(def.keepsake.item)?.name ?? def.keepsake.item;
    this.host.hint(`The ${def.name.toLowerCase()} trusts you now. It leaves you ${def.keepsake.count} ${gift}.`, 'info');
    this.host.events.emit('sound', { id: 'discover' });
    this.host.notifyQuests({ kind: 'befriend', friends: this.host.bestiary.friendCount });
    this.host.syncStatus();
  }

  /** Every night each sprinkler waters the tilled soil around it (so the field is wet by morning without a trip with the can). */
  sprinkle(): void {
    for (const [mapId, list] of Object.entries(this.host.placedToSave())) {
      if (!this.host.world.hasMap(mapId)) continue;
      for (const placed of list) {
        const radius = this.host.world.index.objectById.get(placed.def)?.sprinkles;
        if (radius !== undefined) this.host.farmOf(mapId).waterAround(placed.x, placed.y, radius);
      }
    }
  }
}
