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

  it('emits resume', async () => {
    const wrapper = mount(PauseScreen);
    const buttons = wrapper.findAll('.btn');
    await buttons[0].trigger('click');
    expect(wrapper.emitted('resume')).toBeTruthy();
  });
});
