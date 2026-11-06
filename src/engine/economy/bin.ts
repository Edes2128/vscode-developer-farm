import { unitPrice, type ItemLookup, type ItemStack } from '../items/types';

/** The shipping bin: what the player put in during the day. It is emptied, and paid for, each morning. */
export class ShippingBin {
  readonly items: ItemStack[] = [];
  version = 0;

  constructor(saved: readonly ItemStack[] = [], lookup?: ItemLookup) {
    for (const stack of saved) {
      if (stack.count > 0 && (lookup === undefined || lookup(stack.id) !== undefined)) this.add(stack);
    }
    this.version = 0;
  }

  add(stack: ItemStack): void {
    const same = this.items.findIndex((s) => s.id === stack.id && s.quality === stack.quality);
    if (same >= 0) this.items[same] = { ...(this.items[same] as ItemStack), count: (this.items[same] as ItemStack).count + stack.count };
    else this.items.push({ ...stack });
    this.version += 1;
  }

  /** What the bin's contents are worth. */
  total(lookup: ItemLookup): number {
    return this.items.reduce((sum, stack) => {
      const def = lookup(stack.id);
      return def === undefined ? sum : sum + unitPrice(def, stack.quality) * stack.count;
    }, 0);
  }

  /** What is in the bin, with what each line is worth: for the morning report. */
  describe(lookup: ItemLookup): { name: string; count: number; quality: ItemStack['quality']; total: number }[] {
    return this.items.flatMap((stack) => {
      const def = lookup(stack.id);
      return def === undefined ? [] : [{ name: def.name, count: stack.count, quality: stack.quality, total: unitPrice(def, stack.quality) * stack.count }];
    });
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.items.length = 0;
    this.version += 1;
  }
}
