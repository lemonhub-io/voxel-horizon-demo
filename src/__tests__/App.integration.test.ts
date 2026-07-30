import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import App from "../App.vue";
import { useGameStore } from "../stores/gameStore";
import { useHudStore } from "../stores/hudStore";
import { useInventoryStore } from "../stores/inventoryStore";
import { useShipStore } from "../stores/shipStore";

const mocks = vi.hoisted(() => ({
  engine: {
    newGame: vi.fn(),
    continueGame: vi.fn(),
    joinPublicMultiplayer: vi.fn(),
    joinOfficialMultiplayer: vi.fn(),
    hostPublicMultiplayer: vi.fn(),
    finishLoad: vi.fn(),
    continueWithFailedModels: vi.fn(),
    togglePause: vi.fn(),
    respawn: vi.fn(),
    leaveMultiplayer: vi.fn(),
    inv: { useItem: vi.fn(), craft: vi.fn(), syncStore: vi.fn() },
    ship: {
      closePanel: vi.fn(),
      repair: vi.fn(),
      refuel: vi.fn(),
      enter: vi.fn(),
    },
    mp: { roomId: "alpha", isHost: true, isOfficial: false },
    multiplayer: false,
  },
  loadGame: vi.fn(),
  save: {
    hasSave: vi.fn(),
    listSlots: vi.fn(),
    getCurrentSlot: vi.fn(),
    pickSlotForNewGame: vi.fn(),
    setCurrentSlot: vi.fn(),
    load: vi.fn(),
    deleteSlot: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../engine-loader", () => ({ loadGame: mocks.loadGame }));
vi.mock("../save", () => ({ Save: mocks.save }));

const stubs = {
  TitleScreen: {
    emits: [
      "new-game",
      "continue",
      "official-mp",
      "public-mp",
      "saves",
      "help",
      "settings",
    ],
    template:
      '<div id="title"><button class="new" @click="$emit(\'new-game\')"/><button class="continue" @click="$emit(\'continue\')"/><button class="public" @click="$emit(\'public-mp\')"/><button class="official" @click="$emit(\'official-mp\')"/><button class="saves" @click="$emit(\'saves\')"/></div>',
  },
  SaveSlotScreen: {
    emits: ["load", "delete", "back"],
    template:
      '<div id="slots"><button class="load" @click="$emit(\'load\', 1)"/><button class="delete" @click="$emit(\'delete\', 0)"/></div>',
  },
  MultiplayerLobbyScreen: {
    emits: ["join", "join-official", "back"],
    template:
      '<div id="lobby"><button class="join" @click="$emit(\'join\', { roomId: \'room-1\' })"/></div>',
  },
  PauseScreen: {
    emits: ["resume", "save", "host-mp", "help", "settings", "quit"],
    template:
      '<div id="pause"><button class="save" @click="$emit(\'save\')"/><button class="host" @click="$emit(\'host-mp\')"/><button class="resume" @click="$emit(\'resume\')"/></div>',
  },
  InventoryScreen: {
    emits: ["close", "use-item", "craft"],
    template:
      '<div id="inventory"><button class="use" @click="$emit(\'use-item\', \'sodium\')"/><button class="craft" @click="$emit(\'craft\', { id: \'plate\', req: [], out: 1 })"/></div>',
  },
  LoadingScreen: true,
  ModelLoadError: {
    emits: ["continue", "report-exit"],
    template:
      '<div id="model-error"><button class="model-continue" @click="$emit(\'continue\')"/></div>',
  },
  IntroScreen: {
    emits: ["skip"],
    template:
      '<div id="intro"><button class="skip" @click="$emit(\'skip\')"/></div>',
  },
  HudOverlay: true,
  TouchControls: true,
  ShipPanel: {
    emits: ["close", "repair", "refuel", "launch"],
    template:
      '<div id="ship"><button class="repair" @click="$emit(\'repair\', \'thruster\')"/><button class="refuel" @click="$emit(\'refuel\')"/><button class="launch" @click="$emit(\'launch\')"/></div>',
  },
  DeathScreen: {
    emits: ["respawn"],
    template:
      '<div id="dead"><button class="respawn" @click="$emit(\'respawn\')"/></div>',
  },
  SettingsScreen: true,
  HelpScreen: true,
  PlanetCard: true,
  MilestonePopup: true,
};

function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(App, { global: { plugins: [pinia], stubs } });
}

describe("App integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadGame.mockResolvedValue(mocks.engine);
    mocks.save.hasSave.mockResolvedValue(true);
    mocks.save.listSlots.mockResolvedValue([
      null,
      { planetName: "Nova" },
      null,
    ]);
    mocks.save.getCurrentSlot.mockReturnValue(0);
    mocks.save.pickSlotForNewGame.mockResolvedValue(2);
    mocks.save.load.mockResolvedValue(null);
    mocks.save.save.mockResolvedValue(true);
    (window as unknown as { game: unknown }).game = mocks.engine;
  });

  it("loads the engine for new games and empty save slots without overwriting slot selection", async () => {
    const wrapper = mountApp();
    await flushPromises();

    await wrapper.find(".new").trigger("click");
    await flushPromises();
    expect(mocks.save.pickSlotForNewGame).toHaveBeenCalledOnce();
    expect(mocks.save.setCurrentSlot).toHaveBeenCalledWith(2);
    expect(mocks.engine.newGame).toHaveBeenCalled();

    await wrapper.find(".saves").trigger("click");
    await wrapper.find("#slots .load").trigger("click");
    await flushPromises();
    expect(mocks.save.setCurrentSlot).toHaveBeenCalledWith(1);
    expect(mocks.save.load).toHaveBeenCalledWith(1);
    expect(mocks.engine.newGame).toHaveBeenCalledTimes(2);

    mocks.save.load.mockResolvedValueOnce({ playerHp: 100 });
    await wrapper.find(".saves").trigger("click");
    await wrapper.find("#slots .load").trigger("click");
    await flushPromises();
    expect(mocks.engine.continueGame).toHaveBeenCalledOnce();
  });

  it("routes multiplayer, pause, inventory and HUD actions to the active engine", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await wrapper.find(".public").trigger("click");
    await wrapper.find("#lobby .join").trigger("click");
    await flushPromises();
    expect(mocks.engine.joinPublicMultiplayer).toHaveBeenCalledWith("room-1");

    const game = useGameStore();
    game.state = "pause";
    await wrapper.vm.$nextTick();
    await wrapper.find("#pause .host").trigger("click");
    await wrapper.find("#pause .save").trigger("click");
    await wrapper.find("#pause .resume").trigger("click");
    await flushPromises();
    expect(mocks.engine.hostPublicMultiplayer).toHaveBeenCalledOnce();
    expect(mocks.save.save).toHaveBeenCalledWith(mocks.engine);
    expect(mocks.engine.togglePause).toHaveBeenCalledWith(false);

    const inventory = useInventoryStore();
    inventory.open = true;
    await wrapper.vm.$nextTick();
    await wrapper.find("#inventory .use").trigger("click");
    await wrapper.find("#inventory .craft").trigger("click");
    expect(mocks.engine.inv.useItem).toHaveBeenCalledWith("sodium");
    expect(mocks.engine.inv.craft).toHaveBeenCalledWith({
      id: "plate",
      req: [],
      out: 1,
    });
    expect(mocks.engine.inv.syncStore).toHaveBeenCalledTimes(2);

    mocks.engine.joinPublicMultiplayer.mockRejectedValueOnce(
      new Error("offline"),
    );
    game.state = "title";
    await wrapper.vm.$nextTick();
    await wrapper.find(".public").trigger("click");
    await wrapper.find("#lobby .join").trigger("click");
    await flushPromises();
    const notifications = useHudStore().notifications;
    expect(notifications[notifications.length - 1]).toMatchObject({
      text: "offline",
      kind: "danger",
    });
  });

  it("routes gameplay, error and ship-screen events to their engine methods", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const game = useGameStore();

    game.state = "intro";
    await wrapper.vm.$nextTick();
    await wrapper.find("#intro .skip").trigger("click");
    expect(mocks.engine.finishLoad).toHaveBeenCalledWith(null);

    game.state = "model-error";
    await wrapper.vm.$nextTick();
    await wrapper.find("#model-error .model-continue").trigger("click");
    expect(mocks.engine.continueWithFailedModels).toHaveBeenCalledOnce();

    game.state = "dead";
    await wrapper.vm.$nextTick();
    await wrapper.find("#dead .respawn").trigger("click");
    expect(mocks.engine.respawn).toHaveBeenCalledOnce();

    game.state = "play";
    const inventory = useInventoryStore();
    inventory.open = false;
    useShipStore().open = true;
    await wrapper.vm.$nextTick();
    await wrapper.find("#ship .repair").trigger("click");
    await wrapper.find("#ship .refuel").trigger("click");
    await wrapper.find("#ship .launch").trigger("click");
    expect(mocks.engine.ship.repair).toHaveBeenCalledWith("thruster");
    expect(mocks.engine.ship.refuel).toHaveBeenCalledOnce();
    expect(mocks.engine.ship.closePanel).toHaveBeenCalledOnce();
    expect(mocks.engine.ship.enter).toHaveBeenCalledOnce();
  });
});
