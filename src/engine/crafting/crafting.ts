/**
 * Making things: which recipes a station shows, whether the pockets can pay for one, and doing it. Pure functions over the
 * inventory and the data, so the kitchen and the workbench share one rule and the menus only ask.
 */
import { Inventory, makeStack } from '../inventory/inventory';
import type { ItemLookup, ItemStack } from '../items/types';
import type { RecipeDef, Station } from './types';

/** How many MORE of an item are needed (not how many are required in all). */
export interface Missing {
  readonly item: string;
  readonly count: number;
}

export type CraftCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'missing'; readonly missing: readonly Missing[] }
  | { readonly ok: false; readonly reason: 'full' };

/**
 * Recipes shown at a station: the ones made there that are either free for everyone or unlocked. The caller evaluates the
 * unlock conditions (it knows the quests and friendships), so this only asks, and only for recipes that have an `unlock`.
 * Keeps the input order, which is the order the data lists them in.
 */
export function recipesAt(recipes: readonly RecipeDef[], station: Station, isUnlocked: (recipe: RecipeDef) => boolean): RecipeDef[] {
  return recipes.filter((recipe) => recipe.station === station && (recipe.unlock === undefined || isUnlocked(recipe)));
}

/** What the recipe takes of each item. An item listed twice is simply needed in both amounts. */
function needs(recipe: RecipeDef): Map<string, number> {
  const need = new Map<string, number>();
  for (const { item, count } of recipe.inputs) need.set(item, (need.get(item) ?? 0) + count);
  return need;
}

function missingFrom(recipe: RecipeDef, inventory: Inventory): Missing[] {
  const missing: Missing[] = [];
  for (const [item, need] of needs(recipe)) {
    // `Inventory.count` adds up every slot and every quality: any quality will do for an ingredient.
    const short = need - inventory.count(item);
    if (short > 0) missing.push({ item, count: short });
  }
  return missing;
}

/** Takes `need` of an item across slots: the lowest quality first (the best stays for selling or gifts), then slot order. */
function takeIngredient(inventory: Inventory, item: string, need: number): void {
  const holders = inventory.slots
    .flatMap((slot, index) => (slot !== null && slot.id === item ? [{ index, quality: slot.quality }] : []))
    .sort((a, b) => a.quality - b.quality || a.index - b.index);
  let left = need;
  for (const { index } of holders) {
    if (left <= 0) break;
    left -= inventory.take(index, left)?.count ?? 0;
  }
}

function consume(recipe: RecipeDef, inventory: Inventory): void {
  for (const [item, need] of needs(recipe)) takeIngredient(inventory, item, need);
}

/**
 * Does the inventory hold every ingredient, and would the output fit once they are gone? Using up the last of a stack frees
 * its slot, so a full inventory can still cook; the answer comes from doing it on a copy. Never changes the inventory.
 */
export function checkCraft(recipe: RecipeDef, inventory: Inventory, lookup: ItemLookup): CraftCheck {
  const missing = missingFrom(recipe, inventory);
  if (missing.length > 0) return { ok: false, reason: 'missing', missing };

  const after = new Inventory(lookup, inventory.toSave());
  consume(recipe, after);
  return after.canAdd(makeStack(recipe.output.item, recipe.output.count)) ? { ok: true } : { ok: false, reason: 'full' };
}

/**
 * Makes it: takes the ingredients and adds the output (quality 0). All or nothing: if `checkCraft` would refuse, the
 * inventory is left exactly as it was (version included). Returns the check, and on success the stack that was made.
 */
export function craft(recipe: RecipeDef, inventory: Inventory, lookup: ItemLookup): CraftCheck & { readonly made?: ItemStack } {
  const check = checkCraft(recipe, inventory, lookup);
  if (!check.ok) return check;

  consume(recipe, inventory);
  const made = makeStack(recipe.output.item, recipe.output.count);
  inventory.add(made);
  return { ok: true, made };
}

const nameOf = (lookup: ItemLookup, id: string): string => lookup(id)?.name ?? id;

/** "Fish stew · Trout, Carp ×2": the recipe's name, then what it takes. Unknown item ids show as the id. */
export function recipeLabel(recipe: RecipeDef, lookup: ItemLookup): string {
  if (recipe.inputs.length === 0) return recipe.name;
  const inputs = recipe.inputs.map(({ item, count }) => (count > 1 ? `${nameOf(lookup, item)} ×${count}` : nameOf(lookup, item)));
  return `${recipe.name} · ${inputs.join(', ')}`;
}

/** "You need 2 more Trout and 1 more Copper ore." Unknown item ids show as the id. */
export function missingText(missing: readonly Missing[], lookup: ItemLookup): string {
  if (missing.length === 0) return 'You have everything you need.';
  const parts = missing.map(({ item, count }) => `${count} more ${nameOf(lookup, item)}`);
  const last = parts[parts.length - 1];
  const list = parts.length === 1 ? (last ?? '') : `${parts.slice(0, -1).join(', ')} and ${last ?? ''}`;
  return `You need ${list}.`;
}
