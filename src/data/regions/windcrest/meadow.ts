import type { MapDef } from '../../../engine/world/types';

/**
 * Windcrest meadow: the windswept highland above the farm. 48 x 36 cells. The farm's north trail climbs from the bottom edge (a
 * worn dirt path, with a lush verge of plain grass on either side) in long bends to the old ruin at the top. Hand-editable
 * ASCII like the other maps (see homeFarm.ts for the shared legend).
 *
 *   terrain   ;  highland grass (the plain)   .  plain grass (the verge of the trail and of the tarn)   d  dirt trail   ~  water (the tarn)
 *   props     .  nothing   B  birch   r  rock   b  bush   S  standing stone   C  cairn   W  the Windcrest sign
 *
 * Where things are: the sign stands beside the trail just north of the arrival (29,31). Seven standing stones make a ring open to the
 * south around (11,19) in the west (the middle is kept clear), with a lone stone at (21,9), (38,21) and (42,26) and cairns at (19,12),
 * (29,21), (37,14) and (6,27). The tarn lies in the north-west (x 8..14, y 7..12; a pond: minnow, carp and catfish) and the rocky
 * outcrop in the north-east (x 34..45, y 2..9) holds the ore. Four open clearings (the stone ring in the west, a wide one east of the
 * trail around (39,23), one beside the upper trail around (29,9) and one in the south-west around (10,30)) are kept nearly free of
 * trees for the creatures that wander in. Birches thicken into groves in the south-centre, the south-east and the far west, and the
 * edges are sealed with trees and rocks apart from the two exits.
 *
 * Exits: the bottom edge (30..31, 35) back to the farm, the top edge (22..23, 0) on to the ruin.
 */
