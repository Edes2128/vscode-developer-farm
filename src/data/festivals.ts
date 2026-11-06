import type { FestivalDef } from '../engine/festivals/types';

/**
 * The year's four festivals, one a season, each on a fixed day and held on a map the player can reach. The sky is always clear
 * on festival days, the villagers gather where `places` says while it is open, and the host runs the activity. How well the player
 * did is compared with a few deterministic rivals (see festivals/rankings.ts), and the prize follows the rank; it is given once.
 * Times are minutes on the game clock (`9 * 60` is 9:00 am).
 */

const GREEN = 'willowbrook.village_green';
const RIVER = 'willowbrook.riverbank';
const h = (hour: number): number => hour * 60;

export const FESTIVALS: readonly FestivalDef[] = [
  {
    id: 'egg_hunt',
    name: 'The Egg Hunt',
    season: 'spring',
    day: 13,
    map: GREEN,
    from: h(9),
    to: h(17),
    host: 'willa',
    places: [
      { npc: 'willa', x: 21, y: 13, facing: 'down' },
      { npc: 'tobias', x: 23, y: 13, facing: 'down' },
      { npc: 'ines', x: 25, y: 14, facing: 'left' },
      { npc: 'hollis', x: 23, y: 16, facing: 'up' },
      { npc: 'bram', x: 27, y: 17, facing: 'left' },
      { npc: 'june', x: 18, y: 13, facing: 'right' },
    ],
    huntAreas: [{ x: 3, y: 3, w: 30, h: 23 }],
    intro: ['It is the Egg Hunt! I have hidden eight painted eggs all over the green, and not very well.', 'Walk over one to pick it up. Come and find me when you are done, and I will see how you did against the rest of the village.'],
    rivals: { count: 3, min: 2, max: 6 },
    activity: { kind: 'hunt', tokens: 8 },
    prizes: [
      { rank: 1, money: 300, items: [{ id: 'chicken_feed', count: 10 }], message: 'First! The sharpest eyes in the valley. Here is the big prize.' },
      { rank: 2, money: 200, message: 'Second place, and not a crack in any of them. Well done.' },
      { rank: 3, money: 120, message: 'Third. A fine haul. Take this for the effort.' },
      { rank: 4, money: 60, message: 'Everyone gets something for coming. Better luck next spring!' },
    ],
  },
  {
    id: 'fishing_contest',
    name: 'The Silverbend Fishing Contest',
    season: 'summer',
    day: 11,
    map: RIVER,
    from: h(9),
    to: h(17),
    host: 'june',
    places: [
      { npc: 'june', x: 8, y: 13, facing: 'down' },
      { npc: 'willa', x: 14, y: 10, facing: 'down' },
      { npc: 'tobias', x: 16, y: 9, facing: 'down' },
      { npc: 'hollis', x: 18, y: 8, facing: 'down' },
      { npc: 'bram', x: 20, y: 7, facing: 'left' },
      { npc: 'ines', x: 22, y: 9, facing: 'left' },
    ],
    intro: ['Welcome to the contest! Whoever lands the most fish at Silverbend between nine and five wins.', 'Cast from anywhere on the bank or the dock. Come and tell me your count when you are done.'],
    rivals: { count: 3, min: 2, max: 5 },
    activity: { kind: 'fishing-contest' },
    prizes: [
      { rank: 1, money: 500, items: [{ id: 'trout', count: 1 }], message: 'The most fish! The river is yours. Here is the prize, and a trout for your supper.' },
      { rank: 2, money: 300, message: 'Second. You had them biting. Here is the prize.' },
      { rank: 3, money: 150, message: 'Third. A fine day on the water.' },
      { rank: 4, money: 50, message: 'You stood by the river all day, and that is the whole point. Thank you for coming.' },
    ],
  },
  {
    id: 'harvest_fair',
    name: 'The Harvest Fair',
    season: 'autumn',
    day: 16,
    map: GREEN,
    from: h(10),
    to: h(18),
    host: 'tobias',
    places: [
      { npc: 'tobias', x: 22, y: 13, facing: 'down' },
      { npc: 'willa', x: 20, y: 13, facing: 'down' },
      { npc: 'hollis', x: 24, y: 13, facing: 'down' },
      { npc: 'june', x: 18, y: 13, facing: 'right' },
      { npc: 'ines', x: 26, y: 14, facing: 'left' },
      { npc: 'bram', x: 27, y: 17, facing: 'left' },
    ],
    intro: ['The Harvest Fair! Every farm in the valley sends its best, and I get to be judge, which I have been practising for.', 'Give me the best crop, fish or dish you have, and I will tell you how it stands against the others. Only one entry, mind.'],
    rivals: { count: 3, min: 25, max: 90 },
    activity: { kind: 'harvest-fair', priceStep: 5 },
    prizes: [
      { rank: 1, money: 600, items: [{ id: 'pumpkin_seeds', count: 4 }], message: 'The finest in the valley! My mother would have wept. First prize is yours.' },
      { rank: 2, money: 350, message: 'Second. A very close thing. Well grown.' },
      { rank: 3, money: 200, message: 'Third. Lovely. Honestly lovely.' },
      { rank: 4, money: 75, message: 'Every entry is a good one. Here is something for the trouble.' },
    ],
  },
  {
    id: 'lantern_night',
    name: 'Lantern Night',
    season: 'winter',
    day: 25,
    map: GREEN,
    from: h(18),
    to: h(22),
    host: 'ines',
    places: [
      { npc: 'ines', x: 18, y: 14, facing: 'right' },
      { npc: 'willa', x: 20, y: 14, facing: 'down' },
      { npc: 'tobias', x: 22, y: 14, facing: 'down' },
      { npc: 'hollis', x: 24, y: 14, facing: 'down' },
      { npc: 'june', x: 19, y: 16, facing: 'up' },
      { npc: 'bram', x: 25, y: 16, facing: 'up' },
    ],
    intro: ['Lantern Night. The longest dark of the year, and the whole village comes out to light it.', 'Speak to everyone while the lanterns burn: a word from you means twice as much tonight. Come back and tell me who you saw.'],
    // Lanterns line the plaza from six until ten, and come down with the night.
    decorations: [16, 18, 20, 22, 24, 26].map((x) => ({ object: 'festival_lantern', x, y: 13 })),
    rivals: { count: 3, min: 1, max: 4 },
    activity: { kind: 'lantern-night', bonus: 20 },
    prizes: [
      { rank: 1, money: 400, items: [{ id: 'lantern', count: 1 }], message: 'You spoke to every soul on the green. That is what the night is for. A lantern of your own.' },
      { rank: 2, money: 250, message: 'Nearly everyone! A warm night. Take this.' },
      { rank: 3, money: 125, message: 'You were out in the cold, and it was kind of you. Take this.' },
      { rank: 4, money: 50, message: 'Thank you for coming out. The lanterns were brighter for it.' },
    ],
  },
];
