import type { MapDef } from '../../../engine/world/types';

/**
 * Marlow shallows: the first of Marlow Marsh, a drowned green country south of Home Farm. 48 x 36 cells. The farm's south trail
 * arrives at the top edge and runs out of dry ground at a wide lagoon; a boardwalk (two planks wide) carries it across to the
 * lodge of the naturalist Fern, which stands on a yard of firm grass with a worn path round it. Hand-editable ASCII like the other
 * maps (see homeFarm.ts for the shared legend).
 *
 *   terrain   :  marsh sedge (the wet ground)   .  grass (the firm ground)   d  dirt path   ~  water
 *   props     .  nothing   B  birch   P  pine   T  oak   b  bush   r  rock   s  stump   e  a clump of reeds (a decal, walk through it)
 *             =  one plank of boardwalk (lies over water or mud)   L  Fern's lodge (6 x 4 cells)   M  the Marlow sign
 *
 * Where things are: the trail from the farm arrives at (22,1) and runs south down the meadow; the sign stands beside it at (24,4).
 * The lagoon fills rows 9..12 across the whole map (its banks wind a little, and bays reach up into the north-west and down on the
 * west). The main boardwalk crosses it at x 22..23, y 8..13; a second, one plank wide, crosses at x 44 (y 8..13) and comes down on
 * the east bank. Below the lagoon a grassy neck leads to the lodge yard: the lodge covers x 20..25, y 21..24 and its door is its
 * third bottom cell (22,24), with the path running round the west side to the doorstep at (22,25). A plank path leads west from the
 * yard over a small pool (y 22, x 6..17); the south-west pond (x 2..16, y 25..31) has a jetty at x 11..17, y 29. A creek runs from
 * the lagoon down the east side (x 35..38) into the south-east pool, crossed by a two-wide boardwalk at x 34..39, y 16..17; the
 * east bank beyond it holds the way on to the fen at (47, 16..17).
 * Five open dry patches are kept nearly free of trees for the creatures: the west knoll (x 3..12, y 15..19), the meadow by the sign
 * (x 28..34, y 2..7), the east bank patch (x 39..45, y 19..26), the south knoll (x 20..29, y 30..33) and the grass east of the lodge
 * (x 27..32, y 17..23). The edges are sealed with trees and water apart from the two exits.
 *
 * Exits: the top edge (22..23, 0) back to the farm, the east edge (47, 16..17) on to the fen, and the lodge door (22, 24).
 * Fishing is pond water in three stretches (the lagoon with its bays and pools, the south-west pond, and the creek with the
 * south-east pool; a rod can be cast from the boardwalks). Things are buried in three places each morning: the west marsh, the
 * east bank and the south.
 */