export const WINDCREST_MEADOW: MapDef = {
  id: 'windcrest.meadow',
  regionId: 'windcrest',
  name: 'Windcrest Meadow',
  width: 48,
  height: 36,
  terrain: [
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 00
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 01
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 02
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 03
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 04
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 05
    ';;;;;;;;;.....;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 06
    ';;;;;;;;..~~~..;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 07
    ';;;;;;;..~~~~~..;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 08
    ';;;;;;;.~~~~~~~.;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 09
    ';;;;;;;.~~~~~~..;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 10
    ';;;;;;;..~~~~..;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 11
    ';;;;;;;;..~~..;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 12
    ';;;;;;;;;....;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 13
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 14
    ';;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;;;;;', // 15
    ';;;;;;;;;;;;;;;;;;;;;.dd.....;;;;;;;;;;;;;;;;;;;', // 16
    ';;;;;;;;;;;;;;;;;;;;;.dddddd.;;;;;;;;;;;;;;;;;;;', // 17
    ';;;;;;;;;;;;;;;;;;;;;.dddddd.;;;;;;;;;;;;;;;;;;;', // 18
    ';;;;;;;;;;;;;;;;;;;;;.....dd.;;;;;;;;;;;;;;;;;;;', // 19
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;', // 20
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;', // 21
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;', // 22
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;;;;;', // 23
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dd.....;;;;;;;;;;;;;;;', // 24
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dddddd.;;;;;;;;;;;;;;;', // 25
    ';;;;;;;;;;;;;;;;;;;;;;;;;.dddddd.;;;;;;;;;;;;;;;', // 26
    ';;;;;;;;;;;;;;;;;;;;;;;;;.....dd.;;;;;;;;;;;;;;;', // 27
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 28
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 29
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 30
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 31
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 32
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 33
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 34
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;.dd.;;;;;;;;;;;;;;;', // 35
  ],
  props: [
    'BBBBBBBBBrBBBBBBBrBrrB..rrBrrBBBrrrrBBBrBBBBrrBr', // 00
    'BBBrB..BBBB.rBBrBBBBBr..r.BrBBBBBrrrrBrBBBBBBBrB', // 01
    'BBrBBr..B........B.........BBb.BBBrrrrrrrrrrrrBB', // 02
    'BrrB...B..rB......r.........B.....rr.rrBrrrrrrBB', // 03
    'BrBB..r...........................r........rrrBB', // 04
    'BB....b.........................B.r.r..r....rrBB', // 05
    'BB....B........................B......r....r.rBB', // 06
    'BBBB...............................r.....r...rBr', // 07
    'rrB................B...................r....bBrB', // 08
    'rB..BB...............S..............r......r.rBB', // 09
    'rBB...........................................BB', // 10
    'rBB................................B..........rB', // 11
    'BB.BB............B.C.....................B....Br', // 12
    'Br.......................................B...BrB', // 13
    'BB...................................C........BB', // 14
    'Br...........................................rBr', // 15
    'BB.........S.....................B............BB', // 16
    'BB...b...S...S.......................B.......bBB', // 17
    'BB..........................................B.rr', // 18
    'BrB.....S.....S...B...........................rB', // 19
    'BBB.......................................b...BB', // 20
    'BrB......S...S......BBr......C........S......rrB', // 21
    'BrrB..............r...B.......................rr', // 22
    'Brr.................B.rB.....................BBB', // 23
    'BB.......B...........................r.......rBr', // 24
    'BB................B...b...........B...........BB', // 25
    'rBBB......b......B...B.r..................S..BBr', // 26
    'rB....C..........B.b...b.............B........rB', // 27
    'rr................b.bBbr....................bBrB', // 28
    'BB.Bb................brB.......................B', // 29
    'Br........B...........B............B.........BBr', // 30
    'rBB..............r..B.BrBB...W......B.........BB', // 31
    'rr......................B.BB..............bB..BB', // 32
    'BB..B.BBrr.B..B.....BBB....B......BB.....B...rrB', // 33
    'rBBBrrBBrBBBBBrrrB..BBBBBBrBrB..BBrrrr.BrrBr.BrB', // 34
    'BBBrBBBrBBBBBBBrBBrBBBrBrBrBrB..BBBrrBrBBBBBBBBB', // 35
  ],
  propLegend: {
    B: 'birch',
    r: 'rock',
    b: 'bush',
    S: 'standing_stone',
    C: 'cairn',
    W: 'sign_windcrest',
  },
  scatter: [
    // Heather everywhere on the plain, thickest round the stone ring; a little else to break the green up.
    { defs: ['heather'], density: 0.07, on: ['highland_grass'], seed: 701 },
    { defs: ['heather'], density: 0.22, on: ['highland_grass'], seed: 703, area: { x: 4, y: 13, w: 15, h: 13 } },
    { defs: ['tuft'], density: 0.06, on: ['highland_grass'], seed: 709 },
    { defs: ['flower_white', 'flower_blue'], density: 0.02, on: ['highland_grass'], seed: 711 },
    { defs: ['pebbles'], density: 0.02, on: ['highland_grass'], seed: 713 },
    { defs: ['flower_blue', 'flower_white', 'flower_yellow'], density: 0.1, on: ['grass'], seed: 717 },
    { defs: ['tuft'], density: 0.08, on: ['grass'], seed: 719 },
    // Reeds on the bank of the tarn.
    { defs: ['reeds'], density: 0.35, on: ['grass'], seed: 727, area: { x: 6, y: 5, w: 11, h: 10 } },
  ],
  // The trail from the farm arrives at the bottom, looking up it.
  spawn: { x: 30, y: 34, facing: 'up' },
  exits: [
    { x: 30, y: 35, w: 2, h: 1, to: { map: 'willowbrook.home_farm', x: 30, y: 1, facing: 'down' } },
    { x: 22, y: 0, w: 2, h: 1, to: { map: 'windcrest.ruin', x: 20, y: 28, facing: 'up' } },
  ],
  // Veins in the rock of the outcrop: three plain stones, two copper, two iron.
  nodes: [
    { x: 37, y: 4, def: 'stone' },
    { x: 40, y: 4, def: 'copper' },
    { x: 36, y: 6, def: 'stone' },
    { x: 41, y: 6, def: 'iron' },
    { x: 39, y: 7, def: 'stone' },
    { x: 37, y: 8, def: 'iron' },
    { x: 42, y: 8, def: 'copper' },
  ],
  // The tarn, with grass banks to stand on.
  fishing: [{ x: 7, y: 6, w: 9, h: 8, water: 'pond' }],
  // Old things lie in the turf: round the stone ring, in the west and east clearings and along the plain.
  dig: {
    areas: [
      { x: 3, y: 13, w: 16, h: 20 },
      { x: 33, y: 14, w: 13, h: 17 },
      { x: 25, y: 3, w: 9, h: 12 },
    ],
    count: 3,
    artifacts: [
      { item: 'old_coin', weight: 3 },
      { item: 'arrowhead', weight: 3 },
      { item: 'fossil', weight: 2 },
      { item: 'rusty_key', weight: 1 },
    ],
  },
};
