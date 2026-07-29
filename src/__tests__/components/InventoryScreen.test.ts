import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from '../helpers/three-mock';
import { useInventoryStore } from '../../stores/inventoryStore';
import InventoryScreen from '../../components/InventoryScreen.vue';

createThreeMock();
(window as unknown as Record<string, unknown>).game = { atlas: { icon: vi.fn(() => '') } };

function touchAt(x: number, y: number): Touch {
  return { clientX: x, clientY: y, identifier: 1 } as Touch;
}

describe('InventoryScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders tabs', () => { const w = mount(InventoryScreen); expect(w.findAll('.inv-tab').length).toBe(3); });
  it('shows empty detail', () => { const w = mount(InventoryScreen); expect(w.text()).toContain('选择一件物品查看详情'); });
  it('emits close on backdrop', async () => { const w = mount(InventoryScreen); await w.find('#inv-screen').trigger('mousedown.self'); expect(w.emitted('close')).toBeTruthy(); });

  it('selects a slot into the detail panel on click when pointer is fine', async () => {
    // happy-dom's matchMedia('(pointer: fine)').matches === true → hasFinePointer is true,
    // so click selects via onSlotClick → selects the slot into the detail panel.
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 3 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];
    await slot.trigger('click');
    // detail panel now shows the selected item's name
    expect(w.text()).toContain('钠');
    // selected slot is flagged with the highlight class
    expect(slot.classes()).toContain('selected');
  });

  it('opens detail modal on long-press', async () => {
    vi.useFakeTimers();
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 2 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];
    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    await vi.advanceTimersByTimeAsync(500);
    expect(w.find('.inv-modal').exists()).toBe(true);
    expect(w.find('.inv-modal').text()).toContain('钠');
  });

  it('cancels long-press when the finger moves', async () => {
    vi.useFakeTimers();
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 2 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];
    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    await slot.trigger('touchmove', { touches: [touchAt(40, 10)] });
    await vi.advanceTimersByTimeAsync(500);
    expect(w.find('.inv-modal').exists()).toBe(false);
  });

  it('opens modal on double-tap and selects on single short tap', async () => {
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 2 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];

    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    await slot.trigger('touchend');
    expect(slot.classes()).toContain('selected');
    expect(w.find('.inv-modal').exists()).toBe(false);

    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    await slot.trigger('touchend');
    expect(w.find('.inv-modal').exists()).toBe(true);
  });

  it('ignores backdrop close immediately after open (ghost click guard)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 2 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];
    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    await vi.advanceTimersByTimeAsync(500);
    // openModal sets ignore window to Date.now()+350 ≈ 1_000_850
    expect(w.find('.inv-modal').exists()).toBe(true);

    await w.find('.inv-modal').trigger('click');
    expect(w.find('.inv-modal').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(400);
    await w.find('.inv-modal').trigger('click');
    expect(w.find('.inv-modal').exists()).toBe(false);
  });

  it('clears pending long-press timer on unmount', async () => {
    vi.useFakeTimers();
    const store = useInventoryStore();
    store.slots[0] = { id: 'sodium', n: 2 };
    const w = mount(InventoryScreen);
    const slot = w.findAll('#inv-grid .slot')[0];
    await slot.trigger('touchstart', { touches: [touchAt(10, 10)] });
    w.unmount();
    // Must not throw if the long-press timer fires after unmount
    await vi.advanceTimersByTimeAsync(600);
  });
});
