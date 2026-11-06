import type { RecipeDef } from '../engine/crafting/types';

/**
 * What can be cooked and made. Dishes are worth more than the ingredients they take, so cooking is a reason to keep
 * a few crops back; some recipes are taught by friends (a villager's hearts or a finished quest). Metal bars are for the
 * greenhouse and the lamps. Every input and output is an item (src/data/items.ts).
 */

const at = (station: RecipeDef['station'], id: string, name: string, description: string, inputs: RecipeDef['inputs'], output: RecipeDef['output'], unlock?: RecipeDef['unlock']): RecipeDef =>
  unlock === undefined ? { id, name, station, description, inputs, output } : { id, name, station, description, inputs, output, unlock };

export const RECIPES: readonly RecipeDef[] = [
  at('kitchen', 'fried_egg', 'Fried egg', 'An egg in a hot pan.', [{ item: 'egg', count: 1 }], { item: 'fried_egg', count: 1 }),
  at('kitchen', 'radish_salad', 'Radish salad', 'Two radishes, sliced thin.', [{ item: 'radish', count: 2 }], { item: 'radish_salad', count: 1 }),
  at('kitchen', 'tomato_soup', 'Tomato soup', 'Two tomatoes, simmered.', [{ item: 'tomato', count: 2 }], { item: 'tomato_soup', count: 1 }),
  at('kitchen', 'omelette', 'Omelette', 'Two eggs and a tomato.', [{ item: 'egg', count: 2 }, { item: 'tomato', count: 1 }], { item: 'omelette', count: 1 }),
  at(
    'kitchen',
    'strawberry_jam',
    'Strawberry jam',
    'Three strawberries and patience.',
    [{ item: 'strawberry', count: 3 }],
    { item: 'strawberry_jam', count: 1 },
    { all: [{ kind: 'friendship', npc: 'tobias', atLeast: 2 }], hint: 'Tobias knows how his mother made jam: spend time with him.' },
  ),
  at(
    'kitchen',
    'pumpkin_pie',
    'Pumpkin pie',
    'A pumpkin, an egg and a strawberry.',
    [{ item: 'pumpkin', count: 1 }, { item: 'egg', count: 1 }, { item: 'strawberry', count: 1 }],
    { item: 'pumpkin_pie', count: 1 },
    { all: [{ kind: 'friendship', npc: 'willa', atLeast: 4 }], hint: 'Willa has a pie recipe she shares with good friends.' },
  ),
  at(
    'kitchen',
    'baked_trout',
    'Baked trout',
    'A trout with a sliced tomato.',
    [{ item: 'trout', count: 1 }, { item: 'tomato', count: 1 }],
    { item: 'baked_trout', count: 1 },
    { all: [{ kind: 'quest', id: 'the_anglers_favour', status: 'done' }], hint: 'June will show you how to bake a fish, once you have helped her.' },
  ),
  at(
    'kitchen',
    'fish_stew',
    'Fish stew',
    'A perch, a carp and a radish in one pot.',
    [{ item: 'perch', count: 1 }, { item: 'carp', count: 1 }, { item: 'radish', count: 1 }],
    { item: 'fish_stew', count: 1 },
    { all: [{ kind: 'friendship', npc: 'june', atLeast: 2 }], hint: 'June makes a stew of everything she catches: ask her about it.' },
  ),
  at('workbench', 'copper_bar', 'Copper bar', 'Three pieces of ore and a lump of coal.', [{ item: 'copper_ore', count: 3 }, { item: 'coal', count: 1 }], { item: 'copper_bar', count: 1 }),
  at('workbench', 'iron_bar', 'Iron bar', 'Three pieces of ore and two lumps of coal.', [{ item: 'iron_ore', count: 3 }, { item: 'coal', count: 2 }], { item: 'iron_bar', count: 1 }),
  at('workbench', 'lantern', 'Lantern', 'A copper frame and a crystal to hold the light.', [{ item: 'copper_bar', count: 1 }, { item: 'quartz', count: 1 }], { item: 'lantern', count: 1 }),
  at('workbench', 'fertilizer', 'Fertilizer', 'Chicken feed and crushed stone, mixed well. Makes two.', [{ item: 'chicken_feed', count: 2 }, { item: 'stone', count: 1 }], { item: 'fertilizer', count: 2 }),
  at('workbench', 'sprinkler', 'Sprinkler', 'A copper pipe on an iron post.', [{ item: 'copper_bar', count: 1 }, { item: 'iron_bar', count: 1 }], { item: 'sprinkler', count: 1 }),
  at('workbench', 'vase', 'Vase', 'Six stones, ground smooth.', [{ item: 'stone', count: 6 }], { item: 'vase', count: 1 }),
  at('workbench', 'clock', 'Grandfather clock', 'Copper, iron and a crystal for the face.', [{ item: 'copper_bar', count: 2 }, { item: 'iron_bar', count: 1 }, { item: 'quartz', count: 1 }], { item: 'clock', count: 1 }),
];
