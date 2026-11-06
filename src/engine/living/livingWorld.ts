/**
 * The living world: the weather, the festivals and the notice board. It owns what the game remembers about them (how the
 * player is doing at today's festival, which requests were handed in today, the days the sky is always clear, the painted
 * eggs and decorations laid out for the open festival) and the rules that follow from them. It is created by `Game`, which
 * stays the façade: its weather, festival and board methods delegate here.
 *
 * What it asks of the game (`LivingWorldHost`): the world and the clock, the map and the player (for the egg hunt and the
 * decorations), the pockets and the money (for entries, prizes and payments), the villagers (a request warms its giver), and
 * the usual hint, status and quest hooks. It never reaches further into the game than that.
 */
import { digSpots } from '../digging/digging';
import { festivalDays, festivalOn, isOpen } from '../festivals/festivals';
import { prizeFor, rankOf, rivalScores } from '../festivals/rankings';
import type { FestivalDef, FestivalPrize } from '../festivals/types';
import type { Emitter } from '../core/emitter';
import type { GameEvents } from '../game';
import type { Inventory } from '../inventory/inventory';
import { canAddAll, takeItems } from '../inventory/take';
import { isGoods, unitPrice, type ItemDef, type Quality } from '../items/types';
import { worldToTile } from '../math/coords';
import type { GameSaveState } from '../persistence/saveFormat';
import type { PlayerState } from '../player/player';
import type { QuestEvent } from '../quests/types';
import { paymentFor, requestsFor } from '../requests/requests';
import type { Request } from '../requests/types';
import { heartsOf } from '../social/friendship';
import type { DayContext, Villagers } from '../social/villagers';
import type { WorldClock } from '../time/clock';
import type { Weather } from '../weather/types';
import { forecastFor, watersFields, weatherOn } from '../weather/weather';
import type { GameMap } from '../world/gameMap';
import type { World } from '../world/world';

/** What the living world needs from the game. The game implements it; nothing here reaches into the game's insides. */
export interface LivingWorldHost {
  readonly world: World;
  readonly clock: WorldClock;
  /** The map being shown (it changes when the player walks through an exit). */
  readonly map: GameMap;
  readonly player: PlayerState;
  readonly inventory: Inventory;
  readonly villagers: Villagers;
  readonly events: Emitter<GameEvents>;
  money: number;
  item(id: string): ItemDef | undefined;
  hint(text: string, tone: 'info' | 'warn'): void;
  syncStatus(): void;
  notifyQuests(event: QuestEvent): void;
  /** Is somebody standing in this cell (the player, or a villager on the current map)? */
  occupied(x: number, y: number): boolean;
}

/** How the player is doing at today's festival (it only counts for the day it was made on). */
export interface FestivalProgress {
  day: number;
  score: number;
  found: Set<number>;
  entered: boolean;
  talked: Set<string>;
  claimed: boolean;
}

export class LivingWorld {
  /** How the player is doing at today's festival (it only counts for the day it was made on). */
  festivalProgress: FestivalProgress;
  /** Requests handed in to the notice board today. */
  readonly boardDone: { day: number; done: Set<string> };
  /** The days festivals fall on: the sky is always clear on them. */
  readonly clearDays: Set<number>;

  private weatherDay = 0;
  private weatherToday: Weather = 'sun';
  /** Where the painted eggs of today's hunt are on the current map (cells), cached for the day and map. */
  private huntTokens: { key: string; cells: { x: number; y: number }[] } = { key: '', cells: [] };
  /** What the open festival has put up on the map being shown (so it can be taken down again). */
  private decor: { key: string; map: GameMap; uids: number[]; waiting: { object: string; x: number; y: number }[] } | undefined;

