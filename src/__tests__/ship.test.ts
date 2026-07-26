import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from './helpers/three-mock';
import type { Game } from '../types';

const THREE = createThreeMock();

function createMockGame() {
  return {
    world: { topSolidY: () => 30, surfaceY: () => 30, collides: () => false },
    hud: { notify: vi.fn(), setFlightHud: vi.fn(), closeShipPanel: vi.fn() },
    audio: { ensure: vi.fn(), initLoops: vi.fn(), uiOpen: vi.fn(), uiClose: vi.fn(), uiDeny: vi.fn(), craft: vi.fn(), recharge: vi.fn(), takeoff: vi.fn(), landing: vi.fn(), land: vi.fn(), setLoop: vi.fn(), shipThrottle: vi.fn() },
    fx: { spawn: vi.fn(), shake: vi.fn(), stopWarp: vi.fn() },
    inv: { count: vi.fn(() => 0), consume: vi.fn(() => true) },
    player: { inShip: false, exitShip: vi.fn() },
    missions: { onEvent: vi.fn() },
    camera: new THREE.PerspectiveCamera(),
    scene: { add: vi.fn() },
    settings: { sens: 100, invert: false },
    input: { dx: 0, dy: 0, dxSmooth: 0, keys: {} as Record<string, boolean> },
    time: 0, timeUniform: { value: 0 },
  } as unknown as Game;
}

import { Ship } from '../ship';

describe('Ship', () => {
  let game: ReturnType<typeof createMockGame>;
  let ship: Ship;

  beforeEach(() => { setActivePinia(createPinia()); game = createMockGame(); ship = new Ship(game); });

  it('initializes broken', () => { expect(ship.comps.thruster.broken).toBe(true); expect(ship.repaired()).toBe(false); });
  it('canLaunch false when not repaired', () => { ship.fuel = 100; expect(ship.canLaunch()).toBe(false); });
  it('canLaunch false when fuel < 25', () => { ship.comps.thruster.broken = false; ship.comps.pulse.broken = false; ship.fuel = 20; expect(ship.canLaunch()).toBe(false); });
  it('canLaunch true when repaired and fueled', () => { ship.comps.thruster.broken = false; ship.comps.pulse.broken = false; ship.fuel = 50; expect(ship.canLaunch()).toBe(true); });

  describe('updateCrashPose', () => {
    it('tilts when broken', () => { ship.updateCrashPose(); expect(ship.group.rotation.z).toBeCloseTo(0.16); });
    it('straightens when repaired', () => { ship.comps.thruster.broken = false; ship.comps.pulse.broken = false; ship.updateCrashPose(); expect(ship.group.rotation.z).toBe(0); });
  });

  describe('update', () => {
    it('generates smoke when broken', () => { ship.smokeT = 0; ship.update(0.1); expect(game.fx.spawn).toHaveBeenCalled(); });
  });

  describe('serialize / deserialize', () => {
    it('round-trips', () => {
      ship.fuel = 75; ship.comps.thruster.broken = false;
      const data = ship.serialize();
      const s2 = new Ship(game); s2.deserialize(data);
      expect(s2.fuel).toBe(75); expect(s2.comps.thruster.broken).toBe(false); expect(s2.comps.pulse.broken).toBe(true);
    });
  });
});
