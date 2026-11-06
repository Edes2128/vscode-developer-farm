import type { FootprintCell, ObjectDef } from '../engine/world/types';

/**
 * Objects for the inside of buildings, the old mine and the river and forest (Phase 4). Frame names match the art pipeline
 * (assets/src/sprites). The footprint rule is the same as everywhere: the anchor is the bottom-left cell, tall sprites rise
 * above it, so furniture against a back wall overlaps the wall tiles above it.
 */

const solid = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'solid' });
const open = (dx: number, dy: number): FootprintCell => ({ dx, dy, mode: 'open' });
const ONE: readonly FootprintCell[] = [solid(0, 0)];
const TWO_WIDE: readonly FootprintCell[] = [solid(0, 0), solid(1, 0)];
const THREE_WIDE: readonly FootprintCell[] = [solid(0, 0), solid(1, 0), solid(2, 0)];
const grid = (width: number, height: number, cell: (dx: number, dy: number) => FootprintCell): FootprintCell[] =>
  Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width)));

const shadowSmall = { frame: 'fx/shadow_small', x: 1, y: 9 } as const;

const furniture: readonly ObjectDef[] = [
  {
    id: 'bed',
    name: 'Bed',
    layer: 'standing',
    frames: ['object/bed'],
    anchor: { x: 0, y: 16 },
    footprint: grid(2, 2, (dx, dy) => solid(dx, dy - 1)),
    interact: { verb: 'Look', title: 'Bed', lines: ['A bed with a patchwork quilt, made with great care. It is not yours to nap in.'] },
  },
  {
    id: 'table',
    name: 'Table',
    layer: 'standing',
    frames: ['object/table'],
    anchor: { x: 0, y: 8 },
    footprint: TWO_WIDE,
  },
  { id: 'chair', name: 'Chair', layer: 'standing', frames: ['object/chair'], anchor: { x: 0, y: 4 }, footprint: ONE },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    layer: 'standing',
    frames: ['object/bookshelf'],
    anchor: { x: 0, y: 24 },
    footprint: TWO_WIDE,
    interact: { verb: 'Look', title: 'Bookshelf', lines: ['Almanacs, field guides and a great many seed catalogues. Some pages are dog-eared at the fish.'] },
  },
  { id: 'stove', name: 'Stove', layer: 'standing', frames: ['object/stove'], anchor: { x: 0, y: 8 }, footprint: ONE, interact: { verb: 'Look', title: 'Stove', lines: ['A small iron stove, warm to stand beside. Something simmers on it.'] } },
  { id: 'barrel', name: 'Barrel', layer: 'standing', frames: ['object/barrel'], anchor: { x: 0, y: 0 }, footprint: ONE, shadow: shadowSmall },
  { id: 'crate', name: 'Crate', layer: 'standing', frames: ['object/crate'], anchor: { x: 0, y: 0 }, footprint: ONE, shadow: shadowSmall },
  { id: 'pot_plant', name: 'Potted plant', layer: 'standing', frames: ['object/pot_plant'], anchor: { x: 0, y: 4 }, footprint: ONE },
  {
    id: 'shelf_goods',
    name: 'Shelves',
    layer: 'standing',
    frames: ['object/shelf_goods'],
    anchor: { x: 0, y: 16 },
    footprint: grid(2, 1, (dx) => solid(dx, 0)),
    interact: { verb: 'Look', title: 'Shelves', lines: ['Jars, sacks and folded cloth, each with a neat little price tag. Ask at the counter.'] },
  },
  {
    id: 'counter',
    name: 'Store counter',
    layer: 'standing',
    frames: ['object/counter'],
    anchor: { x: 0, y: 8 },
    footprint: THREE_WIDE,
    interact: {
      verb: 'Browse',
      title: 'General store',
      lines: ['A brass scale and a cash box sit on the counter. A card reads: "REED\'S GENERAL STORE. Open from nine until five."'],
      action: { kind: 'shop', shop: 'general_store' },
    },
  },
  // A rug lies on the floor under everything: three cells across and two deep, none of them solid, so it never blocks anyone and furniture can stand on it.
  { id: 'rug', name: 'Rug', layer: 'floor', frames: ['object/rug'], anchor: { x: 0, y: 16 }, footprint: [-1, 0].flatMap((dy) => [0, 1, 2].map((dx) => open(dx, dy))) },
];

const buildings: readonly ObjectDef[] = [
  {
    id: 'general_store',
    name: "Reed's General Store",
    layer: 'standing',
    frames: ['object/store'],
    anchor: { x: 0, y: 64 },
    // Six cells across, four deep, like the cottages: the third cell of the bottom row is the open door.
    footprint: grid(6, 4, (dx, dy) => (dx === 2 && dy === 3 ? open(2, 0) : solid(dx, dy - 3))),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
  },
];

