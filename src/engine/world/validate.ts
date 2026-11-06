import { INVENTORY_SLOTS } from '../inventory/inventory';
import { isGoods } from '../items/types';
import { isDirection } from '../math/coords';
import { isSeason } from '../time/calendar';
import { BEDTIME_MINUTE, WAKE_MINUTE } from '../time/clock';
import { MAX_HEARTS } from '../social/friendship';
import { REQUESTS_PER_DAY } from '../requests/requests';
import { WEATHERS } from '../weather/types';
import { SEASON_WEATHER } from '../weather/weather';
import { AWAY, type Condition } from '../social/types';
import { ripeStage } from '../farming/types';
import { CANONICAL_MASKS } from './autotile';
import { ContentIndex } from './content';
import { allCharacterFrames, allTerrainFrames, ANIMAL_POSES, animalFrame } from './frames';
import { GameMap } from './gameMap';
import { generateMineFloor } from '../mine/generator';
import { MINE_FLOORS, parseMineFloor } from '../mine/surface';
import type { Content, ExitDef, MapDef } from './types';

export interface ContentProblem {
  readonly where: string;
  readonly message: string;
}

/**
 * Checks a content pack for mistakes before the player can hit them: bad references, malformed maps,
 * an unreachable spawn, interactables nobody can get to, and (when the atlas is supplied) frames that do
 * not exist. Returns every problem found, so a content author sees the whole list at once.
 *
 * This is what keeps generated content honest: a map is only valid if the player can actually play it.
 */
