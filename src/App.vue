<template>
  <TitleScreen
    v-if="game.state === 'title' && !showSaves"
    ref="titleRef"
    :has-save="hasSave"
    @new-game="onNewGame"
    @continue="onContinue"
    @saves="showSaves = true"
    @help="showHelp = true"
    @settings="showSettings = true"
  />

  <div v-if="engineLoading" id="engine-loading" role="status" aria-live="polite">
    <div class="engine-loading__spinner"></div>
    <div>正在准备星球渲染器</div>
    <small>INITIALIZING RENDERER</small>
  </div>

  <SaveSlotScreen
    v-if="showSaves"
    :slots="saveSlots"
    :current-slot="currentSlot"
    @load="onLoadSlot"
    @delete="onDeleteSlot"
    @back="showSaves = false"
  />

  <LoadingScreen
    v-if="game.state === 'loading'"
    :planet-name="game.planetName"
    :subtitle="game.palette.climate + ' · 构建体素地貌…'"
    :progress="game.loadProgress"
  />

  <ModelLoadError v-if="game.state === 'model-error'" :failures="game.modelLoadFailures" @continue="onContinueWithFailedModels" @report-exit="onReportModelFailure" />
  <IntroScreen
    v-if="game.state === 'intro'"
    :lines="game.introLines"
    @skip="onIntroSkip"
  />

  <HudOverlay v-if="game.state === 'play' || game.state === 'warp'" />
  <TouchControls v-if="(game.state === 'play' || game.state === 'warp') && !inv.open && !ship.open" />
  <InventoryScreen v-if="inv.open" @close="onCloseInv" @use-item="onUseItem" @craft="onCraft" />
  <ShipPanel v-if="ship.open" @close="onCloseShip" @repair="onRepair" @refuel="onRefuel" @launch="onLaunch" />
  <PauseScreen v-if="game.state === 'pause'" @resume="onResume" @save="onSave" @help="showHelp = true" @settings="showSettings = true" @quit="onQuit" />
  <DeathScreen v-if="game.state === 'dead'" @respawn="onRespawn" />

  <SettingsScreen v-if="showSettings" @back="showSettings = false" @wipe="onWipe" />
  <HelpScreen v-if="showHelp" @back="showHelp = false" />

  <PlanetCard :info="hud.planetCardInfo" />
  <MilestonePopup :m="hud.milestones[0]" />

  <div id="warp-overlay" :class="{ hidden: game.state !== 'warp' }"><canvas id="warp-canvas"></canvas><div class="warp-text">超光速跃迁中 // HYPERWARP</div></div>
  <div id="tooltip" class="hidden"></div>
  <div id="drag-ghost" class="hidden"><img><span></span></div>
  <div id="vignette"></div>
  <div id="damage-flash" :class="{ hit: damageFlash }"></div>
  <div id="storm-tint" :style="{ opacity: game.stormFactor * 0.9 }"></div>
  <div id="water-tint" :style="{ opacity: player.headInWater ? 1 : 0 }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGameStore } from './stores/gameStore';
import { usePlayerStore } from './stores/playerStore';
import { useInventoryStore } from './stores/inventoryStore';
import { useShipStore } from './stores/shipStore';
import { useHudStore } from './stores/hudStore';
import { Save } from './save';
import { loadGame } from './engine-loader';
import type { Game, SaveSlotMeta } from './types';

import TitleScreen from './components/TitleScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import ModelLoadError from './components/ModelLoadError.vue';
import IntroScreen from './components/IntroScreen.vue';
import HudOverlay from './components/HudOverlay.vue';
import TouchControls from './components/TouchControls.vue';
import InventoryScreen from './components/InventoryScreen.vue';
import ShipPanel from './components/ShipPanel.vue';
import PauseScreen from './components/PauseScreen.vue';
import DeathScreen from './components/DeathScreen.vue';
import SettingsScreen from './components/SettingsScreen.vue';
import HelpScreen from './components/HelpScreen.vue';
import PlanetCard from './components/PlanetCard.vue';
import MilestonePopup from './components/MilestonePopup.vue';
import SaveSlotScreen from './components/SaveSlotScreen.vue';

