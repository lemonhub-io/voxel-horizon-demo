import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from '../helpers/three-mock';
import { useInventoryStore } from '../../stores/inventoryStore';
import InventoryScreen from '../../components/InventoryScreen.vue';

createThreeMock();
(window as unknown as Record<string, unknown>).game = { atlas: { icon: vi.fn(() => '') } };

describe('InventoryScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));

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
});
