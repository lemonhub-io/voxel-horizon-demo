<template>
  <div id="hud">
    <div id="hud-top">
      <div id="compass-wrap"><canvas id="compass" ref="compassCanvas" width="640" height="52"></canvas></div>
      <div id="hud-corner">
        <div v-if="multiplayer" id="hud-mp" title="公开联机会话">
          <svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 14c0-2.8 3.1-5 7-5s7 2.2 7 5v2H5v-2Z"/><path d="M18 8a3 3 0 1 1 0 6"/></svg>
          <span>{{ mpRoom || 'PUBLIC' }}</span>
        </div>
        <div id="hud-units"><svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 10-8 10L4 12z"/><path d="m12 7 4 5-4 5-4-5z"/></svg><span>{{ inventory.units }}</span></div>
        <div id="hud-planet">{{ game.planetName }}</div>
        <div id="hud-env"><svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg><span>{{ envLabel }}</span></div>
      </div>
    </div>
    <div id="alert-center" :class="{ hidden: !hud.alertOn }"><svg class="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5m0 3h.01"/></svg><span>{{ hud.alertText }}</span></div>

    <div id="crosshair" :class="{ hidden: hud.flightHudOn }">
      <svg id="mine-ring" width="56" height="56" viewBox="0 0 56 56"><circle class="ring-bg" cx="28" cy="28" r="24"/><circle class="ring-fg" cx="28" cy="28" r="24" :style="mineRingStyle"/></svg>
      <div id="ch-dot"></div>
      <div id="heat-wrap"><div id="heat-bar" :style="heatStyle"></div></div>
      <div id="jet-wrap"><div id="jet-bar" :style="{ height: player.jetFuel + '%' }"></div></div>
    </div>

    <div id="interact-hint" :class="{ hidden: !hud.interactKey }">
      <svg id="hold-ring" width="44" height="44" viewBox="0 0 44 44"><circle class="ring-bg" cx="22" cy="22" r="18"/><circle class="ring-fg" cx="22" cy="22" r="18" :style="holdRingStyle"/></svg>
      <span class="kbd">{{ hud.interactKey }}</span><span>{{ hud.interactText }}</span>
    </div>

    <div id="stats-left" :class="{ hidden: hud.flightHudOn }">
      <div id="shield-row" class="stat-row"><svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 3v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><div class="bar"><div class="bar-fill shield" :style="{ width: player.hp + '%' }"></div></div></div>
      <div class="stat-row"><svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><div id="hp-segs"><div v-for="i in 4" :key="i" class="hp-seg" :class="{ off: player.hp / 100 < i / 4 - 0.24, hurt: player.hp < 30 }"></div></div></div>
    </div>

    <div id="stats-right" :class="{ hidden: hud.flightHudOn }">
      <div class="stat-row"><div class="bar rtl"><div class="bar-fill haz" :class="{ low: player.hazard < 25 }" :style="{ width: player.hazard + '%' }"></div></div><svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 15H4z"/><path d="M12 9v4m0 3h.01"/></svg></div>
      <div class="stat-row"><div class="bar rtl"><div class="bar-fill ls" :class="{ low: player.ls < 25 }" :style="{ width: player.ls + '%' }"></div></div><svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg></div>
    </div>

    <Hotbar :items="inventory.hotbar" :sel="inventory.sel" :class="{ hidden: hud.flightHudOn }" />
    <Toasts :toasts="hud.toasts" />
    <Notifications :notifications="hud.notifications" />

    <div id="mission-card" :class="{ hidden: !hud.missionTitle }">
      <div id="mission-kind">任务</div>
      <div id="mission-title">{{ hud.missionTitle }}</div>
      <div id="mission-desc">{{ hud.missionDesc }}</div>
      <div v-if="hud.missionMax > 0" id="mission-prog-wrap"><div class="bar slim"><div class="bar-fill acc" :style="{ width: Math.min(100, hud.missionCur / hud.missionMax * 100) + '%' }"></div></div><span>{{ Math.min(hud.missionCur, hud.missionMax) }} / {{ hud.missionMax }}</span></div>
    </div>

    <div id="visor-overlay" class="hidden">
      <div class="visor-ring r1"></div>
      <div class="visor-ring r2"></div>
      <div class="visor-corner tl"></div>
      <div class="visor-corner tr"></div>
      <div class="visor-corner bl"></div>
      <div class="visor-corner br"></div>
      <div class="visor-scanline"></div>
      <div id="visor-side">
        <div>目 镜</div>
        <div id="visor-clock">T+0s // 0,0</div>
      </div>
      <div id="visor-info" class="hidden">
        <div id="vi-name"></div>
        <div id="vi-type"></div>
        <div id="vi-extra"></div>
        <div id="vi-hint">按住 <span class="kbd sm">左键</span> 分析</div>
      </div>
    </div>

    <div id="marker-layer">
      <div v-for="m in screenMarkers" :key="m.id" class="marker" :class="m.type" :style="{ left: m.sx + 'px', top: m.sy + 'px', opacity: m.opacity }">
        <div class="m-ico">{{ markerIcons[m.type] || '?' }}</div>
        <div class="m-dist">{{ m.dist }}</div>
      </div>
    </div>

    <div id="flight-hud" :class="{ hidden: !hud.flightHudOn }">
      <div id="flight-reticle"><div class="fr-c"></div><div class="fr-l"></div><div class="fr-r"></div></div>
      <div id="flight-data">
        <div class="fd-item"><label>速度</label><span>{{ Math.round(ship.speed) }}</span><em>u/s</em></div>
        <div class="fd-item"><label>高度</label><span>0</span><em>m</em></div>
        <div class="fd-item"><label>跃迁电池</label><span>{{ inventory.count('warp_cell') }}</span><em>枚</em></div>
      </div>
      <div id="flight-tips">鼠标 转向 · W/S 油门 · 空格 加力 · E 降落 · J 跃迁</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useShipStore } from '../stores/shipStore';
import { useHudStore } from '../stores/hudStore';
import Hotbar from './Hotbar.vue';
import Toasts from './Toasts.vue';
import Notifications from './Notifications.vue';
import { useScreenMarkers } from '../composables/useScreenMarkers';

defineProps<{
  multiplayer?: boolean;
  mpRoom?: string;
}>();

const game = useGameStore();
const player = usePlayerStore();
const inventory = useInventoryStore();
const ship = useShipStore();
const hud = useHudStore();
const { markers } = storeToRefs(hud);

const compassCanvas = ref<HTMLCanvasElement | null>(null);

const markerIcons: Record<string, string> = { na: 'Na', h2: 'H', o2: 'O₂', fe: 'Fe', cu: 'Cu' };
const { screenMarkers } = useScreenMarkers(markers);

const envLabel = computed(() => game.stormActive ? game.palette.storm.label : '白昼');

const mineRingStyle = computed(() => ({
  strokeDashoffset: 151 - 151 * Math.min(1, player.mineProgress)
}));

const heatStyle = computed(() => ({
  height: Math.min(1, player.heat) * 100 + '%',
  background: player.overheated > 0 ? '#ff3c2c' : ''
}));

const holdRingStyle = computed(() => ({
  strokeDashoffset: 113 - 113 * Math.min(1, hud.interactProgress)
}));
</script>