export function validateContent(content: Content, atlasFrames?: ReadonlySet<string>): ContentProblem[] {
  const problems: ContentProblem[] = [];
  const add = (where: string, message: string): void => void problems.push({ where, message });

  let index: ContentIndex;
  try {
    index = new ContentIndex(content);
  } catch (error) {
    return [{ where: 'content', message: (error as Error).message }];
  }

  /** A map's definition: written in the content, or generated (the mine). */
  const defOf = (id: string): MapDef | undefined => {
    const written = index.mapById.get(id);
    if (written !== undefined) return written;
    const floor = parseMineFloor(id);
    return floor === undefined ? undefined : generateMineFloor(floor);
  };

  const needFrame = (where: string, frame: string): void => {
    if (atlasFrames !== undefined && !atlasFrames.has(frame)) add(where, `atlas has no frame "${frame}"`);
  };

  // --- terrain
  for (const terrain of content.terrains) {
    if (terrain.glyph.length !== 1) add(`terrain ${terrain.id}`, `glyph "${terrain.glyph}" must be one character`);
    if (terrain.glyph === '.' && terrain.render !== 'base') add(`terrain ${terrain.id}`, 'the "." glyph is reserved for plain base terrain');
    for (const frame of allTerrainFrames(terrain, CANONICAL_MASKS)) needFrame(`terrain ${terrain.id}`, frame);
  }

  // --- objects
  for (const object of content.objects) {
    const where = `object ${object.id}`;
    if (object.frames === undefined && object.connect === undefined) add(where, 'has neither frames nor a connect group');
    for (const frame of object.frames ?? []) needFrame(where, frame);
    if (object.connect !== undefined) {
      for (let mask = 0; mask < 16; mask += 1) needFrame(where, `${object.connect.framePrefix}${mask}`);
    }
    if (object.shadow !== undefined) needFrame(where, object.shadow.frame);
    if (object.layer === 'standing' && object.footprint.length === 0) add(where, 'a standing object needs a footprint');
    if (object.layer === 'ground' && object.footprint.length > 0) add(where, 'a ground decal must not have a footprint');
    for (const cell of object.interact?.cells ?? []) {
      if (!object.footprint.some((f) => f.dx === cell.dx && f.dy === cell.dy)) {
        add(where, `interact cell ${cell.dx},${cell.dy} is outside the footprint`);
      }
    }
    if (object.interact !== undefined && object.interact.lines.length === 0) add(where, 'interact has no lines');
  }

  for (const object of content.objects) {
    for (const [season, frames] of Object.entries(object.seasonal ?? {})) {
      if (!isSeason(season)) add(`object ${object.id}`, `has seasonal frames for unknown season "${season}"`);
      if ((frames ?? []).length === 0) add(`object ${object.id}`, `has an empty list of ${season} frames`);
      for (const frame of frames ?? []) needFrame(`object ${object.id}`, frame);
    }
  }

  // --- items
  for (const item of content.items) {
    const where = `item ${item.id}`;
    needFrame(where, item.icon);
    if (item.maxStack < 1 || !Number.isInteger(item.maxStack)) add(where, 'maxStack must be a whole number of at least 1');
    if (item.sellPrice < 0 || !Number.isInteger(item.sellPrice)) add(where, 'sellPrice must be a whole number, 0 or more');
    if (item.kind === 'tool' && (item.tool === undefined || item.maxStack !== 1)) add(where, 'a tool needs a tool kind and a stack of 1');
    if (item.kind !== 'tool' && item.tool !== undefined) add(where, 'only a tool has a tool kind');
    if (item.kind === 'seed') {
      const crop = item.plants === undefined ? undefined : index.cropById.get(item.plants);
      if (crop === undefined) add(where, `seed plants unknown crop "${item.plants}"`);
      else if (crop.seed !== item.id) add(where, `crop "${crop.id}" does not name this seed as its own`);
    }
  }

  // --- crops
  for (const crop of content.crops) {
    const where = `crop ${crop.id}`;
    if (crop.seasons.length === 0 || !crop.seasons.every(isSeason)) add(where, 'needs one or more valid seasons');
    if (crop.stageDays.length === 0 || !crop.stageDays.every((d) => Number.isInteger(d) && d >= 1)) add(where, 'stageDays must be whole numbers of at least 1');
    if (crop.frames.length !== crop.stageDays.length + 1) add(where, `needs ${crop.stageDays.length + 1} frames (one per stage and one for ripe), has ${crop.frames.length}`);
    for (const frame of crop.frames) needFrame(where, frame);
    if (index.itemById.get(crop.seed)?.plants !== crop.id) add(where, `seed item "${crop.seed}" does not plant this crop`);
    if (index.itemById.get(crop.harvest)?.kind !== 'crop') add(where, `harvest item "${crop.harvest}" is not a crop item`);
    if (crop.regrowStage !== undefined && !(Number.isInteger(crop.regrowStage) && crop.regrowStage >= 0 && crop.regrowStage < ripeStage(crop))) {
      add(where, 'regrowStage must be one of the growing stages');
    }
  }

  // --- shops
  for (const shop of content.shops) {
    const where = `shop ${shop.id}`;
    if (shop.offers.length === 0) add(where, 'has nothing for sale');
    for (const offer of shop.offers) {
      const what = offer.item ?? offer.animal ?? '?';
      if ((offer.item === undefined) === (offer.animal === undefined)) add(where, `an offer must be for exactly one of an item and an animal ("${what}")`);
      if (offer.item !== undefined && !index.itemById.has(offer.item)) add(where, `sells unknown item "${offer.item}"`);
      if (offer.animal !== undefined && !index.animalById.has(offer.animal)) add(where, `sells unknown animal "${offer.animal}"`);
      if (!(Number.isInteger(offer.price) && offer.price > 0) || !(Number.isInteger(offer.quantity) && offer.quantity > 0)) add(where, `offer for "${what}" needs a positive price and quantity`);
      if (offer.animal !== undefined && offer.quantity !== 1) add(where, `an animal is sold one at a time ("${what}")`);
      if (offer.seasons !== undefined && !offer.seasons.every(isSeason)) add(where, `offer for "${what}" has an invalid season`);
      if (offer.once === true && index.itemById.get(offer.item ?? '')?.kind !== 'tool') add(where, `"${what}" is marked as a one-off but is not a tool`);
    }
    if (shop.buys !== undefined && !(shop.buys.variance >= 0 && shop.buys.variance <= 0.5)) add(where, 'price variance must be between 0 and 0.5');
    if (shop.keeper !== undefined) {
      const keeper = index.npcById.get(shop.keeper);
      if (keeper === undefined) add(where, `keeper "${shop.keeper}" does not exist`);
      else if (!keeper.schedule.some((entry) => entry.serves === shop.id)) add(where, `${keeper.name} never stands at the stall: no schedule entry serves "${shop.id}"`);
    }
  }
  for (const object of content.objects) {
    const action = object.interact?.action;
    if (action?.kind === 'shop' && !index.shopById.has(action.shop)) add(`object ${object.id}`, `opens unknown shop "${action.shop}"`);
  }

  // --- nodes (what the pickaxe breaks)
  for (const node of content.nodes) {
    const where = `node ${node.id}`;
    needFrame(where, node.frame);
    if (!(Number.isInteger(node.hits) && node.hits >= 1)) add(where, 'hits must be a whole number of at least 1');
    if (node.drops.length === 0 && node.tool !== 'hoe') add(where, 'drops nothing');
    for (const drop of node.drops) {
      if (!index.itemById.has(drop.item)) add(where, `drops unknown item "${drop.item}"`);
      if (!(Number.isInteger(drop.min) && Number.isInteger(drop.max) && drop.min >= 1 && drop.max >= drop.min)) add(where, `drop "${drop.item}" needs 1 <= min <= max`);
      if (!(drop.chance > 0 && drop.chance <= 1)) add(where, `drop "${drop.item}" needs a chance above 0 and up to 1`);
    }
    if (node.tool !== 'hoe' && !node.drops.some((d) => d.chance === 1)) add(where, 'needs one drop that always appears, or a swing can give nothing at all');
  }
  for (const map of content.maps) {
    for (const spawn of map.nodes ?? []) if (!index.nodeById.has(spawn.def)) add(`map ${map.id}`, `places unknown node "${spawn.def}"`);
  }

  // --- fish
  const waters = new Set(content.maps.flatMap((m) => (m.fishing ?? []).map((z) => z.water)));
  for (const fish of content.fish) {
    const where = `fish ${fish.id}`;
    if (index.itemById.get(fish.item)?.kind !== 'fish') add(where, `item "${fish.item}" is not a fish item`);
    if (fish.waters.length === 0) add(where, 'lives nowhere');
    for (const water of fish.waters) if (!waters.has(water)) add(where, `lives in "${water}", which no map has a fishing zone for`);
    if (fish.seasons.length === 0 || !fish.seasons.every(isSeason)) add(where, 'needs one or more valid seasons');
    if (!(fish.from < fish.to && fish.from >= 6 * 60 && fish.to <= BEDTIME_MINUTE + 1)) add(where, 'bites between 6:00 am and 2:00 am, from before to');
    if (![1, 2, 3, 4, 5].includes(fish.difficulty)) add(where, 'difficulty must be 1 to 5');
    if (!(fish.weight > 0)) add(where, 'weight must be above 0');
  }
  // Every kind of water must always have something that bites by day, or a rod would be useless there.
  for (const water of waters) {
    const always = content.fish.some((f) => f.waters.includes(water) && f.seasons.length === 4 && f.from <= 6 * 60 && f.to >= 18 * 60);
    if (!always) add(`water ${water}`, 'has no fish that bites all year through the day');
  }

  // --- animals
  for (const animal of content.animals) {
    const where = `animal ${animal.id}`;
    if (index.itemById.get(animal.product)?.kind !== 'crop') add(where, `product "${animal.product}" is not a produce item`);
    if (!index.itemById.has(animal.feed)) add(where, `feed "${animal.feed}" does not exist`);
    if (animal.names.length === 0) add(where, 'needs at least one name');
    for (const pose of ANIMAL_POSES) needFrame(where, animalFrame(animal.sprite, pose));
  }

  // --- villagers
  const checkConditions = (where: string, conditions: readonly Condition[] | undefined, self?: string): void => {
    for (const condition of conditions ?? []) {
      if (condition.kind === 'quest') {
        if (!index.questById.has(condition.id)) add(where, `refers to unknown quest "${condition.id}"`);
        else if (condition.id === self) add(where, 'a quest cannot depend on itself');
      } else if (condition.kind === 'friendship' && condition.npc !== undefined) {
        if (!index.npcById.has(condition.npc)) add(where, `refers to unknown villager "${condition.npc}"`);
        if (condition.atLeast > MAX_HEARTS) add(where, `asks for more than ${MAX_HEARTS} hearts`);
      } else if (condition.kind === 'friendship' && condition.atLeast > MAX_HEARTS) add(where, `asks for more than ${MAX_HEARTS} hearts`);
      else if (condition.kind === 'season' && !condition.is.every(isSeason)) add(where, 'has an invalid season');
      else if (condition.kind === 'not') checkConditions(where, [condition.condition], self);
    }
  };
  for (const npc of content.npcs) {
    const where = `villager ${npc.id}`;
    for (const frame of allCharacterFrames(npc.sprite)) needFrame(where, frame);
    if (!index.mapById.has(npc.home)) add(where, `home map "${npc.home}" does not exist`);
    if (npc.schedule.length === 0) add(where, 'has no schedule');
    npc.schedule.forEach((entry, i) => {
      const before = npc.schedule[i - 1];
      const conditional = entry.when !== undefined || entry.days !== undefined;
      // Two entries may start at the same minute only when the later one is for particular days or weather.
      if (before !== undefined && (entry.from < before.from || (entry.from === before.from && !conditional))) add(where, 'schedule entries must be in order of time');
      if (i === 0 && conditional) add(where, 'the first schedule entry must apply every day, so there is always somewhere to be');
      if (entry.when !== undefined && entry.when !== 'rain' && entry.when !== 'dry') add(where, `schedule entry has an invalid weather "${String(entry.when)}"`);
      if (entry.days !== undefined && (entry.days.length === 0 || !entry.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) add(where, 'schedule days must be weekdays from 0 (Monday) to 6 (Sunday)');
      if (entry.map !== AWAY && !index.mapById.has(entry.map)) add(where, `schedule goes to unknown map "${entry.map}"`);
      if (entry.serves !== undefined && index.shopById.get(entry.serves)?.keeper !== npc.id) add(where, `serves "${entry.serves}", which does not name them as its keeper`);
      // A shop must not be shut by the sky alone: whoever keeps one has a day that does not depend on the weather (the weekday is fine).
      if (entry.when !== undefined && content.shops.some((s) => s.keeper === npc.id)) add(where, 'keeps a shop, so no schedule entry may depend on the weather');
    });
    if ((npc.schedule[0]?.from ?? 0) > 6 * 60) add(where, 'must have a place to be from 6:00 am');
    for (const id of [...npc.tastes.loves, ...npc.tastes.likes, ...npc.tastes.dislikes, ...npc.tastes.hates]) {
      const item = index.itemById.get(id);
      if (item === undefined) add(where, `has a taste for unknown item "${id}"`);
      else if (!isGoods(item)) add(where, `has a taste for "${id}", which can never be given as a gift (only crops, fish, minerals, artifacts, dishes and bars can)`);
    }
    for (const [name, lines] of Object.entries(npc.reactions)) if (lines.length === 0) add(where, `has no "${name}" gift reaction`);
    const seen = new Set<string>();
    for (const rule of [...npc.greetings, ...npc.chats]) {
      if (seen.has(rule.id)) add(where, `dialogue rule "${rule.id}" appears twice`);
      seen.add(rule.id);
      if (rule.lines.length === 0) add(where, `dialogue rule "${rule.id}" says nothing`);
      checkConditions(`${where} / ${rule.id}`, rule.when);
    }
    if (npc.greetings.at(-1)?.when !== undefined || npc.chats.at(-1)?.when !== undefined) add(where, 'the last greeting and the last chat must have no conditions, so there is always something to say');
    npc.rewards.forEach((reward) => {
      if (reward.hearts < 1 || reward.hearts > MAX_HEARTS) add(where, `a reward at ${reward.hearts} hearts is out of range`);
      for (const item of reward.items ?? []) if (!index.itemById.has(item.id)) add(where, `a reward gives unknown item "${item.id}"`);
    });
    for (const questId of npc.quests) {
      const quest = index.questById.get(questId);
      if (quest === undefined) add(where, `offers unknown quest "${questId}"`);
      else if (quest.giver !== npc.id) add(where, `offers "${questId}", which names ${quest.giver} as its giver`);
    }
  }

  // --- quests
  const sources = (itemId: string): { crops: string[]; elsewhere: boolean } => ({
    crops: content.crops.filter((c) => c.harvest === itemId).map((c) => c.id),
    elsewhere:
      content.animals.some((a) => a.product === itemId) ||
      content.shops.some((s) => s.offers.some((o) => o.item === itemId)) ||
      content.fish.some((f) => f.item === itemId) ||
      content.nodes.some((n) => n.drops.some((d) => d.item === itemId)) ||
      content.recipes.some((r) => r.output.item === itemId) ||
      content.maps.some((m) => (m.dig?.artifacts ?? []).some((a) => a.item === itemId)),
  });
  // The doors of buildings the carpenter puts up count as exits of the map their site is on.
  const siteMap = new Map<string, string>();
  for (const map of content.maps) for (const site of map.sites ?? []) siteMap.set(site.id, map.id);
  const doorsOn = (mapId: string): readonly ExitDef[] =>
    content.buildings.filter((b) => content.maps.some((m) => m.id === mapId && (m.sites ?? []).some((site) => site.building === b.id))).map((b) => b.door);

  // Maps reachable on foot from the start, ignoring locks; and those reachable without entering a region that has to be unlocked.
  const lockedRegions = new Set(content.regions.filter((r) => r.unlock.kind !== 'always').map((r) => r.id));
  const reach = (respectLocks: boolean): Set<string> => {
    const seen = new Set<string>([content.startMap]);
    const queue = [content.startMap];
    for (let head = 0; head < queue.length; head += 1) {
      for (const exit of [...(defOf(queue[head] as string)?.exits ?? []), ...doorsOn(queue[head] as string)]) {
        const target = defOf(exit.to.map);
        if (target === undefined || seen.has(target.id)) continue;
        if (respectLocks && lockedRegions.has(target.regionId)) continue;
        seen.add(target.id);
        queue.push(target.id);
      }
    }
    return seen;
  };
  const mapsReachableFromStart = reach(false);
  const openMaps = reach(true);
  const shopSells = (tool: string): boolean => content.shops.some((s) => s.offers.some((o) => o.item === tool));
  const toolItem = (kind: string): string | undefined => content.items.find((i) => i.tool === kind)?.id;
  const nodeKinds = new Map<string, Set<string>>();
  for (const node of content.nodes) for (const drop of node.drops) nodeKinds.set(drop.item, new Set([...(nodeKinds.get(drop.item) ?? []), node.id]));
  /** Does a map have, standing on it, an object that satisfies a test (by its prop layer or its placements)? */
  const mapHasObject = (map: MapDef, test: (id: string) => boolean): boolean => {
    const ids = new Set<string>([...map.props.flatMap((row) => [...row].map((g) => map.propLegend[g] ?? '')), ...(map.objects ?? []).map((o) => o.def)]);
    return [...ids].some((id) => id !== '' && test(id));
  };
  const stationPlaced = (station: string): boolean =>
    content.maps.some((m) =>
      mapHasObject(m, (id) => {
        const action = index.objectById.get(id)?.interact?.action;
        return action?.kind === 'craft' && action.station === station;
      }),
    );
  const minedSomewhere = (item: string): boolean => {
    const kinds = nodeKinds.get(item);
    if (kinds === undefined) return false;
    for (let floor = 1; floor <= MINE_FLOORS; floor += 1) if ((generateMineFloor(floor).nodes ?? []).some((n) => kinds.has(n.def))) return true;
    return false;
  };
  const hasRanch = content.maps.some((m) => m.ranch !== undefined);
  for (const quest of content.quests) {
    const where = `quest ${quest.id}`;
    const giver = index.npcById.get(quest.giver);
    if (giver === undefined) add(where, `giver "${quest.giver}" does not exist`);
    else if (!giver.quests.includes(quest.id)) add(where, `${giver.name} does not offer it`);
    if (quest.objectives.length === 0) add(where, 'has nothing to do');
    if (quest.offer.length === 0 || quest.done.length === 0) add(where, 'needs lines for when it is offered and when it is done');
    checkConditions(where, quest.requires, quest.id);
    // A quest that is only offered in some seasons may only ask for what can be grown then.
    const onlyIn = (quest.requires ?? []).flatMap((c) => (c.kind === 'season' ? [...c.is] : []));
    for (const objective of quest.objectives) {
      if ('item' in objective) {
        if (!index.itemById.has(objective.item)) { add(where, `asks for unknown item "${objective.item}"`); continue; }
        if (objective.count < 1) add(where, 'asks for fewer than one');
        const source = sources(objective.item);
        const possible = objective.kind === 'mine' || objective.kind === 'catch' || source.elsewhere || source.crops.some((id) => onlyIn.length === 0 || (index.cropById.get(id)?.seasons ?? []).some((s) => onlyIn.includes(s)));
        if (!possible) add(where, `asks for "${objective.item}", which cannot be got ${onlyIn.length > 0 ? `in ${onlyIn.join(' or ')}` : 'at all'}`);
      }
      if (objective.kind === 'deliver' && !index.npcById.has(objective.to)) add(where, `delivers to unknown villager "${objective.to}"`);
      if (objective.kind === 'visit' && !mapsReachableFromStart.has(objective.map)) add(where, `asks the player to visit "${objective.map}", which cannot be reached from the start`);
      if (objective.kind === 'friendship' && (!index.npcById.has(objective.npc) || objective.hearts > MAX_HEARTS)) add(where, 'has an impossible friendship objective');
      if (objective.kind === 'catch') {
        const rod = toolItem('fishing_rod');
        if (rod === undefined || !shopSells(rod)) add(where, 'asks the player to catch fish, but no shop sells a rod');
        const fishes = content.fish.filter((f) => objective.item === undefined || f.item === objective.item);
        if (objective.item !== undefined && fishes.length === 0) add(where, `asks for "${objective.item}", which no fish gives`);
        if (objective.count < 1) add(where, 'asks for fewer than one');
        // A fish must live in water the player can reach without the region this quest may unlock, in a season the quest is offered.
        const reachableWaters = new Set(content.maps.filter((m) => openMaps.has(m.id)).flatMap((m) => (m.fishing ?? []).map((z) => z.water)));
        const catchable = fishes.some((f) => f.waters.some((w) => reachableWaters.has(w)) && (onlyIn.length === 0 ? f.seasons.length === 4 : f.seasons.some((s) => onlyIn.includes(s))));
        if (!catchable) add(where, 'asks for a catch that no reachable water gives');
      }
      if (objective.kind === 'craft') {
        const recipes = content.recipes.filter((r) => objective.item === undefined || r.output.item === objective.item);
        if (recipes.length === 0) add(where, objective.item === undefined ? 'asks the player to make something, but there are no recipes' : `asks for "${objective.item}", which no recipe makes`);
        if (objective.count < 1) add(where, 'asks for fewer than one');
        if (!recipes.some((r) => stationPlaced(r.station))) add(where, 'asks the player to make something at a station that is not on any map');
      }
      if (objective.kind === 'place' && !(content.maps.some((m) => m.decorate === true) && content.items.some((i) => i.kind === 'furniture' && sources(i.id).elsewhere))) add(where, 'asks the player to place furniture, but there is no room to decorate or no furniture to be had');
      if (objective.kind === 'build') {
        if (!index.buildingById.has(objective.building)) add(where, `asks for unknown building "${objective.building}"`);
        else if (!content.npcs.some((n) => n.carpenter === true)) add(where, 'asks for a building, but there is no carpenter');
      }
      if (objective.kind === 'donate' && (content.museum === undefined || objective.count > content.museum.slots.length)) add(where, 'asks for more donations than the museum has room for (or there is no museum)');
      if (objective.kind === 'dig' && !content.maps.some((m) => m.dig !== undefined)) add(where, 'asks the player to dig, but no map has dig spots');
      if (objective.kind === 'mine') {
        const pick = toolItem('pickaxe');
        if (pick === undefined || !shopSells(pick)) add(where, 'asks the player to dig, but no shop sells a pickaxe');
        if (!minedSomewhere(objective.item)) add(where, `asks for "${objective.item}", which no mine floor has a node for`);
        if (!mapsReachableFromStart.has('mine.floor_1')) add(where, 'asks the player to mine, but the mine cannot be reached');
      }
      if (objective.kind === 'collect' && !content.animals.some((animal) => animal.product === objective.item)) add(where, `collects "${objective.item}", which no animal produces`);
      if ((objective.kind === 'feed' || objective.kind === 'collect') && !hasRanch) add(where, 'needs a coop, and no map has one');
    }
    for (const item of quest.rewards.items ?? []) if (!index.itemById.has(item.id)) add(where, `rewards unknown item "${item.id}"`);
    if (quest.rewards.animal !== undefined) {
      if (!index.animalById.has(quest.rewards.animal)) add(where, `rewards unknown animal "${quest.rewards.animal}"`);
      if (quest.rewards.fallbackMoney === undefined) add(where, 'an animal reward needs a fallback in case the coop is full');
    }
    if (quest.rewards.friendship !== undefined && !index.npcById.has(quest.rewards.friendship.npc)) add(where, `rewards friendship with unknown villager "${quest.rewards.friendship.npc}"`);
  }

  // A built copy of a map and the cells reachable from its entrance (built once, on demand).
  const reachable = new Map<string, { map: GameMap; cells: Uint8Array } | undefined>();
  const reachOn = (id: string): { map: GameMap; cells: Uint8Array } | undefined => {
    if (!reachable.has(id)) {
      const def = index.mapById.get(id);
      let entry: { map: GameMap; cells: Uint8Array } | undefined;
      try {
        const map = def === undefined ? undefined : GameMap.build(def, index);
        entry = map === undefined ? undefined : { map, cells: map.reachableFrom(map.spawn.x, map.spawn.y) };
      } catch {
        entry = undefined; // the map's own problems are reported above
      }
      reachable.set(id, entry);
    }
    return reachable.get(id);
  };
  /** How many cells of a map can be walked on and reached from its entrance. */
  const countOpen = (id: string): number => {
    const on = reachOn(id);
    return on === undefined ? 0 : on.cells.reduce((n, c) => n + c, 0);
  };
  // --- furniture, recipes, buildings, digging and the museum (Phase 5)
  for (const item of content.items) {
    if (item.kind === 'furniture') {
      if (item.places === undefined || !index.objectById.has(item.places)) add(`item ${item.id}`, `furniture must place a known object, not "${item.places ?? ''}"`);
      if (item.sellPrice !== 0) add(`item ${item.id}`, 'furniture cannot be sold');
      if (item.places !== undefined && (index.objectById.get(item.places)?.footprint.length ?? 1) === 0) add(`item ${item.id}`, 'furniture needs an object with at least one footprint cell, or it could never be placed');
    } else if (item.places !== undefined) add(`item ${item.id}`, 'only furniture places an object');
  }
  for (const recipe of content.recipes) {
    const where = `recipe ${recipe.id}`;
    if (recipe.inputs.length === 0) add(where, 'needs at least one ingredient');
    if (recipe.station !== 'kitchen' && recipe.station !== 'workbench') add(where, `has unknown station "${recipe.station}"`);
    if (!(Number.isInteger(recipe.output.count) && recipe.output.count >= 1)) add(where, 'must make at least one');
    const output = index.itemById.get(recipe.output.item);
    if (output === undefined) add(where, `makes unknown item "${recipe.output.item}"`);
    let inputValue = 0;
    for (const input of recipe.inputs) {
      const item = index.itemById.get(input.item);
      if (item === undefined) { add(where, `needs unknown item "${input.item}"`); continue; }
      if (!(Number.isInteger(input.count) && input.count >= 1)) add(where, `needs a whole number of ${input.item}`);
      if (input.item === recipe.output.item) add(where, 'makes what it takes');
      const source = sources(input.item);
      if (!(source.elsewhere || source.crops.length > 0)) add(where, `needs "${input.item}", which cannot be got`);
      inputValue += item.sellPrice * input.count;
    }
    // Cooking and smelting must pay: the product is worth a fifth more than what went in, or nobody would bother.
    if (output !== undefined && isGoods(output) && output.sellPrice * recipe.output.count < Math.ceil(inputValue * 1.2)) add(where, `makes something worth ${output.sellPrice * recipe.output.count}g from ingredients worth ${inputValue}g`);
    if (recipe.unlock !== undefined) {
      checkConditions(where, recipe.unlock.all);
      if (recipe.unlock.hint.trim().length === 0) add(where, 'an unlock needs a hint that says how to get the recipe');
    }
    if (!stationPlaced(recipe.station)) add(where, `can only be made at a ${recipe.station}, and none stands on any map`);
  }

  const reachableFromStart = (id: string): boolean => mapsReachableFromStart.has(id);
  for (const building of content.buildings) {
    const where = `building ${building.id}`;
    const sitesFor = content.maps.flatMap((m) => (m.sites ?? []).filter((site) => site.building === building.id).map((site) => ({ map: m, site })));
    if (sitesFor.length !== 1) add(where, `needs exactly one site, has ${sitesFor.length}`);
    const object = index.objectById.get(building.object);
    const scaffolding = index.objectById.get(building.scaffolding);
    if (object === undefined) add(where, `its object "${building.object}" does not exist`);
    if (scaffolding === undefined) add(where, `its scaffolding "${building.scaffolding}" does not exist`);
    if (!(Number.isInteger(building.cost.money) && building.cost.money >= 0 && Number.isInteger(building.cost.days) && building.cost.days >= 1)) add(where, 'needs a cost in whole gold and at least one day');
    for (const item of building.cost.items) {
      if (!index.itemById.has(item.id)) add(where, `costs unknown item "${item.id}"`);
      else if (!(sources(item.id).elsewhere || sources(item.id).crops.length > 0)) add(where, `costs "${item.id}", which cannot be got`);
    }
    const target = defOf(building.door.to.map);
    if (target === undefined) add(where, `its door leads to unknown map "${building.door.to.map}"`);
    const place = sitesFor[0];
    if (place !== undefined && object !== undefined && scaffolding !== undefined) {
      if (!reachableFromStart(place.map.id)) add(where, `its site is on ${place.map.id}, which cannot be reached`);
      const onMap = reachOn(place.map.id);
      if (onMap !== undefined) {
        if (!onMap.map.canPlace(scaffolding, place.site.x, place.site.y)) add(where, `its scaffolding does not fit on site ${place.site.id}: something stands there`);
        if (!onMap.map.canPlace(object, place.site.x, place.site.y)) add(where, `the building does not fit on site ${place.site.id}: something stands there`);
        const doorCell = object.footprint.some((c) => c.mode === 'open' && place.site.x + c.dx >= building.door.x && place.site.x + c.dx < building.door.x + building.door.w && place.site.y + c.dy >= building.door.y && place.site.y + c.dy < building.door.y + building.door.h);
        if (!doorCell) add(where, 'its door is not on an open cell of the building');
        const front = { x: building.door.x, y: building.door.y + 1 };
        if (!onMap.map.isWalkable(front.x, front.y)) add(where, `the way to its door (${front.x},${front.y}) is blocked`);
      }
    }
  }
  if (content.buildings.length > 0 && !content.npcs.some((n) => n.carpenter === true)) add('buildings', 'there is no carpenter to build them');

  // Dig spots and what they hold.
  const artifactItems = content.items.filter((i) => i.kind === 'artifact');
  for (const map of content.maps) {
    if (map.dig === undefined) continue;
    const where = `map ${map.id} dig`;
    if (!index.nodeById.has('dig_spot')) add(where, 'needs the "dig_spot" node');
    if (map.dig.artifacts.length === 0 || map.dig.count < 1) add(where, 'needs artifacts and at least one spot a day');
    for (const a of map.dig.artifacts) {
      if (index.itemById.get(a.item)?.kind !== 'artifact') add(where, `buries "${a.item}", which is not an artifact`);
      if (!(a.weight > 0)) add(where, `"${a.item}" needs a weight above 0`);
    }
    let candidates = 0;
    const on = reachOn(map.id);
    for (const area of map.dig.areas) {
      if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height || area.w < 1 || area.h < 1) add(where, `area ${area.x},${area.y} does not fit on the map`);
      else if (on !== undefined) for (let y = area.y; y < area.y + area.h; y += 1) for (let x = area.x; x < area.x + area.w; x += 1) if (on.map.isWalkable(x, y) && on.cells[y * map.width + x] === 1 && !on.map.isTillable(x, y) && on.map.interactableAt(x, y) === undefined) candidates += 1;
    }
    if (on !== undefined && candidates < map.dig.count * 3) add(where, `has ${candidates} places to dig, too few for ${map.dig.count} spots a day`);
  }
  // (A small test world has no digging at all; a full world must bury everything it names.)
  if (content.museum !== undefined || content.maps.some((m) => m.dig !== undefined)) {
    for (const artifact of artifactItems) {
      if (!content.maps.some((m) => (m.dig?.artifacts ?? []).some((a) => a.item === artifact.id))) add(`item ${artifact.id}`, 'is an artifact that nothing buries');
    }
  }

  const museum = content.museum;
  if (museum !== undefined) {
    const where = `museum ${museum.id}`;
    const seen = new Set<string>();
    const kindOf = { fish: 'fish', mineral: 'mineral', artifact: 'artifact' } as const;
    for (const slot of museum.slots) {
      if (seen.has(slot.item)) add(where, `lists "${slot.item}" twice`);
      seen.add(slot.item);
      const item = index.itemById.get(slot.item);
      if (item === undefined) add(where, `wants unknown item "${slot.item}"`);
      else {
        if (item.kind !== kindOf[slot.section]) add(where, `"${slot.item}" is a ${item.kind}, not a ${slot.section}`);
        const source = sources(slot.item);
        if (!(source.elsewhere || source.crops.length > 0)) add(where, `wants "${slot.item}", which cannot be got`);
      }
    }
    let last = 0;
    for (const milestone of museum.milestones) {
      if (milestone.count <= last || milestone.count > museum.slots.length) add(where, `a reward at ${milestone.count} is out of order or beyond the ${museum.slots.length} things it collects`);
      last = milestone.count;
      for (const item of milestone.reward.items ?? []) if (!index.itemById.has(item.id)) add(where, `a reward gives unknown item "${item.id}"`);
      if (milestone.message.trim().length === 0) add(where, 'a reward needs a message');
    }
    if (!content.maps.some((m) => mapHasObject(m, (id) => index.objectById.get(id)?.interact?.action?.kind === 'museum'))) add(where, 'has no display case on any map');
  }
  if (museum === undefined) {
    for (const map of content.maps) if (mapHasObject(map, (id) => index.objectById.get(id)?.interact?.action?.kind === 'museum')) add(`map ${map.id}`, 'has a display case, but the content has no museum');
  }

  // --- the new game
  const kit = content.newGame;
  if (!(Number.isInteger(kit.money) && kit.money >= 0)) add('newGame', 'money must be a whole number, 0 or more');
  let kitStacks = 0;
  for (const stack of kit.items) {
    const item = index.itemById.get(stack.id);
    if (item === undefined) add('newGame', `starts with unknown item "${stack.id}"`);
    else {
      if (stack.count < 1 || stack.count > item.maxStack) add('newGame', `${stack.count} ${stack.id} does not fit in one stack`);
      kitStacks += 1;
    }
  }
  if (kitStacks > INVENTORY_SLOTS) add('newGame', `starts with ${kitStacks} stacks but there are only ${INVENTORY_SLOTS} slots`);

  // --- regions
  for (const region of content.regions) {
    const start = index.mapById.get(region.startMap);
    if (start === undefined) add(`region ${region.id}`, `start map "${region.startMap}" does not exist`);
    else if (start.regionId !== region.id) add(`region ${region.id}`, `start map "${region.startMap}" belongs to another region`);
    if (region.unlock.kind === 'conditions') {
      const unlock = region.unlock;
      if (unlock.all.length === 0 || unlock.message.trim().length === 0) add(`region ${region.id}`, 'an unlock needs conditions and a message that says what to do');
      if (region.id === index.mapById.get(content.startMap)?.regionId) add(`region ${region.id}`, 'the region the game starts in cannot be locked');
      checkConditions(`region ${region.id}`, unlock.all);
      // The quest that opens a region must be doable without having been in it.
      for (const condition of unlock.all) {
        if (condition.kind !== 'quest') continue;
        const quest = index.questById.get(condition.id);
        for (const objective of quest?.objectives ?? []) {
          if (objective.kind === 'mine') add(`region ${region.id}`, `unlocked by "${condition.id}", which asks the player to mine (inside the region)`);
          if (objective.kind === 'visit' && !openMaps.has(objective.map)) add(`region ${region.id}`, `unlocked by "${condition.id}", which asks the player to go somewhere that needs the unlock first`);
        }
      }
      // And there must be a way in at all.
      if (![...mapsReachableFromStart].some((id) => defOf(id)?.regionId === region.id)) add(`region ${region.id}`, 'cannot be reached from the start');
    }
  }

  // --- festivals, the notice board and the weekly market (Phase 6)
  const festivalDates = new Set<string>();
  for (const festival of content.festivals) {
    const where = `festival ${festival.id}`;
    if (!isSeason(festival.season) || !Number.isInteger(festival.day) || festival.day < 1 || festival.day > 28) add(where, 'needs a season and a day from 1 to 28');
    const date = `${festival.season} ${festival.day}`;
    if (festivalDates.has(date)) add(where, `shares its date (${date}) with another festival`);
    festivalDates.add(date);
    if (!(festival.from >= 6 * 60 && festival.to <= 26 * 60 && festival.from < festival.to)) add(where, 'must open and close between 6:00 am and 2:00 am, and open before it closes');
    if (!index.npcById.has(festival.host)) add(where, `host "${festival.host}" is not a villager`);
    if (!festival.places.some((p) => p.npc === festival.host)) add(where, 'its host has no place to stand, so nobody could talk to them');
    if (festival.intro.length === 0) add(where, 'needs an introduction for the host to say');
    const { rivals } = festival;
    if (!Number.isInteger(rivals.count) || rivals.count < 1 || rivals.count > 10 || !Number.isInteger(rivals.min) || !Number.isInteger(rivals.max) || rivals.min < 0 || rivals.max < rivals.min) add(where, 'rivals need a whole count from 1 to 10 and a score range from 0 up');
    if (festival.activity.kind === 'harvest-fair' && !(festival.activity.priceStep >= 1)) add(where, 'a fair scores by a price step of 1 or more');
    if (festival.activity.kind === 'lantern-night' && !(Number.isInteger(festival.activity.bonus) && festival.activity.bonus >= 0)) add(where, 'a lantern night needs a whole friendship bonus, 0 or more');
    const on = reachOn(festival.map);
    if (on === undefined) add(where, `is held on unknown map "${festival.map}"`);
    const seenNpc = new Set<string>();
    const seenCell = new Set<number>();
    for (const place of festival.places) {
      if (!index.npcById.has(place.npc)) add(where, `places unknown villager "${place.npc}"`);
      if (seenNpc.has(place.npc)) add(where, `places ${place.npc} twice`);
      seenNpc.add(place.npc);
      if (place.facing !== undefined && !isDirection(place.facing)) add(where, `${place.npc} faces an invalid direction`);
      if (on === undefined) continue;
      if (seenCell.has(place.y * on.map.width + place.x)) add(where, `puts two villagers on ${place.x},${place.y}`);
      seenCell.add(place.y * on.map.width + place.x);
      if (!on.map.isWalkable(place.x, place.y)) add(where, `${place.npc} stands at ${place.x},${place.y}, which is not walkable`);
      else if (on.cells[place.y * on.map.width + place.x] !== 1) add(where, `${place.npc} stands at ${place.x},${place.y}, which cannot be reached from the entrance`);
      else if (on.map.interactableAt(place.x, place.y) !== undefined) add(where, `${place.npc} stands on something the player can use, at ${place.x},${place.y}`);
      else if (on.map.exits.some((e) => place.x >= e.x && place.y >= e.y && place.x < e.x + e.w && place.y < e.y + e.h)) add(where, `${place.npc} stands in a doorway, at ${place.x},${place.y}`);
    }
    // Decorations and the people standing about must leave every exit of the map reachable on foot.
    if (on !== undefined && (festival.decorations?.length ?? 0) > 0) {
      const { map } = on;
      const blocked = new Set<number>([...(festival.decorations ?? []), ...festival.places].map((c) => c.y * map.width + c.x));
      const seen = new Uint8Array(map.width * map.height);
      const queue: number[] = [map.spawn.y * map.width + map.spawn.x];
      seen[queue[0] as number] = 1;
      for (let head = 0; head < queue.length; head += 1) {
        const at = queue[head] as number;
        const ax = at % map.width;
        const ay = Math.floor(at / map.width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = ax + dx;
          const ny = ay + dy;
          const next = ny * map.width + nx;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen[next] === 1 || blocked.has(next) || !map.isWalkable(nx, ny)) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (on.cells[y * map.width + x] === 1 && seen[y * map.width + x] === 0 && !blocked.has(y * map.width + x)) {
            add(where, `its decorations and people shut off the cell ${x},${y}, which can be reached without them`);
            x = map.width;
            y = map.height;
          }
        }
      }
    }
    for (const decoration of festival.decorations ?? []) {
      if (!index.objectById.has(decoration.object)) add(where, `puts up unknown object "${decoration.object}"`);
      else if (on !== undefined) {
        const def = index.objectById.get(decoration.object)!;
        if (!on.map.canPlace(def, decoration.x, decoration.y)) add(where, `cannot put a ${decoration.object} at ${decoration.x},${decoration.y}: the place is taken or off the map`);
        else if (festival.places.some((p) => p.x === decoration.x && p.y === decoration.y)) add(where, `puts a ${decoration.object} where ${festival.places.find((p) => p.x === decoration.x && p.y === decoration.y)?.npc} stands`);
      }
    }
    const activity = festival.activity;
    if (activity.kind !== 'hunt' && festival.huntAreas !== undefined) add(where, 'has hunt areas but is not a hunt');
    if (activity.kind === 'hunt') {
      needFrame(where, 'item/festival_egg');
      if (!Number.isInteger(activity.tokens) || activity.tokens < 1 || activity.tokens > 40) add(where, 'a hunt hides 1 to 40 eggs');
      const areas = festival.huntAreas ?? [];
      if (areas.length === 0) add(where, 'a hunt needs areas to hide the eggs in');
      if (on !== undefined && areas.length > 0) {
        let open = 0;
        for (const area of areas) {
          if (area.x < 0 || area.y < 0 || area.x + area.w > on.map.width || area.y + area.h > on.map.height) add(where, `a hunt area at ${area.x},${area.y} is outside the map`);
          for (let y = area.y; y < area.y + area.h; y += 1) {
            for (let x = area.x; x < area.x + area.w; x += 1) {
              const inExit = on.map.exits.some((e) => x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h);
              if (on.map.isWalkable(x, y) && on.cells[y * on.map.width + x] === 1 && on.map.interactableAt(x, y) === undefined && !inExit) open += 1;
            }
          }
        }
        if (open < activity.tokens * 4) add(where, `its areas have only ${open} open cells for ${activity.tokens} eggs`);
      }
    }
    if (activity.kind === 'fishing-contest' && on !== undefined && (index.mapById.get(festival.map)?.fishing ?? []).length === 0) add(where, 'a fishing contest needs water to fish in on its map');
    if (festival.prizes.length === 0) add(where, 'needs prizes');
    festival.prizes.forEach((prize, i) => {
      const before = festival.prizes[i - 1];
      if (!Number.isInteger(prize.rank) || prize.rank < 1 || (before !== undefined && prize.rank <= before.rank) || (i === 0 && prize.rank !== 1)) add(where, 'prizes must start at rank 1 and rise');
      if (!Number.isInteger(prize.money) || prize.money < 0) add(where, `the rank ${prize.rank} prize needs a whole amount of money, 0 or more`);
      if (prize.message.trim().length === 0) add(where, `the rank ${prize.rank} prize needs something to say`);
      for (const item of prize.items ?? []) {
        if (!index.itemById.has(item.id)) add(where, `a prize gives unknown item "${item.id}"`);
        else if (!Number.isInteger(item.count) || item.count < 1 || item.count > (index.itemById.get(item.id)?.maxStack ?? 1)) add(where, `a prize gives ${item.count} ${item.id}, which does not fit in one stack`);
      }
    });
  }

  const pool = content.requests;
  if (pool.givers.length > 0 || pool.offers.length > 0) {
    const where = 'notice board';
    if (pool.givers.length === 0) add(where, 'has requests but nobody to ask for them');
    if (new Set(pool.givers).size !== pool.givers.length) add(where, 'lists a villager twice among the givers');
    for (const giver of pool.givers) if (!index.npcById.has(giver)) add(where, `giver "${giver}" is not a villager`);
    if (!content.maps.some((m) => mapHasObject(m, (id) => index.objectById.get(id)?.interact?.action?.kind === 'board'))) add(where, 'has requests, but no map has a notice board to read them on');
    for (const offer of pool.offers) {
      const label = `${where} / ${offer.item}`;
      const item = index.itemById.get(offer.item);
      if (item === undefined) {
        add(label, 'asks for an unknown item');
        continue;
      }
      if (!isGoods(item)) add(label, 'asks for something that is not produce, a fish, a mineral, an artifact, a dish or a bar');
      if (!Number.isInteger(offer.min) || !Number.isInteger(offer.max) || offer.min < 1 || offer.max < offer.min || offer.max > item.maxStack) add(label, 'needs a whole number range of pieces that fits in one stack');
      if (!(offer.pay >= item.sellPrice) || offer.pay > item.sellPrice * 3) add(label, `pays ${offer.pay} a piece, which should be between its sale price (${item.sellPrice}) and three times that`);
      if (offer.seasons !== undefined) {
        if (offer.seasons.length === 0 || !offer.seasons.every(isSeason)) add(label, 'has an invalid list of seasons');
        // Something that only a crop or a fish gives cannot be asked for in a season it is not to be had.
        const direct = sources(offer.item);
        const seasonal = new Set<string>([...direct.crops.flatMap((id) => index.cropById.get(id)?.seasons ?? []), ...content.fish.filter((f) => f.item === offer.item).flatMap((f) => f.seasons)]);
        const otherwise =
          content.animals.some((a) => a.product === offer.item) ||
          content.shops.some((s) => s.offers.some((o) => o.item === offer.item)) ||
          content.nodes.some((n) => n.drops.some((d) => d.item === offer.item)) ||
          content.recipes.some((r) => r.output.item === offer.item);
        if (!otherwise && seasonal.size > 0) for (const season of offer.seasons) if (!seasonal.has(season)) add(label, `is asked for in ${season}, when nothing gives it`);
      }
      const source = sources(offer.item);
      if (source.crops.length === 0 && !source.elsewhere) add(label, 'is asked for, but nothing in the world gives it');
    }
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const kinds = new Set(pool.offers.filter((o) => o.seasons === undefined || o.seasons.includes(season)).map((o) => o.item));
      if (kinds.size < REQUESTS_PER_DAY) add(where, `has only ${kinds.size} kinds of request in ${season}; the board shows ${REQUESTS_PER_DAY} a day`);
    }
  }

  // Villagers who are away part of the week only make sense if somebody minds the shop when they are there.
  for (const npc of content.npcs) {
    for (const entry of npc.schedule) {
      if (entry.serves !== undefined && entry.map === AWAY) add(`villager ${npc.id}`, 'cannot mind a shop while away');
    }
  }

  // --- fertilizer, sprinklers, crops that need rain and the rare creatures (Phase 7)
  for (const item of content.items) {
    if (item.fertilizes === true && item.kind !== 'supply') add(`item ${item.id}`, 'only a supply can fertilize (it is used up)');
  }
  for (const object of content.objects) {
    if (object.sprinkles === undefined) continue;
    const where = `object ${object.id}`;
    if (!Number.isInteger(object.sprinkles) || object.sprinkles < 1 || object.sprinkles > 3) add(where, 'a sprinkler waters 1 to 3 cells around it');
    if (!content.items.some((i) => i.kind === 'furniture' && i.places === object.id)) add(where, 'is a sprinkler that no item puts down');
  }
  for (const crop of content.crops) {
    if (crop.needsRain === true && !crop.seasons.some((s) => SEASON_WEATHER[s].rain + SEASON_WEATHER[s].storm > 0)) add(`crop ${crop.id}`, 'needs rain, but it never rains in the seasons it can be planted in');
  }
  for (const creature of content.creatures) {
    const where = `creature ${creature.id}`;
    needFrame(where, `creature/${creature.sprite}_0`);
    needFrame(where, `creature/${creature.sprite}_1`);
    if (creature.maps.length === 0) add(where, 'is found on no map');
    for (const id of creature.maps) {
      if (!index.mapById.has(id)) add(where, `is found on unknown map "${id}"`);
      else if (!mapsReachableFromStart.has(id)) add(where, `is found on "${id}", which cannot be reached from the start`);
      else if (countOpen(id) < 4) add(where, `has too little open ground to stand on at "${id}"`);
    }
    if (creature.seasons.length === 0 || !creature.seasons.every(isSeason)) add(where, 'needs one or more valid seasons');
    if (creature.weather.length === 0 || !creature.weather.every((w) => (WEATHERS as readonly string[]).includes(w))) add(where, 'needs one or more valid weathers');
    else if (!creature.seasons.some((s) => creature.weather.some((w) => SEASON_WEATHER[s][w] > 0))) add(where, 'is about only in weather that never happens in its seasons');
    if (!(creature.from >= 0 && creature.to <= 26 * 60 && creature.from < creature.to && creature.to > WAKE_MINUTE)) add(where, 'must be about from before to, some time between 6:00 am and 2:00 am (nobody is up before six)');
    if (!(creature.chance > 0 && creature.chance <= 1)) add(where, 'needs a chance above 0 and up to 1');
    if (creature.likes.length === 0) add(where, 'likes nothing, so it can never be befriended');
    for (const id of creature.likes) {
      const item = index.itemById.get(id);
      if (item === undefined) add(where, `likes unknown item "${id}"`);
      else if (!isGoods(item)) add(where, `likes "${id}", which is not something the player can collect (goods only)`);
      else if (!sources(id).elsewhere && sources(id).crops.length === 0) add(where, `likes "${id}", which cannot be got`);
    }
    const keep = index.itemById.get(creature.keepsake.item);
    if (keep === undefined) add(where, `leaves unknown keepsake "${creature.keepsake.item}"`);
    else if (!Number.isInteger(creature.keepsake.count) || creature.keepsake.count < 1 || creature.keepsake.count > keep.maxStack) add(where, 'leaves a whole number of keepsakes that fits in one stack');
    if (creature.name.trim().length === 0 || creature.description.trim().length === 0) add(where, 'needs a name and something to say about it');
  }
  for (const quest of content.quests) {
    for (const objective of quest.objectives) {
      if (objective.kind === 'see' && (objective.count < 1 || objective.count > content.creatures.length)) add(`quest ${quest.id}`, `asks to see ${objective.count} creatures, but there are ${content.creatures.length}`);
      if (objective.kind === 'befriend' && (objective.count < 1 || objective.count > content.creatures.length)) add(`quest ${quest.id}`, `asks to befriend ${objective.count} creatures, but there are ${content.creatures.length}`);
    }
  }

  // --- maps
  for (const map of content.maps) validateMap(map, index, add, defOf, doorsOn);
  // Villagers' places must be somewhere they can stand and walk to from the map's entrance.
  for (const npc of content.npcs) {
    for (const entry of npc.schedule) {
      const on = reachOn(entry.map);
      if (on === undefined) continue;
      const label = `villager ${npc.id}`;
      if (!on.map.isWalkable(entry.x, entry.y)) add(label, `schedule puts them at ${entry.x},${entry.y} on ${entry.map}, which is not walkable`);
      else if (on.cells[entry.y * on.map.width + entry.x] !== 1) add(label, `schedule puts them at ${entry.x},${entry.y} on ${entry.map}, which cannot be reached from the entrance`);
    }
  }

  // The mine's floors are made by code, so each is checked here as if it were written out by hand.
  // (Only when the content has a way in: a small test world without the forest has no mine.)
  if (content.maps.some((m) => (m.exits ?? []).some((e) => parseMineFloor(e.to.map) !== undefined))) {
    for (let floor = 1; floor <= MINE_FLOORS; floor += 1) validateMap(generateMineFloor(floor), index, add, defOf, doorsOn);
  }

  return problems;
}

