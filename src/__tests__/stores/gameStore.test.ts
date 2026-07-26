import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStore } from '../../stores/gameStore';

describe('useGameStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with title state', () => {
    const store = useGameStore();
    expect(store.state).toBe('title');
  });

  it('planetInfo returns valid structure', () => {
    const store = useGameStore();
    store.planetName = '测试星球';
    const info = store.planetInfo();
    expect(info.name).toBe('测试星球');
    expect(info.climate).toBeTruthy();
    expect(info.res.length).toBeGreaterThan(0);
  });

  it('settings have defaults', () => {
    const store = useGameStore();
    expect(store.settings.master).toBe(80);
    expect(store.settings.fov).toBe(78);
  });

  it('stormFactor starts at 0', () => {
    const store = useGameStore();
    expect(store.stormFactor).toBe(0);
  });
});
