<template>
  <TitleScreen
    v-if="game.state === 'title' && !showSaves && !showMpLobby"
    ref="titleRef"
    :has-save="hasSave"
    @new-game="onNewGame"
    @continue="onContinue"
    @official-mp="onOfficialMp"
    @public-mp="openMpLobby"
    @saves="showSaves = true"
    @help="showHelp = true"
    @settings="showSettings = true"
  />

  <NicknamePrompt v-if="nicknameRequired" @confirm="onNicknameConfirm" />

  <div v-if="engineLoading" id="engine-loading" role="status" aria-live="polite">
    <div class="engine-loading__spinner"></div>
    <div>{{ engineLoadingText }}</div>
    <small>{{ engineLoadingSub }}</small>
  </div>

  <SaveSlotScreen
    v-if="showSaves"
    :slots="saveSlots"
    :current-slot="currentSlot"
    @load="onLoadSlot"
    @delete="onDeleteSlot"
    @back="showSaves = false"
  />

  <MultiplayerLobbyScreen
    v-if="showMpLobby && game.state === 'title'"
    :joining="mpBusy"
    @back="showMpLobby = false"
    @join="onMpJoin"
    @join-official="onOfficialMp"
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

  <HudOverlay v-if="game.state === 'play' || game.state === 'warp'" :multiplayer="isMultiplayer" :mp-room="mpRoomLabel" />
  <TouchControls v-if="(game.state === 'play' || game.state === 'warp') && !inv.open && !ship.open" />
  <InventoryScreen v-if="inv.open" @close="onCloseInv" @use-item="onUseItem" @craft="onCraft" />
  <ShipPanel v-if="ship.open" @close="onCloseShip" @repair="onRepair" @refuel="onRefuel" @launch="onLaunch" />
  <PauseScreen
    v-if="game.state === 'pause'"
    :multiplayer="isMultiplayer"
    :is-host="isMpHost"
    :official="isMpOfficial"
    @resume="onResume"
    @save="onSave"
    @host-mp="onHostMp"
    @help="showHelp = true"
    @settings="showSettings = true"
    @quit="onQuit"
  />
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
import { ref } from 'vue';
import { useGameStore } from './stores/gameStore';
import { usePlayerStore } from './stores/playerStore';
import { useInventoryStore } from './stores/inventoryStore';
import { useShipStore } from './stores/shipStore';
import { useHudStore } from './stores/hudStore';
import { useGameFlow } from './composables/useGameFlow';

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
import MultiplayerLobbyScreen from './components/MultiplayerLobbyScreen.vue';
import NicknamePrompt from './components/NicknamePrompt.vue';
import { getPlayerNickname, savePlayerNickname } from './net/official-profile';

const game = useGameStore();
const player = usePlayerStore();
const inv = useInventoryStore();
const ship = useShipStore();
const hud = useHudStore();
const damageFlash = ref(false);
const nicknameRequired = ref(!getPlayerNickname());
const titleRef = ref<InstanceType<typeof TitleScreen> | null>(null);
const {
  hasSave,
  saveSlots,
  currentSlot,
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
} = useGameFlow(titleRef);

function onNicknameConfirm(nickname: string): void {
  if (savePlayerNickname(nickname)) nicknameRequired.value = false;
}

function triggerDamageFlash() {
  damageFlash.value = true;
  setTimeout(() => { damageFlash.value = false; }, 130);
}

defineExpose({ titleRef, triggerDamageFlash });
</script>
