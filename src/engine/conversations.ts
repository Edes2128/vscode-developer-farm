import { checkCraft, craft, missingText, recipeLabel, recipesAt } from './crafting/crafting';
import type { RecipeDef, Station } from './crafting/types';
import type { FestivalDef } from './festivals/types';
import { offerLabel, offersFor, purchase, quoteSale, canBuy, type ShopHooks } from './economy/shop';
import type { ShopDef } from './economy/types';
import type { BuildingDef } from './buildings/types';
import type { Inventory } from './inventory/inventory';
import { canAddAll, takeItems } from './inventory/take';
import type { Museum } from './museum/museum';
import {
  isChoosing,
  openDialog,
  withOptions,
  type DialogOption,
  type DialogSpeaker,
  type DialogState,
} from './interaction';
import type { ItemDef, ItemStack } from './items/types';
import type { QuestDef, QuestEvent, QuestReward } from './quests/types';
import type { Request } from './requests/types';
import type { QuestLog } from './quests/questLog';
import type { Ranch } from './ranch/ranch';
import { holds as holdsFor, type Facts } from './social/conditions';
import { pickRule } from './social/dialogue';
import { chat, gift, giftAllowance, heartsOf, isGiftable, MAX_FRIENDSHIP, type NpcRecord } from './social/friendship';
import type { NpcDef } from './social/types';
import type { Villagers } from './social/villagers';
import type { Season } from './time/calendar';
import type { WorldClock } from './time/clock';
import type { GameMap } from './world/gameMap';
import type { World } from './world/world';

/** What the conversations need from the game. The game implements it; nothing here reaches into the game's insides. */
export interface ConversationHost {
  readonly world: World;
  readonly inventory: Inventory;
  readonly villagers: Villagers;
  readonly quests: QuestLog;
  readonly flags: Set<string>;
  readonly clock: WorldClock;
  readonly map: GameMap;
  readonly season: Season;
  readonly dialog: DialogState | undefined;
  money: number;
  facts(): Facts;
  item(id: string): ItemDef | undefined;
  /** The ranch on the current map, for the coop and trough in front of the player. */
  ranchHere(): Ranch | undefined;
  /** The ranch that stocks the farm's coop, for buying animals (the first map that has one). */
  mainRanch(): Ranch | undefined;
  showDialog(dialog: DialogState): void;
  setDialog(dialog: DialogState | undefined): void;
  hint(text: string, tone: 'info' | 'warn'): void;
  endDay(cause: 'slept' | 'exhausted'): void;
  syncStatus(): void;
  notifyQuests(event: QuestEvent): void;
  /** The village museum, if the content has one. */
  readonly museum: Museum | undefined;
  buildingStatus(id: string): 'available' | 'ordered' | 'built';
  buildingShortfall(building: BuildingDef): { money: number; items: { id: string; count: number }[] };
  orderBuilding(id: string): { ok: true; readyDay: number } | { ok: false; note: string };
  /** What is waiting to be built, and the morning each is ready (for the carpenter's talk). */
  readonly pending: readonly { site: string; readyDay: number }[];
  siteOf(buildingId: string): { site: { id: string } } | undefined;
  /** Counts something the player collected (a fish, a mineral, an artifact) for the collection page. */
  readonly collection: Record<string, number>;
  /** How much furniture is put out at home right now. */
  placedCount(): number;
  /** The rare creatures the player has seen and befriended. */
  readonly bestiary: { readonly seenCount: number; readonly friendCount: number };
  /** The festival that is open right now (anywhere), if any. */
  festivalNow(): FestivalDef | undefined;
  /** Today's festival once it has begun, open or closed: its host still settles prizes after it ends. */
  festivalClaimable(): FestivalDef | undefined;
  festivalStatus(): { festival: FestivalDef; score: number; line: string; canClaim: boolean; claimed: boolean } | undefined;
  fairScore(itemId: string, quality: number): number;
  enterFair(itemId: string): { ok: true; score: number } | { ok: false; note: string };
  claimFestival(): { ok: true; rank: number; of: number; message: string; given: string } | { ok: false; note: string };
  /** Extra friendship points for speaking to this villager at a festival (0 when it does not count). */
  festivalChat(npcId: string): number;
  /** The requests on the notice board today. */
  requestsToday(): { request: Request; done: boolean }[];
  fulfilRequest(id: string): { ok: true; paid: number; giver: string } | { ok: false; note: string };
}

const leave: DialogOption = { id: 'leave', label: 'Goodbye', enabled: true };

/**
 * Everything the player can say to or do with a villager, a shop, the coop and the trough, as dialogs. Each choice in
 * a dialog carries an id (`npc:chat:willa`, `buy:2`); `choose` carries it out.
 */
export class Conversations {
  constructor(private readonly host: ConversationHost) {}

  // ------------------------------------------------------------------------------------------ the farm

  openSleep(title: string, lines: readonly string[]): void {
    this.host.showDialog(
      openDialog(title, lines, [
        { id: 'sleep:yes', label: 'Go to bed', enabled: true },
        { id: 'sleep:no', label: 'Not yet', enabled: true },
      ], { kind: 'sleep' }),
    );
  }

