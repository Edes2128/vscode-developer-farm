import { createRng } from '../core/random';
import { rollQuality } from '../farming/farm';
import type { ItemStack } from '../items/types';
import { TILE_SIZE, worldToTile } from '../math/coords';
import { findPath, type Cell, type PathGrid } from '../path/astar';
import { MAX_FRIENDSHIP } from '../social/friendship';
import type { AnimalDef, AnimalSave, RanchConfig, RanchSave } from './types';

export const PET_POINTS = 15;
export const FED_POINTS = 10;
export const HUNGRY_POINTS = -5;
/** Animals move at a stroll. */
export const ANIMAL_SPEED = 22;

export type AnimalMode = 'idle' | 'walk' | 'peck';

/** A live animal: what is saved, plus where it is and what it is doing. */
export interface Animal extends AnimalSave {
  friendship: number;
  pettedDay: number;
  fedDay: number;
  /** Feet position, world pixels. Not saved. */
  x: number;
  y: number;
  facing: 'left' | 'right';
  mode: AnimalMode;
  /** Seconds left in the current mode. */
  timer: number;
  path: Cell[];
  rng: () => number;
}

export interface NightReport {
  readonly fed: number;
  readonly hungry: number;
  readonly eggs: number;
}

const hashString = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * One map's animals: the coop's chickens, the trough they eat from, and the egg basket. They wander the yard on
 * their own, and each night every animal that finds feed in the trough eats it and leaves a product behind.
 * Positions are not saved: on loading they are scattered over the yard again.
 */
export class Ranch {
  readonly animals: Animal[] = [];
  feed: number;
  basket: ItemStack[];
  /** Goes up on every change to the animals' state that the HUD shows (not on every step they take). */
  version = 0;

  constructor(
    readonly config: RanchConfig,
    private readonly defs: (id: string) => AnimalDef | undefined,
    private readonly grid: PathGrid,
    save?: RanchSave,
  ) {
    this.feed = Math.max(0, Math.min(config.troughCapacity, save?.feed ?? 0));
    this.basket = (save?.basket ?? []).filter((s) => s.count > 0).map((s) => ({ ...s }));
    for (const animal of save?.animals ?? []) {
      if (this.defs(animal.kind) === undefined || this.animals.length >= config.capacity) continue;
      this.spawn(animal);
    }
  }

  get isFull(): boolean {
    return this.animals.length >= this.config.capacity;
  }

  /** Adds an animal. Returns it, or undefined if the coop is full or the kind is unknown. */
  add(kind: string): Animal | undefined {
    const def = this.defs(kind);
    if (def === undefined || this.isFull) return undefined;
    const count = this.animals.length;
    const name = def.names[count % Math.max(1, def.names.length)] ?? def.name;
    // A unique id even after animals have been added and others never removed.
    let n = this.animals.length + 1;
    while (this.animals.some((a) => a.id === `${kind}-${n}`)) n += 1;
    this.version += 1;
    return this.spawn({ id: `${kind}-${n}`, kind, name, friendship: 0, pettedDay: 0, fedDay: 0 });
  }

  /** Pours feed into the trough. Returns how much went in. */
  addFeed(amount: number): number {
    const room = this.config.troughCapacity - this.feed;
    const added = Math.max(0, Math.min(room, Math.floor(amount)));
    this.feed += added;
    if (added > 0) this.version += 1;
    return added;
  }

  /** Takes every egg out of the basket. */
  collect(): ItemStack[] {
    const taken = this.basket;
    this.basket = [];
    if (taken.length > 0) this.version += 1;
    return taken;
  }

  eggCount(): number {
    return this.basket.reduce((sum, stack) => sum + stack.count, 0);
  }

  /** Petting once a day makes friends. Returns the friendship gained. */
  pet(animal: Animal, day: number): number {
    if (animal.pettedDay === day) return 0;
    animal.pettedDay = day;
    const before = animal.friendship;
    animal.friendship = Math.min(MAX_FRIENDSHIP, before + PET_POINTS);
    this.version += 1;
    return animal.friendship - before;
  }

  animalAt(cell: Cell): Animal | undefined {
    return this.animals.find((a) => worldToTile(a.x) === cell.x && worldToTile(a.y - 3) === cell.y);
  }

