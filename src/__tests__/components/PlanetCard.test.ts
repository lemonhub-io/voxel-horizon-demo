import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PlanetCard from '../../components/PlanetCard.vue';

describe('PlanetCard', () => {
  it('renders nothing when null', () => { const w = mount(PlanetCard, { props: { info: null } }); expect(w.find('#planet-card').exists()).toBe(false); });
  it('renders info', () => { const w = mount(PlanetCard, { props: { info: { name: '测试星', climate: '温和', flora: '丰饶', fauna: '3 种', storm: '偶发', res: ['carbon'] } } }); expect(w.text()).toContain('测试星'); });
});
