import type { MapDef } from '../../../engine/world/types';

/**
 * Home Farm: where the game begins. 64 x 48 cells.
 *
 * The map is two ASCII layers you can edit by hand. Every row is one row of cells, left to right:
 *
 *   terrain   .  grass     d  dirt path     ~  water
 *   props     .  nothing   T/P  oak/pine (chosen by position)   b/B  bush/berry bush   r  rock   s  stump
 *             f  fence (joins its neighbours)   H  farmhouse   W  well   M  mailbox   =  bridge
 *             F/N/S/E  signs (farm / north / south / east)   L/l  fallen logs (north / south)    O  rockslide (none now: the east road is open)
 *             X  shipping bin   K  seed stall   Q  chicken coop   v  feed trough
 *
 * A multi-cell object sits on its anchor cell, the bottom-left cell of its footprint: the farmhouse
 * covers 6 x 4 cells above and to the right of its 'H'. `npm test` checks that the spawn is walkable and
 * everything you can interact with can be reached, so a typo here cannot ship.
 */
export const HOME_FARM: MapDef = {
  id: 'willowbrook.home_farm',
  regionId: 'willowbrook',
  name: 'Home Farm',
  width: 64,
  height: 48,
  terrain: [
    '..............................dd..............~~~...............', // 00
    '..............................dd..............~~~...............', // 01
    '..............................dd..............~~~...............', // 02
    '..............................dd..............~~~...............', // 03
    '..............................dd..............~~~...............', // 04
    '..............................dd..............~~~...............', // 05
    '..............................dd..............~~~...............', // 06
    '..............................dd..............~~~...............', // 07
    '..............................dd..............~~~...............', // 08
    '..............................dd..............~~~...............', // 09
    '..............................dd..............~~~...............', // 10
    '..............................dd..............~~~...............', // 11
    '..............................dd..............~~~...............', // 12
    '............dddd..............dd.............~~~................', // 13
    '.............dd...............dd.............~~~................', // 14
    '.............dd...............dd............~~~~................', // 15
    '.............dd...............dd............~~~.................', // 16
    '.............dd...............dd...........~~~~.................', // 17
    '.............dd...............dd...........~~~..................', // 18
    '.............dd...............dd...........~~~..................', // 19
    '.............dd...............dd..........~~~...................', // 20
    '.............ddddddddddddddddddddddddddddd~~~ddddddddddddddddddd', // 21
    '.............ddddddddddddddddddddddddddddd~~~ddddddddddddddddddd', // 22
    '.............dd.......dd.................~~~....................', // 23
    '.............dd.......dd.................~~~....................', // 24
    '......................dd................~~~.....................', // 25
    '......................dd................~~~.....................', // 26
    '......................dd............~~~~~~~.....................', // 27
    '......................dd...........~~~~~~~~~....................', // 28
    '......................dd..........~~~~~~~~~~~...................', // 29
    '......................dd.........~~~~~~~~~~~~~..................', // 30
    '......................dd.........~~~~~~~~~~~~~..................', // 31
    '......................dd.........~~~~~~~~~~~~~..................', // 32
    '......................dd..........~~~~~~~~~~~...................', // 33
    '......................dd...........~~~~~~~~~....................', // 34
    '......................dd............~~~~~~~.....................', // 35
    '......................dd...............~~~~.....................', // 36
    '......................dd...............~~~~.....................', // 37
    '......................dd...............~~~~.....................', // 38
    '......................dd...............~~~~.....................', // 39
    '......................dd...............~~~~.....................', // 40
    '......................dd...............~~~~.....................', // 41
    '......................dd...............~~~~.....................', // 42
    '......................dd...............~~~~.....................', // 43
    '......................dd...............~~~~.....................', // 44
    '......................dd...............~~~~.....................', // 45
    '......................dd...............~~~~.....................', // 46
    '......................dd...............~~~~.....................', // 47
  ],
  props: [
    'TPTTTPPPTPPPTTPTTTTTTTPTPTPPP....PPTPPPPPPPPP.....TTTPPPPTTPTTTT', // 00
    'TTPPTTTPPTTTTTTPTTTTTTPTPPPPP....PPTTPTTTTTPP.....TTPPPTPTTTTTTT', // 01
    'PTTTPPTTPTPPTTTTPTPPPPTPPTTPP....PPPTTTPPTPPT.....TPTTPPTTTPPPTT', // 02
    'TTTP.PPTTPPT.P.PP.T....TP.PP.b..bTP.P..P.T.........T.P..P..PPTPT', // 03
    'TTTT..T....T.......T..T....P...........PP..P..........sT.....PTP', // 04
    'PTPPT...........................N..B....................TP...PPP', // 05
    'PTP.....................P..........................T.T.P.T..TPTP', // 06
    'TTT......................P.T........................P.P..T.T.PPP', // 07
    'TTTPT..b................PT.P.........r............T...T.T.TPTTPT', // 08
    'TPT.P..................PT...T.............s.b.......PTPT..TTPPTP', // 09
    'TPT..................bTT.TT.T........................T.......PPP', // 10
    'TTTP...................TT...................r..........PT.PPTPPT', // 11
    'TTP........H.........X..TP........r................P.T..TP...PPP', // 12
    'TPT.................................................T.P.PPT.PTPP', // 13
    'PTPT..............W..............................T...........PTT', // 14
    'PPTT.......F..............................T......T.r.......BPTTP', // 15
    'TTP.............M....................................b......TPPP', // 16
    'TTTP........................................................PPTP', // 17
    'TTP.T............r.......r.................................T.PPP', // 18
    'PTPP................K.....................................ET.PPT', // 19
    'PPP...m....b................................................bb..', // 20
    'PPT......................................=......................', // 21
    'PPP.P..m........................................................', // 22
    'PPT.........................................................bb..', // 23
    'PTP.T.fffffff..fffffff..fff.................................PPPP', // 24
    'PTP.P.f...................f................................T.PPP', // 25
    'PTP...f...................f........................B......s.TPPT', // 26
    'PPPPP.f...................f.fQ..f................r....T.....TTTP', // 27
    'PTP...f...................f.f...f.......................T...TTTP', // 28
    'TPPb..f...................f.f...f...................P.m.....TTPP', // 29
    'PPTT..f...................f.....f...............m....T.T.T..PPPT', // 30
    'TPTPT.f...................f.f..vf.......................T..TPTTP', // 31
    'TPPT..f...................f.f...f...................T..T.....PPT', // 32
    'PPPPP.f...................f.fffff............................PTT', // 33
    'TTPb..f...................f............................TTT.TTTPT', // 34
    'PTP...f...................f.........................TTP.bT.TTPPT', // 35
    'TTTP..f...................f.........................P.T..TTTTTTP', // 36
    'PTT...f...................f.....P....b...............PP.T..PTTTP', // 37
    'PPTPP.ffffffffffffffff..fff..sT..T.................bT...T..TTTTT', // 38
    'TPPP..........................TPTT.T........................TTTT', // 39
    'TPT..P.TTTT......................PTT................P.....T.TTTT', // 40
    'PTTTT.TT.PTTP.................B..................r..T.b..PP.PTPT', // 41
    'PPPTT.TT...P...b........S....T.TPP..................r.TTTT.TPTTT', // 42
    'TTPP.TTTP..PTP....T......P....TTPPTT.T.......P.....TPTB.....TPPP', // 43
    'PTPTTPTP.T.TTT..PTPTTb..bPT..P...TT.........T.PP...T....PPT..TTT', // 44
    'TTTPTTTTTPPTTPTPTPTTT....PPTTPPPTPPTTT......PTTTPTPTPPTTTPTPPTPP', // 45
    'PPTTPPPPTTPPPTPPTTTPT....TPTTPTTTTPTPP......PPTTPPPTPTPTTTPTTTTT', // 46
    'PTTPPPTPTTTPTTTPTPTTP....PTTTTTTTTTTTT......PPTPPPTTTPPTPTPTTPPP', // 47
  ],
  propLegend: {
    T: 'oak',
    P: 'pine',
    b: 'bush',
    B: 'berry_bush',
    r: 'rock',
    m: 'rock',
    s: 'stump',
    f: 'fence',
    H: 'farmhouse',
    W: 'well',
    M: 'mailbox',
    '=': 'bridge',
    F: 'sign_farm',
    N: 'sign_north',
    S: 'sign_south',
    E: 'sign_east',
    L: 'fallen_log_north',
    l: 'fallen_log_south',
    O: 'rockslide',
    X: 'shipping_bin',
    K: 'seed_stall',
    Q: 'coop',
    v: 'trough',
  },
  scatter: [
    { defs: ['flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_pink'], density: 0.05, on: ['grass'], seed: 7 },
    // A little garden by the front door.
    {
      defs: ['flower_yellow', 'flower_pink', 'flower_white', 'flower_red'],
      density: 0.3,
      on: ['grass'],
      seed: 19,
      area: { x: 8, y: 13, w: 12, h: 3 },
    },
    { defs: ['tuft'], density: 0.07, on: ['grass'], seed: 31 },
    { defs: ['pebbles'], density: 0.012, on: ['grass'], seed: 43 },
    { defs: ['mushroom'], density: 0.006, on: ['grass'], seed: 53 },
  ],
  // The east road goes on to the Village Green. The way back is the green's west exit.
  exits: [
    // The north trail climbs to Windcrest Heights (closed until the player has earned it: see that region's unlock).
    { x: 30, y: 0, w: 2, h: 1, to: { map: 'windcrest.meadow', x: 30, y: 34, facing: 'up' } },
    // The south trail leads down into Marlow Marsh (closed until the player has earned it: see that region's unlock).
    { x: 22, y: 47, w: 2, h: 1, to: { map: 'marlow.shallows', x: 22, y: 1, facing: 'down' } },
    { x: 62, y: 21, w: 2, h: 2, to: { map: 'willowbrook.village_green', x: 2, y: 14, facing: 'right' } },
    // The farmhouse door (the third cell of the bottom row of the house): your bed, your kitchen and your workbench are inside.
    { x: 13, y: 12, w: 1, h: 1, to: { map: 'willowbrook.farmhouse', x: 5, y: 7, facing: 'up' } },
  ],
  // The empty lot east of the farmhouse, where the carpenter can build a greenhouse (the anchor is the bottom-left cell).
  sites: [{ id: 'greenhouse_site', building: 'greenhouse', x: 22, y: 17 }],
  // A few things lie buried in the meadow west of the house each day.
  dig: {
    areas: [{ x: 3, y: 13, w: 9, h: 7 }],
    count: 3,
    artifacts: [
      { item: 'clay_pot', weight: 3 },
      { item: 'arrowhead', weight: 3 },
      { item: 'old_coin', weight: 2 },
      { item: 'glass_bead', weight: 1 },
    ],
  },
  // The chicken yard behind the fenced field: three cells wide, five deep, with a gate on its west side.
  ranch: { yard: { x: 29, y: 28, w: 3, h: 5 }, capacity: 4, troughCapacity: 12 },
  // Where a rod can be cast: the pond first (its cells are part of the same water as the river), then the river around it.
  fishing: [
    { x: 35, y: 28, w: 9, h: 8, water: 'pond' },
    { x: 33, y: 0, w: 16, h: 48, water: 'river' },
  ],
  // The fenced field west of the south trail: the soil here can be worked.
  tillable: [{ x: 7, y: 25, w: 15, h: 13 }],
  // In front of the farmhouse door, looking at it.
  spawn: { x: 13, y: 14, facing: 'up' },
};
