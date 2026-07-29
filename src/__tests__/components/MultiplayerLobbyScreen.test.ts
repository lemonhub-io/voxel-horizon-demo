import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MultiplayerLobbyScreen from '../../components/MultiplayerLobbyScreen.vue';

const rooms = [
  { roomId: 'public-0', playerCount: 2, maxPlayers: 8, seed: 1, palIdx: 0, planetName: '泽界' },
  { roomId: 'public-1', playerCount: 8, maxPlayers: 8, seed: 2, palIdx: 1, planetName: '满员' },
  { roomId: 'public-2', playerCount: 0, maxPlayers: 8, seed: 3, palIdx: 0, planetName: '待生成星域' },
];

describe('MultiplayerLobbyScreen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ rooms }),
      })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders lobby title and loads rooms', async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();
    expect(wrapper.text()).toContain('公开联机');
    expect(wrapper.text()).toContain('泽界');
    expect(wrapper.text()).toContain('不托管存档');
  });

  it('emits join with name on quick join', async () => {
    const wrapper = mount(MultiplayerLobbyScreen, { props: { displayName: '测试员' } });
    await flushPromises();
    const buttons = wrapper.findAll('button');
    const quick = buttons.find((b) => b.text().includes('快速加入'));
    await quick!.trigger('click');
    expect(wrapper.emitted('join')?.[0]).toEqual([{ name: '测试员' }]);
  });

  it('emits back', async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();
    const back = wrapper.findAll('button').find((b) => b.text().includes('返回'));
    await back!.trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
