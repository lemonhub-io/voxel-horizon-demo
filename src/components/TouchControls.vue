<template>
  <div v-if="isTouch" id="touch-controls" aria-label="触控操作">
    <div
      id="touch-look-zone"
      @pointerdown.prevent="onLookStart"
      @pointermove.prevent="onLookMove"
      @pointerup.prevent="onLookEnd"
      @pointercancel.prevent="onLookCancel"
    />

    <div
      id="touch-joy-zone"
      @pointerdown.prevent="onJoyStart"
      @pointermove.prevent="onJoyMove"
      @pointerup.prevent="onJoyEnd"
      @pointercancel.prevent="onJoyEnd"
    >
      <div id="touch-joy-base" :class="{ active: joyActive }" :style="joyBaseStyle">
        <div id="touch-joy-thumb" :class="{ snap: joySnapping }" :style="joyThumbStyle" />
      </div>
    </div>

    <div id="touch-actions" aria-label="移动操作">
      <button class="touch-btn touch-btn-jump" aria-label="跳跃或喷气" @pointerdown.prevent="pressKey('Space')" @pointerup.prevent="releaseKey('Space')" @pointercancel.prevent="releaseKey('Space')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5m0 0-5 5m5-5 5 5M5 21h14"/></svg>
      </button>
    </div>

    <div id="touch-utilities" aria-label="功能操作">
      <button class="touch-utility-btn" aria-label="扫描脉冲或跃迁" @pointerdown.prevent="scanOrWarp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1"/><path d="M12 12 21 3"/></svg></button>
      <button class="touch-utility-btn" aria-label="分析目镜" @pointerdown.prevent="triggerKey('KeyF')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></svg></button>
      <button class="touch-utility-btn" aria-label="打开背包" @pointerdown.prevent="triggerKey('Tab')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14v12H5zM8 8V5h8v3M9 13h6"/></svg></button>
      <button class="touch-utility-btn" aria-label="暂停游戏" @pointerdown.prevent="triggerKey('Escape')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg></button>
    </div>

    <div id="touch-sprint-indicator" :class="{ active: sprintActive }" :aria-label="sprintActive ? '疾跑已开启' : '双击摇杆切换疾跑'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 11h6l-1 9 9-13h-6z"/></svg></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

interface TouchInput {
  keys: Record<string, boolean>;
  buttons: Record<number, boolean>;
  dx: number;
  dy: number;
  moveX: number;
  moveY: number;
  moveActive: boolean;
  touchSprint: boolean;
  jumpPressed: boolean;
}
interface RuntimeGame {
  input: TouchInput;
  settings: { touchSens: number };
  player?: {
    inShip: boolean;
    visor: boolean;
    placeBlock: () => void;
    tryOpenShipPanel: (clientX: number, clientY: number) => boolean;
  };
  onKey: (code: string, event: KeyboardEvent) => void;
}

const isTouch = ref(false);
const joyActive = ref(false);
const joySnapping = ref(false);
const sprintActive = ref(false);
const joyBaseX = ref(0);
const joyBaseY = ref(0);
const joyThumbX = ref(0);
const joyThumbY = ref(0);
const joyRadius = 58;
const longPressDelay = 360;
const lookMoveThreshold = 12;
const touchLookScale = 2.3;
let joyPointer = -1;
let lastJoyTap = 0;
let joyCenterX = 0;
let joyCenterY = 0;
let lookPointer = -1;
let lookX = 0;
let lookY = 0;
let lookStartX = 0;
let lookStartY = 0;
let lookMoved = false;
let lookMining = false;
let longPressTimer: number | undefined;

const joyBaseStyle = computed(() => ({ left: `${joyBaseX.value}px`, top: `${joyBaseY.value}px` }));
const joyThumbStyle = computed(() => ({ transform: `translate(${joyThumbX.value}px, ${joyThumbY.value}px)` }));

