import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TouchControls from "../../components/TouchControls.vue";
import { usePlayerStore } from "../../stores/playerStore";

function input() {
  return {
    keys: {} as Record<string, boolean>,
    buttons: {} as Record<number, boolean>,
    dx: 0,
    dy: 0,
    moveX: 0,
    moveY: 0,
    moveActive: false,
    touchSprint: false,
    jumpPressed: false,
  };
}

describe("TouchControls", () => {
  const placeBlock = vi.fn();
  const tryOpenShipPanel = vi.fn();
  const onKey = vi.fn();
  let controls: ReturnType<typeof input>;

  beforeEach(() => {
    setActivePinia(createPinia());
    controls = input();
    placeBlock.mockReset();
    tryOpenShipPanel.mockReset();
    tryOpenShipPanel.mockReturnValue(false);
    onKey.mockReset();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true),
    });
    (window as unknown as { game: unknown }).game = {
      input: controls,
      settings: { touchSens: 100 },
      player: { inShip: false, visor: false, placeBlock, tryOpenShipPanel },
      onKey,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("maps joystick movement, sprint taps, and action buttons to game input", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200);
    const wrapper = mount(TouchControls);
    await wrapper.vm.$nextTick();
    const joy = wrapper.find("#touch-joy-zone");
    await joy.trigger("pointerdown", {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    await joy.trigger("pointermove", {
      pointerId: 1,
      clientX: 158,
      clientY: 100,
    });
    expect(controls.moveActive).toBe(true);
    expect(controls.moveX).toBeCloseTo(1);
    expect(wrapper.find("#touch-joy-base").classes()).toContain("active");
    await joy.trigger("pointerup", { pointerId: 1 });
    expect(controls.moveActive).toBe(false);
    expect(controls.moveX).toBe(0);

    await joy.trigger("pointerdown", {
      pointerId: 2,
      clientX: 100,
      clientY: 100,
    });
    expect(controls.touchSprint).toBe(true);
    await wrapper.find(".touch-btn-jump").trigger("pointerdown");
    expect(controls.keys.Space).toBe(true);
    expect(controls.jumpPressed).toBe(true);
    expect(onKey).toHaveBeenCalledWith("Space", expect.any(KeyboardEvent));
    await wrapper.find(".touch-btn-jump").trigger("pointerup");
    expect(controls.keys.Space).toBe(false);
  });

  it("turns touch look into camera deltas and places a block on a short release", async () => {
    const wrapper = mount(TouchControls);
    await wrapper.vm.$nextTick();
    const look = wrapper.find("#touch-look-zone");
    await look.trigger("pointerdown", {
      pointerId: 4,
      clientX: 10,
      clientY: 20,
    });
    await look.trigger("pointermove", {
      pointerId: 4,
      clientX: 30,
      clientY: 25,
    });
    expect(controls.dx).toBeCloseTo(46);
    expect(controls.dy).toBeCloseTo(11.5);
    await look.trigger("pointerup", { pointerId: 4, clientX: 30, clientY: 25 });
    expect(placeBlock).not.toHaveBeenCalled();

    await look.trigger("pointerdown", {
      pointerId: 5,
      clientX: 10,
      clientY: 20,
    });
    await look.trigger("pointerup", { pointerId: 5, clientX: 10, clientY: 20 });
    expect(tryOpenShipPanel).toHaveBeenCalledWith(10, 20);
    expect(placeBlock).toHaveBeenCalledOnce();
  });

  it("starts and stops mining after a stationary long press, and provides ship controls", async () => {
    vi.useFakeTimers();
    const player = usePlayerStore();
    player.inShip = true;
    (
      window as unknown as { game: { player: { inShip: boolean } } }
    ).game.player.inShip = true;
    const wrapper = mount(TouchControls);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".touch-btn-boost").exists()).toBe(true);
    await wrapper.find(".touch-btn-boost").trigger("pointerdown");
    expect(controls.keys.Space).toBe(true);
    await wrapper.find(".touch-btn-land").trigger("pointerdown");
    await vi.advanceTimersByTimeAsync(80);
    expect(onKey).toHaveBeenCalledWith("KeyE", expect.any(KeyboardEvent));
    expect(controls.keys.KeyE).toBe(false);

    player.inShip = false;
    (
      window as unknown as { game: { player: { inShip: boolean } } }
    ).game.player.inShip = false;
    await wrapper.vm.$nextTick();
    const look = wrapper.find("#touch-look-zone");
    await look.trigger("pointerdown", {
      pointerId: 9,
      clientX: 10,
      clientY: 10,
    });
    await vi.advanceTimersByTimeAsync(360);
    expect(controls.buttons[0]).toBe(true);
    await look.trigger("pointercancel", { pointerId: 9 });
    expect(controls.buttons[0]).toBe(false);
  });
});
