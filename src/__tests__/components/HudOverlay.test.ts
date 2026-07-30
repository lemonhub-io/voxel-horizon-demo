import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import HudOverlay from "../../components/HudOverlay.vue";
import { useGameStore } from "../../stores/gameStore";
import { useHudStore } from "../../stores/hudStore";
import { useInventoryStore } from "../../stores/inventoryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useShipStore } from "../../stores/shipStore";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe("HudOverlay", () => {
  let frame: FrameRequestCallback | undefined;

  beforeEach(() => {
    setActivePinia(createPinia());
    frame = undefined;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    (window as unknown as { game: unknown }).game = {
      camera: {
        matrixWorldInverse: { elements: identity },
        projectionMatrix: { elements: identity },
      },
      player: { pos: { x: 0, y: 0, z: 0 } },
      atlas: { icon: vi.fn(() => "") },
    };
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders multiplayer, mission, flight data, and projected markers from stores", async () => {
    const game = useGameStore();
    const hud = useHudStore();
    const inventory = useInventoryStore();
    const player = usePlayerStore();
    const ship = useShipStore();
    game.planetName = "Nova";
    game.stormActive = true;
    hud.alertOn = true;
    hud.alertText = "Storm";
    hud.interactKey = "E";
    hud.interactText = "Open";
    hud.interactProgress = 0.5;
    hud.missionTitle = "Gather";
    hud.missionDesc = "Collect ore";
    hud.missionCur = 2;
    hud.missionMax = 4;
    hud.flightHudOn = true;
    hud.markers = [{ id: "ore", type: "fe", x: 0, y: 0, z: 0.5, ttl: 10 }];
    inventory.units = 18;
    inventory.hotbar[0] = { id: "ferrite", n: 2 };
    inventory.count = vi.fn(() => 3);
    player.hp = 20;
    player.hazard = 10;
    player.ls = 10;
    player.heat = 2;
    player.overheated = 1;
    ship.speed = 12.4;

    const wrapper = mount(HudOverlay, {
      props: { multiplayer: true, mpRoom: "alpha" },
    });
    frame?.(40);
    await wrapper.vm.$nextTick();

    expect(wrapper.find("#hud-mp").text()).toContain("alpha");
    expect(wrapper.find("#hud-planet").text()).toBe("Nova");
    expect(wrapper.find("#alert-center").classes()).not.toContain("hidden");
    expect(wrapper.find("#mission-title").text()).toBe("Gather");
    expect(wrapper.find("#flight-hud").classes()).not.toContain("hidden");
    expect(wrapper.findAll(".marker")).toHaveLength(1);
    expect(wrapper.find(".marker").text()).toContain("1m");
    expect(wrapper.find("#heat-bar").attributes("style")).toContain("#ff3c2c");
  });

  it("removes markers when no camera is available and cancels the animation frame", async () => {
    const hud = useHudStore();
    hud.markers = [{ id: "ore", type: "fe", x: 0, y: 0, z: 0.5, ttl: 10 }];
    const wrapper = mount(HudOverlay);
    frame?.(40);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".marker")).toHaveLength(1);

    (window as unknown as { game: unknown }).game = {};
    frame?.(80);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".marker")).toHaveLength(0);
    wrapper.unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
