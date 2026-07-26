import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useShipStore } from '../../stores/shipStore';

describe('useShipStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with broken components', () => {
    const store = useShipStore();
    expect(store.comps.thruster.broken).toBe(true);
    expect(store.comps.pulse.broken).toBe(true);
    expect(store.repaired).toBe(false);
  });

  it('canLaunch is false when not repaired', () => {
    const store = useShipStore();
    store.fuel = 100;
    expect(store.canLaunch).toBe(false);
  });

  it('canLaunch is true when repaired and fueled', () => {
    const store = useShipStore();
    store.comps.thruster.broken = false;
    store.comps.pulse.broken = false;
    store.fuel = 50;
    expect(store.canLaunch).toBe(true);
  });

  it('canLaunch is false when fuel < 25', () => {
    const store = useShipStore();
    store.comps.thruster.broken = false;
    store.comps.pulse.broken = false;
    store.fuel = 20;
    expect(store.canLaunch).toBe(false);
  });
});
