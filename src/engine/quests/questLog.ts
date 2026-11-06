import type { Condition, QuestStatus } from '../social/types';
import { targetOf, type Objective, type QuestDef, type QuestEvent, type QuestSave } from './types';

export interface QuestChange {
  /** Quests whose progress moved. */
  readonly progressed: readonly QuestDef[];
  /** Quests that just became ready to report. */
  readonly ready: readonly QuestDef[];
}

/** The quests the player has taken on, how far along each is, and which are finished. */
export class QuestLog {
  private readonly states = new Map<string, { status: Exclude<QuestStatus, 'none'>; progress: number[] }>();
  private readonly defs = new Map<string, QuestDef>();
  /** Goes up on every change, so the HUD knows when to redraw the journal. */
  version = 0;

  constructor(defs: readonly QuestDef[], saved: readonly QuestSave[] = []) {
    for (const def of defs) this.defs.set(def.id, def);
    for (const save of saved) {
      const def = this.defs.get(save.id);
      if (def === undefined) continue;
      const progress = def.objectives.map((o, i) => Math.max(0, Math.min(targetOf(o), Math.floor(save.progress[i] ?? 0))));
      this.states.set(save.id, { status: save.status, progress });
    }
  }

  def(id: string): QuestDef | undefined {
    return this.defs.get(id);
  }

  status(id: string): QuestStatus {
    return this.states.get(id)?.status ?? 'none';
  }

  progress(id: string): readonly number[] {
    return this.states.get(id)?.progress ?? [];
  }

  /** Quests being worked on or waiting to be reported, in the order they were taken. */
  open(): QuestDef[] {
    return [...this.states.entries()].filter(([, s]) => s.status !== 'done').map(([id]) => this.defs.get(id) as QuestDef);
  }

  finished(): QuestDef[] {
    return [...this.states.entries()].filter(([, s]) => s.status === 'done').map(([id]) => this.defs.get(id) as QuestDef);
  }

  /**
   * Can this quest be offered now? Not if it is already taken or finished, and only when its conditions hold.
   * `check` answers the conditions (the game knows the facts).
   */
  canOffer(id: string, check: (conditions: readonly Condition[]) => boolean): boolean {
    const def = this.defs.get(id);
    return def !== undefined && this.status(id) === 'none' && check(def.requires ?? []);
  }

  /**
   * Takes a quest on. `prime` says how far each objective already is (a map already visited, hearts already earned),
   * so the player is never asked to do again something they have already done.
   */
  accept(id: string, prime: (objective: Objective) => number = () => 0): QuestDef | undefined {
    const def = this.defs.get(id);
    if (def === undefined || this.status(id) !== 'none') return undefined;
    const progress = def.objectives.map((o) => Math.min(targetOf(o), Math.max(0, prime(o))));
    const done = progress.every((p, i) => p >= targetOf(def.objectives[i] as Objective));
    this.states.set(id, { status: done ? 'ready' : 'active', progress });
    this.version += 1;
    return def;
  }

  /** Tells the log something happened. Returns which quests moved and which are now ready. */
  notify(event: QuestEvent): QuestChange {
    const progressed: QuestDef[] = [];
    const ready: QuestDef[] = [];
    for (const [id, state] of this.states) {
      if (state.status !== 'active') continue;
      const def = this.defs.get(id) as QuestDef;
      let moved = false;
      def.objectives.forEach((objective, index) => {
        const target = targetOf(objective);
        const before = state.progress[index] as number;
        if (before >= target) return;
        const gain = gainFrom(objective, event);
        if (gain === 0) return;
        // A friendship or furnishing objective is a level, not a tally: it tracks the hearts, or the furniture, the player has right now.
        const after = objective.kind === 'friendship' || objective.kind === 'place' || objective.kind === 'see' || objective.kind === 'befriend' ? Math.min(target, Math.max(before, gain)) : Math.min(target, before + gain);
        if (after !== before) {
          state.progress[index] = after;
          moved = true;
        }
      });
      if (!moved) continue;
      progressed.push(def);
      if (def.objectives.every((o, i) => (state.progress[i] as number) >= targetOf(o))) {
        state.status = 'ready';
        ready.push(def);
      }
    }
    if (progressed.length > 0) this.version += 1;
    return { progressed, ready };
  }

  /** Reports a ready quest to its giver. Returns it so the game can hand over the rewards. */
  complete(id: string): QuestDef | undefined {
    const state = this.states.get(id);
    if (state?.status !== 'ready') return undefined;
    state.status = 'done';
    this.version += 1;
    return this.defs.get(id);
  }

  /** Delivery objectives of an active quest that a villager is waiting for. */
  deliveries(npc: string): { quest: QuestDef; index: number; objective: Extract<Objective, { kind: 'deliver' }>; remaining: number }[] {
    const out: { quest: QuestDef; index: number; objective: Extract<Objective, { kind: 'deliver' }>; remaining: number }[] = [];
    for (const [id, state] of this.states) {
      if (state.status !== 'active') continue;
      const quest = this.defs.get(id) as QuestDef;
      quest.objectives.forEach((objective, index) => {
        if (objective.kind !== 'deliver' || objective.to !== npc) return;
        const remaining = objective.count - (state.progress[index] as number);
        if (remaining > 0) out.push({ quest, index, objective, remaining });
      });
    }
    return out;
  }

  toSave(): QuestSave[] {
    return [...this.states.entries()].map(([id, s]) => ({ id, status: s.status, progress: [...s.progress] }));
  }
}

function gainFrom(objective: Objective, event: QuestEvent): number {
  switch (objective.kind) {
    case 'ship':
    case 'harvest':
    case 'collect':
      return event.kind === objective.kind && event.item === objective.item ? event.count : 0;
    case 'deliver':
      return event.kind === 'deliver' && event.item === objective.item && event.to === objective.to ? event.count : 0;
    case 'feed':
      return event.kind === 'feed' ? event.count : 0;
    case 'visit':
      return event.kind === 'visit' && event.map === objective.map ? 1 : 0;
    case 'friendship':
      return event.kind === 'friendship' && event.npc === objective.npc ? event.hearts : 0;
    case 'catch':
      return event.kind === 'catch' && (objective.item === undefined || objective.item === event.item) ? 1 : 0;
    case 'mine':
      return event.kind === 'mine' && event.item === objective.item ? event.count : 0;
    case 'craft':
      return event.kind === 'craft' && (objective.item === undefined || objective.item === event.item) ? event.count : 0;
    case 'place':
      return event.kind === 'place' ? event.placed : 0;
    case 'build':
      return event.kind === 'build' && event.building === objective.building ? 1 : 0;
    case 'donate':
      return event.kind === 'donate' ? 1 : 0;
    case 'dig':
      return event.kind === 'dig' ? 1 : 0;
    case 'see':
      return event.kind === 'see' ? event.seen : 0;
    case 'befriend':
      return event.kind === 'befriend' ? event.friends : 0;
  }
}
