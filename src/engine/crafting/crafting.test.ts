import { describe, expect, it, vi } from 'vitest';
import { Inventory, INVENTORY_SLOTS, makeStack } from '../inventory/inventory';
import type { ItemDef, ItemLookup, ItemStack } from '../items/types';
import { checkCraft, craft, missingText, recipeLabel, recipesAt } from './crafting';
import type { RecipeDef } from './types';

const item = (id: string, name: string, maxStack = 99, kind: ItemDef['kind'] = 'crop'): ItemDef => ({
  id,
  name,
  description: '',
  kind,
  icon: id,
  maxStack,
  sellPrice: 10,
});

const ITEMS = new Map<string, ItemDef>(
  [
    item('trout', 'Trout', 99, 'fish'),
    item('carp', 'Carp', 99, 'fish'),
    item('copper_ore', 'Copper ore', 99, 'mineral'),
    item('stew', 'Fish stew', 9, 'dish'),
    item('arrow', 'Arrow', 10, 'material'),
    item('rock', 'Rock', 99, 'mineral'),
    item('ore', 'Ore', 5, 'mineral'),
  ].map((def) => [def.id, def]),
);
const lookup: ItemLookup = (id) => ITEMS.get(id);

const recipe = (over: Partial<RecipeDef> = {}): RecipeDef => ({
  id: 'fish_stew',
  name: 'Fish stew',
  station: 'kitchen',
  description: '',
  inputs: [{ item: 'trout', count: 2 }],
  output: { item: 'stew', count: 1 },
  ...over,
});

/** An inventory holding exactly these slots (the rest empty). */
const inventoryOf = (...stacks: (ItemStack | null)[]): Inventory =>
  new Inventory(lookup, { slots: stacks, selected: 0 });

/** The trout stacks still in the pockets, in slot order. */
const troutIn = (inv: Inventory): ItemStack[] => inv.slots.filter((slot): slot is ItemStack => slot !== null && slot.id === 'trout');

/** The given stacks first, then full stacks of rock in every other slot, so nothing merges into them and nothing is free. */
const fill = (stacks: readonly ItemStack[]): (ItemStack | null)[] => {
  const slots: (ItemStack | null)[] = [...stacks];
  while (slots.length < INVENTORY_SLOTS) slots.push(makeStack('rock', 99));
  return slots;
};

describe('recipesAt', () => {
  const stew = recipe({ id: 'stew' });
  const salad = recipe({ id: 'salad', unlock: { all: [{ kind: 'flag', name: 'salad' }], hint: 'Ask around.' } });
  const bar = recipe({ id: 'bar', station: 'workbench' });
  const pie = recipe({ id: 'pie', unlock: { all: [{ kind: 'flag', name: 'pie' }], hint: 'Ask Ann.' } });
  const bench2 = recipe({ id: 'bench2', station: 'workbench', unlock: { all: [{ kind: 'flag', name: 'b' }], hint: '' } });
  const all = [stew, salad, bar, pie, bench2];
  const ids = (list: readonly RecipeDef[]): string[] => list.map((r) => r.id);

  it('keeps only the recipes made at that station, in input order', () => {
    expect(ids(recipesAt(all, 'kitchen', () => true))).toEqual(['stew', 'salad', 'pie']);
    expect(ids(recipesAt(all, 'workbench', () => true))).toEqual(['bar', 'bench2']);
    expect(recipesAt([], 'kitchen', () => true)).toEqual([]);
  });

  it('hides a recipe with an unlock until the caller says it is unlocked', () => {
    expect(ids(recipesAt(all, 'kitchen', () => false))).toEqual(['stew']);
    expect(ids(recipesAt(all, 'kitchen', (r) => r.id === 'pie'))).toEqual(['stew', 'pie']);
    expect(ids(recipesAt(all, 'workbench', () => false))).toEqual(['bar']);
  });

  it('only asks about recipes that have an unlock and are at this station', () => {
    const isUnlocked = vi.fn((_recipe: RecipeDef) => true);
    recipesAt(all, 'kitchen', isUnlocked);
    expect(isUnlocked.mock.calls.map(([r]) => r.id)).toEqual(['salad', 'pie']);
  });

  it('does not change the list it is given', () => {
    const input = [...all];
    recipesAt(input, 'kitchen', () => true);
    expect(input).toEqual(all);
  });
});

