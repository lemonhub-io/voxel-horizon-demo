import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.hoisted(() => ({
  hasSave: vi.fn(),
  listSlots: vi.fn(),
  getCurrentSlot: vi.fn(),
  pickSlotForNewGame: vi.fn(),
  setCurrentSlot: vi.fn(),
  load: vi.fn(),
  deleteSlot: vi.fn(),
  clear: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../save", () => ({ Save: save }));

import { useSaveSlots } from "../../composables/useSaveSlots";

describe("useSaveSlots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    save.hasSave.mockResolvedValue(true);
    save.listSlots.mockResolvedValue([null, { planetName: "Nova" }]);
    save.getCurrentSlot.mockReturnValue(1);
    save.pickSlotForNewGame.mockResolvedValue(2);
    save.load.mockResolvedValue(null);
    save.save.mockResolvedValue(true);
  });

  it("hydrates and refreshes slot metadata without a component dependency", async () => {
    const slots = useSaveSlots();
    await slots.initialize();
    expect(slots.hasSave.value).toBe(true);
    expect(slots.currentSlot.value).toBe(1);
    expect(slots.saveSlots.value).toEqual([null, { planetName: "Nova" }]);

    save.listSlots.mockResolvedValueOnce([null, null]);
    await slots.refresh();
    expect(slots.hasSave.value).toBe(false);
  });

  it("coordinates slot selection and mutating persistence operations", async () => {
    const slots = useSaveSlots();
    await expect(slots.prepareNewGame()).resolves.toBe(2);
    expect(save.setCurrentSlot).toHaveBeenCalledWith(2);

    await slots.loadSlot(3);
    expect(save.setCurrentSlot).toHaveBeenCalledWith(3);
    expect(save.load).toHaveBeenCalledWith(3);

    await slots.deleteSlot(1);
    await slots.clear();
    await expect(slots.saveGame({} as never)).resolves.toBe(true);
    expect(save.deleteSlot).toHaveBeenCalledWith(1);
    expect(save.clear).toHaveBeenCalledOnce();
    expect(save.save).toHaveBeenCalledOnce();
  });
});
