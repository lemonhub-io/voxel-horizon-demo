import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsScreen from '../../components/SettingsScreen.vue';

describe('SettingsScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders title', () => { const w = mount(SettingsScreen); expect(w.text()).toContain('系统设置'); });
  it('has range inputs', () => { const w = mount(SettingsScreen); expect(w.findAll('input[type="range"]').length).toBeGreaterThanOrEqual(3); });
  it('emits back', async () => { const w = mount(SettingsScreen); const btn = w.findAll('.btn').find(b => b.text().includes('返回')); await btn!.trigger('click'); expect(w.emitted('back')).toBeTruthy(); });
  it('emits wipe', async () => { const w = mount(SettingsScreen); const btn = w.findAll('.btn').find(b => b.text().includes('清除')); await btn!.trigger('click'); expect(w.emitted('wipe')).toBeTruthy(); });
});
