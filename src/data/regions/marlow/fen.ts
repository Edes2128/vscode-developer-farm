import type { MapDef } from '../../../engine/world/types';

/**
 * Marlow fen: the wild heart of the marsh, east of the shallows. 40 x 32 cells. A great lake fills the middle, and a boardwalk two
 * planks wide runs straight across it from the way in on the west bank, over a grassy island with a standing stone, to the east
 * bank. Spurs of boardwalk lead off it to two smaller islands, each with a cairn. A dead end: the only way out is back west.
 * Hand-editable ASCII like the other maps (see homeFarm.ts for the shared legend).
 *
 *   terrain   :  marsh sedge   d  dirt path   ~  water
 *   props     .  nothing   B  birch   P  pine   b  bush   r  rock   s  stump   e  a clump of reeds (a decal, walk through it)
 *             =  one plank of boardwalk   S  standing stone   c  cairn
 *
 * Where things are: you arrive at (1,16). The boardwalk runs along y 16..17 from x 7 to x 33; the standing stone is on the middle
 * island at (19,15). A spur runs south from (14,18) to (14,20) and reaches the south island, whose cairn is at (15,22); another runs
 * north from (26,15) up x 26 to the north island, whose cairn is at (25,10). A third cairn stands at the head of the east bank's
 * dirt path at (35,8), the path running from the end of the boardwalk north along x 35..36 and south down the shore. Short jetties
 * reach into the north-west pool (x 6, y 4..7) and the south-west pool (x 4..9, y 27). Four open dry patches are kept nearly free of
 * trees for the creatures: the west bank by the way in (x 2..6, y 9..14), the east bank (x 32..37, y 17..23), the north-east
 * (x 31..37, y 6..10) and the south-west (x 8..14, y 23..26). The edges are sealed with birches and pines apart from the way in.
 *
 * Exits: the west edge (0, 16..17) back to the shallows. All the water here is pond water to fish (a rod can be cast from the
 * boardwalk), and things are buried in the west and east banks each morning.
 */
