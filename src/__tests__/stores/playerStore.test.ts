import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlayerStore } from '../../stores/playerStore';

describe('usePlayerStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('initializes with correct defaults', () => {
    const store = usePlayerStore();
    expect(store.hp).toBe(100);
    expect(store.hazard).toBe(25);
    expect(store.ls).toBe(80);
    expect(store.jetFuel).toBe(100);
    expect(store.inShip).toBe(false);
    expect(store.dead).toBe(false);
    expect(store.visor).toBe(false);
  });

  it('state is reactive', () => {
    const store = usePlayerStore();
    store.hp = 50;
    expect(store.hp).toBe(50);
    store.dead = true;
    expect(store.dead).toBe(true);
  });
});
