import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from './helpers/three-mock';
import type { Game } from '../types';

createThreeMock();

const THREE = createThreeMock();

function createMockGame() {
  return {
    hud: { notify: vi.fn(), milestone: vi.fn(), setMission: vi.fn() },
    audio: { missionDone: vi.fn(), uiDeny: vi.fn() },
    inv: { count: vi.fn(() => 0), units: 0, syncStore: vi.fn() },
    ship: { comps: { thruster: { broken: true }, pulse: { broken: true } }, fuel: 0, group: { position: new THREE.Vector3(14, 0, 9) } },
    player: { pos: new THREE.Vector3(100, 0, 100) },
    milestones: { stats: { scans: 0, warps: 0 } },
  } as unknown as Game;
}

import { Missions, Milestones } from '../missions';

describe('Missions', () => {
  let game: ReturnType<typeof createMockGame>;
  let missions: Missions;

  beforeEach(() => {
    setActivePinia(createPinia());
    game = createMockGame();
    missions = new Missions(game);
  });

  it('starts at index 0', () => expect(missions.idx).toBe(0));
  it('scanner is locked initially', () => expect(missions.scannerUnlocked).toBe(false));
  it('current returns first mission', () => expect(missions.current().id).toBe('wake'));
  it('has 10 missions', () => expect(missions.defs.length).toBe(10));

  describe('tick', () => {
    it('does not advance when condition not met', () => {
      missions.tick();
      expect(missions.idx).toBe(0);
    });
    it('advances when condition met', () => {
      // Place player near ship
      (game.player as { pos: THREE.Vector3 }).pos.set(14, 0, 9);
      missions.tick();
      expect(missions.idx).toBe(1);
      expect(game.hud.notify).toHaveBeenCalled();
      expect(game.audio.missionDone).toHaveBeenCalled();
    });
  });

  describe('onEvent', () => {
    it('tracks launch event', () => { missions.onEvent('launch'); expect(missions.launched).toBe(true); });
    it('tracks shelter count', () => { missions.onEvent('place'); missions.onEvent('place'); expect(missions.shelterCount).toBe(2); });
  });

  describe('serialize / deserialize', () => {
    it('round-trips data', () => {
      missions.idx = 3; missions.scannerUnlocked = true; missions.shelterCount = 5; missions.launched = true;
      const data = missions.serialize();
      const m2 = new Missions(game);
      m2.deserialize(data);
      expect(m2.idx).toBe(3); expect(m2.scannerUnlocked).toBe(true); expect(m2.shelterCount).toBe(5); expect(m2.launched).toBe(true);
    });
  });
});

describe('Milestones', () => {
  let game: ReturnType<typeof createMockGame>;
  let milestones: Milestones;

  beforeEach(() => { setActivePinia(createPinia()); game = createMockGame(); milestones = new Milestones(game); });

  it('starts with zero stats', () => { expect(milestones.stats.walk).toBe(0); });
  it('addStat increments', () => { milestones.addStat('walk', 100); expect(milestones.stats.walk).toBe(100); });
  it('awards milestone at threshold', () => {
    milestones.addStat('walk', 600); // tiers [100,500,...] → tier 2
    expect(milestones.awarded.walk).toBe(2);
    expect(game.hud.milestone).toHaveBeenCalled();
  });
  it('does not re-award same tier', () => {
    milestones.addStat('walk', 600); // tier 2
    milestones.addStat('walk', 100); // still tier 2
    expect(game.hud.milestone).toHaveBeenCalledTimes(1);
  });
  it('tickTime increments survive', () => { milestones.tickTime(10); expect(milestones.stats.survive).toBe(10); });
  describe('serialize / deserialize', () => {
    it('round-trips', () => {
      milestones.stats.walk = 500; milestones.awarded.walk = 1;
      const data = milestones.serialize();
      const m2 = new Milestones(game); m2.deserialize(data);
      expect(m2.stats.walk).toBe(500); expect(m2.awarded.walk).toBe(1);
    });
  });
});
