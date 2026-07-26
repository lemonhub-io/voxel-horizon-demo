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

  <IntroScreen
    v-if="game.state === 'intro'"
    :lines="game.introLines"
    @skip="onIntroSkip"
  />

  <HudOverlay v-if="game.state === 'play' || game.state === 'warp'" />
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
import type { SaveSlotMeta } from './types';

import TitleScreen from './components/TitleScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import IntroScreen from './components/IntroScreen.vue';
import HudOverlay from './components/HudOverlay.vue';
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

function getEngine() {
  return (window as unknown as { game: { [k: string]: unknown } }).game;
}

function onNewGame() {
  const engine = getEngine();
  const seed = titleRef.value?.seed || '';
  if (engine && typeof engine.newGame === 'function') (engine.newGame as (s?: string) => void)(seed);
}
function onContinue() {
  const engine = getEngine();
  if (engine && typeof engine.continueGame === 'function') (engine.continueGame as () => Promise<void>)();
}
async function onLoadSlot(slot: number) {
  Save.setCurrentSlot(slot);
  currentSlot.value = slot;
  // Check if slot has data
  const data = await Save.load(slot);
  if (data) {
    showSaves.value = false;
    onContinue();
  } else {
    // Empty slot — start new game in this slot
    showSaves.value = false;
    onNewGame();
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
  if (engine && typeof engine.finishLoad === 'function') (engine.finishLoad as (d: null) => void)(null);
}
function onCloseInv() { inv.open = false; }
function onUseItem(id: string) {
  const engine = getEngine();
  if (engine?.inv && typeof (engine.inv as Record<string, unknown>).useItem === 'function') {
    (engine.inv as { useItem: (id: string) => boolean }).useItem(id);
    (engine.inv as { syncStore: () => void }).syncStore();
  }
}
function onCraft(recipe: { id: string; req: [string, number][]; out: number }) {
  const engine = getEngine();
  if (engine?.inv && typeof (engine.inv as Record<string, unknown>).craft === 'function') {
    (engine.inv as { craft: (r: typeof recipe) => void }).craft(recipe);
    (engine.inv as { syncStore: () => void }).syncStore();
  }
}
function onCloseShip() { ship.open = false; }
function onRepair(_key: string) { /* handled by engine */ }
function onRefuel() {
  const engine = getEngine();
  if (engine?.ship) {
    const s = engine.ship as Record<string, unknown>;
    if (typeof s.renderPanel === 'function') (s.renderPanel as () => void)();
  }
}
function onLaunch() {
  ship.open = false;
  const engine = getEngine();
  if (engine?.ship && typeof (engine.ship as Record<string, unknown>).enter === 'function') {
    ((engine.ship as Record<string, unknown>).enter as () => void)();
  }
}
function onResume() {
  const engine = getEngine();
  if (engine && typeof engine.togglePause === 'function') (engine.togglePause as (v: boolean) => void)(false);
}
async function onSave() {
  await Save.save(getEngine() as Parameters<typeof Save.save>[0]);
  await refreshSlots();
  hud.addNotification('进度已保存', 'success');
  onResume();
}
async function onQuit() {
  await Save.save(getEngine() as Parameters<typeof Save.save>[0]);
  location.reload();
}
function onRespawn() {
  const engine = getEngine();
  if (engine && typeof engine.respawn === 'function') (engine.respawn as () => void)();
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
