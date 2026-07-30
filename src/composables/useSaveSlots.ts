import { ref } from "vue";
import { Save } from "../save";
import type { Game, SaveData, SaveSlotMeta } from "../types";

/** Coordinates slot metadata and selection without coupling it to a screen. */
export function useSaveSlots() {
  const hasSave = ref(false);
  const saveSlots = ref<(SaveSlotMeta | null)[]>([]);
  const currentSlot = ref(0);

  async function initialize(): Promise<void> {
    const [saved, slots] = await Promise.all([
      Save.hasSave(),
      Save.listSlots(),
    ]);
    hasSave.value = saved;
    saveSlots.value = slots;
    currentSlot.value = Save.getCurrentSlot();
  }

  async function refresh(): Promise<void> {
    saveSlots.value = await Save.listSlots();
    hasSave.value = saveSlots.value.some((slot) => slot !== null);
  }

  async function prepareNewGame(): Promise<number> {
    const slot = await Save.pickSlotForNewGame();
    Save.setCurrentSlot(slot);
    currentSlot.value = slot;
    return slot;
  }

  async function loadSlot(slot: number): Promise<SaveData | null> {
    Save.setCurrentSlot(slot);
    currentSlot.value = slot;
    return Save.load(slot);
  }

  async function deleteSlot(slot: number): Promise<void> {
    await Save.deleteSlot(slot);
    await refresh();
  }

  async function clear(): Promise<void> {
    await Save.clear();
    await refresh();
  }

  async function saveGame(game: Game): Promise<boolean> {
    const saved = await Save.save(game);
    await refresh();
    return saved;
  }

  return {
    hasSave,
    saveSlots,
    currentSlot,
    initialize,
    refresh,
    prepareNewGame,
    loadSlot,
    deleteSlot,
    clear,
    saveGame,
  };
}
