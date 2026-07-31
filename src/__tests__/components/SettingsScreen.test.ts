import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SettingsScreen from '../../components/SettingsScreen.vue';
import { useGameStore } from '../../stores/gameStore';
import { DEFAULT_SETTINGS } from '../../config';

describe('SettingsScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders title', () => {
    const w = mount(SettingsScreen);
    expect(w.text()).toContain('系统设置');
  });

  it('has range inputs', () => {
    const w = mount(SettingsScreen);
    expect(w.findAll('input[type="range"]').length).toBeGreaterThanOrEqual(3);
  });

  it('switches tabs', async () => {
    const w = mount(SettingsScreen);
    const graphics = w.findAll('.opts-tab').find(b => b.text().includes('画面'));
    expect(graphics).toBeDefined();
    await graphics!.trigger('click');
    expect(w.text()).toContain('电影级后处理');
    expect(w.text()).toContain('显示帧率');
  });

  it('exposes touch sensitivity and autosave controls', async () => {
    const w = mount(SettingsScreen);
    await w.findAll('.opts-tab').find(b => b.text().includes('操控'))!.trigger('click');
    expect(w.text()).toContain('触控灵敏度');
    await w.findAll('.opts-tab').find(b => b.text().includes('系统'))!.trigger('click');
    expect(w.text()).toContain('自动存档');
  });

  it('resets to defaults', async () => {
    const store = useGameStore();
    store.settings.master = 10;
    store.settings.showFps = true;
    const w = mount(SettingsScreen);
    await w.findAll('.opts-tab').find(b => b.text().includes('系统'))!.trigger('click');
    const reset = w.findAll('.btn').find(b => b.text().includes('恢复默认'));
    await reset!.trigger('click');
    expect(store.settings.master).toBe(DEFAULT_SETTINGS.master);
    expect(store.settings.showFps).toBe(DEFAULT_SETTINGS.showFps);
  });

  it('emits back', async () => {
    const w = mount(SettingsScreen);
    const btn = w.findAll('.btn').find(b => b.text().includes('返回'));
    await btn!.trigger('click');
    expect(w.emitted('back')).toBeTruthy();
  });

  it('requires double confirm for wipe', async () => {
    const w = mount(SettingsScreen);
    await w.findAll('.opts-tab').find(b => b.text().includes('系统'))!.trigger('click');
    const wipe = w.findAll('.btn').find(b => b.text().includes('清除'));
    await wipe!.trigger('click');
    expect(w.emitted('wipe')).toBeFalsy();
    const wipe2 = w.findAll('.btn').find(b => b.text().includes('再次确认'));
    await wipe2!.trigger('click');
    expect(w.emitted('wipe')).toBeTruthy();
  });
});