const wild: readonly ObjectDef[] = [
  { id: 'ladder_down', name: 'Ladder down', layer: 'floor', frames: ['object/ladder_down'], anchor: { x: 0, y: 0 }, footprint: [open(0, 0)] },
  { id: 'ladder_up', name: 'Ladder up', layer: 'floor', frames: ['object/ladder_up'], anchor: { x: 0, y: 0 }, footprint: [open(0, 0)] },
  {
    id: 'cave_mouth',
    name: 'Old mine entrance',
    layer: 'standing',
    frames: ['object/cave_mouth'],
    anchor: { x: 0, y: 24 },
    // Rock on either side, and the dark way in between: the middle cell is open and is where the mine's exit lies.
    footprint: [solid(0, 0), open(1, 0), solid(2, 0)],
    shadow: { frame: 'fx/shadow_house', x: -26, y: 6 },
  },
  {
    id: 'dock',
    name: 'Fishing dock',
    layer: 'floor',
    frames: ['object/dock_h'],
    anchor: { x: 0, y: 16 },
    // Four cells across, two deep: walkable over the river, like the bridge.
    footprint: grid(4, 2, (dx, dy) => open(dx, dy - 1)),
  },
  {
    id: 'sign_river',
    name: 'River sign',
    layer: 'standing',
    frames: ['object/signpost_right'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: shadowSmall,
    interact: { verb: 'Read', title: 'Sign', lines: ['SILVERBEND', 'Slow water, patient fish. Cast with a rod and wait for the float to dip.'] },
  },
  {
    id: 'sign_wood',
    name: 'Trail sign',
    layer: 'standing',
    frames: ['object/signpost_left'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: shadowSmall,
    interact: { verb: 'Read', title: 'Sign', lines: ['WHISPERING WOOD', 'The old mine is up the trail, past the pond. Take a pickaxe, and mind the time: the mine does not know it is night.'] },
  },
  {
    id: 'sign_mine',
    name: 'Mine sign',
    layer: 'standing',
    frames: ['object/signpost_right'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    shadow: shadowSmall,
    interact: { verb: 'Read', title: 'Sign', lines: ['THE OLD MINE', 'Ten floors, so the story goes. Rocks break with a pickaxe; ladders take you up and down.'] },
  },
];

// ------------------------------------------------------------------------------------------ Phase 5: the farmhouse, the museum, the greenhouse

const homeAndWorkshop: readonly ObjectDef[] = [
  {
    id: 'bed_home',
    name: 'Your bed',
    layer: 'standing',
    frames: ['object/bed'],
    anchor: { x: 0, y: 16 },
    footprint: grid(2, 2, (dx, dy) => solid(dx, dy - 1)),
    interact: { verb: 'Go to bed', title: 'Your bed', lines: ['Your own bed, with the quilt turned down.', 'Turn in for the night?'], action: { kind: 'bed' } },
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    layer: 'standing',
    frames: ['object/kitchen'],
    anchor: { x: 0, y: 8 },
    footprint: THREE_WIDE,
    interact: { verb: 'Cook', title: 'Kitchen', lines: ['A sink, a stove and a rack of copper pots.'], action: { kind: 'craft', station: 'kitchen' } },
  },
  {
    id: 'workbench',
    name: 'Workbench',
    layer: 'standing',
    frames: ['object/workbench'],
    anchor: { x: 0, y: 8 },
    footprint: TWO_WIDE,
    interact: { verb: 'Make', title: 'Workbench', lines: ['A vice, a saw, a hammer and a tin of nails.'], action: { kind: 'craft', station: 'workbench' } },
  },
  { id: 'armchair', name: 'Armchair', layer: 'standing', frames: ['object/armchair'], anchor: { x: 0, y: 4 }, footprint: ONE },
  { id: 'wardrobe', name: 'Wardrobe', layer: 'standing', frames: ['object/wardrobe'], anchor: { x: 0, y: 24 }, footprint: TWO_WIDE },
  { id: 'lantern', name: 'Lantern', layer: 'standing', frames: ['object/lantern'], anchor: { x: 0, y: 12 }, footprint: ONE },
  { id: 'vase', name: 'Vase', layer: 'standing', frames: ['object/vase'], anchor: { x: 0, y: 4 }, footprint: ONE },
  { id: 'clock', name: 'Grandfather clock', layer: 'standing', frames: ['object/clock'], anchor: { x: 0, y: 16 }, footprint: ONE },
  {
    id: 'rain_barrel',
    name: 'Rain barrel',
    layer: 'standing',
    frames: ['object/rain_barrel'],
    anchor: { x: 0, y: 8 },
    footprint: ONE,
    waterSource: true,
    interact: { verb: 'Look', title: 'Rain barrel', lines: ['Brimming with rainwater. Dip the can in to fill it.'] },
  },
];

const civic: readonly ObjectDef[] = [
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    layer: 'standing',
    frames: ['object/greenhouse'],
    anchor: { x: 0, y: 48 },
    // Six cells across, three deep: the third cell of the bottom row is the open door.
    footprint: grid(6, 3, (dx, dy) => (dx === 2 && dy === 2 ? open(2, 0) : solid(dx, dy - 2))),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
  },
  {
    id: 'construction',
    name: 'Building site',
    layer: 'standing',
    frames: ['object/construction'],
    anchor: { x: 0, y: 48 },
    footprint: grid(6, 3, (dx, dy) => solid(dx, dy - 2)),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
    interact: { verb: 'Look', title: 'Building site', lines: ['Planks, panes of glass and a ladder. The carpenter is hard at work: it will be done in a few mornings.'], cells: [{ dx: 2, dy: 0 }] },
  },
  {
    id: 'museum_building',
    name: 'Village museum',
    layer: 'standing',
    frames: ['object/museum'],
    anchor: { x: 0, y: 64 },
    footprint: grid(6, 4, (dx, dy) => (dx === 2 && dy === 3 ? open(2, 0) : solid(dx, dy - 3))),
    shadow: { frame: 'fx/shadow_house', x: -2, y: 6 },
  },
  {
    id: 'case',
    name: 'Display case',
    layer: 'standing',
    frames: ['object/case'],
    anchor: { x: 0, y: 16 },
    footprint: TWO_WIDE,
    interact: { verb: 'Look', title: 'Museum', lines: ['A glass-topped case lined with velvet.'], action: { kind: 'museum' } },
  },
  { id: 'pedestal', name: 'Pedestal', layer: 'standing', frames: ['object/pedestal'], anchor: { x: 0, y: 8 }, footprint: ONE },
];

export const INTERIOR_OBJECTS: readonly ObjectDef[] = [...furniture, ...buildings, ...wild, ...homeAndWorkshop, ...civic];
