import type { FootprintCell, ObjectDef } from '../engine/world/types';
import { INTERIOR_OBJECTS } from './interiors';

/**
 * Object definitions: everything that can stand on, or be painted onto, a map.
 *
 * `anchor` is where the anchor cell's top-left sits inside the sprite, in pixels. The anchor cell is the
 * bottom-left cell of the footprint, so a sprite grows up and to the right from where it is placed.
 * Frame names match the art pipeline (assets/src/sprites/objects.mjs).
 */

const solid = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'solid' });
const open = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'open' });
const ONE: readonly FootprintCell[] = [solid(0, 0)];
const TWO_WIDE: readonly FootprintCell[] = [solid(0, 0), solid(1, 0)];

const grid = (width: number, height: number, cell: (dx: number, dy: number) => FootprintCell): FootprintCell[] =>
  Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width)));

// ------------------------------------------------------------------------------------------ nature

const nature: readonly ObjectDef[] = [
  {
    id: 'oak',
    name: 'Oak tree',
    layer: 'standing',
    frames: ['object/oak_a', 'object/oak_b'],
    seasonal: { autumn: ['object/oak_autumn'] },
    anchor: { x: 16, y: 40 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_tree', x: -12, y: 6 },
  },
  {
    id: 'pine',
    name: 'Pine tree',
    layer: 'standing',
    frames: ['object/pine_a', 'object/pine_b'],
    anchor: { x: 16, y: 40 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_pine', x: -10, y: 6 },
  },
  {
    id: 'bush',
    name: 'Bush',
    layer: 'standing',
    frames: ['object/bush'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  },
  {
    id: 'berry_bush',
    name: 'Berry bush',
    layer: 'standing',
    frames: ['object/bush_berry'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  },
  {
    id: 'rock',
    name: 'Rock',
    layer: 'standing',
    frames: ['object/rock_small', 'object/rock_mossy'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  },
  {
    id: 'stump',
    name: 'Tree stump',
    layer: 'standing',
    frames: ['object/stump'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
  },
];

// ------------------------------------------------------------------------------------------ farm and trail props

const props: readonly ObjectDef[] = [
  {
    id: 'farmhouse',
    name: 'Farmhouse',
    layer: 'standing',
    frames: ['object/farmhouse'],
    anchor: { x: 0, y: 64 },
    // The lower four rows of the 6x5-cell sprite are the building; the top row is roof you can walk behind. The third cell of the
    // bottom row is the open door: walk into it to go inside (the bed, the kitchen and the workbench are there).
    footprint: grid(6, 4, (dx, dy) => (dx === 2 && dy === 3 ? open(2, 0) : solid(dx, dy - 3))),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
    smoke: { x: 72, y: -64 },
  },
  {
    id: 'well',
    name: 'Old well',
    layer: 'standing',
    frames: ['object/well'],
    anchor: { x: 0, y: 24 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    waterSource: true,
    interact: {
      verb: 'Look',
      title: 'Old well',
      lines: ['Cool, clear water, a long way down.', 'Someone dug this long before you arrived.'],
    },
  },
  {
    id: 'mailbox',
    name: 'Mailbox',
    layer: 'standing',
    frames: ['object/mailbox'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: {
      verb: 'Check',
      title: 'Mailbox',
      lines: ['Nothing today.', 'The little red flag stays down.'],
    },
  },
  {
    id: 'shipping_bin',
    name: 'Shipping bin',
    layer: 'standing',
    frames: ['object/shipping_bin'],
    anchor: { x: 0, y: 8 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    interact: {
      verb: 'Ship',
      title: 'Shipping bin',
      lines: ['Put the selected item in the bin and it is sold overnight.'],
      action: { kind: 'ship' },
    },
  },
  {
    id: 'seed_stall',
    name: 'Seed stall',
    layer: 'standing',
    frames: ['object/seed_stall'],
    anchor: { x: 0, y: 24 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    interact: {
      verb: 'Browse',
      title: 'Seed stall',
      lines: ['A hand-painted sign reads:', '"WILLA\'S SEEDS. Open from nine until five."'],
      action: { kind: 'shop', shop: 'seed_stall' },
    },
  },
  {
    id: 'fence',
    name: 'Fence',
    layer: 'standing',
    connect: { group: 'fence', framePrefix: 'object/fence_m' },
    anchor: { x: 0, y: 0 },
    footprint: ONE,
  },
  {
    id: 'bridge',
    name: 'Wooden bridge',
    layer: 'floor',
    frames: ['object/bridge_h'],
    anchor: { x: 0, y: 0 },
    // Five cells across, two deep: walkable even where the cells below are river.
    footprint: grid(5, 2, (dx, dy) => open(dx, dy)),
  },
];

// ------------------------------------------------------------------------------------------ the coop, the village

const THREE_WIDE: readonly FootprintCell[] = [solid(0, 0), solid(1, 0), solid(2, 0)];

const homes: readonly ObjectDef[] = ['tobias', 'willa'].map((who) => ({
  id: `${who}_cottage`,
  name: `${who === 'tobias' ? "Tobias's" : "Willa's"} cottage`,
  layer: 'standing' as const,
  frames: [`object/cottage_${who === 'tobias' ? 'blue' : 'green'}`],
  anchor: { x: 0, y: 64 },
  // Six cells across, four deep. The third cell of the bottom row is the open door: walk into it to go inside.
  footprint: grid(6, 4, (dx, dy) => (dx === 2 && dy === 3 ? open(2, 0) : solid(dx, dy - 3))),
  shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
  smoke: { x: 72, y: -64 },
}));

const village: readonly ObjectDef[] = [
  ...homes,
  {
    id: 'sprinkler',
    name: 'Sprinkler',
    layer: 'standing',
    frames: ['object/sprinkler'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    // Every night it waters the tilled soil in the eight cells around it.
    sprinkles: 1,
  },
  {
    id: 'festival_lantern',
    name: 'Lantern',
    layer: 'standing',
    frames: ['object/lantern'],
    anchor: { x: 0, y: 12 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 10 },
    interact: { verb: 'Look', title: 'Lantern', lines: ['A paper lantern, lit for the night. It will be gone by morning.'] },
  },
  {
    id: 'notice_board',
    name: 'Notice board',
    layer: 'standing',
    frames: ['object/notice_board'],
    anchor: { x: 0, y: 16 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    interact: {
      verb: 'Read',
      title: 'Notice board',
      lines: ['Slips of paper, pinned up in the village handwriting.'],
      action: { kind: 'board' },
    },
  },
  {
    id: 'merchant_cart',
    name: "Rowan's cart",
    layer: 'standing',
    frames: ['object/merchant_cart'],
    anchor: { x: 0, y: 16 },
    footprint: THREE_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 6, y: 10 },
    interact: {
      verb: 'Browse',
      title: "Rowan's cart",
      lines: ['A striped awning and a painted board:', '"MARKET DAY. Every Sunday, eight until six. Seeds of every season."'],
      action: { kind: 'shop', shop: 'merchant' },
    },
  },
  {
    id: 'fountain',
    name: 'Fountain',
    layer: 'standing',
    frames: ['object/fountain'],
    anchor: { x: 0, y: 24 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    waterSource: true,
    interact: { verb: 'Look', title: 'Fountain', lines: ['The water is cool and clear. A few coins glint at the bottom: other people\'s wishes.'] },
  },
  {
    id: 'bench',
    name: 'Bench',
    layer: 'standing',
    frames: ['object/bench'],
    anchor: { x: 0, y: 0 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 8 },
  },
  {
    id: 'sign_green',
    name: 'Village sign',
    layer: 'standing',
    frames: ['object/signpost_right'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: { verb: 'Read', title: 'Sign', lines: ['WILLOWBROOK GREEN', 'Cottages to the north. The fountain is for looking at, not for washing in.'] },
  },
  {
    id: 'sign_home',
    name: 'Road sign',
    layer: 'standing',
    frames: ['object/signpost_left'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: { verb: 'Read', title: 'Sign', lines: ['HOME FARM', 'West along the road, over the bridge, and you are back among your own fields.'] },
  },
];

const coop: readonly ObjectDef[] = [
  {
    id: 'coop',
    name: 'Chicken coop',
    layer: 'standing',
    frames: ['object/coop'],
    anchor: { x: 0, y: 24 },
    footprint: THREE_WIDE,
    shadow: { frame: 'fx/shadow_house', x: -26, y: 6 },
    interact: { verb: 'Open', title: 'Chicken coop', lines: ['A snug little coop with a nesting box and a ramp.'], action: { kind: 'coop' } },
  },
  {
    id: 'trough',
    name: 'Feed trough',
    layer: 'standing',
    frames: ['object/trough'],
    anchor: { x: 0, y: 0 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: { verb: 'Fill', title: 'Feed trough', lines: ['A wooden trough for the hens.'], action: { kind: 'trough' } },
  },
];

// ------------------------------------------------------------------------------------------ signs and trail blocks

const signs: readonly ObjectDef[] = [
  {
    id: 'sign_farm',
    name: 'Farm sign',
    layer: 'standing',
    frames: ['object/signpost_right'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: {
      verb: 'Read',
      title: 'Sign',
      lines: ['HOME FARM', 'A little patch of Willowbrook, all yours.'],
    },
  },
  {
    id: 'sign_north',
    name: 'Trail sign',
    layer: 'standing',
    frames: ['object/signpost_left'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: {
      verb: 'Read',
      title: 'Sign',
      lines: ['NORTH TRAIL', 'Up to Windcrest Heights, where the wind never stops and the old stones keep their secrets.'],
    },
  },
  {
    id: 'sign_south',
    name: 'Trail sign',
    layer: 'standing',
    frames: ['object/signpost_left'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: {
      verb: 'Read',
      title: 'Sign',
      lines: ['SOUTH TRAIL', 'Down to Marlow Marsh. Keep to the boardwalks: the marsh keeps what it takes.'],
    },
  },
  {
    id: 'sign_east',
    name: 'Road sign',
    layer: 'standing',
    frames: ['object/signpost_right'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: { frame: 'fx/shadow_small', x: 1, y: 9 },
    interact: {
      verb: 'Read',
      title: 'Sign',
      lines: ['TO WILLOWBROOK VILLAGE', 'Over the bridge and along the road.'],
    },
  },
  {
    id: 'fallen_log_north',
    name: 'Fallen log',
    layer: 'standing',
    frames: ['object/log'],
    anchor: { x: 0, y: 0 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 8 },
    interact: {
      verb: 'Look',
      title: 'Fallen log',
      lines: ['A great log lies across the trail.', 'Beyond it the woods grow thick and quiet. Not today.'],
    },
  },
  {
    id: 'fallen_log_south',
    name: 'Fallen log',
    layer: 'standing',
    frames: ['object/log'],
    anchor: { x: 0, y: 0 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 8 },
    interact: {
      verb: 'Look',
      title: 'Fallen log',
      lines: ['The trail south is blocked by a fallen log.', 'You can hear the river carrying on without you.'],
    },
  },
  {
    id: 'rockslide',
    name: 'Rockslide',
    layer: 'standing',
    frames: ['object/boulder'],
    anchor: { x: 0, y: 8 },
    footprint: TWO_WIDE,
    shadow: { frame: 'fx/shadow_medium', x: 3, y: 10 },
    interact: {
      verb: 'Look',
      title: 'Rockslide',
      lines: ['Boulders have tumbled across the road to the village.', "Somebody will clear them, in time."],
    },
  },
];

// ------------------------------------------------------------------------------------------ ground decals

const decal = (id: string, name: string, frames: readonly string[]): ObjectDef => ({
  id,
  name,
  layer: 'ground',
  frames,
  anchor: { x: 0, y: 0 },
  footprint: [],
});

const decals: readonly ObjectDef[] = [
  decal('flower_red', 'Red flowers', ['decal/flower_red_0', 'decal/flower_red_1']),
  decal('flower_yellow', 'Yellow flowers', ['decal/flower_yellow_0', 'decal/flower_yellow_1']),
  decal('flower_blue', 'Blue flowers', ['decal/flower_blue_0', 'decal/flower_blue_1']),
  decal('flower_white', 'White flowers', ['decal/flower_white_0', 'decal/flower_white_1']),
  decal('flower_pink', 'Pink flowers', ['decal/flower_pink_0', 'decal/flower_pink_1']),
  decal('tuft', 'Tall grass', ['decal/tuft_0', 'decal/tuft_1', 'decal/tuft_2']),
  decal('pebbles', 'Pebbles', ['decal/pebbles_0', 'decal/pebbles_1']),
  decal('mushroom', 'Mushroom', ['decal/mushroom']),
  decal('fern', 'Ferns', ['decal/fern_0', 'decal/fern_1']),
  decal('bluebell', 'Bluebells', ['decal/bluebell_0', 'decal/bluebell_1']),
];

export const OBJECTS: readonly ObjectDef[] = [...nature, ...props, ...coop, ...village, ...signs, ...decals, ...INTERIOR_OBJECTS];
