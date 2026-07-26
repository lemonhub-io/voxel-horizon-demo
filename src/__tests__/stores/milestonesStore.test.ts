import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMilestonesStore } from '../../stores/milestonesStore';

describe('useMilestonesStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with zero stats', () => {
    const store = useMilestonesStore();
    expect(store.stats.walk).toBe(0);
    expect(store.stats.mined).toBe(0);
    expect(store.stats.scans).toBe(0);
  });

  it('stats can be updated', () => {
    const store = useMilestonesStore();
    store.stats.walk = 100;
    expect(store.stats.walk).toBe(100);
  });
});
