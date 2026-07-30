import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PauseScreen from '../../components/PauseScreen.vue';

describe('PauseScreen', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders pause title', () => {
    const wrapper = mount(PauseScreen);
    expect(wrapper.text()).toContain('系统暂停');
  });

  it('has all menu buttons', () => {
    const wrapper = mount(PauseScreen);
    expect(wrapper.text()).toContain('继续探索');
    expect(wrapper.text()).toContain('保存进度');
    expect(wrapper.text()).toContain('返回标题');
  });

  it('hides save and shows leave label in multiplayer', () => {
    const wrapper = mount(PauseScreen, { props: { multiplayer: true, isHost: true } });
    expect(wrapper.text()).toContain('联机暂停');
    expect(wrapper.text()).not.toContain('保存进度');
    expect(wrapper.text()).toContain('离开联机');
    expect(wrapper.text()).toContain('房主本机托管');
  });

  it('shows official banner', () => {
    const wrapper = mount(PauseScreen, {
      props: { multiplayer: true, isHost: false, official: true },
    });
    expect(wrapper.text()).toContain('官方星域');
    expect(wrapper.text()).toContain('R2');
  });

  it('shows open multiplayer when offline', () => {
    const wrapper = mount(PauseScreen, { props: { multiplayer: false } });
    expect(wrapper.text()).toContain('开放联机');
  });

  it('emits resume', async () => {
    const wrapper = mount(PauseScreen);
    const buttons = wrapper.findAll('.btn');
    await buttons[0].trigger('click');
    expect(wrapper.emitted('resume')).toBeTruthy();
  });
});
