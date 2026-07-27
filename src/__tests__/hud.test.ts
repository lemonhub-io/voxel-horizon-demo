import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from './helpers/three-mock';
import type { Game } from '../types';

const THREE = createThreeMock();

function createMockGame() {
  return {
    player: { hp: 100, hazard: 50, ls: 80, jetFuel: 90, inShip: false, yaw: 0, pos: new THREE.Vector3() },
    ship: { group: { position: new THREE.Vector3(10, 0, 10) }, yaw: 0 },
    camera: new THREE.PerspectiveCamera(),
    world: { getBlock: () => 0 },
    audio: { notify: vi.fn() },
    palette: { hazard: { type: 'heat' } },
    stormActive: false,
    sky: { dayMix: 1 },
  } as unknown as Game;
}

import { HUD } from '../hud';

describe('HUD', () => {
  let game: ReturnType<typeof createMockGame>;
  let hud: HUD;

  beforeEach(() => { setActivePinia(createPinia()); game = createMockGame(); hud = new HUD(game); });

  it('initializes with null compass', () => { expect(hud.compass).toBeNull(); });

  describe('notify', () => {
    it('delegates to hudStore and plays audio', () => {
      hud.notify('测试', 'info');
      expect(game.audio.notify).toHaveBeenCalledWith('info');
    });
  });

  describe('clearMarkers', () => {
    it('clears store markers', () => {
      hud.clearMarkers();
      // smoke test - no crash
    });
  });

  describe('update', () => {
    it('runs without error', () => expect(() => hud.update(0.016)).not.toThrow());
    it('skips when no player', () => { (game as { player: unknown }).player = null; expect(() => hud.update(0.016)).not.toThrow(); });
  });
});
