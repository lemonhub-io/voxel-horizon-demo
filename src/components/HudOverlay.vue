<template>
  <div id="hud">
    <div id="hud-top">
      <div id="compass-wrap"><canvas id="compass" ref="compassCanvas" width="640" height="52"></canvas></div>
      <div id="hud-corner">
        <div id="hud-units"><span class="u-sym">◈</span><span>{{ inventory.units }}</span></div>
        <div id="hud-planet">{{ game.planetName }}</div>
        <div id="hud-env"><span>{{ envIcon }}</span><span>{{ envLabel }}</span></div>
      </div>
    </div>

    <div id="alert-center" :class="{ hidden: !hud.alertOn }"><span class="alert-icon">⚠</span><span>{{ hud.alertText }}</span></div>

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
      <div id="shield-row" class="stat-row"><span class="stat-ico">⬡</span><div class="bar"><div class="bar-fill shield" :style="{ width: player.hp + '%' }"></div></div></div>
      <div class="stat-row"><span class="stat-ico">✚</span><div id="hp-segs"><div v-for="i in 4" :key="i" class="hp-seg" :class="{ off: player.hp / 100 < i / 4 - 0.24, hurt: player.hp < 30 }"></div></div></div>
    </div>

    <div id="stats-right" :class="{ hidden: hud.flightHudOn }">
      <div class="stat-row"><div class="bar rtl"><div class="bar-fill haz" :class="{ low: player.hazard < 25 }" :style="{ width: player.hazard + '%' }"></div></div><span class="stat-ico">{{ hazIcon }}</span></div>
      <div class="stat-row"><div class="bar rtl"><div class="bar-fill ls" :class="{ low: player.ls < 25 }" :style="{ width: player.ls + '%' }"></div></div><span class="stat-ico">❍</span></div>
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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { useShipStore } from '../stores/shipStore';
import { useHudStore } from '../stores/hudStore';
import { HAZ_ICONS } from '../config';
import Hotbar from './Hotbar.vue';
import Toasts from './Toasts.vue';
import Notifications from './Notifications.vue';

const game = useGameStore();
const player = usePlayerStore();
const inventory = useInventoryStore();
const ship = useShipStore();
const hud = useHudStore();

const compassCanvas = ref<HTMLCanvasElement | null>(null);

const markerIcons: Record<string, string> = { na: 'Na', h2: 'H', o2: 'O₂', fe: 'Fe', cu: 'Cu' };
interface MatrixLike { elements: ArrayLike<number> }
interface CameraLike { matrixWorldInverse: MatrixLike; projectionMatrix: MatrixLike }
interface ScreenMarker { id: string; type: string; sx: number; sy: number; opacity: number; dist: string }

const screenMarkers = ref<ScreenMarker[]>([]);
let markerFrame = 0;
let lastMarkerUpdate = 0;

function projectMarker(x: number, y: number, z: number, camera: CameraLike): { x: number; y: number; z: number; w: number } | null {
  const view = camera.matrixWorldInverse.elements;
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const vw = view[3] * x + view[7] * y + view[11] * z + view[15];
  const projection = camera.projectionMatrix.elements;
  const clipX = projection[0] * vx + projection[4] * vy + projection[8] * vz + projection[12] * vw;
  const clipY = projection[1] * vx + projection[5] * vy + projection[9] * vz + projection[13] * vw;
  const clipZ = projection[2] * vx + projection[6] * vy + projection[10] * vz + projection[14] * vw;
  const clipW = projection[3] * vx + projection[7] * vy + projection[11] * vz + projection[15] * vw;
  if (clipW <= 0) return null;
  return { x: clipX / clipW, y: clipY / clipW, z: clipZ / clipW, w: clipW };
}

function updateScreenMarkers(): void {
  const engine = window.game;
  const camera = engine?.camera;
  const playerPos = engine?.player?.pos;
  if (!camera || !playerPos || hud.markers.length === 0) {
    if (screenMarkers.value.length) screenMarkers.value = [];
    return;
  }

  const width = innerWidth;
  const height = innerHeight;
  screenMarkers.value = hud.markers.flatMap(marker => {
    const point = projectMarker(marker.x, marker.y, marker.z, camera);
    if (!point || point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return [];
    const dx = marker.x - playerPos.x;
    const dy = marker.y - playerPos.y;
    const dz = marker.z - playerPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [{
      id: marker.id,
      type: marker.type,
      sx: (point.x * 0.5 + 0.5) * width,
      sy: (-point.y * 0.5 + 0.5) * height,
      opacity: Math.max(0, 1 - distance / 60),
      dist: distance >= 1000 ? (distance / 1000).toFixed(1) + 'km' : Math.round(distance) + 'm'
    }];
  }).filter(marker => marker.opacity > 0);
}

function refreshScreenMarkers(timestamp: number): void {
  if (timestamp - lastMarkerUpdate >= 1000 / 30) {
    lastMarkerUpdate = timestamp;
    updateScreenMarkers();
  }
  markerFrame = requestAnimationFrame(refreshScreenMarkers);
}

onMounted(() => { markerFrame = requestAnimationFrame(refreshScreenMarkers); });
onUnmounted(() => cancelAnimationFrame(markerFrame));

const hazIcon = computed(() => HAZ_ICONS[game.palette.hazard.type] || '☢');
const envIcon = computed(() => game.stormActive ? '⚠' : '☀');
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
