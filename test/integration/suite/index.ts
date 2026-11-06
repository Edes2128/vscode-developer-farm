/**
 * Runs inside the VS Code extension host. Deliberately framework-free: a test is a named async function
 * and any thrown error fails the run.
 *
 * It drives the REAL extension: the real webview under the real content security policy, real WebGL, and
 * real files on disk.
 */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { CONTENT } from '../../../src/data/content';
import { checksum, decodeSave, SAVE_VERSION } from '../../../src/engine/persistence/saveFormat';
import { festivalDays } from '../../../src/engine/festivals/festivals';
import { watersFields, weatherOn } from '../../../src/engine/weather/weather';
import { Game } from '../../../src/engine/game';
import { InputState } from '../../../src/engine/input/actions';
import { World } from '../../../src/engine/world/world';
import type { FarmTestApi } from '../../../src/extension/extension';
import type { TestState } from '../../../src/shared/messages';

const EXTENSION_ID = 'thesulce.developer-farm';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(description: string, probe: () => T | undefined | Promise<T | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await sleep(100);
  }
}

async function getApi(): Promise<FarmTestApi> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `extension ${EXTENSION_ID} is not installed in the test host`);
  const api = (await extension.activate()) as FarmTestApi | undefined;
  assert.ok(api, 'activate() must return the test API in test mode');
  return api;
}

/** Opens the farm and waits until the game has drawn, then lets late CSP and error reports arrive. */
async function openFarm(api: FarmTestApi): Promise<void> {
  await api.open();
  await waitFor('the farm to render', () => (api.diagnostics()?.rendered ? true : undefined));
  await sleep(750);
}

