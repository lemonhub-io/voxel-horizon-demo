import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NicknamePrompt from '../../components/NicknamePrompt.vue';

describe('NicknamePrompt', () => {
  it('blocks an empty nickname', async () => {
    const wrapper = mount(NicknamePrompt);
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.text()).toContain('昵称需为');
  });

  it('emits a normalized nickname after confirmation', async () => {
    const wrapper = mount(NicknamePrompt);
    await wrapper.find('input').setValue('  星海旅人  ');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('confirm')).toEqual([['星海旅人']]);
  });
});
