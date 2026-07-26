import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock the game engine minimally
const mockGame = {
  audio: { uiOpen: vi.fn(), uiClose: vi.fn(), uiDeny: vi.fn(), craft: vi.fn(), useItem: vi.fn(), pickup: vi.fn(), notify: vi.fn() },
  hud: { notify: vi.fn(), toast: vi.fn() },
  player: { hazard: 50, ls: 50, hp: 100 },
  exitPointerLock: vi.fn(),
  requestPointerLock: vi.fn(),
  milestones: { addStat: vi.fn() },
} as unknown as import('../types').Game;

import { Inventory } from '../inventory';

describe('Inventory', () => {
  let inv: Inventory;

  beforeEach(() => {
    setActivePinia(createPinia());
    inv = new Inventory(mockGame);
  });

  describe('add', () => {
    it('adds items to hotbar first', () => {
      inv.add('carbon', 5);
      expect(inv.hotbar[0]).not.toBeNull();
      expect(inv.hotbar[0]!.id).toBe('carbon');
      expect(inv.hotbar[0]!.n).toBe(5);
    });

    it('fills hotbar then slots', () => {
      inv.add('carbon', 300);
      const hotbarCount = inv.hotbar.reduce((s, i) => s + (i?.n || 0), 0);
      const slotCount = inv.slots.reduce((s, i) => s + (i?.n || 0), 0);
      expect(hotbarCount + slotCount).toBe(300);
    });

    it('stacks items of same type', () => {
      inv.add('carbon', 10);
      inv.add('carbon', 5);
      expect(inv.hotbar[0]!.n).toBe(15);
    });

    it('returns amount actually added', () => {
      const added = inv.add('carbon', 5);
      expect(added).toBe(5);
    });
  });

  describe('count', () => {
    it('returns 0 for absent item', () => expect(inv.count('carbon')).toBe(0));
    it('counts across hotbar and slots', () => {
      inv.add('carbon', 100);
      expect(inv.count('carbon')).toBe(100);
    });
  });

  describe('consume', () => {
    it('returns false when insufficient', () => {
      expect(inv.consume('carbon', 5)).toBe(false);
    });

    it('removes items and returns true', () => {
      inv.add('carbon', 10);
      expect(inv.consume('carbon', 3)).toBe(true);
      expect(inv.count('carbon')).toBe(7);
    });

    it('clears slot when empty', () => {
      inv.add('carbon', 1);
      inv.consume('carbon', 1);
      expect(inv.count('carbon')).toBe(0);
    });
  });

  describe('canAfford / pay', () => {
    it('canAfford returns false when insufficient', () => {
      expect(inv.canAfford([['carbon', 10]])).toBe(false);
    });

    it('canAfford returns true when sufficient', () => {
      inv.add('carbon', 20);
      expect(inv.canAfford([['carbon', 10]])).toBe(true);
    });

    it('pay deducts resources', () => {
      inv.add('carbon', 20);
      inv.pay([['carbon', 10]]);
      expect(inv.count('carbon')).toBe(10);
    });

    it('pay returns false when cannot afford', () => {
      expect(inv.pay([['carbon', 10]])).toBe(false);
    });
  });

  describe('selected', () => {
    it('returns null when hotbar empty', () => expect(inv.selected()).toBeNull());
    it('returns selected hotbar item', () => {
      inv.add('carbon', 5);
      expect(inv.selected()).not.toBeNull();
      expect(inv.selected()!.id).toBe('carbon');
    });
  });

  describe('useItem', () => {
    it('returns false for non-consumable', () => {
      inv.add('carbon', 1);
      expect(inv.useItem('carbon')).toBe(false);
    });

    it('returns false when empty', () => expect(inv.useItem('sodium')).toBe(false));

    it('consumes item on use', () => {
      inv.add('sodium', 3);
      mockGame.player.hazard = 30;
      inv.useItem('sodium');
      expect(inv.count('sodium')).toBe(2);
    });
  });

  describe('serialize / deserialize', () => {
    it('round-trips data', () => {
      inv.add('carbon', 42);
      inv.sel = 3;
      inv.units = 100;
      const data = inv.serialize();
      const inv2 = new Inventory(mockGame);
      inv2.deserialize(data);
      expect(inv2.count('carbon')).toBe(42);
      expect(inv2.sel).toBe(3);
      expect(inv2.units).toBe(100);
    });
  });
});