  constructor(
    private readonly host: LivingWorldHost,
    saved?: GameSaveState,
  ) {
    const { content } = host.world.index;
    this.clearDays = festivalDays(content.festivals);
    const sameDay = saved !== undefined && saved.festival.day === saved.time.day;
    this.festivalProgress = {
      day: sameDay ? saved.festival.day : 0,
      score: sameDay ? saved.festival.score : 0,
      found: new Set(sameDay ? saved.festival.found : []),
      entered: sameDay ? saved.festival.entered : false,
      talked: new Set(sameDay ? saved.festival.talked : []),
      claimed: sameDay ? saved.festival.claimed : false,
    };
    this.boardDone = { day: saved !== undefined && saved.board.day === saved.time.day ? saved.board.day : 0, done: new Set(saved !== undefined && saved.board.day === saved.time.day ? saved.board.done : []) };
  }

  /** What goes into the save: today's festival record and the board, each only for the day it belongs to. */
  toSave(): Pick<GameSaveState, 'festival' | 'board'> {
    return {
      festival: {
        day: this.festivalProgress.day === this.host.clock.day ? this.festivalProgress.day : 0,
        score: this.festivalProgress.day === this.host.clock.day ? this.festivalProgress.score : 0,
        found: this.festivalProgress.day === this.host.clock.day ? [...this.festivalProgress.found] : [],
        entered: this.festivalProgress.day === this.host.clock.day && this.festivalProgress.entered,
        talked: this.festivalProgress.day === this.host.clock.day ? [...this.festivalProgress.talked] : [],
        claimed: this.festivalProgress.day === this.host.clock.day && this.festivalProgress.claimed,
      },
      board: this.boardDone.day === this.host.clock.day ? { day: this.boardDone.day, done: [...this.boardDone.done] } : { day: 0, done: [] },
    };
  }

  /** The weather today: decided by the day alone (festival days are always clear). */
  get weather(): Weather {
    if (this.weatherDay !== this.host.clock.day) {
      this.weatherDay = this.host.clock.day;
      this.weatherToday = weatherOn(this.host.clock.day, this.clearDays);
    }
    return this.weatherToday;
  }

  /** Tomorrow's weather, which the player can be told today. */
  get forecast(): Weather {
    return forecastFor(this.host.clock.day, this.clearDays);
  }

  /** The festival held today (open or not), if any. */
  get festivalToday(): FestivalDef | undefined {
    return festivalOn(this.host.world.index.content.festivals, this.host.clock.day);
  }

  /** The festival that is open right now, wherever it is held. */
  festivalNow(): FestivalDef | undefined {
    const festival = this.festivalToday;
    return festival !== undefined && isOpen(festival, this.host.clock.minutes) ? festival : undefined;
  }

  /** The festival of today once it has begun, open or closed: what its host will still settle (a prize earned before it ended is still owed). */
  festivalClaimable(): FestivalDef | undefined {
    const festival = this.festivalToday;
    return festival !== undefined && this.host.clock.minutes >= festival.from ? festival : undefined;
  }

  /** What kind of day it is, for the villagers' schedules: the weather, the weekday, and a festival that calls them. */
  dayContext(): DayContext {
    const festival = this.festivalToday;
    return {
      rainy: watersFields(this.weather),
      weekday: (this.host.clock.day - 1) % 7,
      ...(festival === undefined
        ? {}
        : { festival: { map: festival.map, from: festival.from, to: festival.to, places: new Map(festival.places.map((p) => [p.npc, { x: p.x, y: p.y, ...(p.facing === undefined ? {} : { facing: p.facing }) }])) } }),
    };
  }

  /** Today's festival record, started afresh if it belongs to another day. */
  private progress(): FestivalProgress {
    if (this.festivalProgress.day !== this.host.clock.day) {
      this.festivalProgress = { day: this.host.clock.day, score: 0, found: new Set(), entered: false, talked: new Set(), claimed: false };
    }
    return this.festivalProgress;
  }

