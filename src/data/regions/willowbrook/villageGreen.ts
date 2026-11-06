import type { MapDef } from '../../../engine/world/types';

/**
 * Village Green: the first corner of Willowbrook village. 40 x 30 cells.
 *
 * Two cottages, a plaza with a fountain and benches, and the road west to Home Farm. The rest of the village comes later.
 * Edited by hand like Home Farm: two ASCII layers (see homeFarm.ts for the legend).
 *
 *   props   C  Tobias's cottage   G  Willa's cottage   M  general store   N  museum   U  fountain   h  bench (two cells)
 *           Y  notice board (two cells)   K  Rowan's market-day cart (three cells; he stands behind it on Sundays)
 *           Z / z / W / R  signs (village / home road / wood trail / river)
 *
 * Every building's door is the third cell of its bottom row: walk into it to go inside (each door is an exit to an interior
 * map). Trails leave the green to the north (Whispering Wood) and the south-west (the river).
 */
export const VILLAGE_GREEN: MapDef = {
  id: 'willowbrook.village_green',
  regionId: 'willowbrook',
  name: 'Village Green',
  width: 40,
  height: 30,
  terrain: [
    '......................dd................', // 00
    '......................dd................', // 01
    '......................dd................', // 02
    '......................dd................', // 03
    '......................dd................', // 04
    '......................dd................', // 05
    '......................dd................', // 06
    '......................dd................', // 07
    '......................dd................', // 08
    '......................dd................', // 09
    '........dd............dd......dd........', // 10
    '........dd....dddddddddddd....dd........', // 11
    '........dd....dddddddddddddddddd........', // 12
    '........dd....dddddddddddddddddd........', // 13
    'dddddddddddddddddddddddddd..............', // 14
    'dddddddddddddddddddddddddd..............', // 15
    '...dd.........dddddddddddd..............', // 16
    '...dd.........dddddddddddd..............', // 17
    '...dd.........dddddddddddd..............', // 18
    '...dd.............dd....................', // 19
    '...dd.............dd....................', // 20
    '...dd.............dd....................', // 21
    '...dd.............dd....................', // 22
    '...dd.............dd....................', // 23
    '...dd.............dddddddddddddd........', // 24
    '...dd...................................', // 25
    '...dd...................................', // 26
    '...dd...................................', // 27
    '...dd...................................', // 28
    '...dd...................................', // 29
  ],
  props: [
    'TPTPPTTPPPPTTTPPPPPTTP..TPTTTTTTTTPTTTPP', // 00
    'PPTPPTTPPPPPPTTPPPTTPT..PTTTPTPPTPPPTPPT', // 01
    'TPTPTPPPTPTTTPTTPPPPPP..TTPTPTTPTPTPPTTP', // 02
    'TTP...TP..T..T..T.TPTP....T...PTT.r..TTT', // 03
    'PPT.............................b....PPT', // 04
    'PPP......................T...........PPP', // 05
    'TPT.................................TPTP', // 06
    'PPPPT................................TTP', // 07
    'PTTP..........T......................PTP', // 08
    'TPPT..C..............W......G........PPP', // 09
    'PPP..................................TTT', // 10
    'PTPT.................................PPP', // 11
    '...T...........h.......h.............TTP', // 12
    '....Z.Y.............................TPTT', // 13
    '.....................................TTT', // 14
    '...................U................PPPT', // 15
    '..z..................................PTT', // 16
    '.....R....r.s..h.......h............TPTT', // 17
    'TPT.................................TTPT', // 18
    'PPT......m................K......b..TPTP', // 19
    'TTP..b...........b...................PTT', // 20
    'PPT..........r...T...................TPP', // 21
    'TTP.........B...b.................r..TPT', // 22
    'PPP............B....M.......N.......bTTP', // 23
    'TTT..........T..T...................TTPT', // 24
    'PPT..s..................b......T...rTPTP', // 25
    'TTT.....T..PPPm.PT.TTBTP....TPPT.....TTP', // 26
    'PTP..TPTPTTPTTPPTTTTPPTTTTPPTPTTTPPTPPPT', // 27
    'TTP..TPTTTTPPTPTTTTPTTPPTPTTPPPTPPTPTTTT', // 28
    'TTT..TTTTTTPPTPPTTPTPTTTPPPTPTTTTTPTPTPT', // 29
  ],
  propLegend: {
    T: 'oak',
    P: 'pine',
    b: 'bush',
    B: 'berry_bush',
    r: 'rock',
    m: 'rock',
    s: 'stump',
    C: 'tobias_cottage',
    G: 'willa_cottage',
    U: 'fountain',
    h: 'bench',
    Z: 'sign_green',
    z: 'sign_home',
    W: 'sign_wood',
    R: 'sign_river',
    M: 'general_store',
    N: 'museum_building',
    Y: 'notice_board',
    K: 'merchant_cart',
  },
  scatter: [
    { defs: ['flower_red', 'flower_yellow', 'flower_blue', 'flower_white', 'flower_pink'], density: 0.06, on: ['grass'], seed: 71 },
    { defs: ['flower_pink', 'flower_white', 'flower_yellow'], density: 0.3, on: ['grass'], seed: 83, area: { x: 4, y: 16, w: 8, h: 4 } },
    { defs: ['tuft'], density: 0.07, on: ['grass'], seed: 97 },
    { defs: ['pebbles'], density: 0.012, on: ['grass'], seed: 101 },
  ],
  // The road from Home Farm arrives here, looking east along it.
  spawn: { x: 3, y: 14, facing: 'right' },
  exits: [
    // The road west leads back to Home Farm.
    { x: 0, y: 14, w: 1, h: 2, to: { map: 'willowbrook.home_farm', x: 60, y: 21, facing: 'left' } },
    // The trail north into Whispering Wood (closed until the player has earned it: see the forest's region).
    { x: 22, y: 0, w: 2, h: 1, to: { map: 'willowbrook.whispering_wood', x: 22, y: 38, facing: 'up' } },
    // The trail south-west to the river.
    { x: 3, y: 29, w: 2, h: 1, to: { map: 'willowbrook.riverbank', x: 3, y: 1, facing: 'down' } },
    // The doors.
    { x: 8, y: 9, w: 1, h: 1, to: { map: 'willowbrook.tobias_cottage', x: 4, y: 6, facing: 'up' } },
    { x: 30, y: 9, w: 1, h: 1, to: { map: 'willowbrook.willas_cottage', x: 4, y: 6, facing: 'up' } },
    { x: 22, y: 23, w: 1, h: 1, to: { map: 'willowbrook.general_store', x: 5, y: 7, facing: 'up' } },
    { x: 30, y: 23, w: 1, h: 1, to: { map: 'willowbrook.museum', x: 6, y: 8, facing: 'up' } },
  ],
};