export const MARLOW_SHALLOWS: MapDef = {
  id: 'marlow.shallows',
  regionId: 'marlow',
  name: 'Marlow Shallows',
  width: 48,
  height: 36,
  terrain: [
    ':::::::::::::::.......dd.........:::::::::::::::', // 00
    ':::::::::::::.........dd.........:::::::::::::::', // 01
    '::::::::::::::........dd.........:::::~:::::::::', // 02
    ':::::::::::::.........dd.........:~~~~~~::::::::', // 03
    ':::~~~~~~~~~:.~~~~~...dd.........:~~~~~~~:::::::', // 04
    '::~~~~~~~~~~~~~~~~~~..dd..........~~~~~~~:::::::', // 05
    '::~~~~~~~~~~~:~~~~~...dd.......:.::::~::::::::::', // 06
    ':~~~~~~~~~~~~~:.:.....dd.......:::::::::::::::::', // 07
    ':~~~~~~~~~~::::::::.........:::~~~::::::::~~~~~~', // 08
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 09
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 10
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 11
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 12
    '~~:::::~~~~~~~~~::::..dd...::::~~~~~~~~:::::::::', // 13
    '::::::~~~~~~~~~:::::..dd...~~~~~:::~~~::::::::::', // 14
    ':::::::~~~~~~~::::::..dd...~~~~~:::~~~~:::::::::', // 15
    ':::::.....~..:::::::..dd...:.:::::~~~~~:::::::::', // 16
    ':::...........:::.:...dd.....::::::~~~::::::::::', // 17
    ':::...............dddddd......:::::~~~:::::.::::', // 18
    ':::...............dddddd.........::~~~~::....:::', // 19
    '::::.........:....dd............:::~~~:::......:', // 20
    ':::::::::::::~~~..dd.............::~~~~~.......:', // 21
    '::::::::::::~~~~~.dd..............:~~~~~.......:', // 22
    ':::::::::::::~~~..dd..............:~~~::.......:', // 23
    '::::::::::::......dd.............:~~~~~:.......:', // 24
    '::::::~~~~~~~~....ddddddddddd.....~~~~~:.......:', // 25
    ':::~~~~~~~~~~~~~..ddddddddddd...:~~~~~~~~......:', // 26
    '::~~~~~~~~~~~~~~...............:~~~~~~~~~~~..:::', // 27
    '::~~~~~~~~~~~~~~..............:.~~~~~~~~~~~:::::', // 28
    '::~~~~~~~~~~~~~~::...........:::~~~~~~~~~~~:::::', // 29
    '::::~~~~~~~~~~~~::..:.......:::~~~~~~~~~~~~~::::', // 30
    '::::::~~~~~~~~:::::...........::~~~~~~~~~~~:::::', // 31
    ':::::::::::::::::::...........::~~~~~~~~~~::::::', // 32
    '::::::::::::::::::::..........::::~~~~~~::::::::', // 33
    '~~:::~~~:::~::~~~~~~~:....~:~:~:::~~:~:::~:::~~:', // 34
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 35
  ],
  props: [
    'BBPPBBBPBBBBPPBBBBPBBB..BBBBPPPBBBBPBPPBPPPBPPPP', // 00
    'b.BbBbBBbbb.BB.B.BBB......bbbbB.BbbbBbbPbBBbb.BB', // 01
    'P....PP.b.b.b................P..Pe.PbP.Pe.P....B', // 02
    'P.ee.eeeee..............................ee.....B', // 03
    'B.e.........B...........M.BB.............e.....B', // 04
    'BB..................B.....P...................bB', // 05
    'Bb...........b......................e.eee......P', // 06
    'B.............e.B...T...........e........eee..eB', // 07
    'P..........ee.ee..e...==....bb....BeBe...b..=...', // 08
    '......................==....................=...', // 09
    '......................==....................=...', // 10
    '......................==....................=...', // 11
    '......................==....................=...', // 12
    '..eee.e.........ee....==...eeee........ee...=.BB', // 13
    'Bee..e.........BB................P....PP.......B', // 14
    'PB....e........BBB.....................e.......P', // 15
    'Bb...........r....b........e..eeee======........', // 16
    'PbB............B..................======........', // 17
    'B.............B................................P', // 18
    'PB............T..................B.....e.......B', // 19
    'P....B..B.........................e...e........P', // 20
    'P..............................................B', // 21
    'PB....============...............B............bB', // 22
    'B..........e...................................P', // 23
    'Bb.....e.B.B........L............B.....e.......B', // 24
    'B..ee..................................e.......B', // 25
    'Bbe.............................e..............B', // 26
    'BB.........................................b..bB', // 27
    'Pb.........=.......T...T...................e...P', // 28
    'PB.........=======...........B.e...........e...P', // 29
    'PBBb.......=....e.............e...............BB', // 30
    'BbbbbP........e.e..............................B', // 31
    'BbbbbBB..e.eee.................e..............bB', // 32
    'PBbBBbb.e.BeBee...ee...........eBP......e....eBB', // 33
    '..bBP...PPP.bB.........BPP...B..Bb..B.bP..e....P', // 34
    '................................................', // 35
  ],
  propLegend: {
    B: 'birch',
    P: 'pine',
    T: 'oak',
    b: 'bush',
    r: 'rock',
    s: 'stump',
    e: 'reeds',
    '=': 'plank',
    L: 'lodge',
    M: 'sign_marlow',
  },
  scatter: [
    // reeds everywhere on the wet ground, thick round the banks, then the odd tuft, flower and pebble on the firm ground
    { defs: ['reeds'], density: 0.1, on: ['marsh_grass'], seed: 701 },
    { defs: ['reeds'], density: 0.4, on: ['marsh_grass'], seed: 709, area: { x: 0, y: 7, w: 48, h: 9 } },
    { defs: ['reeds'], density: 0.35, on: ['marsh_grass'], seed: 719, area: { x: 0, y: 24, w: 18, h: 11 } },
    { defs: ['reeds'], density: 0.35, on: ['marsh_grass'], seed: 727, area: { x: 28, y: 22, w: 20, h: 13 } },
    { defs: ['tuft'], density: 0.06, on: ['grass'], seed: 733 },
    { defs: ['flower_white', 'flower_yellow', 'flower_blue'], density: 0.05, on: ['grass'], seed: 739 },
    { defs: ['pebbles'], density: 0.012, on: ['grass', 'marsh_grass'], seed: 743 },
    { defs: ['mushroom'], density: 0.01, on: ['marsh_grass'], seed: 751 },
  ],
  // The trail from the farm arrives at the top, looking down it.
  spawn: { x: 22, y: 1, facing: 'down' },
  exits: [
    { x: 22, y: 0, w: 2, h: 1, to: { map: 'willowbrook.home_farm', x: 22, y: 46, facing: 'up' } },
    { x: 47, y: 16, w: 1, h: 2, to: { map: 'marlow.fen', x: 1, y: 16, facing: 'right' } },
    // The lodge door: the third cell of the bottom row of the lodge. Inside, it is a few steps from Fern.
    { x: 22, y: 24, w: 1, h: 1, to: { map: 'marlow.lodge', x: 5, y: 7, facing: 'up' } },
  ],
  fishing: [
    // the lagoon, its bays and the pools of the north meadow
    { x: 0, y: 2, w: 48, h: 14, water: 'pond' },
    // the south-west pond and the pool by the yard
    { x: 1, y: 20, w: 16, h: 13, water: 'pond' },
    // the creek and the south-east pool
    { x: 29, y: 16, w: 16, h: 19, water: 'pond' },
  ],
  dig: {
    areas: [
      { x: 2, y: 14, w: 13, h: 9 },
      { x: 39, y: 13, w: 7, h: 14 },
      { x: 15, y: 27, w: 16, h: 7 },
    ],
    count: 3,
    artifacts: [
      { item: 'glass_bead', weight: 3 },
      { item: 'clay_pot', weight: 2 },
      { item: 'rusty_key', weight: 2 },
    ],
  },
};