  /** The painted eggs still hidden on this map today (a hunt, while it is open), as cells. Cached for the day, the map and the count found. */
  get huntEggs(): readonly { x: number; y: number }[] {
    const festival = this.festivalNow();
    if (festival === undefined || festival.activity.kind !== 'hunt' || festival.map !== this.host.map.id) return [];
    const progress = this.progress();
    const key = `${this.host.clock.day}:${this.host.map.id}:${progress.found.size}`;
    if (this.huntTokens.key === key) return this.huntTokens.cells;
    const reach = this.host.map.reachableFromWithRocks(this.host.map.spawn.x, this.host.map.spawn.y);
    const candidates: { x: number; y: number }[] = [];
    // Not under anyone who stands there all day, nor under a lantern.
    const taken = (x: number, y: number): boolean => festival.places.some((p) => p.x === x && p.y === y) || (festival.decorations ?? []).some((d) => d.x === x && d.y === y);
    for (const area of festival.huntAreas ?? []) {
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) {
          const open = this.host.map.isWalkable(x, y) && reach[y * this.host.map.width + x] === 1 && this.host.map.interactableAt(x, y) === undefined && this.host.map.extraAt(x, y) === undefined && !this.host.map.isOverhung(x, y) && !taken(x, y);
          if (open && !this.host.map.exits.some((e) => x >= e.x && y >= e.y && x < e.x + e.w && y < e.y + e.h)) candidates.push({ x, y });
        }
      }
    }
    const all = digSpots(`festival:${festival.id}`, this.host.clock.day, candidates, festival.activity.tokens);
    this.huntTokens = { key, cells: all.filter((c) => !progress.found.has(c.y * 1000 + c.x)) };
    return this.huntTokens.cells;
  }

  /**
   * Puts up the festival's decorations while it is open on this map, and takes them down when it is not (or the map is another).
   * A decoration is never put down on someone: it waits until the cell is clear.
   */
  syncDecorations(): void {
    const festival = this.festivalNow();
    const wanted = festival !== undefined && festival.map === this.host.map.id && (festival.decorations?.length ?? 0) > 0 ? festival : undefined;
    const key = wanted === undefined ? '' : `${wanted.id}:${this.host.map.id}`;
    if ((this.decor?.key ?? '') !== key || (this.decor !== undefined && this.decor.map !== this.host.map)) {
      if (this.decor !== undefined) for (const uid of this.decor.uids) this.decor.map.removeObject(uid);
      this.decor = wanted === undefined ? undefined : { key, map: this.host.map, uids: [], waiting: [...(wanted.decorations ?? [])] };
    }
    if (this.decor === undefined || this.decor.waiting.length === 0) return;
    const still: { object: string; x: number; y: number }[] = [];
    for (const decoration of this.decor.waiting) {
      const def = this.host.world.index.objectById.get(decoration.object);
      if (def === undefined) continue;
      const placed = this.host.occupied(decoration.x, decoration.y) ? undefined : this.host.map.addObject(def, decoration.x, decoration.y);
      if (placed !== undefined) this.decor.uids.push(placed.uid);
      else if (this.host.occupied(decoration.x, decoration.y)) still.push(decoration); // someone is standing there: try again in a moment
    }
    this.decor.waiting = still;
  }

  /** Stepping on a painted egg picks it up. */
  collectEgg(): void {
    const eggs = this.huntEggs;
    if (eggs.length === 0) return;
    const x = worldToTile(this.host.player.x);
    const y = worldToTile(this.host.player.y - 3);
    if (!eggs.some((e) => e.x === x && e.y === y)) return;
    const progress = this.progress();
    progress.found.add(y * 1000 + x);
    progress.score += 1;
    this.host.events.emit('effect', { kind: 'harvest', x, y });
    const total = (this.festivalNow()?.activity.kind === 'hunt' ? this.festivalNow()?.activity : undefined) as { tokens: number } | undefined;
    this.host.hint(`A painted egg! (${progress.score}${total === undefined ? '' : ` of ${total.tokens}`})`, 'info');
  }

  /** How much a festival entry is worth: its price, quality included, in the fair's steps. Nothing when there is no fair today. */
  fairScore(itemId: string, quality: Quality): number {
    const def = this.host.item(itemId);
    const fair = this.festivalToday?.activity;
    return def === undefined || fair?.kind !== 'harvest-fair' ? 0 : Math.round(unitPrice(def, quality) / fair.priceStep);
  }

  /** Gives the harvest fair the best of one kind of thing the player holds. Only one entry a day. */
  enterFair(itemId: string): { ok: true; score: number } | { ok: false; note: string } {
    const festival = this.festivalNow();
    const progress = this.progress();
    if (festival === undefined || festival.activity.kind !== 'harvest-fair') return { ok: false, note: 'There is no fair to enter.' };
    if (progress.entered) return { ok: false, note: 'You have already entered something.' };
    const best = this.host.inventory.slots
      .map((slot, index) => ({ slot, index }))
      .filter((e) => e.slot?.id === itemId)
      .sort((a, b) => (b.slot?.quality ?? 0) - (a.slot?.quality ?? 0))[0];
    const def = this.host.item(itemId);
    if (best === undefined || best.slot === null || best.slot === undefined || def === undefined || !isGoods(def)) return { ok: false, note: 'You have nothing like that to enter.' };
    const score = this.fairScore(itemId, best.slot.quality);
    this.host.inventory.take(best.index, 1);
    progress.entered = true;
    progress.score = score;
    this.host.syncStatus();
    return { ok: true, score };
  }

  /** Landing a fish counts for the contest, if one is on. */
  countContestFish(): void {
    const festival = this.festivalNow();
    if (festival?.activity.kind !== 'fishing-contest' || festival.map !== this.host.map.id) return;
    const progress = this.progress();
    progress.score += 1;
    this.host.hint(`The contest: ${progress.score} fish so far.`, 'info');
  }

  /**
   * Speaking to someone on Lantern Night counts (once for each of them) and warms them more than usual. Returns the extra friendship
   * points, which are owed even if the day's ordinary chat with them was already used.
   */
  festivalChat(npcId: string): number {
    const festival = this.festivalNow();
    if (festival?.activity.kind !== 'lantern-night' || festival.map !== this.host.map.id || !festival.places.some((p) => p.npc === npcId)) return 0;
    const progress = this.progress();
    if (progress.talked.has(npcId)) return 0;
    progress.talked.add(npcId);
    progress.score = progress.talked.size;
    return festival.activity.bonus;
  }

  /** How the player is doing at today's festival (once it has begun), in words, and whether they can ask for the prize. */
  festivalStatus(): { festival: FestivalDef; score: number; line: string; canClaim: boolean; claimed: boolean } | undefined {
    const festival = this.festivalClaimable();
    if (festival === undefined) return undefined;
    const progress = this.progress();
    const activity = festival.activity;
    const line =
      activity.kind === 'hunt'
        ? `You have found ${progress.score} of ${activity.tokens} painted eggs.`
        : activity.kind === 'fishing-contest'
          ? `You have landed ${progress.score} fish for the contest.`
          : activity.kind === 'harvest-fair'
            ? progress.entered
              ? `Your entry is in, and the judge scored it ${progress.score}.`
              : 'You have not entered anything yet.'
            : `You have spoken to ${progress.score} of ${festival.places.length} people tonight.`;
    return { festival, score: progress.score, line, canClaim: progress.score >= 1 && !progress.claimed, claimed: progress.claimed };
  }

  /** The prize row the player's score earns, and how they placed. */
  private festivalResult(festival: FestivalDef, score: number): { prize: FestivalPrize; rank: number; of: number } | undefined {
    const rivals = rivalScores(festival.id, this.host.clock.day, festival.rivals.count, festival.rivals.min, festival.rivals.max);
    const rank = rankOf(score, rivals);
    const prize = prizeFor(festival.prizes, rank);
    return prize === undefined ? undefined : { prize, rank, of: rivals.length + 1 };
  }

  private describePrize(prize: FestivalPrize, items: readonly { id: string; count: number }[]): string {
    return [`${prize.money} gold`, ...items.map((i) => `${i.count} ${this.host.item(i.id)?.name ?? i.id}`)].join(' and ');
  }

  /** Asks the host how the player did: the rank among the rivals decides the prize, which is given once (until bedtime, even after the festival has closed). */
  claimFestival(): { ok: true; rank: number; of: number; message: string; given: string } | { ok: false; note: string } {
    const status = this.festivalStatus();
    if (status === undefined) return { ok: false, note: 'The festival has not begun.' };
    if (status.claimed) return { ok: false, note: 'You have had your prize already.' };
    if (!status.canClaim) return { ok: false, note: 'Take part first.' };
    const result = this.festivalResult(status.festival, status.score);
    if (result === undefined) return { ok: false, note: 'There is no prize for that.' };
    const items = (result.prize.items ?? []).map((i) => ({ id: i.id, count: i.count, quality: 0 as const }));
    if (!canAddAll(this.host.inventory, items, (id) => this.host.item(id))) return { ok: false, note: 'Your pockets are too full for the prize. Make some room and ask again.' };
    for (const stack of items) this.host.inventory.add(stack);
    this.host.money += result.prize.money;
    this.progress().claimed = true;
    this.host.events.emit('sound', { id: 'prize' });
    this.host.syncStatus();
    return { ok: true, rank: result.rank, of: result.of, message: result.prize.message, given: this.describePrize(result.prize, result.prize.items ?? []) };
  }

  /**
   * At the end of the day, a prize that was earned and not asked for is brought round in the night: the money always, the items if
   * they fit. Returns what the morning report should say.
   */
  settleFestival(): string | undefined {
    const status = this.festivalStatus();
    if (status === undefined || !status.canClaim) return undefined;
    const result = this.festivalResult(status.festival, status.score);
    if (result === undefined) return undefined;
    const items = (result.prize.items ?? []).map((i) => ({ id: i.id, count: i.count, quality: 0 as const }));
    const fits = canAddAll(this.host.inventory, items, (id) => this.host.item(id));
    if (fits) for (const stack of items) this.host.inventory.add(stack);
    this.host.money += result.prize.money;
    this.progress().claimed = true;
    const given = this.describePrize(result.prize, fits ? (result.prize.items ?? []) : []);
    return `${status.festival.name}: you placed ${result.rank} of ${result.of}, and your prize was brought round in the night: ${given}.`;
  }

  /** The notice board's requests for today that have not been handed in. */
  requestsToday(): { request: Request; done: boolean }[] {
    if (this.boardDone.day !== this.host.clock.day) {
      this.boardDone.day = this.host.clock.day;
      this.boardDone.done = new Set();
    }
    return requestsFor(this.host.clock.day, this.host.world.index.content.requests).map((request) => ({ request, done: this.boardDone.done.has(request.id) }));
  }

  /** Hands in a request: takes what it asks for, pays (a little more for a friend), and the giver likes you more for it. */
  fulfilRequest(id: string): { ok: true; paid: number; giver: string } | { ok: false; note: string } {
    const entry = this.requestsToday().find((r) => r.request.id === id);
    if (entry === undefined) return { ok: false, note: 'That request is not on the board any more.' };
    if (entry.done) return { ok: false, note: 'That one is already taken care of.' };
    const { request } = entry;
    if (this.host.inventory.count(request.item) < request.count) return { ok: false, note: `You need ${request.count - this.host.inventory.count(request.item)} more.` };
    const record = this.host.villagers.record(request.giver);
    const paid = paymentFor(request, heartsOf(record.friendship));
    takeItems(this.host.inventory, request.item, request.count);
    this.host.money += paid;
    record.friendship = Math.min(1000, record.friendship + 15);
    this.boardDone.done.add(request.id);
    this.host.notifyQuests({ kind: 'friendship', npc: request.giver, hearts: heartsOf(record.friendship) });
    this.host.syncStatus();
    return { ok: true, paid, giver: request.giver };
  }
}
