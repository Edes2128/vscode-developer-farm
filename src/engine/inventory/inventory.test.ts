import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../data/content';
import { unitPrice, type ItemDef } from '../items/types';
import { Inventory, INVENTORY_SLOTS, makeStack } from './inventory';

const items = new Map<string, ItemDef>(CONTENT.items.map((item) => [item.id, item]));
const lookup = (id: string): ItemDef | undefined => items.get(id);
const make = (): Inventory => new Inventory(lookup);

describe('Inventory', () => {
  it('starts empty with the first slot selected', () => {
    const inventory = make();
    expect(inventory.slots).toHaveLength(INVENTORY_SLOTS);
    expect(inventory.slots.every((s) => s === null)).toBe(true);
    expect(inventory.selected).toBe(0);
  });

  it('puts things in the first free slot, and merges matching stacks', () => {
    const inventory = make();
    inventory.add(makeStack('radish', 3));
    inventory.add(makeStack('radish', 4));
    expect(inventory.slots[0]).toEqual({ id: 'radish', count: 7, quality: 0 });
    expect(inventory.slots[1]).toBeNull();
  });

  it('keeps different qualities apart, because they sell differently', () => {
    const inventory = make();
    inventory.add(makeStack('radish', 2, 0));
    inventory.add(makeStack('radish', 2, 1));
    expect(inventory.slots.filter((s) => s !== null)).toHaveLength(2);
    expect(inventory.count('radish')).toBe(4);
  });

  it('splits a stack at its limit and carries on in the next slot', () => {
    const inventory = make();
    expect(inventory.add(makeStack('radish', 150))).toBe(0);
    expect(inventory.slots[0]?.count).toBe(99);
    expect(inventory.slots[1]?.count).toBe(51);
  });

  it('never stacks tools', () => {
    const inventory = make();
    inventory.add(makeStack('hoe', 1));
    inventory.add(makeStack('hoe', 1));
    expect(inventory.slots.filter((s) => s?.id === 'hoe')).toHaveLength(2);
  });

  it('refuses what does not fit instead of dropping things, and says how much was left over', () => {
    const inventory = make();
    for (let i = 0; i < INVENTORY_SLOTS; i += 1) inventory.add(makeStack('radish', 99, 0));
    expect(inventory.room(makeStack('radish', 5))).toBe(0);
    expect(inventory.canAdd(makeStack('radish', 1))).toBe(false);
    expect(inventory.add(makeStack('radish', 5))).toBe(5);
    expect(inventory.count('radish')).toBe(99 * INVENTORY_SLOTS);
  });

  it('takes some or all of a slot', () => {
    const inventory = make();
    inventory.add(makeStack('radish', 5, 1));
    expect(inventory.take(0, 2)).toEqual({ id: 'radish', count: 2, quality: 1 });
    expect(inventory.slots[0]?.count).toBe(3);
    expect(inventory.take(0, 99)).toEqual({ id: 'radish', count: 3, quality: 1 });
    expect(inventory.slots[0]).toBeNull();
    expect(inventory.take(0, 1)).toBeUndefined();
  });

  it('selects slots, wraps round, and ignores nonsense', () => {
    const inventory = make();
    inventory.select(4);
    expect(inventory.selected).toBe(4);
    inventory.select(99);
    inventory.select(-1);
    inventory.select(1.5);
    expect(inventory.selected).toBe(4);
    inventory.selectNext(-1);
    expect(inventory.selected).toBe(3);
    inventory.select(0);
    inventory.selectNext(-1);
    expect(inventory.selected).toBe(INVENTORY_SLOTS - 1);
    inventory.selectNext(1);
    expect(inventory.selected).toBe(0);
  });

  it('tells the HUD when something changed, and only then', () => {
    const inventory = make();
    const v0 = inventory.version;
    inventory.select(0);
    expect(inventory.version).toBe(v0);
    inventory.add(makeStack('radish', 1));
    expect(inventory.version).toBeGreaterThan(v0);
  });

  it('round-trips through a save', () => {
    const inventory = make();
    inventory.add(makeStack('hoe', 1));
    inventory.add(makeStack('radish', 12, 2));
    inventory.select(1);
    const copy = new Inventory(lookup, inventory.toSave());
    expect(copy.slots).toEqual(inventory.slots);
    expect(copy.selected).toBe(1);
  });

  it('drops anything the game no longer knows when loading, and fixes bad quantities and selections', () => {
    const saved = {
      slots: [
        { id: 'removed_item', count: 3, quality: 0 as const },
        { id: 'radish', count: 5000, quality: 0 as const },
        { id: 'radish', count: 0, quality: 0 as const },
        null,
      ],
      selected: 77,
    };
    const inventory = new Inventory(lookup, saved);
    expect(inventory.slots[0]).toBeNull();
    expect(inventory.slots[1]?.count).toBe(99);
    expect(inventory.slots[2]).toBeNull();
    expect(inventory.selected).toBe(0);
    expect(inventory.slots).toHaveLength(INVENTORY_SLOTS);
  });
});

describe('prices', () => {
  it('pays more for better quality, rounded down', () => {
    const radish = lookup('radish') as ItemDef;
    expect(unitPrice(radish, 0)).toBe(40);
    expect(unitPrice(radish, 1)).toBe(50);
    expect(unitPrice(radish, 2)).toBe(60);
    expect(unitPrice(lookup('strawberry') as ItemDef, 1)).toBe(75);
  });
});
