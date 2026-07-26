import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHudStore } from '../../stores/hudStore';

describe('useHudStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with empty state', () => {
    const store = useHudStore();
    expect(store.toasts).toEqual([]);
    expect(store.notifications).toEqual([]);
    expect(store.milestones).toEqual([]);
    expect(store.alertOn).toBe(false);
  });

  it('addToast creates toast', () => {
    const store = useHudStore();
    store.addToast('carbon', 5);
    expect(store.toasts.length).toBe(1);
    expect(store.toasts[0].itemId).toBe('carbon');
    expect(store.toasts[0].n).toBe(5);
  });

  it('addToast stacks same item', () => {
    const store = useHudStore();
    store.addToast('carbon', 3);
    store.addToast('carbon', 2);
    expect(store.toasts.length).toBe(1);
    expect(store.toasts[0].n).toBe(5);
  });

  it('addToast auto-removes after timeout', () => {
    const store = useHudStore();
    store.addToast('carbon', 1);
    expect(store.toasts.length).toBe(1);
    vi.advanceTimersByTime(1800);
    expect(store.toasts.length).toBe(0);
  });

  it('addNotification creates notification', () => {
    const store = useHudStore();
    store.addNotification('测试消息', 'info');
    expect(store.notifications.length).toBe(1);
    expect(store.notifications[0].text).toBe('测试消息');
    expect(store.notifications[0].kind).toBe('info');
  });

  it('addNotification caps at 5', () => {
    const store = useHudStore();
    for (let i = 0; i < 8; i++) store.addNotification(`msg ${i}`, 'info');
    expect(store.notifications.length).toBeLessThanOrEqual(5);
  });

  it('pushMilestone adds and auto-removes', () => {
    const store = useHudStore();
    store.pushMilestone('测试', '里程碑', '描述');
    expect(store.milestones.length).toBe(1);
    vi.advanceTimersByTime(3700);
    expect(store.milestones.length).toBe(0);
  });

  it('showPlanetCard sets and auto-clears', () => {
    const store = useHudStore();
    store.showPlanetCard({ name: '测试', climate: '温和', flora: '丰饶', fauna: '3 种', storm: '偶发', res: [] });
    expect(store.planetCardInfo).not.toBeNull();
    vi.advanceTimersByTime(6000);
    expect(store.planetCardInfo).toBeNull();
  });
});
