import { isQuality, type ItemLookup, type ItemStack, type Quality } from '../items/types';

/** The player's pockets: a fixed number of slots, the first ten of which are on the number keys. */
export const INVENTORY_SLOTS = 12;

/** Stacks never come out of one purchase or harvest larger than this, whatever the item says. */
const HARD_STACK_LIMIT = 999;

export type Slot = ItemStack | null;

/** The size of the pockets' contents, as saved. */
export interface InventorySave {
  readonly slots: readonly (ItemStack | null)[];
  readonly selected: number;
}

/**
 * A row of slots, one of which is selected. Stacks of the same item and quality merge; a full inventory refuses
 * rather than dropping things. Every change bumps `version` so the HUD knows when to redraw.
 */
export class Inventory {
  readonly slots: Slot[];
  selected = 0;
  version = 0;

  constructor(
    private readonly lookup: ItemLookup,
    saved?: InventorySave,
  ) {
    this.slots = Array.from({ length: INVENTORY_SLOTS }, () => null);
    if (saved === undefined) return;
    saved.slots.slice(0, INVENTORY_SLOTS).forEach((stack, i) => {
      const def = stack === null ? undefined : lookup(stack.id);
      // Anything the game no longer knows about is dropped rather than kept as a broken item.
      if (stack !== null && def !== undefined && stack.count > 0) {
        this.slots[i] = { id: stack.id, count: Math.min(stack.count, def.maxStack), quality: isQuality(stack.quality) ? stack.quality : 0 };
      }
    });
    this.selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < INVENTORY_SLOTS ? saved.selected : 0;
  }

  private limit(id: string): number {
    return Math.min(this.lookup(id)?.maxStack ?? 1, HARD_STACK_LIMIT);
  }

  /** How many of this stack would fit right now. */
  room(stack: ItemStack): number {
    const limit = this.limit(stack.id);
    let room = 0;
    for (const slot of this.slots) {
      if (slot === null) room += limit;
      else if (slot.id === stack.id && slot.quality === stack.quality) room += limit - slot.count;
    }
    return room;
  }

  canAdd(stack: ItemStack): boolean {
    return this.room(stack) >= stack.count;
  }

  /** Adds as much as fits, topping up matching stacks first. Returns how many did not fit. */
  add(stack: ItemStack): number {
    const limit = this.limit(stack.id);
    let left = stack.count;
    for (let i = 0; i < this.slots.length && left > 0; i += 1) {
      const slot = this.slots[i];
      if (slot?.id === stack.id && slot.quality === stack.quality && slot.count < limit) {
        const moved = Math.min(left, limit - slot.count);
        this.slots[i] = { ...slot, count: slot.count + moved };
        left -= moved;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i += 1) {
      if (this.slots[i] === null) {
        const moved = Math.min(left, limit);
        this.slots[i] = { id: stack.id, count: moved, quality: stack.quality };
        left -= moved;
      }
    }
    if (left !== stack.count) this.version += 1;
    return left;
  }

  /** Removes up to `count` from a slot and returns what was taken. */
  take(index: number, count: number): ItemStack | undefined {
    const slot = this.slots[index];
    if (slot === null || slot === undefined || count <= 0) return undefined;
    const taken = Math.min(count, slot.count);
    this.slots[index] = taken === slot.count ? null : { ...slot, count: slot.count - taken };
    this.version += 1;
    return { id: slot.id, count: taken, quality: slot.quality };
  }

  selectedStack(): ItemStack | null {
    return this.slots[this.selected] ?? null;
  }

  /** Total of an item across every slot and quality. */
  count(id: string): number {
    return this.slots.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0);
  }

  select(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SLOTS || index === this.selected) return;
    this.selected = index;
    this.version += 1;
  }

  /** Moves the selection along, wrapping round. */
  selectNext(direction: 1 | -1): void {
    this.select((this.selected + direction + INVENTORY_SLOTS) % INVENTORY_SLOTS);
  }

  toSave(): InventorySave {
    return { slots: this.slots.map((slot) => (slot === null ? null : { ...slot })), selected: this.selected };
  }
}

export const makeStack = (id: string, count: number, quality: Quality = 0): ItemStack => ({ id, count, quality });
