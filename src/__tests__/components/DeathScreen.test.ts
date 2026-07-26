import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DeathScreen from '../../components/DeathScreen.vue';

describe('DeathScreen', () => {
  it('renders death message', () => {
    const wrapper = mount(DeathScreen, { props: { cause: '坠落' } });
    expect(wrapper.text()).toContain('信号丢失');
    expect(wrapper.text()).toContain('坠落');
  });

  it('emits respawn on click', async () => {
    const wrapper = mount(DeathScreen);
    await wrapper.find('.btn').trigger('click');
    expect(wrapper.emitted('respawn')).toBeTruthy();
  });
});
