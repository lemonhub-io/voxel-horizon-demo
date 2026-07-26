import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createThreeMock } from '../helpers/three-mock';
import InventoryScreen from '../../components/InventoryScreen.vue';

createThreeMock();
(window as unknown as Record<string, unknown>).game = { atlas: { icon: vi.fn(() => '') } };

describe('InventoryScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders tabs', () => { const w = mount(InventoryScreen); expect(w.findAll('.inv-tab').length).toBe(3); });
  it('shows empty detail', () => { const w = mount(InventoryScreen); expect(w.text()).toContain('选择一件物品查看详情'); });
  it('emits close on backdrop', async () => { const w = mount(InventoryScreen); await w.find('#inv-screen').trigger('mousedown.self'); expect(w.emitted('close')).toBeTruthy(); });
});
