import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import MultiplayerLobbyScreen from '../../components/MultiplayerLobbyScreen.vue';

const rooms = [
  { roomId: 'room-abcd1234', playerCount: 2, maxPlayers: 8, seed: 1, palIdx: 0, planetName: '泽界', live: true },
  { roomId: 'room-ffff9999', playerCount: 8, maxPlayers: 8, seed: 2, palIdx: 1, planetName: '满员', live: true },
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

  it('renders lobby and loads host rooms', async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();
    expect(wrapper.text()).toContain('公开联机');
    expect(wrapper.text()).toContain('泽界');
    expect(wrapper.text()).toContain('房主');
    expect(wrapper.text()).not.toContain('呼号');
  });

  it('emits join with roomId', async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();
    const slot = wrapper.findAll('.mp-slot').find((s) => s.text().includes('泽界'));
    await slot!.trigger('click');
    const join = wrapper.findAll('button').find((b) => b.text().includes('加入所选'));
    await join!.trigger('click');
    expect(wrapper.emitted('join')?.[0]).toEqual([{ roomId: 'room-abcd1234' }]);
  });

  it('emits back', async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();
    const back = wrapper.findAll('button').find((b) => b.text().includes('返回'));
    await back!.trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