  openCoop(title: string): void {
    const ranch = this.host.ranchHere();
    if (ranch === undefined) return;
    const names = ranch.animals.map((a) => `${a.name} (${heartsOf(a.friendship)}♥)`);
    const eggs = ranch.eggCount();
    const lines = [
      ranch.animals.length === 0 ? 'The coop is empty. Willa sells chickens at her stall.' : `${ranch.animals.length} ${ranch.animals.length === 1 ? 'hen lives' : 'hens live'} here: ${names.join(', ')}.`,
      `Eggs in the basket: ${eggs}. Feed in the trough: ${ranch.feed} of ${ranch.config.troughCapacity}.`,
    ];
    const options: DialogOption[] = [];
    if (eggs > 0) options.push({ id: 'coop:collect', label: `Collect the eggs (${eggs})`, enabled: true });
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    this.host.showDialog(openDialog(title, lines, options, { kind: 'coop' }));
  }

  openTrough(title: string): void {
    const ranch = this.host.ranchHere();
    if (ranch === undefined) return;
    const have = this.host.inventory.count(this.feedItem());
    const room = ranch.config.troughCapacity - ranch.feed;
    const lines = [`Feed in the trough: ${ranch.feed} of ${ranch.config.troughCapacity}.`, 'Hens that find feed here overnight leave an egg in the coop.'];
    const options: DialogOption[] = [];
    if (have > 0 && room > 0) options.push({ id: 'trough:fill', label: `Pour in feed (you have ${have})`, enabled: true });
    else if (have === 0) lines.push('You have no chicken feed. Willa sells it at her stall.');
    else lines.push('The trough is full.');
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    this.host.showDialog(openDialog(title, lines, options, { kind: 'trough' }));
  }

  /** A stall with nobody minding it. */
  openClosedStall(shop: ShopDef, title: string): void {
    const keeper = shop.keeper === undefined ? undefined : this.host.world.index.npcById.get(shop.keeper);
    const open = this.host.villagers.nextOpening(shop.id, this.host.clock.minutes);
    const day = open === undefined ? '' : open.inDays === 0 ? 'later' : open.inDays === 1 ? 'tomorrow' : `on ${WEEKDAY_NAMES[open.weekday] ?? 'another day'}`;
    const when = open === undefined ? '' : ` ${open.certain ? 'Back' : 'Perhaps back'} ${day} at ${formatTime(open.at)}.`;
    this.host.showDialog(openDialog(title, [`${keeper?.name ?? 'The keeper'} is away from the stall.${when}`]));
  }

  // ------------------------------------------------------------------------------------------ villagers

  speaker(def: NpcDef): DialogSpeaker {
    return { id: def.id, name: def.name, role: def.role, sprite: def.sprite, hearts: heartsOf(this.host.villagers.record(def.id).friendship) };
  }

  /** Walks up to a villager: a greeting, and what you can do. */
  openNpc(npcId: string): void {
    const def = this.host.villagers.def(npcId);
    if (def === undefined) return;
    const record = this.host.villagers.record(def.id);
    const greeting = pickRule(def.greetings, record, this.host.facts(), def.id, false);
    record.met = true; // after the greeting, which may be the "first meeting" one
    this.host.showDialog(openDialog(def.name, greeting?.lines ?? ['...'], this.npcOptions(def), { kind: 'npc', npc: def.id }, this.speaker(def)));
  }

  private npcOptions(def: NpcDef): DialogOption[] {
    const host = this.host;
    const record = host.villagers.record(def.id);
    const options: DialogOption[] = [{ id: `npc:chat:${def.id}`, label: 'Chat', enabled: true }];

    const stack = host.inventory.selectedStack();
    const item = stack === null ? undefined : host.item(stack.id);
    if (stack !== null && item !== undefined && isGiftable(item)) {
      const allowance = giftAllowance(record, host.clock.day);
      const label = allowance === 'ok' ? `Give ${item.name}` : allowance === 'today' ? `Give ${item.name} (already today)` : `Give ${item.name} (enough this week)`;
      options.push({ id: `npc:gift:${def.id}`, label, enabled: allowance === 'ok' });
    }

    const shop = host.world.index.content.shops.find((s) => s.keeper === def.id);
    if (shop !== undefined && host.villagers.servingShop(shop.id, host.map.id, host.clock.minutes) !== undefined) {
      options.push({ id: `npc:shop:${def.id}`, label: 'Buy or sell', enabled: true });
    }

    for (const delivery of host.quests.deliveries(def.id)) {
      const have = host.inventory.count(delivery.objective.item);
      const name = host.item(delivery.objective.item)?.name ?? delivery.objective.item;
      options.push({ id: `npc:deliver:${def.id}:${delivery.quest.id}`, label: `Hand over ${Math.min(delivery.remaining, Math.max(have, 1))} ${name} (${delivery.quest.title})`, enabled: have > 0 });
    }
    const facts = host.facts();
    for (const id of def.quests) {
      const quest = host.quests.def(id);
      if (quest === undefined) continue;
      if (host.quests.status(id) === 'ready') options.push({ id: `npc:report:${def.id}:${id}`, label: `Report: ${quest.title}`, enabled: true });
    }
    let offered = 0;
    for (const id of def.quests) {
      const quest = host.quests.def(id);
      if (quest === undefined || offered >= 2) continue;
      if (host.quests.canOffer(id, (conditions) => conditions.every((c) => holdsFor(c, facts, def.id)))) {
        options.push({ id: `npc:offer:${def.id}:${id}`, label: `Ask about: ${quest.title}`, enabled: true });
        offered += 1;
      }
    }
    if (def.carpenter === true && host.world.index.content.buildings.length > 0) options.push({ id: `npc:build:${def.id}`, label: 'Ask about building', enabled: true });
    // While it is on the host is at the festival; once it has closed the host can be asked anywhere, so no prize is lost to the clock.
    const festival = host.festivalClaimable();
    if (festival !== undefined && festival.host === def.id && (host.festivalNow() === undefined || festival.map === host.map.id)) {
      options.push({ id: `npc:festival:${def.id}`, label: festival.name, enabled: true });
    }
    options.push(leave);
    return options;
  }

