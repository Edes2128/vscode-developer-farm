import type { MapDef } from '../../../engine/world/types';

/**
 * The Windcrest ruin: what is left of a walled court on the heights. 40 x 30 cells. A short dirt trail from the bottom edge runs
 * into an avenue of old flagstones lined with broken pillars, which leads north across the court to an arch; through the arch is a
 * small inner yard with a standing stone in it, closed on every other side. Highland grass spills in through the broken walls.
 *
 *   terrain   ;  highland grass   .  plain grass (verge of the trail)   d  dirt trail   +  old flagstones
 *   props     .  nothing   B  birch   r  rock   b  bush   S  standing stone   p  broken pillar   w  broken wall (two cells wide)
 *             A  the arch (three cells wide: stone, the open way through, stone)
 *
 * Where things are: you arrive at (20,28). The pillars of the avenue stand at x = 17 and x = 23 (rows 12, 15, 18 and 21), and the arch
 * is at (19..21, 9): walk through the open middle cell (20,9). The inner yard is x 14..26, y 3..8, walled by a row of broken wall along
 * the top (y 2) and a colonnade of pillars and fallen stones down each side (x 13 and x 27). The court is x 9..30, y 10..24, its walls
 * broken in several places: east and west are open stretches of flagstone (x 10..16 and x 24..29, y 15..19) for creatures to stand
 * about on, and a few more standing stones and wall fragments stand inside. Birches ring the edge and the borders are sealed with
 * trees and rocks apart from the one exit.
 *
 * Exits: the bottom edge (20..21, 29) back to the meadow.
 */
