import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useInventoryStore } from "../../stores/inventoryStore";
import { useShipStore } from "../../stores/shipStore";
import Hotbar from "../../components/Hotbar.vue";
import Notifications from "../../components/Notifications.vue";
import SaveSlotScreen from "../../components/SaveSlotScreen.vue";
import ShipPanel from "../../components/ShipPanel.vue";
import Toasts from "../../components/Toasts.vue";

const icon = vi.fn((id: string) => `/icons/${id}.png`);

describe("small UI components", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (window as unknown as { game: unknown }).game = { atlas: { icon } };
    icon.mockClear();
  });

  it("renders hotbar items and updates the selected inventory slot", async () => {
    const wrapper = mount(Hotbar, {
      props: { items: [{ id: "sodium", n: 2 }, null], sel: 0 },
    });

    expect(wrapper.findAll(".hb-slot")).toHaveLength(2);
    expect(wrapper.find(".hb-slot").classes()).toContain("sel");
    expect(wrapper.find("img").attributes("src")).toBe("/icons/sodium.png");
    await wrapper.findAll(".hb-slot")[1].trigger("pointerup");
    expect(useInventoryStore().sel).toBe(1);
  });

  it("renders toast icons and notification kinds with their fallback label", () => {
    const toasts = mount(Toasts, {
      props: { toasts: [{ id: "1", itemId: "iron", name: "Iron", n: 3 }] },
    });
    const notifications = mount(Notifications, {
      props: {
        notifications: [
          { id: "1", text: "Saved", kind: "success" },
          { id: "2", text: "Unknown", kind: "custom" },
        ],
      },
    });

    expect(toasts.text()).toContain("+3");
    expect(toasts.find("img").attributes("src")).toBe("/icons/iron.png");
    expect(notifications.findAll(".notice")).toHaveLength(2);
    expect(notifications.findAll(".n-kicker")[0].text()).toContain("DONE");
    expect(notifications.findAll(".n-kicker")[1].text()).toContain("INFO");
  });

  it("emits save-slot actions and shows populated slot metadata", async () => {
    const wrapper = mount(SaveSlotScreen, {
      props: {
        currentSlot: 0,
        slots: [
          {
            planetName: "Nova",
            climate: "Temperate",
            playTime: 65,
            playerHp: 72,
            timestamp: 0,
          },
          null,
        ],
      },
    });

    expect(wrapper.find(".save-slot").classes()).toContain("active");
    expect(wrapper.text()).toContain("Nova");
    expect(wrapper.text()).toContain("1分5秒");
    await wrapper.find(".save-slot .danger").trigger("click");
    await wrapper.findAll(".save-slot")[1].trigger("click");
    await wrapper.find(".set-actions button").trigger("click");
    expect(wrapper.emitted("delete")).toEqual([[0]]);
    expect(wrapper.emitted("load")).toEqual([[1]]);
    expect(wrapper.emitted("back")).toHaveLength(1);
  });

  it("renders ship health and forwards every ship action", async () => {
    const ship = useShipStore();
    const inventory = useInventoryStore();
    ship.comps.thruster.broken = true;
    ship.comps.thruster.req = [["iron", 2]];
    ship.fuel = 40;
    inventory.slots[0] = { id: "iron", n: 2 };
    const wrapper = mount(ShipPanel);

    expect(wrapper.find(".comp-card").classes()).toContain("broken");
    await wrapper.find(".comp-card button").trigger("click");
    await wrapper.find(".ship-fuel-row button").trigger("click");
    await wrapper.find(".ship-actions button").trigger("click");
    await wrapper.find(".inv-close").trigger("click");
    expect(wrapper.emitted("repair")?.[0]).toEqual(["thruster"]);
    expect(wrapper.emitted("refuel")).toHaveLength(1);
    expect(wrapper.emitted("launch")).toHaveLength(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