  /** A night passes: the hungry stay hungry, the fed leave a product in the basket. */
  nightly(day: number): NightReport {
    let fed = 0;
    let hungry = 0;
    let eggs = 0;
    this.animals.forEach((animal, index) => {
      const def = this.defs(animal.kind);
      if (def === undefined) return;
      if (this.feed > 0) {
        this.feed -= 1;
        fed += 1;
        animal.fedDay = day;
        animal.friendship = Math.min(MAX_FRIENDSHIP, animal.friendship + FED_POINTS);
        // Happier animals lay better eggs. Decided by who and when, like crop quality, so it needs no saving.
        const quality = rollQuality(hashString(animal.id) % 997, index, day, animal.friendship / 4000);
        this.addToBasket({ id: def.product, count: 1, quality });
        eggs += 1;
      } else {
        hungry += 1;
        animal.friendship = Math.max(0, animal.friendship + HUNGRY_POINTS);
      }
    });
    if (fed + hungry > 0) this.version += 1;
    return { fed, hungry, eggs };
  }

  /** Lets the animals potter about. */
  update(dt: number): void {
    for (const animal of this.animals) this.step(animal, dt);
  }

  toSave(): RanchSave {
    return {
      animals: this.animals.map((a): AnimalSave => ({ id: a.id, kind: a.kind, name: a.name, friendship: a.friendship, pettedDay: a.pettedDay, fedDay: a.fedDay })),
      feed: this.feed,
      basket: this.basket.map((s) => ({ ...s })),
    };
  }

  // ------------------------------------------------------------------------------------------ internals

  private addToBasket(stack: ItemStack): void {
    const same = this.basket.findIndex((s) => s.id === stack.id && s.quality === stack.quality);
    if (same >= 0) this.basket[same] = { ...(this.basket[same] as ItemStack), count: (this.basket[same] as ItemStack).count + stack.count };
    else this.basket.push(stack);
  }

  private spawn(save: AnimalSave): Animal {
    const rng = createRng(hashString(save.id));
    const animal: Animal = {
      ...save,
      friendship: Math.max(0, Math.min(MAX_FRIENDSHIP, save.friendship)),
      x: 0,
      y: 0,
      facing: rng() < 0.5 ? 'left' : 'right',
      mode: 'idle',
      timer: 0.5 + rng() * 2,
      path: [],
      rng,
    };
    const cell = this.randomYardCell(rng);
    animal.x = cell.x * TILE_SIZE + TILE_SIZE / 2;
    animal.y = cell.y * TILE_SIZE + TILE_SIZE - 3;
    this.animals.push(animal);
    return animal;
  }

  private randomYardCell(rng: () => number): Cell {
    const { x, y, w, h } = this.config.yard;
    for (let tries = 0; tries < 40; tries += 1) {
      const cell = { x: x + Math.floor(rng() * w), y: y + Math.floor(rng() * h) };
      if (this.grid.walkable(cell.x, cell.y)) return cell;
    }
    return { x, y };
  }

  private step(animal: Animal, dt: number): void {
    animal.timer -= dt;
    if (animal.mode === 'walk') {
      this.walk(animal, dt);
      if (animal.path.length > 0) return;
      animal.mode = 'idle';
      animal.timer = 1 + animal.rng() * 3;
      return;
    }
    if (animal.timer > 0) return;

    const roll = animal.rng();
    if (roll < 0.5) {
      animal.mode = 'idle';
      animal.timer = 1.5 + animal.rng() * 2.5;
    } else if (roll < 0.75) {
      animal.mode = 'peck';
      animal.timer = 1 + animal.rng() * 0.8;
    } else {
      const from = { x: worldToTile(animal.x), y: worldToTile(animal.y - 3) };
      const goal = this.randomYardCell(animal.rng);
      const path = findPath(this.grid, from, goal);
      if (path !== undefined && path.length > 0) {
        animal.path = path;
        animal.mode = 'walk';
      } else {
        animal.mode = 'idle';
        animal.timer = 1;
      }
    }
  }

  private walk(animal: Animal, dt: number): void {
    let budget = ANIMAL_SPEED * dt;
    while (budget > 0 && animal.path.length > 0) {
      const next = animal.path[0] as Cell;
      const tx = next.x * TILE_SIZE + TILE_SIZE / 2;
      const ty = next.y * TILE_SIZE + TILE_SIZE - 3;
      const dx = tx - animal.x;
      const dy = ty - animal.y;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) animal.facing = dx > 0 ? 'right' : 'left';
      if (distance <= budget) {
        animal.x = tx;
        animal.y = ty;
        budget -= distance;
        animal.path.shift();
      } else {
        animal.x += (dx / distance) * budget;
        animal.y += (dy / distance) * budget;
        budget = 0;
      }
    }
  }
}