function validateMap(
  map: MapDef,
  index: ContentIndex,
  add: (where: string, message: string) => void,
  defOf: (id: string) => MapDef | undefined,
  doorsOn: (mapId: string) => readonly ExitDef[],
): void {
  const where = `map ${map.id}`;
  if (!index.regionById.has(map.regionId)) add(where, `region "${map.regionId}" does not exist`);

  let shapeOk = true;
  for (const [name, rows] of [['terrain', map.terrain], ['props', map.props]] as const) {
    if (rows.length !== map.height) {
      add(where, `${name} has ${rows.length} rows, expected ${map.height}`);
      shapeOk = false;
    }
    rows.forEach((row, y) => {
      if (row.length !== map.width) {
        add(where, `${name} row ${y} has ${row.length} columns, expected ${map.width}`);
        shapeOk = false;
      }
    });
  }
  if (!shapeOk) return;

  for (const [glyph, objectId] of Object.entries(map.propLegend)) {
    if (!index.objectById.has(objectId)) add(where, `legend "${glyph}" points at unknown object "${objectId}"`);
  }
  for (const rule of map.scatter) {
    for (const id of rule.defs) {
      const object = index.objectById.get(id);
      if (object === undefined) add(where, `scatter uses unknown object "${id}"`);
      else if (object.layer !== 'ground') add(where, `scatter object "${id}" must be a ground decal`);
    }
    for (const terrainId of rule.on) if (!index.terrainById.has(terrainId)) add(where, `scatter uses unknown terrain "${terrainId}"`);
  }
  if (!isDirection(map.spawn.facing)) add(where, `spawn facing "${map.spawn.facing}" is not a direction`);

  let built: GameMap;
  try {
    built = GameMap.build(map, index);
  } catch (error) {
    add(where, (error as Error).message);
    return;
  }

  // Objects must sit inside the map, and solid footprints must not stack.
  const solidOwner = new Map<number, string>();
  for (const object of built.objects) {
    for (const cell of object.def.footprint) {
      const cx = object.x + cell.dx;
      const cy = object.y + cell.dy;
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) {
        add(where, `${object.def.id} at ${object.x},${object.y} has a footprint cell outside the map (${cx},${cy})`);
        continue;
      }
      if (cell.mode !== 'solid') continue;
      const key = cy * map.width + cx;
      const owner = solidOwner.get(key);
      if (owner !== undefined) add(where, `${object.def.id} and ${owner} overlap at ${cx},${cy}`);
      solidOwner.set(key, `${object.def.id} at ${object.x},${object.y}`);
      const terrain = built.terrainAt(cx, cy);
      if (terrain?.solid) add(where, `${object.def.id} at ${object.x},${object.y} stands on ${terrain.id}`);
    }
  }

  for (const rect of map.tillable ?? []) {
    if (rect.w < 1 || rect.h < 1 || rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
      add(where, `tillable area ${rect.x},${rect.y} ${rect.w}x${rect.h} does not fit on the map`);
    }
  }

  if (map.ambient !== undefined && !['outdoor', 'indoor', 'cave'].includes(map.ambient)) add(where, `ambient "${map.ambient}" is not outdoor, indoor or cave`);

  // Nodes stand on open ground, one to a cell, clear of objects.
  const nodeCells = new Set<number>();
  for (const spawn of map.nodes ?? []) {
    const label = `node ${spawn.def} at ${spawn.x},${spawn.y}`;
    if (spawn.x < 0 || spawn.y < 0 || spawn.x >= map.width || spawn.y >= map.height) {
      add(where, `${label} is outside the map`);
      continue;
    }
    const key = spawn.y * map.width + spawn.x;
    if (nodeCells.has(key)) add(where, `${label} shares its cell with another node`);
    nodeCells.add(key);
    if (built.terrainAt(spawn.x, spawn.y)?.solid) add(where, `${label} is inside solid terrain`);
    if (solidOwner.has(key)) add(where, `${label} overlaps ${solidOwner.get(key)}`);
  }

  // Fishing zones fit on the map and cover water a player can stand beside.
  for (const zone of map.fishing ?? []) {
    const label = `fishing zone ${zone.water} at ${zone.x},${zone.y}`;
    if (zone.w < 1 || zone.h < 1 || zone.x < 0 || zone.y < 0 || zone.x + zone.w > map.width || zone.y + zone.h > map.height) {
      add(where, `${label} does not fit on the map`);
      continue;
    }
    let usable = false;
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
      for (let x = zone.x; x < zone.x + zone.w; x += 1) {
        if (built.terrainAt(x, y)?.waterSource !== true) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => built.isWalkable(x + (dx as number), y + (dy as number)))) usable = true;
      }
    }
    if (!usable) add(where, `${label} has no water the player can fish from`);
  }

  // Exits: they lead somewhere real, land on open ground that is not itself an exit, and can be walked back.
  for (const exit of map.exits ?? []) {
    const label = `exit at ${exit.x},${exit.y}`;
    if (exit.w < 1 || exit.h < 1 || exit.x < 0 || exit.y < 0 || exit.x + exit.w > map.width || exit.y + exit.h > map.height) {
      add(where, `${label} does not fit on the map`);
      continue;
    }
    let walkable = false;
    for (let y = exit.y; y < exit.y + exit.h; y += 1) for (let x = exit.x; x < exit.x + exit.w; x += 1) if (built.isWalkable(x, y)) walkable = true;
    if (!walkable) add(where, `${label} has no walkable cell`);
    const target = defOf(exit.to.map);
    if (target === undefined) {
      add(where, `${label} leads to unknown map "${exit.to.map}"`);
      continue;
    }
    if (!isDirection(exit.to.facing)) add(where, `${label} arrives facing "${exit.to.facing}"`);
    const arrival = GameMap.build(target, index);
    if (!arrival.isWalkable(exit.to.x, exit.to.y)) add(where, `${label} arrives at ${exit.to.x},${exit.to.y} on ${target.id}, which is not walkable`);
    for (const back of [...(target.exits ?? []), ...doorsOn(target.id)]) {
      if (exit.to.x >= back.x && exit.to.x < back.x + back.w && exit.to.y >= back.y && exit.to.y < back.y + back.h) add(where, `${label} lands inside an exit of ${target.id}, so the player would bounce straight back`);
    }
    if (![...(target.exits ?? []), ...doorsOn(target.id)].some((back) => back.to.map === map.id)) add(where, `${label} leads to ${target.id}, which has no way back`);
  }

  // A ranch needs a coop to open, a trough to fill, and room to wander.
  if (map.ranch !== undefined) {
    const { yard, capacity } = map.ranch;
    if (yard.x < 0 || yard.y < 0 || yard.x + yard.w > map.width || yard.y + yard.h > map.height) add(where, 'the ranch yard does not fit on the map');
    let open = 0;
    for (let y = yard.y; y < yard.y + yard.h; y += 1) for (let x = yard.x; x < yard.x + yard.w; x += 1) if (built.isWalkable(x, y)) open += 1;
    if (open < capacity * 2) add(where, `the ranch yard has ${open} open cells, too few for ${capacity} animals to wander`);
    const kinds = new Set(built.objects.map((o) => o.def.interact?.action?.kind));
    if (!kinds.has('coop')) add(where, 'has a ranch but no coop');
    if (!kinds.has('trough')) add(where, 'has a ranch but no trough');
  } else if (built.objects.some((o) => o.def.interact?.action?.kind === 'coop' || o.def.interact?.action?.kind === 'trough')) {
    add(where, 'has a coop or trough but no ranch configuration');
  }

  // The player must be able to start, and to reach everything that can be interacted with.
  const { spawn } = map;
  if (!built.isWalkable(spawn.x, spawn.y)) {
    add(where, `spawn ${spawn.x},${spawn.y} is not walkable`);
    return;
  }
  const reachable = built.reachableFrom(spawn.x, spawn.y);
  // An object can be used if the player can stand next to at least one of its interactable cells.
  const approachable = new Map<number, boolean>();
  const firstCell = new Map<number, string>();
  for (const target of built.allInteractables()) {
    const approach = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const x = target.cellX + (dx as number);
      const y = target.cellY + (dy as number);
      return built.isWalkable(x, y) && reachable[y * map.width + x] === 1;
    });
    approachable.set(target.objectUid, (approachable.get(target.objectUid) ?? false) || approach);
    if (!firstCell.has(target.objectUid)) firstCell.set(target.objectUid, `${target.objectId} at ${target.cellX},${target.cellY}`);
  }
  for (const [uid, ok] of approachable) {
    if (!ok) add(where, `${firstCell.get(uid)} cannot be reached from the spawn`);
  }

  // A farmable map must be farmable: some soil is workable and reachable, and the can can be refilled.
  if ((map.tillable ?? []).length > 0) {
    let workable = 0;
    let waterReachable = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const standable = (cx: number, cy: number): boolean => built.isWalkable(cx, cy) && reachable[cy * map.width + cx] === 1;
        const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => standable(x + (dx as number), y + (dy as number)));
        if (built.isTillable(x, y) && built.isWalkable(x, y) && beside) workable += 1;
        if (built.isWaterSource(x, y) && beside) waterReachable = true;
      }
    }
    if (workable === 0) add(where, 'has a tillable area but no soil the player can reach and work');
    if (!waterReachable) add(where, 'has a tillable area but no water the player can refill the can from');
  }
}
