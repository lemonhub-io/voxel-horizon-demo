import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpScreen from '../../components/HelpScreen.vue';

describe('HelpScreen', () => {
  it('renders controls', () => {
    const wrapper = mount(HelpScreen);
    expect(wrapper.text()).toContain('W');
    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('S');
    expect(wrapper.text()).toContain('D');
    expect(wrapper.text()).toContain('操作手册');
  });

  it('has category tabs and survival content', async () => {
    const wrapper = mount(HelpScreen);
    const survive = wrapper.findAll('.opts-tab').find(b => b.text().includes('生存'));
    expect(survive).toBeDefined();
    await survive!.trigger('click');
    expect(wrapper.text()).toContain('生命维持');
    expect(wrapper.text()).toContain('推荐起步顺序');
  });

  it('filters content by search query', async () => {
    const wrapper = mount(HelpScreen);
    await wrapper.find('.help-search').setValue('跃迁');
    // Flight bind or ship card should match
    expect(wrapper.text()).toMatch(/跃迁/);
  });

  it('emits back on button click', async () => {
    const wrapper = mount(HelpScreen);
    const back = wrapper.findAll('.btn').find(b => b.text().includes('返回'));
    await back!.trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