describe('checkCraft', () => {
  it('is ok when every ingredient is there, with room for the output', () => {
    expect(checkCraft(recipe(), inventoryOf(makeStack('trout', 2)), lookup)).toEqual({ ok: true });
    expect(checkCraft(recipe(), inventoryOf(makeStack('trout', 50)), lookup)).toEqual({ ok: true });
  });

  it('says how many MORE are needed when short', () => {
    const r = recipe({ inputs: [{ item: 'trout', count: 3 }] });
    expect(checkCraft(r, inventoryOf(makeStack('trout', 1)), lookup)).toEqual({ ok: false, reason: 'missing', missing: [{ item: 'trout', count: 2 }] });
    expect(checkCraft(r, inventoryOf(), lookup)).toEqual({ ok: false, reason: 'missing', missing: [{ item: 'trout', count: 3 }] });
  });

  it('lists every item that is short, in recipe order, and leaves out the ones that are covered', () => {
    const r = recipe({
      inputs: [
        { item: 'trout', count: 2 },
        { item: 'carp', count: 1 },
        { item: 'copper_ore', count: 3 },
      ],
    });
    const inv = inventoryOf(makeStack('carp', 4), makeStack('copper_ore', 1));
    expect(checkCraft(r, inv, lookup)).toEqual({
      ok: false,
      reason: 'missing',
      missing: [
        { item: 'trout', count: 2 },
        { item: 'copper_ore', count: 2 },
      ],
    });
  });

  it('counts an item across slots and qualities', () => {
    const inv = inventoryOf(makeStack('trout', 1), makeStack('rock', 1), makeStack('trout', 1, 1), makeStack('trout', 1, 2));
    expect(checkCraft(recipe({ inputs: [{ item: 'trout', count: 3 }] }), inv, lookup)).toEqual({ ok: true });
    expect(checkCraft(recipe({ inputs: [{ item: 'trout', count: 4 }] }), inv, lookup)).toEqual({
      ok: false,
      reason: 'missing',
      missing: [{ item: 'trout', count: 1 }],
    });
  });

  it('adds up an item listed twice in the same recipe', () => {
    const r = recipe({
      inputs: [
        { item: 'trout', count: 1 },
        { item: 'trout', count: 2 },
      ],
    });
    expect(checkCraft(r, inventoryOf(makeStack('trout', 2)), lookup)).toEqual({ ok: false, reason: 'missing', missing: [{ item: 'trout', count: 1 }] });
    expect(checkCraft(r, inventoryOf(makeStack('trout', 3)), lookup)).toEqual({ ok: true });
  });

  it('refuses with "full" when nothing is freed and there is no room', () => {
    // Ingredients are plentiful, so consuming two leaves the slot occupied; every other slot is taken too.
    const inv = inventoryOf(...fill([makeStack('trout', 5)]));
    expect(checkCraft(recipe(), inv, lookup)).toEqual({ ok: false, reason: 'full' });
  });

  it('is ok when the last of an ingredient frees the slot the output needs', () => {
    const inv = inventoryOf(...fill([makeStack('trout', 2)]));
    expect(inv.slots.every((slot) => slot !== null)).toBe(true);
    expect(checkCraft(recipe(), inv, lookup)).toEqual({ ok: true });
  });

  it('is ok when the output merges into an existing stack in a full inventory', () => {
    const inv = inventoryOf(...fill([makeStack('trout', 5), makeStack('stew', 3)]));
    expect(checkCraft(recipe(), inv, lookup)).toEqual({ ok: true });
    // ...but not if that stack is already at its limit.
    const stuffed = inventoryOf(...fill([makeStack('trout', 5), makeStack('stew', 9)]));
    expect(checkCraft(recipe(), stuffed, lookup)).toEqual({ ok: false, reason: 'full' });
  });

  it('prefers to say what is missing over saying the pockets are full', () => {
    const inv = inventoryOf(...fill([makeStack('trout', 1)]));
    expect(checkCraft(recipe(), inv, lookup).ok).toBe(false);
    expect(checkCraft(recipe(), inv, lookup)).toMatchObject({ reason: 'missing' });
  });

  it('needs room for every slot an oversized output takes', () => {
    const arrows = recipe({ id: 'arrows', station: 'workbench', inputs: [{ item: 'copper_ore', count: 1 }], output: { item: 'arrow', count: 15 } });
    // 11 slots taken for good, one free: only 10 arrows (one stack) fit, and 15 need two slots.
    const one = inventoryOf(...fill([makeStack('copper_ore', 5)]).slice(0, INVENTORY_SLOTS - 1));
    expect(checkCraft(arrows, one, lookup)).toEqual({ ok: false, reason: 'full' });
    // With two free slots it fits.
    const two = inventoryOf(...fill([makeStack('copper_ore', 5)]).slice(0, INVENTORY_SLOTS - 2));
    expect(checkCraft(arrows, two, lookup)).toEqual({ ok: true });
  });

  it('works when the output is also an input', () => {
    const refine = recipe({ id: 'refine', station: 'workbench', inputs: [{ item: 'ore', count: 2 }], output: { item: 'ore', count: 1 } });
    // Full inventory: only the slot the ore leaves can take the new one.
    const inv = inventoryOf(...fill([makeStack('ore', 2)]));
    expect(checkCraft(refine, inv, lookup)).toEqual({ ok: true });
    expect(checkCraft(refine, inventoryOf(makeStack('ore', 1)), lookup)).toEqual({ ok: false, reason: 'missing', missing: [{ item: 'ore', count: 1 }] });
  });

  it('never changes the inventory', () => {
    const inv = inventoryOf(makeStack('trout', 2), makeStack('trout', 1, 2));
    const before = inv.toSave();
    const version = inv.version;
    checkCraft(recipe(), inv, lookup);
    checkCraft(recipe({ inputs: [{ item: 'trout', count: 9 }] }), inv, lookup);
    expect(inv.toSave()).toEqual(before);
    expect(inv.version).toBe(version);
  });
});

