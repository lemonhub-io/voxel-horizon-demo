import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMissionsStore } from '../../stores/missionsStore';

describe('useMissionsStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes at index 0', () => {
    const store = useMissionsStore();
    expect(store.idx).toBe(0);
    expect(store.scannerUnlocked).toBe(false);
    expect(store.launched).toBe(false);
  });

  it('current returns null when defs empty', () => {
    const store = useMissionsStore();
    expect(store.current).toBeNull();
  });
});
