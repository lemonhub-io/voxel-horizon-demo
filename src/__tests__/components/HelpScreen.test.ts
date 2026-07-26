import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpScreen from '../../components/HelpScreen.vue';

describe('HelpScreen', () => {
  it('renders controls', () => {
    const wrapper = mount(HelpScreen);
    expect(wrapper.text()).toContain('W A S D');
    expect(wrapper.text()).toContain('操作手册');
  });

  it('emits back on button click', async () => {
    const wrapper = mount(HelpScreen);
    await wrapper.find('.btn').trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
