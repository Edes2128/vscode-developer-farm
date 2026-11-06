/**
 * Finding a way across a map on foot. A* over a grid, four directions, no cutting corners: the same collision
 * the player obeys, so a villager never walks anywhere the player could not.
 */

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface PathGrid {
  readonly width: number;
  readonly height: number;
  /** True when a cell can be walked on. */
  walkable(x: number, y: number): boolean;
}

/** Stops searching after this many cells, so an unreachable goal can never freeze the game. */
const MAX_EXPANSIONS = 20_000;

/**
 * The cells to walk through to get from `start` to `goal`, not including `start`. An empty list means "already
 * there". Undefined means there is no way. The start cell need not be walkable (a villager may stand in a doorway).
 */
export function findPath(grid: PathGrid, start: Cell, goal: Cell): Cell[] | undefined {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!grid.walkable(goal.x, goal.y)) return undefined;

  const { width, height } = grid;
  const index = (x: number, y: number): number => y * width + x;
  const cost = new Float32Array(width * height).fill(Infinity);
  const from = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);

  // A binary heap of [priority, cell index] pairs.
  const heap: [number, number][] = [];
  const push = (priority: number, cell: number): void => {
    heap.push([priority, cell]);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((heap[parent] as [number, number])[0] <= (heap[i] as [number, number])[0]) break;
      [heap[parent], heap[i]] = [heap[i] as [number, number], heap[parent] as [number, number]];
      i = parent;
    }
  };
  const pop = (): number => {
    const top = heap[0] as [number, number];
    const last = heap.pop() as [number, number];
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && (heap[l] as [number, number])[0] < (heap[smallest] as [number, number])[0]) smallest = l;
        if (r < heap.length && (heap[r] as [number, number])[0] < (heap[smallest] as [number, number])[0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i] as [number, number], heap[smallest] as [number, number]];
        i = smallest;
      }
    }
    return top[1];
  };

  const heuristic = (x: number, y: number): number => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const startIndex = index(start.x, start.y);
  cost[startIndex] = 0;
  push(heuristic(start.x, start.y), startIndex);

  let expansions = 0;
  while (heap.length > 0 && expansions < MAX_EXPANSIONS) {
    const current = pop();
    if (closed[current]) continue;
    closed[current] = 1;
    expansions += 1;
    const cx = current % width;
    const cy = Math.floor(current / width);
    if (cx === goal.x && cy === goal.y) {
      const path: Cell[] = [];
      for (let at = current; at !== startIndex; at = from[at] as number) path.push({ x: at % width, y: Math.floor(at / width) });
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !grid.walkable(nx, ny)) continue;
      const next = index(nx, ny);
      const tentative = (cost[current] as number) + 1;
      if (tentative >= (cost[next] as number)) continue;
      cost[next] = tentative;
      from[next] = current;
      push(tentative + heuristic(nx, ny), next);
    }
  }
  return undefined;
}
