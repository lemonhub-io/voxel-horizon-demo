import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import MultiplayerLobbyScreen from "../../components/MultiplayerLobbyScreen.vue";

const officialListing = {
  roomId: "official-main",
  playerCount: 0,
  maxPlayers: 8,
  seed: 1,
  palIdx: 0,
  planetName: "官方星域",
  live: true,
  mode: "official" as const,
};

describe("MultiplayerLobbyScreen official discovery", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/official"))
          return { ok: false, status: 503 };
        return {
          ok: true,
          json: async () => ({
            rooms: [
              officialListing,
              {
                roomId: "room-hosted",
                playerCount: 1,
                maxPlayers: 8,
                seed: 2,
                palIdx: 1,
                planetName: "玩家房间",
                live: true,
              },
            ],
          }),
        };
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("shows the official server from the public list without duplicating it as a host room", async () => {
    const wrapper = mount(MultiplayerLobbyScreen);
    await flushPromises();

    expect(wrapper.find(".mp-official .mp-slot.official").text()).toContain(
      "官方星域",
    );
    expect(wrapper.findAll(".mp-list .mp-slot")).toHaveLength(1);
    expect(wrapper.find(".mp-list").text()).toContain("玩家房间");
    await wrapper.find(".mp-official-btn").trigger("click");
    expect(wrapper.emitted("join-official")).toHaveLength(1);
  });
});