describe('craft', () => {
  it('takes the ingredients and adds the output at normal quality', () => {
    const inv = inventoryOf(makeStack('trout', 3));
    const result = craft(recipe(), inv, lookup);
    expect(result).toEqual({ ok: true, made: { id: 'stew', count: 1, quality: 0 } });
    expect(inv.count('trout')).toBe(1);
    expect(inv.count('stew')).toBe(1);
  });

  it('takes several ingredients at once', () => {
    const r = recipe({
      inputs: [
        { item: 'trout', count: 2 },
        { item: 'carp', count: 1 },
      ],
      output: { item: 'stew', count: 3 },
    });
    const inv = inventoryOf(makeStack('trout', 2), makeStack('carp', 5), makeStack('rock', 4));
    expect(craft(r, inv, lookup).made).toEqual({ id: 'stew', count: 3, quality: 0 });
    expect(inv.count('trout')).toBe(0);
    expect(inv.count('carp')).toBe(4);
    expect(inv.count('rock')).toBe(4);
    expect(inv.count('stew')).toBe(3);
  });

  it('uses the lowest quality first, so the best stays', () => {
    const inv = inventoryOf(makeStack('trout', 1, 2), makeStack('trout', 1, 0), makeStack('trout', 1, 1));
    craft(recipe(), inv, lookup);
    expect(troutIn(inv)).toEqual([{ id: 'trout', count: 1, quality: 2 }]);
  });

  it('takes quality 1 before quality 2 once the normal ones run out, even from a later slot', () => {
    const inv = inventoryOf(makeStack('trout', 1, 2), makeStack('trout', 1, 1), makeStack('trout', 1, 0));
    craft(recipe({ inputs: [{ item: 'trout', count: 2 }] }), inv, lookup);
    expect(troutIn(inv)).toEqual([{ id: 'trout', count: 1, quality: 2 }]);
  });

  it('reaches across slots of the same quality, in slot order, and leaves a partial stack behind', () => {
    const inv = inventoryOf(makeStack('trout', 2), makeStack('rock', 1), makeStack('trout', 4));
    craft(recipe({ inputs: [{ item: 'trout', count: 3 }] }), inv, lookup);
    // The first stack is used up entirely, then one is taken from the second.
    expect(troutIn(inv)).toEqual([{ id: 'trout', count: 3, quality: 0 }]);
  });

  it('splits an output larger than a stack across slots', () => {
    const arrows = recipe({ id: 'arrows', station: 'workbench', inputs: [{ item: 'copper_ore', count: 1 }], output: { item: 'arrow', count: 15 } });
    const inv = inventoryOf(makeStack('copper_ore', 1));
    const result = craft(arrows, inv, lookup);
    expect(result.made).toEqual({ id: 'arrow', count: 15, quality: 0 });
    expect(inv.count('arrow')).toBe(15);
    expect(inv.slots.filter((slot) => slot?.id === 'arrow').map((slot) => slot?.count)).toEqual([10, 5]);
  });

  it('tops up an existing stack of the output', () => {
    const inv = inventoryOf(makeStack('stew', 4), makeStack('trout', 2));
    craft(recipe(), inv, lookup);
    expect(inv.slots[0]).toEqual({ id: 'stew', count: 5, quality: 0 });
  });

  it('can make something from its own ingredient in a full inventory', () => {
    const refine = recipe({ id: 'refine', station: 'workbench', inputs: [{ item: 'ore', count: 2 }], output: { item: 'ore', count: 1 } });
    const inv = inventoryOf(...fill([makeStack('ore', 2)]));
    expect(craft(refine, inv, lookup)).toEqual({ ok: true, made: { id: 'ore', count: 1, quality: 0 } });
    expect(inv.slots[0]).toEqual({ id: 'ore', count: 1, quality: 0 });
  });

  it('can make something when the last ingredient frees the only slot', () => {
    const inv = inventoryOf(...fill([makeStack('trout', 2)]));
    expect(craft(recipe(), inv, lookup).ok).toBe(true);
    expect(inv.slots[0]).toEqual({ id: 'stew', count: 1, quality: 0 });
  });

  it('bumps the version when it makes something', () => {
    const inv = inventoryOf(makeStack('trout', 2));
    const before = inv.version;
    craft(recipe(), inv, lookup);
    expect(inv.version).toBeGreaterThan(before);
  });

  describe('when it cannot', () => {
    const untouched = (inv: Inventory, run: () => unknown): void => {
      const before = inv.toSave();
      const version = inv.version;
      run();
      expect(inv.toSave()).toEqual(before);
      expect(inv.version).toBe(version);
    };

    it('changes nothing and says what is missing', () => {
      const r = recipe({
        inputs: [
          { item: 'trout', count: 2 },
          { item: 'carp', count: 2 },
        ],
      });
      // Trout alone is enough, carp is short: the trout must not be taken.
      const inv = inventoryOf(makeStack('trout', 5), makeStack('carp', 1, 1));
      let result: ReturnType<typeof craft> | undefined;
      untouched(inv, () => {
        result = craft(r, inv, lookup);
      });
      expect(result).toEqual({ ok: false, reason: 'missing', missing: [{ item: 'carp', count: 1 }] });
      expect(result !== undefined && 'made' in result).toBe(false);
    });

    it('changes nothing when the pockets are full', () => {
      const inv = inventoryOf(...fill([makeStack('trout', 5, 1)]));
      let result: ReturnType<typeof craft> | undefined;
      untouched(inv, () => {
        result = craft(recipe(), inv, lookup);
      });
      expect(result).toEqual({ ok: false, reason: 'full' });
    });

    it('changes nothing when a big output does not fit', () => {
      const arrows = recipe({ id: 'arrows', inputs: [{ item: 'copper_ore', count: 1 }], output: { item: 'arrow', count: 15 } });
      const inv = inventoryOf(...fill([makeStack('copper_ore', 5)]).slice(0, INVENTORY_SLOTS - 1));
      untouched(inv, () => expect(craft(arrows, inv, lookup)).toEqual({ ok: false, reason: 'full' }));
    });
  });
});