const near = (actual: number, expected: number, tolerance: number, what: string): void =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: expected ${expected} (±${tolerance}), got ${actual}`);

const saveFile = (api: FarmTestApi): string => path.join(api.saveDirectory, 'slot-1.json');

function readSave(api: FarmTestApi): ReturnType<typeof decodeSave> {
  return decodeSave(fs.readFileSync(saveFile(api), 'utf8'));
}

async function saveAndWait(api: FarmTestApi, countBefore: number): Promise<TestState> {
  api.saveNow();
  return waitFor('the save to reach the disk', async () => {
    const state = await api.probe();
    return state.saveCount > countBefore ? state : undefined;
  });
}

type TestFn = (api: FarmTestApi) => Promise<void>;

/** A position the test saved at, shared between the tests below. */
const remembered: { first?: TestState; second?: TestState } = {};

const tests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'the extension activates and offers its command',
    async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('developerFarm.open'), 'the "Open Farm" command is missing');
    },
  ],

  [
    'the farm opens, draws with WebGL, and the webview is healthy under the strict policy',
    async (api) => {
      await openFarm(api);
      const d = api.diagnostics();
      assert.ok(d, 'no diagnostics');
      assert.ok(d.readyCount >= 1, 'the webview never said "ready"');
      assert.equal(d.renderer, 'webgl', `the game should draw with WebGL, got ${String(d.renderer)}`);
      assert.equal(d.mapId, 'willowbrook.home_farm');
      assert.equal(d.fontsLoaded, true, 'the pixel font did not load');
      assert.deepEqual(d.cspViolations, [], 'content security policy violations');
      assert.deepEqual(d.errors, [], 'uncaught webview errors');
      assert.equal(d.assetMode, 'prod');
    },
  ],

  [
    'opening it again reuses the same tab',
    async (api) => {
      await api.open();
      const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputWebview && t.input.viewType.endsWith('developerFarm.panel'));
      assert.equal(tabs.length, 1);
    },
  ],

  [
    'a new game starts on the doorstep, facing the door',
    async (api) => {
      const state = await api.probe();
      assert.equal(state.mapId, 'willowbrook.home_farm');
      near(state.x, 13 * 16 + 8, 1, 'x');
      near(state.y, 14 * 16 + 14, 1, 'y');
      assert.equal(state.facing, 'up');
      assert.equal(state.paused, false, 'the game must be running');
    },
  ],

  [
    'the player walks when keys are pressed',
    async (api) => {
      const before = await api.probe();
      api.pressKeys(['KeyS'], 800);
      await sleep(1400);
      const after = await api.probe();
      assert.ok(after.y > before.y + 10, `the player did not walk south (y ${before.y} -> ${after.y})`);
      near(after.x, before.x, 1, 'x while walking straight down');
      assert.equal(after.facing, 'down');
      assert.ok(after.playTimeMs > before.playTimeMs, 'play time did not advance');
    },
  ],

  [
    'saving writes a valid save file to disk',
    async (api) => {
      const before = await api.probe();
      remembered.first = await saveAndWait(api, before.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok, `the save file is not valid: ${JSON.stringify(decoded)}`);
      near(decoded.state.player.x, remembered.first.x, 0.5, 'saved x');
      near(decoded.state.player.y, remembered.first.y, 0.5, 'saved y');
      assert.equal(decoded.state.mapId, 'willowbrook.home_farm');
      const leftovers = fs.readdirSync(api.saveDirectory).filter((f) => f.endsWith('.tmp'));
      assert.deepEqual(leftovers, [], 'temporary files were left behind');
    },
  ],

  [
    'the farm is restored where it was left after the tab is closed and reopened',
    async (api) => {
      const first = remembered.first;
      assert.ok(first);
      // Walk on and save again, so a backup of the first save exists too.
      api.pressKeys(['KeyD'], 500);
      await sleep(1000);
      const mid = await api.probe();
      remembered.second = await saveAndWait(api, mid.saveCount);
      assert.ok(remembered.second.x > first.x + 5, 'the player did not walk east');
      assert.ok(fs.existsSync(path.join(api.saveDirectory, 'slot-1.backup.json')), 'no backup was kept');

      api.close();
      await waitFor('the tab to close', () => (api.isOpen() ? undefined : true));
      await openFarm(api);
      const restored = await api.probe();
      near(restored.x, remembered.second.x, 0.5, 'restored x');
      near(restored.y, remembered.second.y, 0.5, 'restored y');
      assert.ok(restored.playTimeMs >= remembered.second.playTimeMs, 'play time was not restored');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors after reopening');
    },
  ],

  [
    'a damaged save is recovered from its backup, and the damaged file is kept',
    async (api) => {
      const first = remembered.first;
      assert.ok(first);
      api.close();
      await waitFor('the tab to close', () => (api.isOpen() ? undefined : true));
      fs.writeFileSync(saveFile(api), '{"format":"developer-farm-save","version":1,"state":{"truncat');
      await openFarm(api);

      const recovered = await api.probe();
      // The backup is the save before the last one.
      near(recovered.x, first.x, 0.5, 'recovered x');
      near(recovered.y, first.y, 0.5, 'recovered y');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while recovering');
      const archived = fs.readdirSync(api.saveDirectory).filter((f) => /^slot-1\.damaged-\d+\.json$/.test(f));
      assert.equal(archived.length, 1, `the damaged save should have been kept, found: ${fs.readdirSync(api.saveDirectory).join(', ')}`);
    },
  ],

  [
    'a save from a newer version is left alone',
    async (api) => {
      api.close();
      await waitFor('the tab to close', () => (api.isOpen() ? undefined : true));
      const future = JSON.stringify({ format: 'developer-farm-save', version: 99, savedAt: '', checksum: '', state: { from: 'the future' } });
      fs.writeFileSync(saveFile(api), future);
      await openFarm(api);
      const state = await api.probe();
      assert.equal(state.mapId, 'willowbrook.home_farm', 'the game should still start');

      api.saveNow();
      await sleep(1000);
      assert.equal(fs.readFileSync(saveFile(api), 'utf8'), future, 'a save from a newer version must never be overwritten');
    },
  ],
];

/** Closes the tab, and removes every save, so the next opening is a brand new game. */
async function startFresh(api: FarmTestApi): Promise<void> {
  api.close();
  await waitFor('the tab to close', () => (api.isOpen() ? undefined : true));
  for (const file of fs.existsSync(api.saveDirectory) ? fs.readdirSync(api.saveDirectory) : []) fs.rmSync(path.join(api.saveDirectory, file));
}

async function reopen(api: FarmTestApi): Promise<void> {
  api.close();
  await waitFor('the tab to close', () => (api.isOpen() ? undefined : true));
  await openFarm(api);
}

const farmingTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-1 save from Phase 1 is upgraded when it is opened',
    async (api) => {
      await startFresh(api);
      const state = { mapId: 'willowbrook.home_farm', player: { x: 216, y: 238, facing: 'up' }, playTimeMs: 90_000 };
      const v1 = { format: 'developer-farm-save', version: 1, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state };
      fs.mkdirSync(api.saveDirectory, { recursive: true });
      fs.writeFileSync(saveFile(api), JSON.stringify(v1));
      await openFarm(api);

      const opened = await api.probe();
      near(opened.x, 216, 1, 'x is kept');
      near(opened.y, 238, 1, 'y is kept');
      assert.equal(opened.day, 1);
      assert.equal(opened.money, 150, 'the new money starts at the default');
      assert.equal(opened.selected, 'hoe');
      assert.equal(opened.inventory['radish_seeds'], 5);
      assert.ok(opened.playTimeMs >= 90_000, 'play time is kept');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while upgrading');

      const before = opened.saveCount;
      await saveAndWait(api, before);
      const decoded = readSave(api);
      assert.ok(decoded.ok, 'the upgraded save is valid');
      assert.equal(decoded.version, SAVE_VERSION, 'it was written back in the current version');
      assert.equal(decoded.migrated, false);
    },
  ],

  [
    'a new farm: till, plant and water the field, with the hotbar drawn under the strict policy',
    async (api) => {
      await startFresh(api);
      await openFarm(api);
      const start = await api.probe();
      assert.equal(start.day, 1);
      assert.equal(start.money, 150);
      assert.equal(start.selected, 'hoe');
      assert.equal(start.inventory['radish_seeds'], 5);
      assert.equal(start.canWater, 24);

      // Down the path and through the gate into the field.
      api.pressKeys(['KeyS'], 2800);
      await sleep(3600);
      const field = await api.probe();
      assert.ok(field.y > 400, `the player did not reach the field (y ${field.y})`);

      api.pressKeys(['Space'], 120); // hoe
      await sleep(1000);
      assert.equal((await api.probe()).soil, 1, 'the hoe did not till the soil');

      api.pressKeys(['Digit3'], 80); // radish seeds
      await sleep(250);
      api.pressKeys(['Space'], 120);
      await sleep(900);
      const planted = await api.probe();
      assert.deepEqual(planted.cropStages, [0], 'the seed was not planted');
      assert.equal(planted.inventory['radish_seeds'], 4, 'planting should use a seed');

      api.pressKeys(['Digit2'], 80); // watering can
      await sleep(250);
      api.pressKeys(['Space'], 120);
      await sleep(1000);
      assert.equal((await api.probe()).canWater, 23, 'watering should use water');

      const d = api.diagnostics();
      assert.deepEqual(d?.cspViolations, [], 'the hotbar and clock must not break the content security policy');
      assert.deepEqual(d?.errors, [], 'errors while farming');
    },
  ],

  [
    'sleeping grows the watered crop, pays the morning report, and the farm survives closing the tab',
    async (api) => {
      api.sleep();
      const night = await waitFor('the morning report', async () => {
        const state = await api.probe();
        return state.summaryOpen ? state : undefined;
      });
      assert.equal(night.day, 2);
      assert.deepEqual(night.cropStages, [0], 'the crop should have grown a day but still be in its first stage');
      assert.equal(night.canWater, 24, 'the can is refilled overnight');
      assert.equal(night.paused, true, 'the game waits while the report is up');

      api.dismissSummary();
      const morning = await waitFor('the day to begin', async () => {
        const state = await api.probe();
        return state.summaryOpen ? undefined : state;
      });
      assert.equal(morning.paused, false);

      const before = morning.saveCount;
      await saveAndWait(api, before);
      const saved = readSave(api);
      assert.ok(saved.ok);
      const farm = saved.state.farms['willowbrook.home_farm'];
      assert.equal(farm?.soil.length, 1);
      assert.equal(farm?.crops[0]?.crop, 'radish');
      assert.equal(farm?.crops[0]?.daysInStage, 1, 'one watered night of growth is in the save');

      await reopen(api);
      const restored = await api.probe();
      assert.equal(restored.day, 2);
      assert.equal(restored.soil, 1);
      assert.deepEqual(restored.cropStages, [0]);
      assert.equal(restored.inventory['radish_seeds'], 4);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors after reopening the farm');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],
];

/** A save exactly as Phase 2 (version 2) wrote it, with the player wherever the test wants. */
function writeV2Save(api: FarmTestApi, player: { x: number; y: number; facing: string }): void {
  const state = {
    mapId: 'willowbrook.home_farm',
    player,
    playTimeMs: 600_000,
    time: { day: 9, minutes: 600 },
    money: 410,
    inventory: {
      slots: [{ id: 'hoe', count: 1, quality: 0 }, { id: 'watering_can', count: 1, quality: 0 }, { id: 'radish_seeds', count: 4, quality: 0 }, null, null, null, null, null, null, null, null, null],
      selected: 0,
      canWater: 20,
    },
    bin: [],
    farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: true }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 2, daysInStage: 1, planted: 5 }] } },
  };
  const envelope = { format: 'developer-farm-save', version: 2, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state };
  fs.mkdirSync(api.saveDirectory, { recursive: true });
  fs.writeFileSync(saveFile(api), JSON.stringify(envelope));
}

const lifeTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-2 save from Phase 2 is upgraded to the current version when opened, and the farm is exactly as it was',
    async (api) => {
      await startFresh(api);
      writeV2Save(api, { x: 216, y: 238, facing: 'down' });
      await openFarm(api);

      const opened = await api.probe();
      assert.equal(opened.mapId, 'willowbrook.home_farm');
      assert.equal(opened.day, 9);
      assert.equal(opened.money, 410);
      assert.equal(opened.soil, 1);
      assert.deepEqual(opened.cropStages, [2]);
      assert.equal(opened.canWater, 20);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while upgrading');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);

      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok, 'the upgraded save is valid');
      assert.equal(decoded.version, SAVE_VERSION, 'it was written back in the current version');
      assert.equal(decoded.migrated, false);
      assert.deepEqual(Object.keys(decoded.state.npcs).sort(), CONTENT.npcs.map((n) => n.id).sort(), 'every villager has a record');
      assert.deepEqual(decoded.state.quests, []);
      assert.ok(decoded.state.flags.includes('visited:willowbrook.home_farm'));
      assert.equal(decoded.state.farms['willowbrook.home_farm']?.soil.length, 1, 'the farm came through the upgrade');
    },
  ],

  [
    'walking east off the edge of the farm arrives on the Village Green, and the save and a reopened tab keep the player there',
    async (api) => {
      await startFresh(api);
      writeV2Save(api, { x: 58 * 16 + 8, y: 21 * 16 + 14, facing: 'right' });
      await openFarm(api);
      assert.equal((await api.probe()).mapId, 'willowbrook.home_farm');

      api.pressKeys(['KeyD'], 1500);
      const arrived = await waitFor('the Village Green', async () => {
        const state = await api.probe();
        return state.mapId === 'willowbrook.village_green' ? state : undefined;
      });
      await sleep(1200); // drawn a few frames: the new map's terrain, objects and villagers
      assert.ok(arrived.x > 0 && arrived.x < 40 * 16, 'the player is somewhere on the 40-wide green');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the village');
      assert.deepEqual(api.diagnostics()?.cspViolations, [], 'the village must not break the content security policy');

      const here = await api.probe();
      await saveAndWait(api, here.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.state.mapId, 'willowbrook.village_green');
      assert.ok(decoded.state.flags.includes('visited:willowbrook.village_green'));
      assert.equal(decoded.state.farms['willowbrook.home_farm']?.crops[0]?.crop, 'radish', "the farm's crop is still in the save while the player is away");

      await reopen(api);
      const restored = await api.probe();
      assert.equal(restored.mapId, 'willowbrook.village_green', 'the game reopens on the green');
      near(restored.x, here.x, 1, 'restored x');
      near(restored.y, here.y, 1, 'restored y');
      assert.deepEqual(restored.cropStages, [], 'no farm is loaded on the green');
      assert.deepEqual(api.diagnostics()?.errors, []);

      // And back again: the farm is as it was.
      api.pressKeys(['KeyA'], 4000);
      const home = await waitFor('the farm again', async () => {
        const state = await api.probe();
        return state.mapId === 'willowbrook.home_farm' ? state : undefined;
      });
      await sleep(600);
      assert.deepEqual((await api.probe()).cropStages, [2]);
      assert.ok(home.x > 55 * 16, 'arrives at the east end of the farm road');
    },
  ],

  [
    'sleeping away from the farm wakes the player at the farmhouse door',
    async (api) => {
      api.sleep();
      await waitFor('the morning report', async () => ((await api.probe()).summaryOpen ? true : undefined));
      const state = await api.probe();
      assert.equal(state.mapId, 'willowbrook.home_farm');
      near(state.x, 13 * 16 + 8, 1, 'x');
      assert.equal(state.day, 10);
      api.dismissSummary();
      await waitFor('the day to begin', async () => ((await api.probe()).summaryOpen ? undefined : true));
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],
];

type Facing = 'up' | 'down' | 'left' | 'right';
const cell = (x: number, y: number, facing: Facing) => ({ x: x * 16 + 8, y: y * 16 + 14, facing });

/** A save exactly as Phase 3 (version 3) wrote it, on any map, with whatever the test needs added. */
function writeV3Save(
  api: FarmTestApi,
  options: { mapId: string; player: { x: number; y: number; facing: string }; quests?: unknown[]; slots?: unknown[] },
): void {
  const state = {
    mapId: options.mapId,
    player: options.player,
    playTimeMs: 600_000,
    time: { day: 9, minutes: 600 },
    money: 410,
    inventory: {
      slots: [...(options.slots ?? [{ id: 'hoe', count: 1, quality: 0 }]), ...Array.from({ length: 12 - (options.slots?.length ?? 1) }, () => null)],
      selected: 0,
      canWater: 20,
    },
    bin: [],
    farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: true }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 2, daysInStage: 1, planted: 5 }] } },
    npcs: {},
    ranches: {},
    quests: options.quests ?? [],
    flags: ['visited:willowbrook.home_farm', 'visited:willowbrook.village_green'],
  };
  const envelope = { format: 'developer-farm-save', version: 3, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state };
  fs.mkdirSync(api.saveDirectory, { recursive: true });
  fs.writeFileSync(saveFile(api), JSON.stringify(envelope));
}

const GONE_FISHING_DONE = [{ id: 'gone_fishing', status: 'done', progress: [3] }];

/** A walkable bank cell next to fishable water, and which way the water is. */
function bankOf(mapId: string, water: string): { x: number; y: number; facing: Facing } {
  const map = new World(CONTENT).map(mapId);
  const reachable = map.reachableFrom(map.spawn.x, map.spawn.y);
  const dirs: readonly (readonly [Facing, number, number])[] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!map.isWalkable(x, y) || reachable[y * map.width + x] !== 1 || map.terrainAt(x, y)?.waterSource === true) continue;
      for (const [facing, dx, dy] of dirs) if (map.fishingWater(x + dx, y + dy) === water) return { x, y, facing };
    }
  }
  throw new Error(`no bank for ${water} on ${mapId}`);
}

const worldTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-3 save from Phase 3 is upgraded to the current version when opened, with nothing found yet',
    async (api) => {
      await startFresh(api);
      writeV3Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up') });
      await openFarm(api);
      const opened = await api.probe();
      assert.equal(opened.day, 9);
      assert.equal(opened.soil, 1);
      assert.deepEqual(opened.cropStages, [2]);
      assert.equal(opened.fishing, null);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while upgrading');

      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.version, SAVE_VERSION);
      assert.equal(decoded.migrated, false);
      assert.deepEqual(decoded.state.collection, {});
      assert.deepEqual(decoded.state.mine, { deepest: 0 });
      assert.equal(decoded.state.farms['willowbrook.home_farm']?.crops[0]?.crop, 'radish', 'the farm came through the upgrade');
    },
  ],

  [
    "walking into a cottage door goes inside (drawn under the strict policy), and the door out leads back",
    async (api) => {
      await startFresh(api);
      writeV3Save(api, { mapId: 'willowbrook.village_green', player: cell(8, 11, 'up') });
      await openFarm(api);
      assert.equal((await api.probe()).mapId, 'willowbrook.village_green');
      api.pressKeys(['KeyW'], 1300);
      await waitFor('the cottage', async () => ((await api.probe()).mapId === 'willowbrook.tobias_cottage' ? true : undefined));
      await sleep(900); // a few frames of the wooden floor, the furniture and the lamp light
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the inside of a cottage');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);

      await sleep(300);
      api.pressKeys(['KeyS'], 1500);
      await waitFor('the green again', async () => ((await api.probe()).mapId === 'willowbrook.village_green' ? true : undefined));
    },
  ],

  [
    'the brambled trail north turns the player back until Gone Fishing is done',
    async (api) => {
      await startFresh(api);
      writeV3Save(api, { mapId: 'willowbrook.village_green', player: cell(22, 3, 'up') });
      await openFarm(api);
      api.pressKeys(['KeyW'], 2000);
      await sleep(2600);
      const state = await api.probe();
      assert.equal(state.mapId, 'willowbrook.village_green', 'the way into the wood must be shut');
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],

  [
    'with the quest done the old mine opens: it draws, saves, and a reopened tab is still down there',
    async (api) => {
      await startFresh(api);
      writeV3Save(api, { mapId: 'willowbrook.whispering_wood', player: cell(30, 15, 'up'), quests: GONE_FISHING_DONE });
      await openFarm(api);
      assert.equal((await api.probe()).mapId, 'willowbrook.whispering_wood');
      await sleep(600); // the forest drew
      api.pressKeys(['KeyW'], 1500);
      const down = await waitFor('the mine', async () => {
        const state = await api.probe();
        return state.mapId === 'mine.floor_1' ? state : undefined;
      });
      await sleep(1000); // cave floor, walls, rocks and ladders
      assert.ok(down.nodes > 0, 'the floor has rocks');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the mine');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);

      const here = await api.probe();
      await saveAndWait(api, here.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.state.mapId, 'mine.floor_1');
      assert.equal(decoded.state.mine.deepest, 1);
      assert.ok(decoded.state.flags.includes('visited:mine.floor_1'));

      await reopen(api);
      assert.equal((await api.probe()).mapId, 'mine.floor_1', 'the game reopens in the mine');
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],

  [
    'casting a line at the river puts the float in the water, and walking away pulls it in',
    async (api) => {
      await startFresh(api);
      const spot = bankOf('willowbrook.home_farm', 'river');
      writeV3Save(api, { mapId: 'willowbrook.home_farm', player: cell(spot.x, spot.y, spot.facing), slots: [{ id: 'fishing_rod', count: 1, quality: 0 }] });
      await openFarm(api);
      assert.equal((await api.probe()).selected, 'fishing_rod');
      api.pressKeys(['Space'], 120);
      const waiting = await waitFor('the line to be in the water', async () => {
        const state = await api.probe();
        return state.fishing === null ? undefined : state;
      });
      assert.equal(waiting.fishing, 'waiting');
      await sleep(800); // a few frames of the float, the line and the ripples
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the fishing line');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);

      const away = { up: 'KeyS', down: 'KeyW', left: 'KeyD', right: 'KeyA' }[spot.facing];
      api.pressKeys([away], 300);
      await waitFor('the line to come in', async () => ((await api.probe()).fishing === null ? true : undefined));
    },
  ],
];

/** A save exactly as Phase 4 (version 4) wrote it, on any map, with whatever the test needs added. */
function writeV4Save(
  api: FarmTestApi,
  options: { mapId: string; player: { x: number; y: number; facing: string }; slots?: unknown[]; time?: { day: number; minutes: number } },
): void {
  const state = {
    mapId: options.mapId,
    player: options.player,
    playTimeMs: 600_000,
    time: options.time ?? { day: 9, minutes: 600 },
    money: 410,
    inventory: {
      slots: [...(options.slots ?? [{ id: 'hoe', count: 1, quality: 0 }]), ...Array.from({ length: 12 - (options.slots?.length ?? 1) }, () => null)],
      selected: 0,
      canWater: 20,
    },
    bin: [],
    farms: { 'willowbrook.home_farm': { soil: [{ x: 8, y: 26, watered: true }], crops: [{ x: 8, y: 26, crop: 'radish', stage: 2, daysInStage: 1, planted: 5 }] } },
    npcs: {},
    ranches: {},
    quests: [],
    flags: ['visited:willowbrook.home_farm', 'visited:willowbrook.village_green'],
    collection: { carp: 1 },
    mine: { deepest: 1 },
  };
  const envelope = { format: 'developer-farm-save', version: 4, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state };
  fs.mkdirSync(api.saveDirectory, { recursive: true });
  fs.writeFileSync(saveFile(api), JSON.stringify(envelope));
}

/** A save as Phase 5 (version 5) wrote it: furniture, a museum with rewards claimed by position, and today's spending. */
function writeV5Save(
  api: FarmTestApi,
  options: { mapId: string; player: { x: number; y: number; facing: string }; time?: { day: number; minutes: number }; museum?: { donated: string[]; claimed: number[] } },
): void {
  writeV4Save(api, { mapId: options.mapId, player: options.player, ...(options.time === undefined ? {} : { time: options.time }) });
  const envelope = JSON.parse(fs.readFileSync(saveFile(api), 'utf8')) as { checksum: string; state: Record<string, unknown> };
  const state = { ...envelope.state, placed: {}, buildings: { built: [], pending: [] }, museum: options.museum ?? { donated: [], claimed: [] }, spent: { day: 0, cells: {}, fished: {} } };
  fs.writeFileSync(saveFile(api), JSON.stringify({ format: 'developer-farm-save', version: 5, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state }));
}

const homeTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-4 save from Phase 4 is upgraded to the current version when opened, with the farm and the finds as they were',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up') });
      await openFarm(api);
      const opened = await api.probe();
      assert.equal(opened.day, 9);
      assert.equal(opened.soil, 1);
      assert.deepEqual(opened.cropStages, [2]);
      assert.deepEqual(api.diagnostics()?.errors, []);
      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.version, SAVE_VERSION);
      assert.equal(decoded.migrated, false);
      assert.deepEqual(decoded.state.collection, { carp: 1 });
      assert.deepEqual(decoded.state.placed, {});
      assert.deepEqual(decoded.state.buildings, { built: [], pending: [] });
      assert.deepEqual(decoded.state.museum, { donated: [], claimed: [] });
    },
  ],

  [
    'the farmhouse door leads inside (drawn under the strict policy); the bed ends the day and the morning begins at the door',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up') });
      await openFarm(api);
      api.pressKeys(['KeyW'], 1300);
      await waitFor('the farmhouse', async () => ((await api.probe()).mapId === 'willowbrook.farmhouse' ? true : undefined));
      await sleep(900); // the kitchen, the workbench, the bed and the lamp light
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the farmhouse');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
      api.sleep();
      const morning = await waitFor('the morning report', async () => {
        const state = await api.probe();
        return state.summaryOpen ? state : undefined;
      });
      assert.equal(morning.mapId, 'willowbrook.home_farm');
      assert.equal(morning.day, 10);
      api.dismissSummary();
      await waitFor('the day to begin', async () => ((await api.probe()).summaryOpen ? undefined : true));
    },
  ],

  [
    'the kitchen opens a menu of recipes',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.farmhouse', player: cell(8, 3, 'up'), slots: [{ id: 'egg', count: 2, quality: 0 }] });
      await openFarm(api);
      api.pressKeys(['KeyE'], 120);
      const dialog = await waitFor('the kitchen menu', async () => (await api.probe()).dialog ?? undefined);
      assert.equal(dialog, 'Kitchen');
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],

  [
    'a chair put down in the farmhouse is saved, and is still there after the tab is closed and opened again',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.farmhouse', player: cell(3, 6, 'right'), slots: [{ id: 'chair', count: 2, quality: 0 }] });
      await openFarm(api);
      assert.equal((await api.probe()).placed, 0);
      api.pressKeys(['Space'], 120);
      const placed = await waitFor('the chair', async () => {
        const state = await api.probe();
        return state.placed === 1 ? state : undefined;
      });
      assert.equal(placed.inventory['chair'], 1);
      await sleep(500);
      await saveAndWait(api, placed.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.deepEqual(decoded.state.placed['willowbrook.farmhouse'], [{ def: 'chair', x: 4, y: 6 }]);
      await reopen(api);
      const again = await api.probe();
      assert.equal(again.mapId, 'willowbrook.farmhouse');
      assert.equal(again.placed, 1);
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],

  [
    'a finished greenhouse stands on the farm, and its door leads into a glass room that draws without errors',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.home_farm', player: cell(24, 19, 'up') });
      const text = fs.readFileSync(saveFile(api), 'utf8');
      // Add the carpenter's finished work to the (version 5) state: written in the current format directly.
      const envelope = JSON.parse(text) as { version: number; checksum: string; state: Record<string, unknown> };
      const state = { ...envelope.state, placed: {}, buildings: { built: ['greenhouse'], pending: [] }, museum: { donated: [], claimed: [] }, spent: { day: 0, cells: {}, fished: {} } };
      fs.writeFileSync(saveFile(api), JSON.stringify({ ...envelope, version: 5, checksum: checksum(JSON.stringify(state)), state }));
      await openFarm(api);
      const farm = await api.probe();
      assert.equal(farm.placed, 1, 'the greenhouse stands on the farm');
      api.pressKeys(['KeyW'], 1500);
      await waitFor('the greenhouse', async () => ((await api.probe()).mapId === 'willowbrook.greenhouse' ? true : undefined));
      await sleep(900);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the greenhouse');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],

  [
    'the museum draws: marble, cases and its curator',
    async (api) => {
      await startFresh(api);
      writeV4Save(api, { mapId: 'willowbrook.village_green', player: cell(30, 25, 'up') });
      await openFarm(api);
      api.pressKeys(['KeyW'], 1500);
      await waitFor('the museum', async () => ((await api.probe()).mapId === 'willowbrook.museum' ? true : undefined));
      await sleep(900);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the museum');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],
];


/** A save as Phase 6 (version 6) wrote it: today's festival and board, with whatever the test needs changed in the state. */
function writeV6Save(
  api: FarmTestApi,
  options: { mapId: string; player: { x: number; y: number; facing: string }; time?: { day: number; minutes: number }; museum?: { donated: string[]; claimed: number[] }; state?: Record<string, unknown> },
): void {
  writeV5Save(api, options);
  const envelope = JSON.parse(fs.readFileSync(saveFile(api), 'utf8')) as { state: Record<string, unknown> };
  const state = { ...envelope.state, festival: { day: 0, score: 0, found: [], entered: false, talked: [], claimed: false }, board: { day: 0, done: [] }, ...(options.state ?? {}) };
  // The museum's rewards were saved by position until version 6: 3, 6, ... a v6 save names them by count.
  fs.writeFileSync(saveFile(api), JSON.stringify({ format: 'developer-farm-save', version: 6, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state }));
}

const CLEAR_DAYS = festivalDays(CONTENT.festivals);
const firstDayWith = (test: (day: number) => boolean): number => {
  for (let day = 2; day < 400; day += 1) if (test(day)) return day;
  throw new Error('no such day');
};

const livingTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-5 save from Phase 5 is upgraded to version 6: the museum rewards are named by count, and no festival or request is under way',
    async (api) => {
      await startFresh(api);
      writeV5Save(api, {
        mapId: 'willowbrook.home_farm',
        player: cell(13, 14, 'up'),
        museum: { donated: ['carp', 'coal', 'quartz', 'trout', 'perch', 'minnow'], claimed: [0, 1] },
      });
      await openFarm(api);
      const opened = await api.probe();
      assert.equal(opened.day, 9);
      assert.equal(opened.festival, null);
      assert.equal(opened.requestsDone, 0);
      assert.deepEqual(api.diagnostics()?.errors, []);
      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.version, SAVE_VERSION);
      assert.equal(decoded.migrated, false);
      assert.deepEqual(decoded.state.museum.claimed, [3, 6]);
      assert.deepEqual(decoded.state.festival, { day: 0, score: 0, found: [], entered: false, talked: [], claimed: false });
      // The board is stamped with the day it was last read (today), with nothing handed in.
      assert.deepEqual(decoded.state.board, { day: opened.day, done: [] });
    },
  ],

  [
    'a rainy day draws its rain and dimmer light without errors, and the weather is the same after the tab is reopened',
    async (api) => {
      await startFresh(api);
      const day = firstDayWith((d) => weatherOn(d, CLEAR_DAYS) === 'rain');
      writeV5Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up'), time: { day, minutes: 600 } });
      await openFarm(api);
      await sleep(1200); // some seconds of falling rain
      assert.equal((await api.probe()).weather, 'rain');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the rain');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
      await reopen(api);
      assert.equal((await api.probe()).weather, 'rain');
    },
  ],

  [
    'a snowy winter day and a storm draw without errors',
    async (api) => {
      await startFresh(api);
      const snow = firstDayWith((d) => weatherOn(d, CLEAR_DAYS) === 'snow');
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(10, 14, 'right'), time: { day: snow, minutes: 600 } });
      await openFarm(api);
      await sleep(1000);
      assert.equal((await api.probe()).weather, 'snow');
      assert.deepEqual(api.diagnostics()?.errors, []);
      const storm = firstDayWith((d) => weatherOn(d, CLEAR_DAYS) === 'storm');
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(10, 14, 'right'), time: { day: storm, minutes: 600 } });
      await openFarm(api);
      await sleep(1000);
      assert.equal((await api.probe()).weather, 'storm');
      assert.ok(watersFields('storm'));
      assert.deepEqual(api.diagnostics()?.errors, []);
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],

  [
    'the Egg Hunt: open at ten, eight painted eggs drawn on the green, the villagers gathered; it is closed at eight',
    async (api) => {
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(3, 14, 'right'), time: { day: 13, minutes: 600 } });
      await openFarm(api);
      await sleep(600);
      const open = await api.probe();
      assert.equal(open.festival, 'egg_hunt');
      assert.equal(open.eggsLeft, 8);
      assert.equal(open.weather, 'sun');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the eggs');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(3, 14, 'right'), time: { day: 13, minutes: 480 } });
      await openFarm(api);
      const early = await api.probe();
      assert.equal(early.festival, null);
      assert.equal(early.eggsLeft, 0);
    },
  ],

  [
    'the notice board opens when read, and the merchant answers at his cart on a Sunday',
    async (api) => {
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(6, 14, 'up'), time: { day: 3, minutes: 600 } });
      await openFarm(api);
      api.pressKeys(['KeyE'], 120);
      assert.equal(await waitFor('the notice board', async () => (await api.probe()).dialog ?? undefined), 'Notice board');
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(27, 20, 'up'), time: { day: 7, minutes: 600 } });
      await openFarm(api);
      api.pressKeys(['KeyE'], 120);
      assert.equal(await waitFor("Rowan at his cart", async () => (await api.probe()).dialog ?? undefined), 'Rowan Ash');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the cart and the board');
    },
  ],

  [
    'a festival and a request in progress are saved, and still there when the tab is closed and opened again',
    async (api) => {
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(3, 14, 'right'), time: { day: 13, minutes: 600 } });
      const text = JSON.parse(fs.readFileSync(saveFile(api), 'utf8')) as { checksum: string; state: Record<string, unknown> };
      const state = { ...text.state, festival: { day: 13, score: 3, found: [], entered: false, talked: [], claimed: false }, board: { day: 13, done: ['req:13:0'] } };
      fs.writeFileSync(saveFile(api), JSON.stringify({ format: 'developer-farm-save', version: 6, savedAt: '2026-11-06T10:00:00.000Z', checksum: checksum(JSON.stringify(state)), state }));
      await openFarm(api);
      const first = await api.probe();
      assert.equal(first.festivalScore, 3);
      assert.equal(first.requestsDone, 1);
      await saveAndWait(api, first.saveCount);
      await reopen(api);
      const again = await api.probe();
      assert.equal(again.festivalScore, 3);
      assert.equal(again.requestsDone, 1);
      assert.deepEqual(api.diagnostics()?.errors, []);
    },
  ],

  [
    'the autumn oaks are drawn when the season turns, without errors',
    async (api) => {
      await startFresh(api);
      writeV5Save(api, { mapId: 'willowbrook.village_green', player: cell(10, 14, 'right'), time: { day: 60, minutes: 600 } });
      await openFarm(api);
      await sleep(600);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing an autumn forest');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],
];


/** Where the rare creature of a day stands, worked out the way the game does (a real game from the same save). */
function creatureOn(mapId: string, time: { day: number; minutes: number }): { creature: string; x: number; y: number } {
  const world = new World(CONTENT);
  const base = new Game(world, new InputState()).toSaveState();
  const game = new Game(world, new InputState(), { ...base, mapId, time, player: { x: 1 * 16 + 8, y: 1 * 16 + 14, facing: 'down' } });
  const [first] = game.creaturesHere();
  assert.ok(first, `a creature on ${mapId} on day ${time.day}`);
  return first;
}

const expansionTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'a version-6 save from Phase 6 is upgraded to version 7: no creature has been met, and the museum rewards are as they were',
    async (api) => {
      await startFresh(api);
      writeV6Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up'), museum: { donated: ['carp', 'coal', 'quartz'], claimed: [] } });
      await openFarm(api);
      const opened = await api.probe();
      assert.equal(opened.creaturesSeen, 0);
      assert.equal(opened.creatureFriends, 0);
      assert.deepEqual(api.diagnostics()?.errors, []);
      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.version, SAVE_VERSION);
      assert.equal(decoded.migrated, false);
      assert.deepEqual(decoded.state.bestiary, { seen: [], friends: [] });
      assert.equal(decoded.state.farms['willowbrook.home_farm']?.soil.length, 1);
    },
  ],

  [
    'the north trail turns the player back until Buried Things is done, then climbs onto Windcrest Heights, which draws under the strict policy',
    async (api) => {
      await startFresh(api);
      writeV6Save(api, { mapId: 'willowbrook.home_farm', player: cell(30, 3, 'up') });
      await openFarm(api);
      api.pressKeys(['KeyW'], 2500);
      await sleep(600);
      assert.equal((await api.probe()).mapId, 'willowbrook.home_farm', 'the closed way turns the player back');
      await startFresh(api);
      writeV6Save(api, { mapId: 'willowbrook.home_farm', player: cell(30, 3, 'up'), state: { quests: [{ id: 'buried_things', status: 'done', progress: [3] }] } });
      await openFarm(api);
      api.pressKeys(['KeyW'], 2500);
      await waitFor('Windcrest Heights', async () => ((await api.probe()).mapId === 'windcrest.meadow' ? true : undefined));
      await sleep(900);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the heights');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],

  [
    'Marlow Marsh draws, shallows, fen and Fern\'s lodge, and Fern answers',
    async (api) => {
      await startFresh(api);
      writeV6Save(api, { mapId: 'marlow.shallows', player: cell(22, 10, 'down'), state: { quests: [{ id: 'gone_fishing', status: 'done', progress: [3] }, { id: 'first_finds', status: 'done', progress: [3] }] } });
      await openFarm(api);
      await sleep(900);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the shallows');
      await startFresh(api);
      writeV6Save(api, { mapId: 'marlow.fen', player: cell(3, 16, 'right') });
      await openFarm(api);
      await sleep(900);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the fen');
      await startFresh(api);
      writeV6Save(api, { mapId: 'marlow.lodge', player: cell(6, 5, 'up') });
      await openFarm(api);
      api.pressKeys(['KeyE'], 120);
      assert.equal(await waitFor('Fern', async () => (await api.probe()).dialog ?? undefined), 'Fern Alder');
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing the lodge');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],

  [
    'a rare creature is seen by walking up to it, drawn without errors, and is still in the journal after the tab is reopened',
    async (api) => {
      await startFresh(api);
      const time = { day: 5, minutes: 8 * 60 };
      const heron = creatureOn('marlow.fen', time);
      assert.equal(heron.creature, 'heron');
      // Two cells to its west (or east), standing still: in range, not running.
      const side: { x: number; facing: Facing } = heron.x >= 3 ? { x: heron.x - 2, facing: 'right' } : { x: heron.x + 2, facing: 'left' };
      writeV6Save(api, { mapId: 'marlow.fen', player: cell(side.x, heron.y, side.facing), time });
      await openFarm(api);
      const seen = await waitFor('the heron to be seen', async () => {
        const state = await api.probe();
        return state.creaturesSeen === 1 ? state : undefined;
      });
      assert.equal(seen.creatures, 1);
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors while drawing a creature');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
      await saveAndWait(api, seen.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.deepEqual(decoded.state.bestiary, { seen: ['heron'], friends: [] });
      await reopen(api);
      assert.equal((await api.probe()).creaturesSeen, 1);
    },
  ],

  [
    'a sprinkler and fertilized soil are saved, and are still there when the tab is closed and opened again',
    async (api) => {
      await startFresh(api);
      const farm = {
        'willowbrook.home_farm': {
          soil: [{ x: 8, y: 26, watered: true, fertilized: true }],
          crops: [{ x: 8, y: 26, crop: 'radish', stage: 2, daysInStage: 1, planted: 5 }],
        },
      };
      writeV6Save(api, { mapId: 'willowbrook.home_farm', player: cell(13, 14, 'up'), state: { farms: farm, placed: { 'willowbrook.home_farm': [{ def: 'sprinkler', x: 9, y: 26 }] } } });
      await openFarm(api);
      const opened = await api.probe();
      assert.equal(opened.placed, 1, 'the sprinkler stands in the field');
      assert.deepEqual(api.diagnostics()?.errors, []);
      await saveAndWait(api, opened.saveCount);
      const decoded = readSave(api);
      assert.ok(decoded.ok);
      assert.equal(decoded.state.farms['willowbrook.home_farm']?.soil[0]?.fertilized, true);
      assert.deepEqual(decoded.state.placed['willowbrook.home_farm'], [{ def: 'sprinkler', x: 9, y: 26 }]);
      await reopen(api);
      const again = await api.probe();
      assert.equal(again.placed, 1);
      assert.deepEqual(again.cropStages, [2]);
    },
  ],
];

const polishTests: ReadonlyArray<readonly [string, TestFn]> = [
  [
    'the first key press unlocks the sound, and the farm runs under the strict policy with it on',
    async (api) => {
      await startFresh(api);
      await openFarm(api);
      assert.equal((await api.probe()).audioUnlocked, false, 'no sound is made before the player does something');
      api.pressKeys(['KeyD'], 300);
      await waitFor('the sound to unlock', async () => ((await api.probe()).audioUnlocked ? true : undefined));
      await sleep(1500); // a little background and, if the dice allow, a first note
      assert.deepEqual(api.diagnostics()?.errors, [], 'errors with sound on');
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],

  [
    'preferences from before sound existed open with the defaults, and muted, large-text and calm-motion preferences open without errors',
    async (api) => {
      await startFresh(api);
      fs.mkdirSync(api.saveDirectory, { recursive: true });
      fs.writeFileSync(path.join(api.saveDirectory, 'preferences.json'), JSON.stringify({ zoom: 2, hudVisible: true, hintsDismissed: true }));
      await openFarm(api);
      api.pressKeys(['KeyD'], 200);
      assert.deepEqual(api.diagnostics()?.errors, []);
      await startFresh(api);
      fs.mkdirSync(api.saveDirectory, { recursive: true });
      fs.writeFileSync(path.join(api.saveDirectory, 'preferences.json'), JSON.stringify({ zoom: 3, hudVisible: true, hintsDismissed: true, audio: { master: 0.3, sfx: 0.5, ambient: 0.5, music: 0, muted: true }, textSize: 'large', highContrast: true, motion: 'reduced' }));
      writeV6Save(api, { mapId: 'willowbrook.village_green', player: cell(10, 14, 'right'), time: { day: 85, minutes: 600 } });
      await openFarm(api);
      await sleep(900);
      assert.equal((await api.probe()).weather, 'snow');
      assert.deepEqual(api.diagnostics()?.errors, []);
      assert.deepEqual(api.diagnostics()?.cspViolations, []);
    },
  ],
];

export async function run(): Promise<void> {
  const api = await getApi();
  let failed = 0;
  for (const [name, test] of [...tests, ...farmingTests, ...lifeTests, ...worldTests, ...homeTests, ...livingTests, ...expansionTests, ...polishTests]) {
    try {
      await test(api);
      console.log(`  ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${name}\n       ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    }
  }
  api.close();
  const total = tests.length + farmingTests.length + lifeTests.length + worldTests.length + homeTests.length + livingTests.length + expansionTests.length + polishTests.length;
  if (failed > 0) throw new Error(`${failed} of ${total} integration tests failed`);
  console.log(`All ${total} integration tests passed.`);
}