export const WINDCREST_RUIN: MapDef = {
  id: 'windcrest.ruin',
  regionId: 'windcrest',
  name: 'Windcrest Ruin',
  width: 40,
  height: 30,
  terrain: [
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', // 00
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', // 01
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;', // 02
    ';;;;;;;;;;;;;;;;++++++++;++;;;;;;;;;;;;;', // 03
    ';;;;;;;;;;;;;;;++++++++++++;;;;;;;;;;;;;', // 04
    ';;;;;;;;;;;;;;+++++++++++++;;;;;;;;;;;;;', // 05
    ';;;;;;;;;;;;;;+++++++++++++;;;;;;;;;;;;;', // 06
    ';;;;;;;;;;;;;;++++++++++++;;;;;;;;;;;;;;', // 07
    ';;;;;;;;;;;;;;+++++++++++;;;;;;;;;;;;;;;', // 08
    ';;;;;;;;;;;;;;;;;;;;+;;;;;;;;;;;;;;;;;;;', // 09
    ';;;;;;;;;++;++;+++++++++;++;+++;;;;;;;;;', // 10
    ';;;;;;;;;+++;+;+;;++++++++++++;;;;;;;;;;', // 11
    ';;;;;;;;;;;++++++++++++++++++;+;;;;;;;;;', // 12
    ';;;;;;;;;+;+++++;+++++++;++++;+;;;;;;;;;', // 13
    ';;;;;;;;;++++++;+++++++++++++++;;;;;;;;;', // 14
    ';;;;;;;;;;++;++++++++++++++++++;;;;;;;;;', // 15
    ';;;;;;;;;+++++++++++++++++++++;;;;;;;;;;', // 16
    ';;;;;;;;;+;++;;++++++++++++++++;;;;;;;;;', // 17
    ';;;;;;;;;;;;+++++++++++++;+++++;;;;;;;;;', // 18
    ';;;;;;;;;++++++++;+++++++++++;+;;;;;;;;;', // 19
    ';;;;;;;;;+;++++++++++++++++++++;;;;;;;;;', // 20
    ';;;;;;;;;;;++++++++++++++++;;++;;;;;;;;;', // 21
    ';;;;;;;;;;;;+++++;+++++++++++++;;;;;;;;;', // 22
    ';;;;;;;;;+;++;+++;+++++;+;;++;;;;;;;;;;;', // 23
    ';;;;;;;;;;++;++++;++++++;++++++;;;;;;;;;', // 24
    ';;;;;;;;;;;;;;;;;;+++++;;;;;;;;;;;;;;;;;', // 25
    ';;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;', // 26
    ';;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;', // 27
    ';;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;', // 28
    ';;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;', // 29
  ],
  props: [
    'BrBBrBBBBBBBBrBrrBrBrBrBrBBBBBrBBBBBrrBB', // 00
    'rB.BrrBrrBrBrBBBrBrrBBrrrBrrBBrrBrrrBrBB', // 01
    'Br.BBBbr..BB.pw.w.w.w.w.w.pp.Br....Brrrr', // 02
    'Br..BB.....B.r............Bp.....rBBrBrB', // 03
    'BBB..........p......S......r........BBBB', // 04
    'BBrB.........pB............p.B......b.BB', // 05
    'BBB..........r.............p..........rB', // 06
    'BBB..........p.............r.B.B.....BBr', // 07
    'rBBB.........r.............p...B......Br', // 08
    'BBB..........w.w.w.A..w.w.w.........B.Br', // 09
    'Br........w.w.............w.w.......B.BB', // 10
    'BBB......p....r..........r....p..B..BBBB', // 11
    'rrr......r.......p.....p......p........B', // 12
    'BBB...rB.p.w.w.p..............r......rBr', // 13
    'rB.......r...............w.w......B..BBB', // 14
    'Brr..............p.....p.............rBB', // 15
    'BB............................r......bBB', // 16
    'BBBB.....p..S...............S.p...b...BB', // 17
    'BB.......r.......p.....p...........r.BrB', // 18
    'BBrrB....p.........................rBrBB', // 19
    'BBB........w.............w....p......BBB', // 20
    'BB.B.....r.p.....p.....p...p..r......Brr', // 21
    'Br..BB...p...r............r...p.......Br', // 22
    'BBB...BB.r....................p......BBB', // 23
    'BrB......w...w.w.p.....pw.w.r.r.....rrrB', // 24
    'rBB..................................bBB', // 25
    'BB..r.B.BB..B..r.r.....B..B..B...B....BB', // 26
    'rB..BrrB...BBBBBBB.....rr...rrB....B.BBB', // 27
    'BrBBBBBrBBBBBBrrBrBB..BBBBBBBBBBB.BBBBBB', // 28
    'rBBBrrBBBBrBrBBBBBrB..BBBBrBBBrrBBBBBrBr', // 29
  ],
  propLegend: {
    B: 'birch',
    r: 'rock',
    b: 'bush',
    S: 'standing_stone',
    p: 'ruin_pillar',
    w: 'ruin_wall',
    A: 'ruin_arch',
  },
  scatter: [
    { defs: ['heather'], density: 0.08, on: ['highland_grass'], seed: 751 },
    { defs: ['tuft'], density: 0.06, on: ['highland_grass'], seed: 757 },
    { defs: ['flower_white', 'flower_blue'], density: 0.02, on: ['highland_grass'], seed: 759 },
    { defs: ['pebbles'], density: 0.02, on: ['highland_grass'], seed: 761 },
    // Weeds and rubble between the flagstones.
    { defs: ['tuft'], density: 0.04, on: ['ruin_floor'], seed: 767 },
    { defs: ['pebbles'], density: 0.05, on: ['ruin_floor'], seed: 769 },
    { defs: ['flower_blue', 'flower_white'], density: 0.1, on: ['grass'], seed: 773 },
  ],
  // The trail from the meadow arrives at the bottom, looking up it.
  spawn: { x: 20, y: 28, facing: 'up' },
  exits: [{ x: 20, y: 29, w: 2, h: 1, to: { map: 'windcrest.meadow', x: 22, y: 1, facing: 'down' } }],
  // Under the flagstones and in the inner yard: pieces of the people who lived here.
  dig: {
    areas: [
      { x: 9, y: 10, w: 22, h: 15 },
      { x: 14, y: 3, w: 13, h: 6 },
    ],
    count: 3,
    artifacts: [
      { item: 'glass_bead', weight: 3 },
      { item: 'old_coin', weight: 2 },
      { item: 'fossil', weight: 2 },
    ],
  },
};
