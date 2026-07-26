import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MilestonePopup from '../../components/MilestonePopup.vue';

describe('MilestonePopup', () => {
  it('renders nothing when undefined', () => { const w = mount(MilestonePopup, { props: { m: undefined } }); expect(w.find('#milestone-pop').exists()).toBe(false); });
  it('renders milestone', () => { const w = mount(MilestonePopup, { props: { m: { kicker: '测试', title: '里程碑', sub: '描述' } } }); expect(w.text()).toContain('里程碑'); });
});
