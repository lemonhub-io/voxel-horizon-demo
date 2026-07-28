import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ModelLoadError from '../../components/ModelLoadError.vue';

describe('ModelLoadError', () => {
  it('lists failed resources and exposes both recovery actions', async () => {
    const wrapper = mount(ModelLoadError, { props: { failures: ['飞船模型：网络错误'] } });
    expect(wrapper.text()).toContain('飞船模型：网络错误');
    const buttons = wrapper.findAll('button');
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    expect(wrapper.emitted('continue')).toHaveLength(1);
    expect(wrapper.emitted('report-exit')).toHaveLength(1);
  });
});