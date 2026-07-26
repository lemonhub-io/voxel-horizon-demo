import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IntroScreen from '../../components/IntroScreen.vue';

describe('IntroScreen', () => {
  it('renders lines', () => { const w = mount(IntroScreen, { props: { lines: [{ text: '第一行' }, { text: '第二行', cls: 'warn' }] } }); expect(w.text()).toContain('第一行'); expect(w.text()).toContain('第二行'); });
  it('emits skip', async () => { const w = mount(IntroScreen, { props: { lines: [] } }); await w.find('#intro-screen').trigger('click'); expect(w.emitted('skip')).toBeTruthy(); });
});