const game = useGameStore();
const player = usePlayerStore();
const inv = useInventoryStore();
const ship = useShipStore();
const hud = useHudStore();

const hasSave = ref(false);
const showSettings = ref(false);
const showHelp = ref(false);
const showSaves = ref(false);
const engineLoading = ref(false);
const damageFlash = ref(false);
const saveSlots = ref<(SaveSlotMeta | null)[]>([]);
const currentSlot = ref(0);
const titleRef = ref<InstanceType<typeof TitleScreen> | null>(null);

onMounted(async () => {
  hasSave.value = await Save.hasSave();
  saveSlots.value = await Save.listSlots();
  currentSlot.value = Save.getCurrentSlot();
});

async function refreshSlots() {
  saveSlots.value = await Save.listSlots();
  hasSave.value = saveSlots.value.some(s => s !== null);
}

function getEngine(): Game | undefined {
  return window.game;
}

async function onNewGame() {
  if (engineLoading.value) return;
  engineLoading.value = true;
  try {
    const engine = await loadGame();
    const seed = titleRef.value?.seed || '';
    engine.newGame(seed);
  } finally {
    engineLoading.value = false;
  }
}
async function onContinue() {
  if (engineLoading.value) return;
  engineLoading.value = true;
  try {
    const engine = await loadGame();
    await engine.continueGame();
  } finally {
    engineLoading.value = false;
  }
}
async function onLoadSlot(slot: number) {
  Save.setCurrentSlot(slot);
  currentSlot.value = slot;
  // Check if slot has data
  const data = await Save.load(slot);
  if (data) {
    showSaves.value = false;
    await onContinue();
  } else {
    // Empty slot — start new game in this slot
    showSaves.value = false;
    await onNewGame();
  }
}
async function onDeleteSlot(slot: number) {
  if (confirm(`确定删除存档 ${slot + 1}？`)) {
    await Save.deleteSlot(slot);
    await refreshSlots();
  }
}
function onIntroSkip() {
  const engine = getEngine();
  engine?.finishLoad(null);
}
function onContinueWithFailedModels() {
  getEngine()?.continueWithFailedModels();
}
function onReportModelFailure() {
  const issueUrl = new URL('https://github.com/lemonhub-io/voxel-horizon-demo/issues/new');
  issueUrl.searchParams.set('title', '模型资源加载失败');
  issueUrl.searchParams.set('body', `自动生成的错误报告：\n\n- ${game.modelLoadFailures.join('\n- ')}\n\n浏览器：${navigator.userAgent}`);
  window.location.assign(issueUrl.toString());
}
function onCloseInv() { inv.open = false; }
function onUseItem(id: string) {
  const engine = getEngine();
  if (engine) {
    engine.inv.useItem(id);
    engine.inv.syncStore();
  }
}
function onCraft(recipe: { id: string; req: [string, number][]; out: number }) {
  const engine = getEngine();
  if (engine) {
    engine.inv.craft(recipe);
    engine.inv.syncStore();
  }
}
function onCloseShip() {
  const engine = getEngine();
  engine?.ship.closePanel();
}
function onRepair(key: string) {
  const engine = getEngine();
  engine?.ship.repair(key);
}
function onRefuel() {
  const engine = getEngine();
  engine?.ship.refuel();
}
function onLaunch() {
  const engine = getEngine();
  engine?.ship.closePanel();
  engine?.ship.enter();
}
function onResume() {
  const engine = getEngine();
  engine?.togglePause(false);
}
async function onSave() {
  const engine = getEngine();
  if (!engine) return;
  await Save.save(engine);
  await refreshSlots();
  hud.addNotification('进度已保存', 'success');
  onResume();
}
async function onQuit() {
  const engine = getEngine();
  if (engine) await Save.save(engine);
  location.reload();
}
function onRespawn() {
  const engine = getEngine();
  engine?.respawn();
}
async function onWipe() {
  if (confirm('确定清除全部存档？')) { await Save.clear(); location.reload(); }
}

function triggerDamageFlash() {
  damageFlash.value = true;
  setTimeout(() => { damageFlash.value = false; }, 130);
}

defineExpose({ titleRef, triggerDamageFlash });
</script>
