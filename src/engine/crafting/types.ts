import type { Condition } from '../social/types';

/** Where something is made: the kitchen cooks, the workbench makes things. */
export type Station = 'kitchen' | 'workbench';

export interface RecipeIngredient {
  /** `ItemDef.id` */
  readonly item: string;
  readonly count: number;
}

/** What it takes to make something. Data lives in src/data/recipes.ts. */
export interface RecipeDef {
  readonly id: string;
  readonly name: string;
  readonly station: Station;
  readonly description: string;
  readonly inputs: readonly RecipeIngredient[];
  readonly output: RecipeIngredient;
  /**
   * If set, the recipe is hidden until these conditions hold (a quest done, hearts with a villager, a flag), and `hint` says
   * how to get it. Dialogue conditions are reused, so a villager's friendship or a quest can teach a recipe.
   */
  readonly unlock?: { readonly all: readonly Condition[]; readonly hint: string };
}
