import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useInventoryStore } from '../../stores/inventoryStore';

describe('useInventoryStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with empty slots', () => {
    const store = useInventoryStore();
    expect(store.slots.length).toBe(24);
    expect(store.hotbar.length).toBe(9);
    expect(store.sel).toBe(0);
    expect(store.units).toBe(0);
  });

  it('count returns 0 for empty inventory', () => {
    const store = useInventoryStore();
    expect(store.count('carbon')).toBe(0);
  });

  it('stackMax returns correct values', () => {
    const store = useInventoryStore();
    expect(store.stackMax('carbon')).toBe(99);
    expect(store.stackMax('metal_plate')).toBe(32);
  });

  it('selected returns null when empty', () => {
    const store = useInventoryStore();
    expect(store.selected).toBeNull();
  });
});
