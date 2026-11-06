import type { ItemLookup, ItemStack } from '../items/types';
import { Inventory } from './inventory';

/** Takes `count` of an item from wherever it is in the pockets, lowest quality first. Returns how many were taken. */
export function takeItems(inventory: Inventory, id: string, count: number): number {
  let left = count;
  const order = inventory.slots
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot?.id === id)
    .sort((a, b) => (a.slot?.quality ?? 0) - (b.slot?.quality ?? 0));
  for (const { index } of order) {
    if (left <= 0) break;
    left -= inventory.take(index, left)?.count ?? 0;
  }
  return count - left;
}

/** Would all of these stacks fit at once? Each may fit alone while together they do not, so this tries them on a copy. */
export function canAddAll(inventory: Inventory, stacks: readonly ItemStack[], lookup: ItemLookup): boolean {
  const copy = new Inventory(lookup, inventory.toSave());
  return stacks.every((stack) => copy.add(stack) === 0);
}
