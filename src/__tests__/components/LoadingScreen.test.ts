import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LoadingScreen from '../../components/LoadingScreen.vue';

describe('LoadingScreen', () => {
  it('renders planet name', () => { const w = mount(LoadingScreen, { props: { planetName: '测试星', subtitle: '构建中…', progress: 50 } }); expect(w.text()).toContain('测试星'); });
  it('sets progress bar', () => { const w = mount(LoadingScreen, { props: { planetName: '星', subtitle: '…', progress: 75 } }); expect(w.find('.bar-fill').attributes('style')).toContain('75%'); });
});