describe('recipeLabel', () => {
  it('names the recipe and its ingredients, with a count after the ones needed more than once', () => {
    const r = recipe({
      inputs: [
        { item: 'trout', count: 1 },
        { item: 'carp', count: 2 },
      ],
    });
    expect(recipeLabel(r, lookup)).toBe('Fish stew · Trout, Carp ×2');
  });

  it('shows an unknown item by its id', () => {
    const r = recipe({ name: 'Mystery', inputs: [{ item: 'ghost_ore', count: 3 }, { item: 'trout', count: 1 }] });
    expect(recipeLabel(r, lookup)).toBe('Mystery · ghost_ore ×3, Trout');
  });

  it('is just the name when nothing is needed', () => {
    expect(recipeLabel(recipe({ inputs: [] }), lookup)).toBe('Fish stew');
  });
});

describe('missingText', () => {
  it('says one thing plainly', () => {
    expect(missingText([{ item: 'trout', count: 2 }], lookup)).toBe('You need 2 more Trout.');
    expect(missingText([{ item: 'trout', count: 1 }], lookup)).toBe('You need 1 more Trout.');
  });

  it('joins two with "and"', () => {
    expect(
      missingText(
        [
          { item: 'trout', count: 2 },
          { item: 'copper_ore', count: 1 },
        ],
        lookup,
      ),
    ).toBe('You need 2 more Trout and 1 more Copper ore.');
  });

  it('separates three or more with commas and a last "and"', () => {
    expect(
      missingText(
        [
          { item: 'trout', count: 2 },
          { item: 'carp', count: 1 },
          { item: 'copper_ore', count: 4 },
        ],
        lookup,
      ),
    ).toBe('You need 2 more Trout, 1 more Carp and 4 more Copper ore.');
  });

  it('shows an unknown item by its id, and copes with nothing missing', () => {
    expect(missingText([{ item: 'ghost_ore', count: 1 }], lookup)).toBe('You need 1 more ghost_ore.');
    expect(missingText([], lookup)).toBe('You have everything you need.');
  });
});
