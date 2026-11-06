import { describe, expect, it } from 'vitest';
import type { PathGrid } from '../path/astar';
import { FED_POINTS, HUNGRY_POINTS, PET_POINTS, Ranch } from './ranch';
import type { AnimalDef, RanchConfig } from './types';

const chicken: AnimalDef = { id: 'chicken', name: 'Chicken', product: 'egg', feed: 'chicken_feed', price: 250, names: ['Clover', 'Biscuit', 'Pepper'], sprite: 'animal/chicken' };
const defs = (id: string): AnimalDef | undefined => (id === 'chicken' ? chicken : undefined);
const config: RanchConfig = { yard: { x: 2, y: 2, w: 5, h: 4 }, capacity: 3, troughCapacity: 6 };
const grid: PathGrid = { width: 10, height: 10, walkable: (x, y) => x >= 0 && y >= 0 && x < 10 && y < 10 && !(x === 4 && y === 3) };
const make = (): Ranch => new Ranch(config, defs, grid);

describe('Ranch', () => {
  it('takes in animals up to its capacity, naming them in turn', () => {
    const ranch = make();
    expect(ranch.add('chicken')?.name).toBe('Clover');
    expect(ranch.add('chicken')?.name).toBe('Biscuit');
    expect(ranch.add('chicken')?.name).toBe('Pepper');
    expect(ranch.add('chicken')).toBeUndefined();
    expect(ranch.isFull).toBe(true);
    expect(new Set(ranch.animals.map((a) => a.id)).size).toBe(3);
  });

  it('refuses a kind it does not know', () => {
    expect(make().add('dragon')).toBeUndefined();
  });

  it('holds a limited amount of feed', () => {
    const ranch = make();
    expect(ranch.addFeed(4)).toBe(4);
    expect(ranch.addFeed(4)).toBe(2);
    expect(ranch.feed).toBe(6);
    expect(ranch.addFeed(1)).toBe(0);
    expect(ranch.addFeed(-5)).toBe(0);
  });

  it('feeds as many animals as there is feed for, and they leave eggs only if fed', () => {
    const ranch = make();
    ranch.add('chicken');
    ranch.add('chicken');
    ranch.add('chicken');
    ranch.addFeed(2);
    const report = ranch.nightly(2);
    expect(report).toEqual({ fed: 2, hungry: 1, eggs: 2 });
    expect(ranch.feed).toBe(0);
    expect(ranch.eggCount()).toBe(2);
    expect(ranch.animals.map((a) => a.friendship)).toEqual([FED_POINTS, FED_POINTS, 0]);
  });

  it('lets hungry animals sulk a little, never below zero', () => {
    const ranch = make();
    const a = ranch.add('chicken')!;
    a.friendship = 12;
    ranch.nightly(2);
    expect(a.friendship).toBe(12 + HUNGRY_POINTS);
    ranch.nightly(3);
    ranch.nightly(4);
    expect(a.friendship).toBe(0);
    expect(ranch.eggCount()).toBe(0);
  });

  it('hands over the eggs once', () => {
    const ranch = make();
    ranch.add('chicken');
    ranch.addFeed(1);
    ranch.nightly(2);
    const eggs = ranch.collect();
    expect(eggs.reduce((n, s) => n + s.count, 0)).toBe(1);
    expect(eggs[0]).toMatchObject({ id: 'egg' });
    expect(ranch.collect()).toEqual([]);
  });

  it('lays better eggs for happier animals, and the same eggs every time for the same day', () => {
    const lay = (friendship: number, day: number): number => {
      const ranch = make();
      const a = ranch.add('chicken')!;
      a.friendship = friendship;
      ranch.addFeed(1);
      ranch.nightly(day);
      return ranch.basket[0]!.quality;
    };
    expect(lay(0, 5)).toBe(lay(0, 5));
    let plain = 0;
    let happy = 0;
    for (let day = 1; day <= 400; day += 1) {
      if (lay(0, day) > 0) plain += 1;
      if (lay(1000, day) > 0) happy += 1;
    }
    expect(happy).toBeGreaterThan(plain);
  });

  it('can be petted once a day', () => {
    const ranch = make();
    const a = ranch.add('chicken')!;
    expect(ranch.pet(a, 3)).toBe(PET_POINTS);
    expect(ranch.pet(a, 3)).toBe(0);
    expect(ranch.pet(a, 4)).toBe(PET_POINTS);
  });

  it('wanders inside the yard and never into a wall, the same way every time', () => {
    const path = (): string[] => {
      const ranch = make();
      ranch.add('chicken');
      ranch.add('chicken');
      const seen: string[] = [];
      for (let i = 0; i < 60 * 90; i += 1) {
        ranch.update(1 / 60);
        for (const a of ranch.animals) {
          const cx = Math.floor(a.x / 16);
          const cy = Math.floor((a.y - 3) / 16);
          expect(grid.walkable(cx, cy), `${cx},${cy}`).toBe(true);
          expect(cx >= 2 && cx < 7 && cy >= 2 && cy < 6, `${cx},${cy} is in the yard`).toBe(true);
        }
        if (i % 600 === 0) seen.push(ranch.animals.map((a) => `${Math.round(a.x)},${Math.round(a.y)},${a.mode}`).join('|'));
      }
      return seen;
    };
    const first = path();
    expect(first).toEqual(path());
    expect(new Set(first).size).toBeGreaterThan(3); // they do move about
  });

  it('finds an animal by the cell it stands in', () => {
    const ranch = make();
    const a = ranch.add('chicken')!;
    expect(ranch.animalAt({ x: Math.floor(a.x / 16), y: Math.floor((a.y - 3) / 16) })).toBe(a);
    expect(ranch.animalAt({ x: 0, y: 0 })).toBeUndefined();
  });

  it('round-trips through a save, and ignores animals it cannot house', () => {
    const ranch = make();
    ranch.add('chicken');
    ranch.animals[0]!.friendship = 140;
    ranch.addFeed(3);
    ranch.addFeed(0);
    ranch.basket.push({ id: 'egg', count: 2, quality: 1 });
    const save = ranch.toSave();
    const copy = new Ranch(config, defs, grid, save);
    expect(copy.toSave()).toEqual(save);

    const crowded = new Ranch({ ...config, capacity: 1 }, defs, grid, { animals: [save.animals[0]!, { ...save.animals[0]!, id: 'chicken-2' }], feed: 99, basket: [] });
    expect(crowded.animals).toHaveLength(1);
    expect(crowded.feed).toBe(6);
    const unknown = new Ranch(config, defs, grid, { animals: [{ id: 'x', kind: 'dragon', name: 'X', friendship: 0, pettedDay: 0, fedDay: 0 }], feed: 0, basket: [] });
    expect(unknown.animals).toHaveLength(0);
  });
});
