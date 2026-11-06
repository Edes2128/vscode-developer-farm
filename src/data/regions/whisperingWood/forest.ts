import { mineFloorEntry } from '../../../engine/mine/generator';
import { mineFloorId } from '../../../engine/mine/surface';
import type { MapDef } from '../../../engine/world/types';

/**
 * Whispering Wood: the forest north of the village green. A trail climbs to a clearing where the old mine's mouth opens in a
 * rock face, and a side trail runs west to a still pond. Props: C the cave mouth (three cells, the middle one is the way in),
 * W the trail sign, N the mine sign.
 */
export const WHISPERING_WOOD: MapDef = {
  id: 'willowbrook.whispering_wood',
  regionId: 'whispering_wood',
  name: 'Whispering Wood',
  width: 48,
  height: 40,
  terrain: [
    '................................................', // 00
    '................................................', // 01
    '................................................', // 02
    '................................................', // 03
    '................................................', // 04
    '................................................', // 05
    '................................................', // 06
    '................................................', // 07
    '................................................', // 08
    '................................................', // 09
    '................................................', // 10
    '................................................', // 11
    '................................................', // 12
    '................................................', // 13
    '...........................ddddddd..............', // 14
    '...........................ddddddd..............', // 15
    '...........................ddddddd..............', // 16
    '...........................ddddddd..............', // 17
    '.............................ddd................', // 18
    '.............................ddd................', // 19
    '...........~~~........dddddddddd................', // 20
    '.........~~~~~~~......dddddddddd................', // 21
    '........~~~~~~~~~.....dd........................', // 22
    '.......~~~~~~~~~~~....dd........................', // 23
    '.......~~~~~~~~~~~....dd........................', // 24
    '.......~~~~~~~~~~~dddddd........................', // 25
    '........~~~~~~~~~ddddddd........................', // 26
    '.........~~~~~~~......dd........................', // 27
    '...........~~~........dd........................', // 28
    '......................dd........................', // 29
    '......................dd........................', // 30
    '......................dd........................', // 31
    '......................dd........................', // 32
    '......................dd........................', // 33
    '......................dd........................', // 34
    '......................dd........................', // 35
    '......................dd........................', // 36
    '......................dd........................', // 37
    '......................dd........................', // 38
    '......................dd........................', // 39
  ],
  props: [
    'PPPPPPPPPPTPPPPPPTTTPPPPPPPPPPPPTPTPTPPPPPTPPPPT', // 00
    'PPT.TPPTPTPPPTTPTTTPPPPPTPTPTPTTTPP.PPPTPPPTTPPP', // 01
    'PT.T..T.bT....Ts.........TTTT.TP.TP...T.P.T.PTPP', // 02
    'PT.T..P.PT..s.T.P.bT.TP..P..TT.T.P..PTTT.TT.PTTP', // 03
    'PTTTTP.T...PPT.bTPP.TT..s...P.T....PP...T.PPT.PT', // 04
    'TPP.P.TP.bPPP.P.TP.PTTP.TTPP...T.sTPP.TP.TP..TTP', // 05
    'PP...P.PPPTTsT......P..PTP.PP..T.TT.T.TPP.PTPTPT', // 06
    'TTP...TT...PPTT.TPP.PP....T...T..b..P..PT...PTTT', // 07
    'PT.TPs.TTTPsPT..P..b..T......TPTTT.TTPPT..P.T.PP', // 08
    'TT.PTT...TPP.TPP..TTP.PPTTTT.PPP....T.PP.P.TT.PP', // 09
    'PPTPT.PPP..P..T....TP..P.T.TT.TT.TT....T....T.PP', // 10
    'TP..s...PTTP..TT..T..PT.....Pb.s.....TT...sT..PP', // 11
    'PTTT.T.TP.PP.PTP.sTT.P...............TP.P.P...PT', // 12
    'PP...TP.T...PPs...PPPTP......C........P...PP..PP', // 13
    'PPTP.T..PPT..PT.P.TT.TPT.............T.PT...PsPT', // 14
    'PPP..........PTPPT.T........N.........T.T.....Ps', // 15
    '..PsT....PT.TT.T..TT.P................PT.PP...TT', // 16
    'TP..P..T..TT..TPTP......T............PPT.P.TPTTT', // 17
    'PPTs.TPT.P.P.TT.........................PP..PTPP', // 18
    'PPTPPP.........T.PP...................TP....P.TT', // 19
    'PP..T.P..........P................s...PPPTPTP.Tb', // 20
    'PPTP.TT...........Ps..............P.TbTTP.P...TP', // 21
    'PPTP.P............................T.P.TT.....TPP', // 22
    'TPPT......................P......sb.TT.bP..PPTTT', // 23
    'PPTT.T....................T........T.P.....T..PP', // 24
    'PT..P......................T.....TTPPT.T.PPPP.PP', // 25
    'PT..TP......................TT..PPP.TTT.T...P.TP', // 26
    'TP.PP....................TPP.PTT.TTT.T.TP..P.TPT', // 27
    'PP.T..TT.........bTT.......T.P..T.PPP.P....PPTPs', // 28
    'TTPP.P.P.P...............T.P...PP..TP.T.T..PT.PT', // 29
    'TT.T.PP.T.P..Ts.............PP.T...P.T..TTPb.TPP', // 30
    'TPsT..P.T...PTT...T.........TP.T.TP...TPT.TT.PPP', // 31
    'TTT..PTT.....PP.....b....T.PT..TPTsTT.T.TTPT.PPP', // 32
    'PPPPT.P...TTT.TPTTP........PP.PPsPbPT..Ps.P.P.TT', // 33
    'TP.bTsT.TP.P.Pb.P.T.......T.P.TP...TPP..P.....TT', // 34
    'PP..P...PP.TTPT.PP.s.......P..T.PT.P...T....TPTP', // 35
    'TTT.bTPTbT.s....TTP.....W..T.T.....T.T.T..T..PPP', // 36
    'TPP.T.P..TPPPb..TP.......P...TP.T.TT.T...T..T..P', // 37
    'PTPP.T..TT.TTT.T.TT..........T.b.TTP....P.TP.TTT', // 38
    'PPbTsT.......P.T.T..T........PP.TTT.P.TTTPTTT.bT', // 39
  ],
  propLegend: {
    T: 'oak',
    P: 'pine',
    b: 'bush',
    s: 'stump',
    C: 'cave_mouth',
    W: 'sign_wood',
    N: 'sign_mine',
  },
  scatter: [
    { defs: ['fern', 'bluebell'], density: 0.14, on: ['grass'], seed: 401 },
    { defs: ['mushroom'], density: 0.03, on: ['grass'], seed: 409 },
    { defs: ['tuft'], density: 0.08, on: ['grass'], seed: 419 },
    { defs: ['pebbles'], density: 0.015, on: ['grass'], seed: 421 },
  ],
  // The trail from the green arrives at the bottom, looking up it.
  spawn: { x: 22, y: 38, facing: 'up' },
  exits: [
    { x: 22, y: 39, w: 2, h: 1, to: { map: 'willowbrook.village_green', x: 22, y: 1, facing: 'down' } },
    // The way into the old mine: the open middle cell of the cave mouth.
    { x: 30, y: 13, w: 1, h: 1, to: { map: mineFloorId(1), ...mineFloorEntry(1) } },
  ],
  fishing: [{ x: 6, y: 18, w: 14, h: 12, water: 'wood_pond' }],
  // Old things lie under the leaf mould, on the trail and in the clearing.
  dig: {
    areas: [{ x: 14, y: 20, w: 20, h: 20 }, { x: 26, y: 12, w: 9, h: 7 }],
    count: 4,
    artifacts: [
      { item: 'fossil', weight: 3 },
      { item: 'rusty_key', weight: 2 },
      { item: 'arrowhead', weight: 2 },
      { item: 'old_coin', weight: 2 },
    ],
  },
};