function getGame(): RuntimeGame | undefined {
  return window.game;
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

function syncFlightThrottle(input: TouchInput, shipActive: boolean): void {
  if (!shipActive) return;
  input.keys.KeyW = input.moveY < -0.15;
  input.keys.KeyS = input.moveY > 0.15;
}

function onJoyStart(event: PointerEvent): void {
  if (joyPointer !== -1) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  element.setPointerCapture(event.pointerId);
  joyPointer = event.pointerId;
  const bounds = element.getBoundingClientRect();
  joyCenterX = event.clientX;
  joyCenterY = event.clientY;
  joyBaseX.value = event.clientX - bounds.left - joyRadius;
  joyBaseY.value = event.clientY - bounds.top - joyRadius;
  joyThumbX.value = 0;
  joyThumbY.value = 0;
  joyActive.value = true;
  joySnapping.value = false;
  const input = getGame()?.input;
  if (input) {
    input.moveActive = true;
    input.moveX = input.moveY = 0;
    const now = performance.now();
    if (now - lastJoyTap < 320) {
      input.touchSprint = !input.touchSprint;
      sprintActive.value = input.touchSprint;
    }
    lastJoyTap = now;
  }
}

function onJoyMove(event: PointerEvent): void {
  if (event.pointerId !== joyPointer) return;
  const input = getGame()?.input;
  if (!input) return;
  const dx = event.clientX - joyCenterX;
  const dy = event.clientY - joyCenterY;
  const distance = Math.hypot(dx, dy);
  const nx = distance > 0.001 ? dx / distance : 0;
  const ny = distance > 0.001 ? dy / distance : 0;
  const visualDistance = Math.min(distance, joyRadius);
  joyThumbX.value = nx * visualDistance;
  joyThumbY.value = ny * visualDistance;
  const raw = Math.min(distance / joyRadius, 1);
  const strength = raw <= 0.14 ? 0 : Math.pow((raw - 0.14) / 0.86, 1.35);
  input.moveX = nx * strength;
  input.moveY = ny * strength;
  const shipActive = getGame()?.player?.inShip ?? false;
  syncFlightThrottle(input, shipActive);
  if (!shipActive && input.moveY < -0.88 && Math.abs(input.moveX) < 0.38) sprintActive.value = true;
}

function onJoyEnd(event: PointerEvent): void {
  if (event.pointerId !== joyPointer) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  releasePointer(element, event.pointerId);
  const input = getGame()?.input;
  if (input) {
    input.moveActive = false;
    input.moveX = input.moveY = 0;
    input.keys.KeyW = false;
    input.keys.KeyS = false;
  }
  joyPointer = -1;
  joyActive.value = false;
  joySnapping.value = true;
  joyThumbX.value = joyThumbY.value = 0;
  if (input && !input.touchSprint) sprintActive.value = false;
  window.setTimeout(() => { joySnapping.value = false; }, 120);
}

function clearLongPressTimer(): void {
  if (longPressTimer !== undefined) {
    window.clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }
}

function startMining(pointerId: number): void {
  if (lookPointer !== pointerId || lookMoved) return;
  const game = getGame();
  const player = game?.player;
  if (!game || !player || player.inShip || player.visor) return;
  game.input.buttons[0] = true;
  lookMining = true;
}

function stopMining(): void {
  if (lookMining) {
    const input = getGame()?.input;
    if (input) input.buttons[0] = false;
  }
  lookMining = false;
}

function onLookStart(event: PointerEvent): void {
  if (lookPointer !== -1) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  element.setPointerCapture(event.pointerId);
  lookPointer = event.pointerId;
  lookX = lookStartX = event.clientX;
  lookY = lookStartY = event.clientY;
  lookMoved = false;
  lookMining = false;
  clearLongPressTimer();
  longPressTimer = window.setTimeout(() => startMining(event.pointerId), longPressDelay);
}

function onLookMove(event: PointerEvent): void {
  if (event.pointerId !== lookPointer) return;
  const input = getGame()?.input;
  if (!input) return;
  const dx = event.clientX - lookX;
  const dy = event.clientY - lookY;
  lookX = event.clientX;
  lookY = event.clientY;
  if (Math.hypot(event.clientX - lookStartX, event.clientY - lookStartY) > lookMoveThreshold) {
    lookMoved = true;
    clearLongPressTimer();
    stopMining();
  }
  const sensitivity = (getGame()?.settings.touchSens ?? 100) / 100 * touchLookScale;
  input.dx += dx * sensitivity;
  input.dy += dy * sensitivity;
}

function placeOrOpenShip(event: PointerEvent): void {
  const player = getGame()?.player;
  if (!player || player.inShip || player.visor) return;
  if (!player.tryOpenShipPanel(event.clientX, event.clientY)) player.placeBlock();
}

function finishLook(event: PointerEvent, placeOnRelease: boolean): void {
  if (event.pointerId !== lookPointer) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  releasePointer(element, event.pointerId);
  clearLongPressTimer();
  const shouldPlace = placeOnRelease && !lookMoved && !lookMining;
  stopMining();
  lookPointer = -1;
  if (shouldPlace) placeOrOpenShip(event);
}

function onLookEnd(event: PointerEvent): void {
  finishLook(event, true);
}

function onLookCancel(event: PointerEvent): void {
  finishLook(event, false);
}

function pressKey(code: string): void {
  const game = getGame();
  if (!game) return;
  game.input.keys[code] = true;
  if (code === 'Space') game.input.jumpPressed = true;
  game.onKey(code, new KeyboardEvent('keydown', { code }));
}
function releaseKey(code: string): void {
  const input = getGame()?.input;
  if (input) input.keys[code] = false;
}
function triggerKey(code: string): void {
  pressKey(code);
  window.setTimeout(() => releaseKey(code), 80);
}
function scanOrWarp(): void {
  triggerKey(getGame()?.player?.inShip ? 'KeyJ' : 'KeyC');
}

onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
});
</script>