  private chatWith(def: NpcDef): void {
    const host = this.host;
    const record = host.villagers.record(def.id);
    const rule = pickRule(def.chats, record, host.facts(), def.id, true);
    let gained = chat(record, host.clock.day);
    // An evening of lanterns: a word counts, and warms them more, even if the day's ordinary chat with them was already used.
    const extra = host.festivalChat(def.id);
    if (extra > 0) {
      const before = record.friendship;
      record.friendship = Math.min(MAX_FRIENDSHIP, record.friendship + extra);
      gained += record.friendship - before;
    }
    if (gained > 0) host.hint(`${def.name}: friendship +${gained}`, 'info');
    else if (extra > 0) host.hint(`${def.name}: it is good to see you tonight`, 'info');
    this.afterFriendship(def);
    host.showDialog(openDialog(def.name, [...(rule?.lines ?? ['...']), ...this.claimRewards(def)], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
  }

  private giveGift(def: NpcDef): void {
    const host = this.host;
    const record = host.villagers.record(def.id);
    const stack = host.inventory.selectedStack();
    const item = stack === null ? undefined : host.item(stack.id);
    if (stack === null || item === undefined || !isGiftable(item) || giftAllowance(record, host.clock.day) !== 'ok') return;
    host.inventory.take(host.inventory.selected, 1);
    const result = gift(record, def, item.id, host.clock.day);
    const reaction = def.reactions[result.reaction];
    const lines = [...reaction];
    if (result.birthday && result.gained > 0 && def.birthdayThanks.length > 0) lines.push(...def.birthdayThanks);
    host.hint(result.gained === 0 ? `${def.name}: no change` : `${def.name}: friendship ${result.gained > 0 ? '+' : ''}${result.gained}`, result.gained < 0 ? 'warn' : 'info');
    this.afterFriendship(def);
    host.showDialog(openDialog(def.name, [...lines, ...this.claimRewards(def)], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
    host.syncStatus();
  }

  /** Hands over any friendship reward the player has earned and has room for. Returns pages to show. */
  private claimRewards(def: NpcDef): string[] {
    const host = this.host;
    const record = host.villagers.record(def.id);
    const hearts = heartsOf(record.friendship);
    const pages: string[] = [];
    def.rewards.forEach((reward, index) => {
      if (record.rewards.includes(index) || hearts < reward.hearts) return;
      const items = reward.items ?? [];
      if (!canAddAll(host.inventory, items.map((i) => ({ id: i.id, count: i.count, quality: 0 as const })), (id) => host.item(id))) return; // when there is room
      for (const i of items) host.inventory.add({ id: i.id, count: i.count, quality: 0 });
      if (reward.money !== undefined) host.money += reward.money;
      record.rewards.push(index);
      pages.push(reward.message, `You received ${describeGifts(items, reward.money, (id) => host.item(id)?.name)}.`);
    });
    if (pages.length > 0) host.syncStatus();
    return pages;
  }

  private afterFriendship(def: NpcDef): void {
    this.host.notifyQuests({ kind: 'friendship', npc: def.id, hearts: heartsOf(this.host.villagers.record(def.id).friendship) });
  }

  // ------------------------------------------------------------------------------------------ quests

  private offerQuest(def: NpcDef, quest: QuestDef): void {
    const dialog = openDialog(def.name, quest.offer, [
      { id: `quest:accept:${def.id}:${quest.id}`, label: 'Accept', enabled: true },
      { id: 'leave', label: 'Not now', enabled: true },
    ], { kind: 'quest', npc: def.id, quest: quest.id }, this.speaker(def));
    this.host.showDialog({ ...dialog, note: `Quest: ${quest.title}` });
  }

  private acceptQuest(def: NpcDef, quest: QuestDef): void {
    const host = this.host;
    host.quests.accept(quest.id, (objective) => {
      if (objective.kind === 'visit') return host.flags.has(`visited:${objective.map}`) ? 1 : 0;
      if (objective.kind === 'friendship') return heartsOf(host.villagers.record(objective.npc).friendship);
      // Things done before the quest was taken up still count.
      if (objective.kind === 'build') return host.buildingStatus(objective.building) === 'built' ? 1 : 0;
      if (objective.kind === 'donate') return host.museum?.count ?? 0;
      if (objective.kind === 'place') return host.placedCount();
      if (objective.kind === 'see') return host.bestiary.seenCount;
      if (objective.kind === 'befriend') return host.bestiary.friendCount;
      return 0;
    });
    host.hint(`New quest: ${quest.title}`, 'info');
    if (host.quests.status(quest.id) === 'ready') host.hint(`${quest.title}: ready to report to ${def.name}`, 'info');
    host.showDialog(openDialog(def.name, [quest.accepted], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
    host.syncStatus();
  }

  /** Can the player carry what this quest pays? Rewards are never lost to a full pocket. */
  private canCarry(reward: QuestReward): boolean {
    return canAddAll(this.host.inventory, (reward.items ?? []).map((i) => ({ id: i.id, count: i.count, quality: 0 as const })), (id) => this.host.item(id));
  }

  private reportQuest(def: NpcDef, quest: QuestDef): void {
    const host = this.host;
    if (!this.canCarry(quest.rewards)) {
      host.showDialog(openDialog(def.name, ['I have something for you, but your pockets are full. Make a little room and come back.'], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
      return;
    }
    if (host.quests.complete(quest.id) === undefined) return;
    const reward = quest.rewards;
    const given: string[] = [];
    if (reward.money !== undefined) host.money += reward.money;
    for (const i of reward.items ?? []) host.inventory.add({ id: i.id, count: i.count, quality: 0 });
    let animalNote = '';
    if (reward.animal !== undefined) {
      const added = host.mainRanch()?.add(reward.animal);
      if (added !== undefined) animalNote = ` and ${added.name} the ${host.world.index.animalById.get(reward.animal)?.name.toLowerCase() ?? 'animal'}, now living in your coop`;
      else if (reward.fallbackMoney !== undefined) host.money += reward.fallbackMoney;
    }
    if (reward.friendship !== undefined) {
      const record: NpcRecord = host.villagers.record(reward.friendship.npc);
      record.friendship = Math.min(MAX_FRIENDSHIP, record.friendship + reward.friendship.points);
      this.afterFriendship(host.villagers.def(reward.friendship.npc) ?? def);
    }
    if (reward.flag !== undefined) host.flags.add(reward.flag);
    given.push(describeGifts(reward.items ?? [], reward.money, (id) => host.item(id)?.name) + animalNote);
    host.hint(`Quest complete: ${quest.title}`, 'info');
    host.showDialog(openDialog(def.name, [...quest.done, `Reward: ${given.join('')}.`, ...this.claimRewards(def)], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
    host.syncStatus();
  }

  private handOver(def: NpcDef, questId: string): void {
    const host = this.host;
    const delivery = host.quests.deliveries(def.id).find((d) => d.quest.id === questId);
    if (delivery === undefined) return;
    const count = takeItems(host.inventory, delivery.objective.item, Math.min(delivery.remaining, host.inventory.count(delivery.objective.item)));
    if (count === 0) return;
    const name = host.item(delivery.objective.item)?.name ?? delivery.objective.item;
    host.notifyQuests({ kind: 'deliver', item: delivery.objective.item, count, to: def.id });
    const ready = host.quests.status(questId) === 'ready';
    host.showDialog(openDialog(def.name, [`You hand over ${count} ${name}.`, ready ? 'That is everything. Speak to me again to finish up.' : 'Thank you. Whenever you have more, I will be glad of it.'], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
    host.syncStatus();
  }

  // ------------------------------------------------------------------------------------------ the kitchen and the workbench

  private unlocked(recipe: RecipeDef): boolean {
    const facts = this.host.facts();
    return recipe.unlock === undefined || recipe.unlock.all.every((c) => holdsFor(c, facts, ''));
  }

  private craftOptions(station: Station): DialogOption[] {
    const host = this.host;
    const lookup = (id: string): ItemDef | undefined => host.item(id);
    const options: DialogOption[] = recipesAt(host.world.index.content.recipes, station, (r) => this.unlocked(r)).map((recipe) => {
      const check = checkCraft(recipe, host.inventory, lookup);
      return {
        id: `craft:${recipe.id}`,
        label: check.ok ? recipeLabel(recipe, lookup) : `${recipeLabel(recipe, lookup)}${check.reason === 'missing' ? '' : ' (no room)'}`,
        enabled: check.ok,
      };
    });
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    return options;
  }

  openCraft(station: Station, title: string): void {
    const recipes = this.host.world.index.content.recipes.filter((r) => r.station === station);
    const locked = recipes.filter((r) => !this.unlocked(r));
    const lines = [station === 'kitchen' ? 'The kitchen is warm and the pots are clean. What shall we cook?' : 'Tools hang on the wall and the bench is clear. What shall we make?'];
    if (locked.length > 0) lines.push(`There are ${locked.length === 1 ? 'a recipe' : `${locked.length} recipes`} still to learn. ${locked[0]?.unlock?.hint ?? ''}`.trim());
    this.host.showDialog(openDialog(title, lines, this.craftOptions(station), { kind: 'craft', station }));
  }

  private craftRecipe(dialog: DialogState, recipeId: string): void {
    const host = this.host;
    const recipe = host.world.index.recipeById.get(recipeId);
    if (recipe === undefined || dialog.context?.kind !== 'craft') return;
    const lookup = (id: string): ItemDef | undefined => host.item(id);
    const result = craft(recipe, host.inventory, lookup);
    let note: string;
    if (result.ok && result.made !== undefined) {
      const name = host.item(result.made.id)?.name ?? result.made.id;
      note = `Made ${result.made.count > 1 ? `${result.made.count} ` : ''}${name}.`;
      host.notifyQuests({ kind: 'craft', item: result.made.id, count: result.made.count });
    } else if (!result.ok && result.reason === 'missing') note = missingText(result.missing, lookup);
    else note = 'Your pockets are too full to hold it.';
    host.setDialog(withOptions(dialog, this.craftOptions(dialog.context.station), note));
    host.syncStatus();
  }

  // ------------------------------------------------------------------------------------------ the museum

  private museumOptions(museum: Museum): DialogOption[] {
    const host = this.host;
    const seen = new Set<string>();
    const options: DialogOption[] = [];
    for (const stack of host.inventory.slots) {
      if (stack === null || seen.has(stack.id) || museum.canDonate(stack.id) !== 'ok') continue;
      seen.add(stack.id);
      options.push({ id: `museum:give:${stack.id}`, label: `Give the ${host.item(stack.id)?.name ?? stack.id}`, enabled: true });
    }
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    return options;
  }

  private museumLines(museum: Museum): string[] {
    const part = (section: 'fish' | 'mineral' | 'artifact', word: string): string => {
      const p = museum.progress(section);
      return `${word} ${p.have}/${p.total}`;
    };
    const next = museum.nextMilestone();
    // One page, so the choices are always showing.
    return [
      `${museum.def.name}: ${museum.count} of ${museum.def.slots.length} things on display. ${part('fish', 'Fish')}, ${part('mineral', 'minerals')}, ${part('artifact', 'artifacts')}.${next === undefined ? ' Every reward has been earned.' : ` The next reward is at ${next.count}.`}`,
    ];
  }

  openMuseum(title: string): void {
    const museum = this.host.museum;
    if (museum === undefined) return;
    const options = this.museumOptions(museum);
    const lines = this.museumLines(museum);
    if (options.length === 1) lines[0] += ' You have nothing the museum wants right now.';
    this.host.showDialog(openDialog(title, lines, options, { kind: 'museum' }));
    this.claimMuseumRewards();
  }

  private giveToMuseum(dialog: DialogState, itemId: string): void {
    const host = this.host;
    const museum = host.museum;
    if (museum === undefined || museum.canDonate(itemId) !== 'ok' || host.inventory.count(itemId) < 1) return;
    takeItems(host.inventory, itemId, 1);
    museum.donate(itemId);
    host.notifyQuests({ kind: 'donate' });
    const claimed = this.claimMuseumRewards();
    if (claimed) return; // the curator is talking
    host.setDialog({ ...withOptions(dialog, this.museumOptions(museum), `${host.item(itemId)?.name ?? itemId} is on display now.`), lines: this.museumLines(museum), page: 0 });
    host.syncStatus();
  }

  /** Hands over every milestone reward that has been earned and fits in the pockets. Returns true if the curator now has something to say. */
  private claimMuseumRewards(): boolean {
    const host = this.host;
    const museum = host.museum;
    if (museum === undefined) return false;
    for (const { index, milestone } of museum.claimable()) {
      const items = milestone.reward.items ?? [];
      if (!canAddAll(host.inventory, items.map((i) => ({ id: i.id, count: i.count, quality: 0 as const })), (id) => host.item(id))) {
        host.hint('There is a reward waiting at the museum, but your pockets are full.', 'warn');
        return false;
      }
      museum.claim(index);
      for (const i of items) host.inventory.add({ id: i.id, count: i.count, quality: 0 });
      if (milestone.reward.money !== undefined) host.money += milestone.reward.money;
      const got = describeGifts(items, milestone.reward.money, (id) => host.item(id)?.name);
      host.showDialog(openDialog(museum.def.name, [milestone.message, `You received ${got}.`]));
      host.syncStatus();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------ the carpenter

  private costText(building: BuildingDef): string {
    const parts = [`${building.cost.money}g`, ...building.cost.items.map((i) => `${i.count} ${this.host.item(i.id)?.name ?? i.id}`)];
    return parts.join(', ');
  }

  private buildOptions(): DialogOption[] {
    const host = this.host;
    const options: DialogOption[] = host.world.index.content.buildings.map((building) => {
      const status = host.buildingStatus(building.id);
      if (status === 'built') return { id: `build:${building.id}`, label: `${building.name} · built`, enabled: false };
      if (status === 'ordered') return { id: `build:${building.id}`, label: `${building.name} · being built`, enabled: false };
      const short = host.buildingShortfall(building);
      const ready = short.money === 0 && short.items.length === 0;
      return { id: `build:${building.id}`, label: `${building.name} · ${this.costText(building)}`, enabled: ready };
    });
    options.push({ id: 'leave', label: 'Not now', enabled: true });
    return options;
  }

  private openBuild(def: NpcDef): void {
    const lines = ['I can put up what you need, if you have the money and the materials. It takes a few days: the work is done when you wake.'];
    this.host.showDialog(openDialog(def.name, lines, this.buildOptions(), { kind: 'build', npc: def.id }, this.speaker(def)));
  }

  private orderBuilding(dialog: DialogState, buildingId: string): void {
    const host = this.host;
    if (dialog.context?.kind !== 'build') return;
    const def = host.villagers.def(dialog.context.npc);
    const building = host.world.index.buildingById.get(buildingId);
    if (def === undefined || building === undefined) return;
    const result = host.orderBuilding(buildingId);
    if (!result.ok) {
      host.setDialog(withOptions(dialog, this.buildOptions(), result.note));
      return;
    }
    host.hint(`The carpenter will have the ${building.name.toLowerCase()} ready on day ${result.readyDay}.`, 'info');
    host.showDialog(openDialog(def.name, [`The ${building.name.toLowerCase()}. Good choice. Leave it with me: look for it on the farm in ${building.cost.days} days.`], [], { kind: 'npc', npc: def.id }, this.speaker(def)));
  }

  // ------------------------------------------------------------------------------------------ the notice board

  private boardOptions(): DialogOption[] {
    const host = this.host;
    const options: DialogOption[] = host.requestsToday().map(({ request, done }) => {
      const giver = host.world.index.npcById.get(request.giver)?.name ?? request.giver;
      const name = host.item(request.item)?.name ?? request.item;
      const have = host.inventory.count(request.item);
      const label = done ? `${giver}: ${request.count} ${name} · done` : `${giver}: ${request.count} ${name} · ${request.money}g${have < request.count ? ` (you have ${have})` : ''}`;
      return { id: `board:give:${request.id}`, label, enabled: !done && have >= request.count };
    });
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    return options;
  }

  openBoard(title: string): void {
    const options = this.boardOptions();
    const lines = ['Requests from the village. Hand one in and you are paid on the spot; whoever asked will remember it.'];
    if (options.length === 1) lines[0] = 'Nothing is pinned up today.';
    this.host.showDialog(openDialog(title, lines, options, { kind: 'board' }));
  }

  private giveRequest(dialog: DialogState, id: string): void {
    const host = this.host;
    const result = host.fulfilRequest(id);
    if (!result.ok) {
      host.setDialog(withOptions(dialog, this.boardOptions(), result.note));
      return;
    }
    const giver = host.world.index.npcById.get(result.giver)?.name ?? result.giver;
    host.setDialog(withOptions(dialog, this.boardOptions(), `${giver} will be glad of it: +${result.paid}g`));
    this.afterFriendshipOf(result.giver);
    host.syncStatus();
  }

  private afterFriendshipOf(npcId: string): void {
    const def = this.host.villagers.def(npcId);
    if (def !== undefined) this.afterFriendship(def);
  }

  // ------------------------------------------------------------------------------------------ festivals

  private festivalOptions(): DialogOption[] {
    const host = this.host;
    const status = host.festivalStatus();
    const options: DialogOption[] = [];
    if (status === undefined) return [leave];
    // An entry is only taken while the fair is open, and only of the selected item (so say so when nothing suitable is selected).
    if (status.festival.activity.kind === 'harvest-fair' && host.festivalNow() === status.festival && status.score === 0) {
      const stack = host.inventory.selectedStack();
      const def = stack === null ? undefined : host.item(stack.id);
      if (stack !== null && def !== undefined) {
        const best = host.inventory.slots.reduce((q, s) => (s !== null && s.id === stack.id && s.quality > q ? s.quality : q), 0);
        const score = host.fairScore(stack.id, best);
        options.push({ id: `festival:enter:${stack.id}`, label: `Enter your best ${def.name} (scores ${score})`, enabled: score > 0 });
      } else options.push({ id: 'festival:enter', label: 'Enter something (select it in your hotbar first)', enabled: false });
    }
    options.push({ id: 'festival:claim', label: status.claimed ? 'Prize collected' : 'Ask how you did', enabled: status.canClaim });
    options.push(leave);
    return options;
  }

  openFestival(def: NpcDef): void {
    const status = this.host.festivalStatus();
    if (status === undefined) return;
    const lines = [...status.festival.intro, status.line];
    this.host.showDialog(openDialog(status.festival.name, lines, this.festivalOptions(), { kind: 'festival', npc: def.id }, this.speaker(def)));
  }

  private chooseFestival(dialog: DialogState, verb: string | undefined, itemId: string | undefined): void {
    const host = this.host;
    const status = host.festivalStatus();
    if (status === undefined) {
      host.setDialog(undefined);
      return;
    }
    const speaker = dialog.context?.kind === 'festival' ? host.villagers.def(dialog.context.npc) : undefined;
    if (verb === 'enter' && itemId !== undefined) {
      const result = host.enterFair(itemId);
      const fresh = host.festivalStatus();
      host.setDialog({ ...withOptions(dialog, this.festivalOptions(), result.ok ? `Entered: the judge gives it ${result.score}.` : result.note), lines: [...status.festival.intro, fresh?.line ?? status.line], page: status.festival.intro.length });
      host.syncStatus();
      return;
    }
    if (verb === 'claim') {
      const result = host.claimFestival();
      if (!result.ok) {
        host.setDialog(withOptions(dialog, this.festivalOptions(), result.note));
        return;
      }
      const place = result.rank === 1 ? 'first' : result.rank === 2 ? 'second' : result.rank === 3 ? 'third' : `place ${result.rank}`;
      host.showDialog(openDialog(status.festival.name, [result.message, `You came ${place} of ${result.of}. You received ${result.given}.`], [], speaker === undefined ? undefined : { kind: 'npc', npc: speaker.id }, speaker === undefined ? undefined : this.speaker(speaker)));
      host.syncStatus();
    }
  }

  // ------------------------------------------------------------------------------------------ shops

  private shopHooks(): ShopHooks {
    const host = this.host;
    return {
      items: (id) => host.item(id),
      animalName: (kind) => host.world.index.animalById.get(kind)?.name,
      animalRoom: () => host.mainRanch() !== undefined && !(host.mainRanch()?.isFull ?? true),
      addAnimal: (kind) => host.mainRanch()?.add(kind) !== undefined,
    };
  }

  openShop(shop: ShopDef, npcId?: string): void {
    const keeper = npcId === undefined ? undefined : this.host.villagers.def(npcId);
    const lines = [keeper === undefined ? 'What would you like?' : 'What can I get you?'];
    this.host.showDialog(openDialog(shop.name, lines, this.shopOptions(shop), { kind: 'shop', shop: shop.id, ...(npcId === undefined ? {} : { npc: npcId }) }, keeper === undefined ? undefined : this.speaker(keeper)));
  }

  shopOptions(shop: ShopDef): DialogOption[] {
    const host = this.host;
    const hooks = this.shopHooks();
    const options: DialogOption[] = offersFor(shop, host.season).map((offer, index) => ({
      id: `buy:${index}`,
      label: offerLabel(offer, hooks, canBuy(offer, host.money, host.inventory, hooks) === 'owned'),
      enabled: canBuy(offer, host.money, host.inventory, hooks) === 'ok',
    }));
    const stack = host.inventory.selectedStack();
    const quote = quoteSale(shop, stack, stack === null ? undefined : host.item(stack.id), host.clock.day);
    if (quote !== undefined && stack !== null) {
      const name = host.item(stack.id)?.name ?? stack.id;
      const trend = quote.percent === 0 ? 'usual price' : `${quote.percent > 0 ? '+' : ''}${quote.percent}% today`;
      options.push({ id: 'sell:selected', label: `Sell ${stack.count} ${name} · ${quote.total}g (${trend})`, enabled: true });
    }
    options.push({ id: 'leave', label: 'Leave', enabled: true });
    return options;
  }

  private buy(dialog: DialogState, shop: ShopDef, index: number): void {
    const host = this.host;
    const offer = offersFor(shop, host.season)[index];
    if (offer === undefined) return;
    const result = purchase(offer, host.money, host.inventory, this.shopHooks());
    if (result.ok) host.money = result.money;
    host.setDialog(withOptions(dialog, this.shopOptions(shop), result.note));
    host.syncStatus();
  }

  private sell(dialog: DialogState, shop: ShopDef): void {
    const host = this.host;
    const stack: ItemStack | null = host.inventory.selectedStack();
    const def = stack === null ? undefined : host.item(stack.id);
    const quote = quoteSale(shop, stack, def, host.clock.day);
    if (stack === null || def === undefined || quote === undefined) {
      host.setDialog(withOptions(dialog, this.shopOptions(shop), 'There is nothing selected that she buys.'));
      return;
    }
    const taken = host.inventory.take(host.inventory.selected, stack.count);
    if (taken === undefined) return;
    host.money += quote.total;
    host.setDialog(withOptions(dialog, this.shopOptions(shop), `Sold ${taken.count} ${def.name} for ${quote.total}g.`));
    host.syncStatus();
  }

  // ------------------------------------------------------------------------------------------ choices

  /** Carries out the highlighted choice of the open dialog. */
  choose(dialog: DialogState): void {
    const option = dialog.options[dialog.selected];
    if (option === undefined || !option.enabled || !isChoosing(dialog)) return;
    const host = this.host;
    const [kind, a] = option.id.split(':') as [string, string | undefined];

    switch (kind) {
      case 'sleep':
        if (a === 'yes') host.endDay('slept');
        else host.setDialog(undefined);
        return;
      case 'buy':
      case 'sell': {
        const shop = dialog.context?.kind === 'shop' ? host.world.index.shopById.get(dialog.context.shop) : undefined;
        if (shop === undefined) return;
        if (kind === 'buy') this.buy(dialog, shop, Number(a));
        else this.sell(dialog, shop);
        return;
      }
      case 'npc':
        this.chooseNpc(option.id); // npc:<verb>:<npc>[:<quest>]
        return;
      case 'quest':
        this.chooseQuest(option.id);
        return;
      case 'craft':
        if (a !== undefined) this.craftRecipe(dialog, a);
        return;
      case 'museum':
        if (a === 'give') this.giveToMuseum(dialog, option.id.split(':')[2] ?? '');
        return;
      case 'build':
        if (a !== undefined) this.orderBuilding(dialog, a);
        return;
      case 'board':
        if (a === 'give') this.giveRequest(dialog, option.id.slice('board:give:'.length));
        return;
      case 'festival':
        this.chooseFestival(dialog, a, option.id.split(':')[2]);
        return;
      case 'coop':
        this.collectEggs();
        return;
      case 'trough':
        this.fillTrough();
        return;
      default:
        host.setDialog(undefined);
    }
  }

  private chooseNpc(id: string): void {
    const [, verb, npcId, questId] = id.split(':') as [string, string, string, string | undefined];
    const def = this.host.villagers.def(npcId);
    if (def === undefined) return;
    switch (verb) {
      case 'chat':
        this.chatWith(def);
        break;
      case 'gift':
        this.giveGift(def);
        break;
      case 'shop': {
        const shop = this.host.world.index.content.shops.find((s) => s.keeper === def.id);
        if (shop !== undefined) this.openShop(shop, def.id);
        break;
      }
      case 'build':
        this.openBuild(def);
        break;
      case 'festival':
        this.openFestival(def);
        break;
      case 'offer': {
        const quest = questId === undefined ? undefined : this.host.quests.def(questId);
        if (quest !== undefined) this.offerQuest(def, quest);
        break;
      }
      case 'report': {
        const quest = questId === undefined ? undefined : this.host.quests.def(questId);
        if (quest !== undefined) this.reportQuest(def, quest);
        break;
      }
      case 'deliver':
        if (questId !== undefined) this.handOver(def, questId);
        break;
    }
  }

  private chooseQuest(id: string): void {
    const [, verb, npcId, questId] = id.split(':') as [string, string, string, string];
    const def = this.host.villagers.def(npcId);
    const quest = this.host.quests.def(questId);
    if (def === undefined || quest === undefined) return;
    if (verb === 'accept') this.acceptQuest(def, quest);
  }

  private collectEggs(): void {
    const host = this.host;
    const ranch = host.ranchHere();
    if (ranch === undefined) return;
    let total = 0;
    for (const stack of ranch.collect()) {
      const left = host.inventory.add(stack);
      if (left > 0) ranch.basket.push({ ...stack, count: left });
      const taken = stack.count - left;
      if (taken > 0) {
        total += taken;
        host.notifyQuests({ kind: 'collect', item: stack.id, count: taken });
      }
    }
    host.setDialog(undefined);
    host.hint(total > 0 ? `+${total} ${total === 1 ? 'Egg' : 'Eggs'}` : 'Your pockets are full.', total > 0 ? 'info' : 'warn');
    host.syncStatus();
  }

  private fillTrough(): void {
    const host = this.host;
    const ranch = host.ranchHere();
    if (ranch === undefined) return;
    const feed = this.feedItem();
    const amount = Math.min(host.inventory.count(feed), ranch.config.troughCapacity - ranch.feed);
    if (amount <= 0) return;
    takeItems(host.inventory, feed, amount);
    ranch.addFeed(amount);
    host.setDialog(undefined);
    host.hint(`Poured in ${amount} ${amount === 1 ? 'scoop' : 'scoops'} of feed`, 'info');
    host.syncStatus();
  }

  private feedItem(): string {
    return this.host.world.index.content.animals[0]?.feed ?? 'chicken_feed';
  }
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatTime(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${hour24 % 12 === 0 ? 12 : hour24 % 12}:${String(minute).padStart(2, '0')} ${hour24 >= 12 ? 'pm' : 'am'}`;
}

function describeGifts(items: readonly { id: string; count: number }[], money: number | undefined, name: (id: string) => string | undefined): string {
  const parts = items.map((i) => `${i.count} ${name(i.id) ?? i.id}`);
  if (money !== undefined && money > 0) parts.push(`${money} gold`);
  return parts.length === 0 ? 'nothing' : parts.join(' and ');
}
