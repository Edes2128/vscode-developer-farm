/** Something on a map that a tool breaks for materials: a rock, an ore vein, a gem. Data lives in src/data/nodes.ts. */
export interface NodeDrop {
  /** `ItemDef.id` of what falls out. */
  readonly item: string;
  readonly min: number;
  readonly max: number;
  /** Chance that this drop appears at all, 0 to 1 (decided by a hash of the cell, never a stored random). */
  readonly chance: number;
}

export interface NodeDef {
  readonly id: string;
  readonly name: string;
  /** Atlas frame, 16 x 16: `node/<id>`. */
  readonly frame: string;
  /** The tool that breaks it. */
  readonly tool: 'pickaxe' | 'hoe';
  /** Does it block the way while it stands? Rocks do (the default); a dig spot is a mark on the ground you walk over. */
  readonly solid?: boolean;
  /** How many swings it takes. */
  readonly hits: number;
  readonly drops: readonly NodeDrop[];
}

/** Where a map starts with a node. Part of `MapDef`. */
export interface NodeSpawn {
  readonly x: number;
  readonly y: number;
  /** `NodeDef.id` */
  readonly def: string;
}
