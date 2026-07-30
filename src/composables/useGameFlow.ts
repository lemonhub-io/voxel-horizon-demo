import { computed, onMounted, ref, type Ref } from 'vue';
import { loadGame } from '../engine-loader';
import { getActiveGame } from '../runtime/game-runtime';
import { useGameStore } from '../stores/gameStore';
import { useHudStore } from '../stores/hudStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useSaveSlots } from './useSaveSlots';
import type { Recipe } from '../types';

interface TitleScreenModel {
  seed?: string;
}

/**
 * Application-level commands that coordinate the UI, lazy engine, and saves.
 * Views should bind these handlers but keep rendering decisions in their components.
 */
export function useGameFlow(titleRef: Ref<TitleScreenModel | null>) {
  const game = useGameStore();
  const hud = useHudStore();
  const inventory = useInventoryStore();
  const saves = useSaveSlots();

  const showSettings = ref(false);
  const showHelp = ref(false);
  const showSaves = ref(false);
  const showMpLobby = ref(false);
  const engineLoading = ref(false);
  const engineLoadingText = ref('正在准备星球渲染器');
  const engineLoadingSub = ref('INITIALIZING RENDERER');
  const mpBusy = ref(false);
  const mpRoomLabel = ref('');

  const isMultiplayer = computed(() => !!getActiveGame()?.multiplayer);
  const isMpHost = computed(() => !!getActiveGame()?.mp?.isHost);
  const isMpOfficial = computed(
    () =>
      !!getActiveGame()?.mp?.isOfficial ||
      getActiveGame()?.mp?.mode === 'official',
  );

  onMounted(() => {
    void saves.initialize();
  });

  function resetLoadingText(): void {
    engineLoadingText.value = '正在准备星球渲染器';
    engineLoadingSub.value = 'INITIALIZING RENDERER';
  }

  function openMpLobby(): void {
    showSaves.value = false;
    showMpLobby.value = true;
  }

  async function onNewGame(): Promise<void> {
    if (engineLoading.value) return;
    engineLoading.value = true;
    resetLoadingText();
    try {
      await saves.prepareNewGame();
      const engine = await loadGame();
      engine.newGame(titleRef.value?.seed || '');
    } finally {
      engineLoading.value = false;
    }
  }

  async function onContinue(): Promise<void> {
    if (engineLoading.value) return;
    engineLoading.value = true;
    try {
      const engine = await loadGame();
      await engine.continueGame();
    } finally {
      engineLoading.value = false;
    }
  }

  async function onLoadSlot(slot: number): Promise<void> {
    const data = await saves.loadSlot(slot);
    showSaves.value = false;
    if (data) {
      await onContinue();
      return;
    }

    engineLoading.value = true;
    try {
      const engine = await loadGame();
      engine.newGame(titleRef.value?.seed || '');
    } finally {
      engineLoading.value = false;
    }
  }

  async function onDeleteSlot(slot: number): Promise<void> {
    if (confirm(`确定删除存档 ${slot + 1}？`)) {
      await saves.deleteSlot(slot);
    }
  }

  async function joinMultiplayer(
    join: (engine: Awaited<ReturnType<typeof loadGame>>) => Promise<void> | void,
    loadingText: string,
    loadingSub: string,
    fallbackRoom: string,
    failureText: string,
  ): Promise<void> {
    if (engineLoading.value || mpBusy.value) return;
    mpBusy.value = true;
    engineLoading.value = true;
    engineLoadingText.value = loadingText;
    engineLoadingSub.value = loadingSub;
    try {
      const engine = await loadGame();
      await join(engine);
      mpRoomLabel.value = engine.mp?.roomId || fallbackRoom;
      showMpLobby.value = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : failureText;
      hud.addNotification(message, 'danger');
      console.warn('multiplayer connection failed', error);
    } finally {
      mpBusy.value = false;
      engineLoading.value = false;
      resetLoadingText();
    }
  }

  async function onMpJoin(payload: { roomId: string }): Promise<void> {
    await joinMultiplayer(
      (engine) => engine.joinPublicMultiplayer(payload.roomId),
      '正在从房主同步世界',
      'JOINING HOST SESSION',
      payload.roomId,
      '加入联机失败',
    );
  }

  async function onOfficialMp(): Promise<void> {
    await joinMultiplayer(
      (engine) => engine.joinOfficialMultiplayer(),
      '正在连接官方星域',
      'OFFICIAL SERVER',
      'official-main',
      '加入官方星域失败',
    );
  }

  async function onHostMp(): Promise<void> {
    const engine = getActiveGame();
    if (!engine || mpBusy.value) return;
    mpBusy.value = true;
    try {
      await engine.hostPublicMultiplayer?.();
      mpRoomLabel.value = engine.mp?.roomId || '';
      hud.addNotification('房间已公开到联机列表', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '开放联机失败';
      hud.addNotification(message, 'danger');
    } finally {
      mpBusy.value = false;
    }
  }

  function onIntroSkip(): void {
    getActiveGame()?.finishLoad(null);
  }

  function onContinueWithFailedModels(): void {
    getActiveGame()?.continueWithFailedModels();
  }

  function onReportModelFailure(): void {
    const issueUrl = new URL(
      'https://github.com/lemonhub-io/voxel-horizon-demo/issues/new',
    );
    issueUrl.searchParams.set('title', '模型资源加载失败');
    issueUrl.searchParams.set(
      'body',
      `自动生成的错误报告：\n\n- ${game.modelLoadFailures.join('\n- ')}\n\n浏览器：${navigator.userAgent}`,
    );
    window.location.assign(issueUrl.toString());
  }

  function onCloseInv(): void {
    inventory.open = false;
  }

  function onUseItem(id: string): void {
    const engine = getActiveGame();
    if (!engine) return;
    engine.inv.useItem(id);
    engine.inv.syncStore();
  }

  function onCraft(recipe: Recipe): void {
    const engine = getActiveGame();
    if (!engine) return;
    engine.inv.craft(recipe);
    engine.inv.syncStore();
  }

  function onCloseShip(): void {
    getActiveGame()?.ship.closePanel();
  }

  function onRepair(key: string): void {
    getActiveGame()?.ship.repair(key);
  }

  function onRefuel(): void {
    getActiveGame()?.ship.refuel();
  }

  function onLaunch(): void {
    const ship = getActiveGame()?.ship;
    ship?.closePanel();
    ship?.enter();
  }

  function onResume(): void {
    getActiveGame()?.togglePause(false);
  }

  async function onSave(): Promise<void> {
    const engine = getActiveGame();
    if (!engine) return;
    if (engine.multiplayer) {
      hud.addNotification('公开联机不托管存档，进度仅会话内有效', 'warn');
      return;
    }
    const saved = await saves.saveGame(engine);
    hud.addNotification(
      saved ? '进度已保存' : '存档失败，请重试',
      saved ? 'success' : 'danger',
    );
    if (saved) onResume();
  }

  async function onQuit(): Promise<void> {
    const engine = getActiveGame();
    if (engine?.multiplayer) {
      engine.leaveMultiplayer?.();
      location.reload();
      return;
    }
    if (engine) {
      const saved = await saves.saveGame(engine);
      if (!saved) {
        hud.addNotification('存档失败，仍将退出', 'warn');
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    location.reload();
  }

  function onRespawn(): void {
    getActiveGame()?.respawn();
  }

  async function onWipe(): Promise<void> {
    if (confirm('确定清除全部存档？')) {
      await saves.clear();
      location.reload();
    }
  }

  return {
    ...saves,
    showSettings,
    showHelp,
    showSaves,
    showMpLobby,
    engineLoading,
    engineLoadingText,
    engineLoadingSub,
    mpBusy,
    mpRoomLabel,
    isMultiplayer,
    isMpHost,
    isMpOfficial,
    openMpLobby,
    onNewGame,
    onContinue,
    onLoadSlot,
    onDeleteSlot,
    onMpJoin,
    onOfficialMp,
    onHostMp,
    onIntroSkip,
    onContinueWithFailedModels,
    onReportModelFailure,
    onCloseInv,
    onUseItem,
    onCraft,
    onCloseShip,
    onRepair,
    onRefuel,
    onLaunch,
    onResume,
    onSave,
    onQuit,
    onRespawn,
    onWipe,
  };
}
