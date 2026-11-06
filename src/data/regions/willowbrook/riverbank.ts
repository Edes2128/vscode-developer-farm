import type { MapDef } from '../../../engine/world/types';

/**
 * Silverbend: the river below the village, with a fishing dock. Hand-editable ASCII like the other maps (see homeFarm.ts for the
 * legend). Extra props: D the dock (four cells wide, over the water), h a bench, R the river sign.
 *
 * The far bank is only for looking at. The whole river and its wide pool are fishing water (`river`).
 */
export const RIVERBANK: MapDef = {
  id: 'willowbrook.riverbank',
  regionId: 'willowbrook',
  name: 'Silverbend',
  width: 40,
  height: 26,
  terrain: [
    '...dd...................................', // 00
    '...dd...................................', // 01
    '...dd...................................', // 02
    '...dd...................................', // 03
    '...dd...................................', // 04
    '...dd...................................', // 05
    '...dd...................................', // 06
    '...dd...................................', // 07
    '...dd...................................', // 08
    '...dd......dddd.........................', // 09
    '...dddddddddddd.........................', // 10
    '......dddd......~~~~~~~~~~~.............', // 11
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 12
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 13
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 14
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 15
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 16
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 17
    '................~~~~~~~~~~~.............', // 18
    '................~~~~~~~~~~~.............', // 19
    '........................................', // 20
    '........................................', // 21
    '........................................', // 22
    '........................................', // 23
    '........................................', // 24
    '........................................', // 25
  ],
  props: [
    '.......P.PPPPPPTPPTTbPPT.TTPT.T.PPTTTTPT', // 00
    'P.......b......P....T...P.............PP', // 01
    'P....R.........P....rT..........PT....Pb', // 02
    'T......................T.P...r........TP', // 03
    'T..........T........r..P........b.P.T.PP', // 04
    '..........T...........T.....P......P..PP', // 05
    'P..................PT.......P.........rP', // 06
    'P....................Pr...............PT', // 07
    '...........................T.....PTP..TP', // 08
    'P................P.........P..P.b....PPT', // 09
    'T...........h......r...r....P.....P...TP', // 10
    'T..........................T..........PT', // 11
    '........................................', // 12
    '......D.................................', // 13
    '........................................', // 14
    '........................................', // 15
    '........................................', // 16
    '........................................', // 17
    'PPT.P..r.T.PP...............b....bT..TTT', // 18
    'TT..P....P......................PP....TP', // 19
    'PPPPP.PT.P..Pr...PPP..P.PPb..PP..PP....T', // 20
    'TPP...........P........P.Tb...P.T.....TP', // 21
    'PTrP.T....T......P....PT...PTPPP.P...PTT', // 22
    'PP.bP..P.P.....PPTTP.PT....P..TTr.T.P.TT', // 23
    'PP......T.P.T...PP..T.P...TTT.P..P..T.PT', // 24
    'TPPPT.PTPP.PT.TT.TPTTTTTTrPPPTTTrTTPPPrr', // 25
  ],
  propLegend: {
    T: 'oak',
    P: 'pine',
    b: 'bush',
    r: 'rock',
    D: 'dock',
    h: 'bench',
    R: 'sign_river',
  },
  scatter: [
    { defs: ['flower_blue', 'flower_white', 'flower_yellow'], density: 0.07, on: ['grass'], seed: 301 },
    { defs: ['tuft'], density: 0.1, on: ['grass'], seed: 307 },
    { defs: ['pebbles'], density: 0.02, on: ['grass'], seed: 311 },
  ],
  // The trail from the village green arrives at the top, looking down it.
  spawn: { x: 3, y: 1, facing: 'down' },
  exits: [{ x: 3, y: 0, w: 2, h: 1, to: { map: 'willowbrook.village_green', x: 3, y: 28, facing: 'up' } }],
  fishing: [{ x: 0, y: 11, w: 40, h: 9, water: 'river' }],
  // The soft earth of the bank gives up beads and pots.
  dig: {
    areas: [{ x: 1, y: 1, w: 30, h: 10 }],
    count: 3,
    artifacts: [
      { item: 'glass_bead', weight: 3 },
      { item: 'clay_pot', weight: 2 },
      { item: 'old_coin', weight: 1 },
      { item: 'fossil', weight: 1 },
    ],
  },
};