export const MARLOW_FEN: MapDef = {
  id: 'marlow.fen',
  regionId: 'marlow',
  name: 'Marlow Fen',
  width: 40,
  height: 32,
  terrain: [
    '::::::::::::::::::::::::::::::::::::::::', // 00
    '::::::::::::::::::::::::::::::::::::::::', // 01
    '::::~~~~~::::::::::::::::::::::::~~~::::', // 02
    '::~~~~~~~~:::::::::::::::::::::~~~~~~:::', // 03
    '::~~~~~~~~~::::::::::::::::::::~~~~~~:::', // 04
    ':::~~~~~~~~::::::::::::::::::::::~~~::::', // 05
    '::::~::~~:::::::::::::::::::::::::::::::', // 06
    '::::::::::::::::::::::::::::::::::::::::', // 07
    ':::::::::::::::~:~~~:~~~::::::::::::::::', // 08
    ':::::::::::::::~~~~~~~~~::::::::::::::::', // 09
    ':::::::::::~~~~~~~~~~~~::::::::::::dd:::', // 10
    ':::::::::::~~~~~~~~~~~~~::::~~:::::dd:::', // 11
    ':::::::::~~~~~~~~~~~~~~~~~~~~~~::::dd:::', // 12
    ':::::::::~~~~~~~~~~~~~~~~~~~~~~::::dd:::', // 13
    '::::::::~~~~~~~~~:::::~~~~~~~~~~:::dd:::', // 14
    ':::::::::~~~~~~~:::::::~~~~~~~~~:::dd:::', // 15
    ':::::::::~~~~~~~:::::::~~~~~~~~~~:ddd:::', // 16
    '::::::::~~~~~~~~:::::::~~~~~~~~~~:ddd:::', // 17
    '::::::::~~~~~~~~~:::::~~~~~~~~~~:::dd:::', // 18
    ':::::::::~~~~~~~~~~~~~~~~~~~~~~~~::dd:::', // 19
    '::::::::::~~~~~~~~~~~~~~~~~~~~~::::dd:::', // 20
    ':::::::::::~~::::~~~~~~~~~~~~~~::::dd:::', // 21
    '::::::::::::::::::~~~~~~~~~~~~:::::dd:::', // 22
    ':::::::::::::::::~~~~~~~~~:~::::::::::::', // 23
    '::::::::::::::::~:~:~:~~~::::::~~~::::::', // 24
    '::::::::::::::::::::::::::::::~~~~~~~:::', // 25
    ':::~~~~~:::::::::::::::::::::~~~~~~~~:::', // 26
    '::~~~~~~~::::::::::::::::::::~~~~~~~~:::', // 27
    '::~~~~~~~::::::::::::~~~~~~~:~~~~~~~~:::', // 28
    ':::~~~~:::::::::::::~~~~~~~~~:~~~~~~::::', // 29
    '::::::::::::::::::::~~~~~~~~~~:~~:::::::', // 30
    ':::::::::::::::::::::~~~~~~~::::::::::::', // 31
  ],
  props: [
    'BBPBPBBBPBBPBBBBBBBBBPBPPPPPBBBBPPBPPBPB', // 00
    'BBBbBbBbBbBbB.BbbBbbbBB...b.......bbBbbP', // 01
    'Pbbb.....Peb...Pb...bP.....b..ePe...e.bB', // 02
    'Pb.........e.P......r.......B........e.P', // 03
    'PB....=....e......B...........e.......bP', // 04
    'BBb...=....e.....PbB....BB.....e....B..P', // 05
    'BBBb.e=...........sB..rBB.......e..e.P.B', // 06
    'Pb.B.e=.ee......eeebe..eeB.............B', // 07
    'Bb......P.......B...e..............c..BB', // 08
    'P..........e.e..........e.............bP', // 09
    'P........b.............b.c..BbP.......bP', // 10
    'Pb.....BBee.............ee=...bPB.....bB', // 11
    'P......Be.................=....bB......P', // 12
    'B......ee.................=....Be.....bP', // 13
    'B................e.e.e....=.....eB...PPP', // 14
    'B.......e..........S..e...=.....e.....bB', // 15
    '.......===========================....BP', // 16
    '.......===========================.....B', // 17
    'P......e......=..e..ee...........e....bB', // 18
    'B.............=..................e....bP', // 19
    'P.....PBeP....=................e.......B', // 20
    'Pb.B.....Be..eeee..............B......bB', // 21
    'Bb.......se.ee.c.....................bbB', // 22
    'B....B.........e..........e.Bee.ee....bP', // 23
    'P..............e...B........e.e.....Be.P', // 24
    'PBee.eeee........eebe.b..e..e........ebP', // 25
    'Bee.....e...............r..Br........PbB', // 26
    'Be..======.B...B.....eeeb.e..........bBB', // 27
    'Be...................................BBB', // 28
    'P.......ee...P...............P......BbBB', // 29
    'b.bbbBbeb...BbbBB.be..........b..BbbBBBB', // 30
    'BPBBPBBPPPBBBBPPBPPBB.......PPBBPBBPBPBP', // 31
  ],
  propLegend: {
    B: 'birch',
    P: 'pine',
    b: 'bush',
    r: 'rock',
    s: 'stump',
    e: 'reeds',
    '=': 'plank',
    S: 'standing_stone',
    c: 'cairn',
  },
  scatter: [
    // more reeds than anywhere else: thin in the open, thick by every bank
    { defs: ['reeds'], density: 0.14, on: ['marsh_grass'], seed: 801 },
    { defs: ['reeds'], density: 0.4, on: ['marsh_grass'], seed: 809, area: { x: 7, y: 5, w: 28, h: 22 } },
    { defs: ['reeds'], density: 0.35, on: ['marsh_grass'], seed: 811, area: { x: 1, y: 23, w: 38, h: 8 } },
    { defs: ['tuft'], density: 0.04, on: ['marsh_grass'], seed: 821 },
    { defs: ['pebbles'], density: 0.012, on: ['marsh_grass'], seed: 823 },
    { defs: ['mushroom'], density: 0.012, on: ['marsh_grass'], seed: 827 },
  ],
  // The boardwalk from the shallows arrives at the west edge, looking east along it.
  spawn: { x: 1, y: 16, facing: 'right' },
  exits: [{ x: 0, y: 16, w: 1, h: 2, to: { map: 'marlow.shallows', x: 46, y: 16, facing: 'left' } }],
  fishing: [{ x: 1, y: 2, w: 38, h: 28, water: 'pond' }],
  // The old things of the fen lie in the soft ground of the banks.
  dig: {
    areas: [
      { x: 1, y: 7, w: 7, h: 19 },
      { x: 30, y: 5, w: 8, h: 19 },
    ],
    count: 3,
    artifacts: [
      { item: 'glass_bead', weight: 3 },
      { item: 'rusty_key', weight: 2 },
      { item: 'arrowhead', weight: 2 },
    ],
  },
};
