import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mount } from '@vue/test-utils';
import TitleScreen from '../../components/TitleScreen.vue';

// happy-dom does not implement canvas getContext('2d'); provide a minimal stub
const origGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (type: string) {
    if (type === '2d') {
      return {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
      } as unknown as CanvasRenderingContext2D;
    }
    return origGetContext.call(this, type);
  });
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe('TitleScreen', () => {
  it('renders title text', () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: false } });
    expect(wrapper.text()).toContain('方界');
    expect(wrapper.text()).toContain('深空');
  });

  it('shows new game button', () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: false } });
    expect(wrapper.find('.btn.t-btn').exists()).toBe(true);
  });

  it('hides continue button when no save', () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: false } });
    const buttons = wrapper.findAll('.btn.t-btn');
    const continueBtn = buttons.find(b => b.text().includes('继续'));
    expect(continueBtn).toBeUndefined();
  });

  it('shows continue button when has save', () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: true } });
    const buttons = wrapper.findAll('.btn.t-btn');
    const continueBtn = buttons.find(b => b.text().includes('继续'));
    expect(continueBtn).toBeDefined();
  });

  it('emits new-game on click', async () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: false } });
    await wrapper.find('.btn.t-btn').trigger('click');
    expect(wrapper.emitted('new-game')).toBeTruthy();
  });

  it('has seed input', () => {
    const wrapper = mount(TitleScreen, { props: { hasSave: false } });
    expect(wrapper.find('input').exists()).toBe(true);
  });
});
