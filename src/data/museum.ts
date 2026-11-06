import type { MuseumDef } from '../engine/museum/types';

/**
 * The village museum: one of everything fish, mineral and artifact the valley gives up, given once each. Ines pays a reward at each
 * milestone. Every item here can be got (the validator checks it).
 */
export const MUSEUM: MuseumDef = {
  id: 'willowbrook_museum',
  name: 'Willowbrook Museum',
  slots: [
    { item: 'minnow', section: 'fish' },
    { item: 'perch', section: 'fish' },
    { item: 'carp', section: 'fish' },
    { item: 'trout', section: 'fish' },
    { item: 'catfish', section: 'fish' },
    { item: 'pike', section: 'fish' },
    { item: 'stone', section: 'mineral' },
    { item: 'copper_ore', section: 'mineral' },
    { item: 'iron_ore', section: 'mineral' },
    { item: 'coal', section: 'mineral' },
    { item: 'quartz', section: 'mineral' },
    { item: 'amethyst', section: 'mineral' },
    { item: 'clay_pot', section: 'artifact' },
    { item: 'arrowhead', section: 'artifact' },
    { item: 'old_coin', section: 'artifact' },
    { item: 'fossil', section: 'artifact' },
    { item: 'rusty_key', section: 'artifact' },
    { item: 'glass_bead', section: 'artifact' },
  ],
  milestones: [
    { count: 3, message: 'Three pieces already! The first cases are never the hardest. Here, for the effort.', reward: { money: 100 } },
    { count: 6, message: 'Six! The museum has begun to look like a museum. Take this for the hens.', reward: { money: 150, items: [{ id: 'chicken_feed', count: 5 }] } },
    { count: 9, message: 'Nine things on display. I could not have asked for a better donor. A lamp for your house.', reward: { items: [{ id: 'lantern', count: 1 }] } },
    { count: 12, message: 'Twelve. People come from the next valley to see it. Here is something from the museum funds.', reward: { money: 400 } },
    { count: 15, message: 'Fifteen! Only a few cases left to fill. Please take these.', reward: { items: [{ id: 'iron_bar', count: 3 }, { id: 'quartz', count: 2 }] } },
    { count: 18, message: 'Every case is full. The whole valley is on display, thanks to you. The museum would like you to have this.', reward: { money: 1000, items: [{ id: 'clock', count: 1 }] } },
  ],
};
