import { describe, expect, it } from 'vitest';
import { CONTENT } from '../data/content';
import { CAN_CAPACITY } from './farming/tools';
import type { Game } from './game';
import { INVENTORY_SLOTS } from './inventory/inventory';
import { createPlayerAt } from './player/player';
import { BEDTIME_MINUTE, WAKE_MINUTE } from './time/clock';
import { farmGameAt, listen, readThrough, run, tap } from './testing';

/** The cell in front of a player standing at (10, 26) facing down: inside the fenced field. */
const FIELD = { x: 10, y: 26 } as const;
const PLOT = { x: 10, y: 27 } as const;

/** Back in the field, as if the player had walked there, ready for the next job. */
const backToField = (game: Game): void => {
  game.player = createPlayerAt(FIELD.x, FIELD.y, 'down');
};

/** Goes to bed, reads the morning report, and walks back to the field. */
function nextMorning(game: Game): void {
  game.endDay('slept');
  game.dismissSummary();
  backToField(game);
}

const slotOf = (game: Game, id: string): number => game.inventory.slots.findIndex((s) => s?.id === id);

describe('the farming loop, played through the real Home Farm', () => {
  it('starts a new game with tools, seeds and money', () => {
    const game = farmGameAt(FIELD, 'down');
    expect(game.inventory.slots.slice(0, 4).map((s) => s?.id)).toEqual(['hoe', 'watering_can', 'radish_seeds', 'strawberry_seeds']);
    expect(game.money).toBe(150);
    expect(game.canWater).toBe(CAN_CAPACITY);
    expect(game.date).toBe('Spring 1');
    expect(game.clock.minutes).toBe(WAKE_MINUTE);
  });

  it('tills, plants and waters the cell in front of the player', () => {
    const game = farmGameAt(FIELD, 'down');
    const effects = listen(game, 'effect');

    tap(game, 'Space');
    run(game, 0.6);
    expect(game.farm.isTilled(PLOT.x, PLOT.y)).toBe(true);

    tap(game, 'Digit3'); // radish seeds
    tap(game, 'Space');
    run(game, 0.5);
    expect(game.farm.cropAt(PLOT.x, PLOT.y)?.crop).toBe('radish');
    expect(game.inventory.count('radish_seeds')).toBe(4);

    tap(game, 'Digit2'); // watering can
    tap(game, 'Space');
    run(game, 0.6);
    expect(game.farm.soilAt(PLOT.x, PLOT.y)?.watered).toBe(true);
    expect(game.canWater).toBe(CAN_CAPACITY - 1);
    expect(effects.map((e) => e.kind)).toEqual(['till', 'plant', 'water']);
  });

  it('shows a green cursor where a tool would work and a red one where it would not', () => {
    const game = farmGameAt(FIELD, 'down');
    run(game, 0.1);
    expect(game.cursor).toEqual({ x: PLOT.x, y: PLOT.y, valid: true });
    game.player = createPlayerAt(13, 14, 'up'); // at the farmhouse door
    run(game, 0.1);
    expect(game.cursor).toMatchObject({ valid: false });
    tap(game, 'Digit8'); // an empty slot
    expect(game.cursor).toBeUndefined();
  });

  it('says why something cannot be done instead of failing silently', () => {
    const game = farmGameAt({ x: 13, y: 14 }, 'up');
    const hints = listen(game, 'hint');
    tap(game, 'Space'); // hoe at the farmhouse wall
    expect(hints.at(-1)).toMatchObject({ tone: 'warn', text: expect.stringContaining('too hard') });

    const field = farmGameAt(FIELD, 'down');
    const fieldHints = listen(field, 'hint');
    tap(field, 'Digit3');
    tap(field, 'Space'); // seeds on untilled ground
    expect(fieldHints.at(-1)?.text).toContain('tilled soil');
  });

  it('refuses a summer crop in spring and plants it in summer', () => {
    const spring = farmGameAt(FIELD, 'down', {
      inventory: { slots: [{ id: 'hoe', count: 1, quality: 0 }, { id: 'tomato_seeds', count: 3, quality: 0 }, ...Array.from({ length: 10 }, () => null)], selected: 0, canWater: 24 },
    });
    const hints = listen(spring, 'hint');
    tap(spring, 'Space');
    run(spring, 0.6);
    tap(spring, 'Digit2');
    tap(spring, 'Space');
    expect(hints.at(-1)?.text).toContain('Tomato will not grow');
    expect(spring.farm.cropAt(PLOT.x, PLOT.y)).toBeUndefined();
  });

  it('stops you swinging while a swing is in progress', () => {
    const game = farmGameAt(FIELD, 'down');
    game.input.press('KeyD');
    tap(game, 'Space', 0.01);
    const x = game.player.x;
    run(game, 0.2);
    expect(game.swing).toBeDefined();
    expect(game.player.x).toBe(x); // held still while swinging
    game.input.release('KeyD');
    run(game, 0.6);
    expect(game.swing).toBeUndefined();
  });

  it('refills the can at the well and at the pond, and says so', () => {
    const well = farmGameAt({ x: 18, y: 15 }, 'up', {
      inventory: { slots: [{ id: 'watering_can', count: 1, quality: 0 }, ...Array.from({ length: 11 }, () => null)], selected: 0, canWater: 3 },
    });
    expect(well.canWater).toBe(3);
    tap(well, 'Space');
    run(well, 0.6);
    expect(well.canWater).toBe(CAN_CAPACITY);

    // standing on the bridge and facing the river
    const river = farmGameAt({ x: 43, y: 21 }, 'up', {
      inventory: { slots: [{ id: 'watering_can', count: 1, quality: 0 }, ...Array.from({ length: 11 }, () => null)], selected: 0, canWater: 0 },
    });
    tap(river, 'Space');
    run(river, 0.6);
    expect(river.canWater).toBe(CAN_CAPACITY);
  });

  it('will not water with an empty can', () => {
    const game = farmGameAt(FIELD, 'down', {
      inventory: { slots: [{ id: 'watering_can', count: 1, quality: 0 }, ...Array.from({ length: 11 }, () => null)], selected: 0, canWater: 0 },
    });
    game.farm.till(PLOT.x, PLOT.y);
    const hints = listen(game, 'hint');
    tap(game, 'Space');
    expect(hints.at(-1)?.text).toContain('empty');
    expect(game.farm.soilAt(PLOT.x, PLOT.y)?.watered).toBe(false);
  });

  describe('a crop through its life', () => {
    function plantAndWater(id: string): Game {
      const game = farmGameAt(FIELD, 'down', {
        inventory: {
          slots: [
            { id: 'hoe', count: 1, quality: 0 },
            { id: 'watering_can', count: 1, quality: 0 },
            { id: `${id}_seeds`, count: 5, quality: 0 },
            ...Array.from({ length: 9 }, () => null),
          ],
          selected: 0,
          canWater: 24,
        },
      });
      tap(game, 'Space');
      run(game, 0.6);
      tap(game, 'Digit3');
      tap(game, 'Space');
      run(game, 0.5);
      tap(game, 'Digit2');
      tap(game, 'Space');
      run(game, 0.6);
      return game;
    }

    it('grows overnight only when watered, then can be picked', () => {
      const game = plantAndWater('radish');
      nextMorning(game);
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toMatchObject({ stage: 0, daysInStage: 1 });
      expect(game.date).toBe('Spring 2');
      expect(game.canWater).toBe(CAN_CAPACITY); // refilled overnight
      expect(game.farm.soilAt(PLOT.x, PLOT.y)?.watered).toBe(false); // dry again

      nextMorning(game); // nobody watered it
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toMatchObject({ stage: 0, daysInStage: 1 });

      for (let night = 0; night < 5; night += 1) {
        game.farm.water(PLOT.x, PLOT.y);
        nextMorning(game);
      }
      expect(game.prompt).toBeUndefined();
      game.player = createPlayerAt(FIELD.x, FIELD.y, 'down');
      run(game, 0.1);
      expect(game.prompt).toMatchObject({ verb: 'Pick', name: 'Radish' });

      tap(game, 'KeyE');
      expect(game.inventory.count('radish')).toBe(1);
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toBeUndefined();
    });

    it('lets a strawberry plant fruit again after it is picked', () => {
      const game = plantAndWater('strawberry');
      for (let night = 0; night < 8; night += 1) {
        nextMorning(game);
        game.farm.water(PLOT.x, PLOT.y);
      }
      nextMorning(game);
      run(game, 0.1);
      tap(game, 'KeyE');
      expect(game.inventory.count('strawberry')).toBe(1);
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toMatchObject({ stage: 2 });
      for (let night = 0; night < 4; night += 1) {
        game.farm.water(PLOT.x, PLOT.y);
        nextMorning(game);
      }
      run(game, 0.1);
      tap(game, 'KeyE');
      expect(game.inventory.count('strawberry')).toBe(2);
    });

    it('withers when the season turns', () => {
      const game = farmGameAt(FIELD, 'down', { time: { day: 28, minutes: 600 } });
      game.farm.till(PLOT.x, PLOT.y);
      game.farm.plant(PLOT.x, PLOT.y, 'radish', 28);
      game.farm.water(PLOT.x, PLOT.y);
      const summaries = listen(game, 'daySummary');
      game.endDay('slept');
      expect(game.date).toBe('Summer 1');
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toBeUndefined();
      expect(summaries[0]).toMatchObject({ withered: 1 });
    });

    it('will not pick up a harvest when the pockets are full', () => {
      const slots = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ({
        id: ['hoe', 'watering_can', 'radish_seeds', 'strawberry_seeds', 'tomato_seeds', 'sunflower_seeds', 'pumpkin_seeds', 'tomato', 'sunflower', 'pumpkin', 'strawberry', 'radish'][i]!,
        count: i < 2 ? 1 : 99,
        quality: (i === 11 ? 1 : 0) as 0 | 1,
      }));
      const game = farmGameAt(FIELD, 'down', { inventory: { slots, selected: 0, canWater: 24 } });
      game.farm.till(PLOT.x, PLOT.y);
      game.farm.plant(PLOT.x, PLOT.y, 'radish', 1);
      game.farm.crops.get(PLOT.y * game.map.width + PLOT.x)!.stage = 3;
      const hints = listen(game, 'hint');
      run(game, 0.1);
      tap(game, 'KeyE');
      expect(hints.at(-1)?.text).toContain('pockets are full');
      expect(game.farm.cropAt(PLOT.x, PLOT.y)).toBeDefined(); // still there to pick later
    });
  });

  describe('shipping and shopping', () => {
    const withProduce = { inventory: { slots: [{ id: 'radish', count: 6, quality: 0 as const }, ...Array.from({ length: 11 }, () => null)], selected: 0, canWater: 24 } };

    it('ships the selected stack and pays for it in the morning', () => {
      const game = farmGameAt({ x: 21, y: 13 }, 'up', withProduce);
      run(game, 0.1);
      expect(game.prompt).toMatchObject({ verb: 'Ship', name: 'Shipping bin' });
      tap(game, 'KeyE');
      expect(game.dialog?.lines[0]).toContain('Shipped 6 Radish, worth 240g');
      expect(game.inventory.count('radish')).toBe(0);
      expect(game.money).toBe(150); // not yet
      tap(game, 'KeyE');
      tap(game, 'KeyE');
      game.closeDialog();

      const summaries = listen(game, 'daySummary');
      game.endDay('slept');
      expect(game.money).toBe(390);
      expect(summaries[0]).toMatchObject({ earned: 240, shipped: [{ name: 'Radish', count: 6, total: 240 }] });
      expect(game.bin.items).toHaveLength(0);
    });

    it('says so when there is nothing to ship, and keeps your tools', () => {
      const game = farmGameAt({ x: 21, y: 13 }, 'up'); // the hoe is selected
      run(game, 0.1);
      tap(game, 'KeyE');
      expect(game.dialog?.lines[0]).toBe('Nothing to ship.');
      expect(game.inventory.count('hoe')).toBe(1);
      expect(game.bin.items).toHaveLength(0);
    });

    // Willa minds the stall from eight until five, so the shop tests go there at ten.
    const MORNING = { time: { day: 1, minutes: 10 * 60 } };

    const openShopAtStall = (game: ReturnType<typeof farmGameAt>): void => {
      tap(game, 'KeyE'); // the stall: Willa is behind it, so she speaks
      readThrough(game);
      expect(game.dialog?.speaker?.id).toBe('willa');
      game.chooseOption(game.dialog!.options.findIndex((o) => o.id === 'npc:shop:willa'));
    };

    it('lets Willa serve the stall: she greets you first, and the shop comes after', () => {
      const game = farmGameAt({ x: 20, y: 20 }, 'up', MORNING);
      run(game, 0.1);
      expect(game.prompt).toMatchObject({ verb: 'Browse', name: 'Seed stall' });
      tap(game, 'KeyE');
      readThrough(game);
      expect(game.dialog?.speaker).toMatchObject({ id: 'willa', name: 'Willa Thorne' });
      expect(game.dialog?.options.map((o) => o.id)).toContain('npc:shop:willa');
    });

    it('sells seeds from the stall, one purchase at a time', () => {
      const game = farmGameAt({ x: 20, y: 20 }, 'up', MORNING);
      run(game, 0.1);
      openShopAtStall(game);
      expect(game.dialog?.options.map((o) => o.label)).toEqual([
        'Radish seeds ×5 · 50g',
        'Strawberry seeds ×3 · 90g',
        'Chicken feed ×5 · 25g',
        'Chicken · 250g',
        'Leave',
      ]);

      tap(game, 'KeyE'); // buy the highlighted offer
      expect(game.money).toBe(100);
      expect(game.inventory.count('radish_seeds')).toBe(10);
      expect(game.dialog?.note).toContain('Bought 5 Radish seeds');

      tap(game, 'KeyS');
      tap(game, 'KeyE'); // 90g with 100g: allowed
      expect(game.money).toBe(10);
      // With 10g nothing is affordable any more, so the highlight moves to "Leave"...
      expect(game.dialog?.options.map((o) => o.enabled)).toEqual([false, false, false, false, true]);
      expect(game.dialog?.selected).toBe(4);
      // ...and clicking something you cannot afford does nothing.
      game.chooseOption(0);
      expect(game.money).toBe(10);
      expect(game.dialog).toBeDefined();
      game.chooseOption(4); // leave, by clicking
      expect(game.dialog).toBeUndefined();
    });

    it('skips options you cannot choose when moving the highlight', () => {
      const game = farmGameAt({ x: 20, y: 20 }, 'up', { ...MORNING, money: 60 });
      run(game, 0.1);
      openShopAtStall(game);
      expect(game.dialog?.options.map((o) => o.enabled)).toEqual([true, false, true, false, true]);
      tap(game, 'KeyS');
      expect(game.dialog?.selected).toBe(2); // jumps over the strawberry seeds
      tap(game, 'KeyS');
      expect(game.dialog?.selected).toBe(4); // and over the chicken
      tap(game, 'KeyW');
      expect(game.dialog?.selected).toBe(2);
    });

    it('buys your produce at today\'s price, from the stall only', () => {
      const game = farmGameAt({ x: 20, y: 20 }, 'up', { ...MORNING, ...withProduce });
      run(game, 0.1);
      openShopAtStall(game);
      const sell = game.dialog!.options.find((o) => o.id === 'sell:selected');
      expect(sell?.label).toMatch(/^Sell 6 Radish · \d+g \(/);
      const before = game.money;
      game.chooseOption(game.dialog!.options.findIndex((o) => o.id === 'sell:selected'));
      expect(game.inventory.count('radish')).toBe(0);
      expect(game.money).toBeGreaterThanOrEqual(before + Math.floor(40 * 0.85) * 6);
      expect(game.money).toBeLessThanOrEqual(before + Math.floor(40 * 1.15) * 6);
    });

    it('closes the stall while Willa is elsewhere, and says when she will be back', () => {
      const game = farmGameAt({ x: 20, y: 20 }, 'up', { time: { day: 1, minutes: 6 * 60 } });
      run(game, 0.1);
      tap(game, 'KeyE');
      expect(game.dialog?.speaker).toBeUndefined();
      expect(game.dialog?.lines.join(' ')).toContain('Willa Thorne is away from the stall');
      expect(game.dialog?.lines.join(' ')).toContain('8:00 am');
    });
  });

  /** Standing beside the bed inside the farmhouse, facing it. */
  const inBed = (): Game =>
    farmGameAt({ x: 0, y: 0 }, 'left', { mapId: 'willowbrook.farmhouse', player: { x: 3 * 16 + 8, y: 3 * 16 + 14, facing: 'left' } });

  describe('the day', () => {
    it('lets you go to bed in your farmhouse, and wakes you at the door the next morning', () => {
      const game = inBed();
      run(game, 0.1);
      expect(game.prompt).toMatchObject({ verb: 'Go to bed', name: 'Your bed' });
      tap(game, 'KeyE');
      tap(game, 'KeyE');
      expect(game.dialog?.options.map((o) => o.label)).toEqual(['Go to bed', 'Not yet']);
      const summaries = listen(game, 'daySummary');
      tap(game, 'KeyE');
      expect(game.clock.day).toBe(2);
      expect(game.clock.minutes).toBe(WAKE_MINUTE);
      expect(game.isPaused).toBe(true); // the morning report is up
      expect(summaries[0]).toMatchObject({ day: 2, cause: 'slept', date: 'Spring 2' });
      expect(game.player.x).toBe(13 * 16 + 8);
      game.dismissSummary();
      expect(game.isPaused).toBe(false);
      expect(summaries.at(-1)).toBeUndefined();
    });

    it('passes out at 2:00 am and wakes at home', () => {
      const game = farmGameAt(FIELD, 'down');
      const summaries = listen(game, 'daySummary');
      run(game, 20 * 60 * 0.7 + 5, 30); // the whole day, on a slow machine
      expect(summaries[0]).toMatchObject({ cause: 'exhausted', day: 2 });
      expect(game.clock.minutes).toBe(WAKE_MINUTE);
      expect(game.player.x).toBe(13 * 16 + 8);
    });

    it('does not move the clock while a message is open, the game is paused, or the report is up', () => {
      const game = inBed();
      run(game, 0.1);
      tap(game, 'KeyE');
      const minutes = game.clock.minutes;
      run(game, 5);
      expect(game.clock.minutes).toBe(minutes);
      game.closeDialog();
      game.setPaused('menu', true);
      run(game, 5);
      expect(game.clock.minutes).toBe(minutes);
      game.setPaused('menu', false);
      run(game, 5);
      expect(game.clock.minutes).toBeGreaterThan(minutes);
      expect(game.clock.minutes).toBeLessThan(BEDTIME_MINUTE);
    });

    it('reports how the crops did', () => {
      const game = farmGameAt(FIELD, 'down');
      game.farm.till(PLOT.x, PLOT.y);
      game.farm.plant(PLOT.x, PLOT.y, 'radish', 1);
      game.farm.water(PLOT.x, PLOT.y);
      const summaries = listen(game, 'daySummary');
      game.endDay('slept');
      expect(summaries[0]).toMatchObject({ grown: 1, withered: 0, ripe: 0, earned: 0 });
    });
  });

  describe('the hotbar', () => {
    it('selects by number, and cycles with Q and R, wrapping round', () => {
      const game = farmGameAt(FIELD, 'down');
      tap(game, 'Digit3');
      expect(game.inventory.selected).toBe(2);
      tap(game, 'KeyR');
      expect(game.inventory.selected).toBe(3);
      tap(game, 'KeyQ');
      tap(game, 'KeyQ');
      expect(game.inventory.selected).toBe(1);
      tap(game, 'Digit1');
      tap(game, 'KeyQ');
      expect(game.inventory.selected).toBe(INVENTORY_SLOTS - 1);
      tap(game, 'Digit0');
      expect(game.inventory.selected).toBe(9);
    });

    it('selects by mouse wheel and by clicking a slot', () => {
      const game = farmGameAt(FIELD, 'down');
      tap(game, 'WheelDown');
      expect(game.inventory.selected).toBe(1);
      tap(game, 'WheelUp');
      expect(game.inventory.selected).toBe(0);
      game.selectSlot(slotOf(game, 'strawberry_seeds'));
      expect(game.inventory.selectedStack()?.id).toBe('strawberry_seeds');
    });

    it('tells the HUD when pockets, money or the clock change', () => {
      const game = farmGameAt(FIELD, 'down');
      const changes = listen(game, 'statusChanged');
      run(game, 0.1);
      const before = changes.length;
      tap(game, 'Digit2');
      expect(changes.length).toBeGreaterThan(before);
    });
  });

  it('keeps all of it through a save and a reload', () => {
    const game = farmGameAt(FIELD, 'down');
    tap(game, 'Space');
    run(game, 0.6);
    tap(game, 'Digit3');
    tap(game, 'Space');
    run(game, 0.5);
    game.money = 321;
    game.canWater = 7;
    game.bin.add({ id: 'radish', count: 2, quality: 1 });
    game.farm.water(PLOT.x, PLOT.y);
    nextMorning(game);

    const saved = game.toSaveState();
    const copy = farmGameAt({ x: 1, y: 1 }, 'down', saved);
    expect(copy.toSaveState()).toEqual(saved);
    expect(copy.date).toBe('Spring 2');
    expect(copy.farm.cropAt(PLOT.x, PLOT.y)).toMatchObject({ crop: 'radish', stage: 0, daysInStage: 1 });
    expect(copy.money).toBe(321 + 100); // the bin was paid for overnight: 2 good radishes
  });

  it('ignores a save that mentions things the game no longer has', () => {
    const base = farmGameAt(FIELD, 'down').toSaveState();
    const game = farmGameAt(FIELD, 'down', {
      inventory: { slots: [{ id: 'removed_item', count: 3, quality: 0 }, { id: 'hoe', count: 1, quality: 0 }, ...Array.from({ length: 10 }, () => null)], selected: 0, canWater: 99 },
      farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: false }], crops: [{ x: 8, y: 26, crop: 'removed_crop', stage: 1, daysInStage: 0, planted: 1 }] }, 'old.map': base.farms['x'] ?? { soil: [{ x: 1, y: 1, watered: false }], crops: [] } },
    });
    expect(game.inventory.slots[0]).toBeNull();
    expect(game.inventory.count('hoe')).toBe(1);
    expect(game.canWater).toBe(CAN_CAPACITY);
    expect(game.farm.cropAt(8, 26)).toBeUndefined();
    expect(game.farm.isTilled(8, 26)).toBe(true);
    // a farm for a map that is not there is kept, not lost
    expect(game.toSaveState().farms['old.map']).toBeDefined();
  });
});

void CONTENT;
