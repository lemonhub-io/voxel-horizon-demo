<template>
  <div v-if="isTouch" id="touch-controls" aria-label="触控操作">
    <div
      id="touch-look-zone"
      @pointerdown.prevent="onLookStart"
      @pointermove.prevent="onLookMove"
      @pointerup.prevent="onLookEnd"
      @pointercancel.prevent="onLookEnd"
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

    <div id="touch-actions" aria-label="游戏操作">
      <button class="touch-btn touch-btn-primary" aria-label="持续采集或攻击" @pointerdown.prevent="pressButton(0)" @pointerup.prevent="releaseButton(0)" @pointercancel.prevent="releaseButton(0)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M7.1 7.1l2.8 2.8m4.2 4.2l2.8 2.8m0-9.7-2.8 2.8m-4.2 4.2-2.8 2.8"/><circle cx="12" cy="12" r="3.4"/></svg></button>
      <button class="touch-btn touch-btn-jump" aria-label="跳跃或喷气" @pointerdown.prevent="pressKey('Space')" @pointerup.prevent="releaseKey('Space')" @pointercancel.prevent="releaseKey('Space')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5m0 0-5 5m5-5 5 5M5 21h14"/></svg></button>
      <button class="touch-btn" aria-label="交互或降落" @pointerdown.prevent="pressKey('KeyE')" @pointerup.prevent="releaseKey('KeyE')" @pointercancel.prevent="releaseKey('KeyE')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10v18H5zM15 12h5m-2-3 3 3-3 3M10 12h.01"/></svg></button>
      <button class="touch-btn" aria-label="放置方块" @pointerdown.prevent="placeBlock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4v10l-7 4-7-4V7zM5 7l7 4 7-4m-7 4v10"/></svg></button>
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
}
interface RuntimeGame {
  input: TouchInput;
  settings: { touchSens: number };
  player?: { inShip: boolean; visor: boolean; placeBlock: () => void };
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
let joyPointer = -1;
let lastJoyTap = 0;
let joyCenterX = 0;
let joyCenterY = 0;
let lookPointer = -1;
let lookX = 0;
let lookY = 0;
let lookMoved = false;

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
  setTimeout(() => { joySnapping.value = false; }, 120);
}

function onLookStart(event: PointerEvent): void {
  if (lookPointer !== -1) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  element.setPointerCapture(event.pointerId);
  lookPointer = event.pointerId;
  lookX = event.clientX;
  lookY = event.clientY;
  lookMoved = false;
}

function onLookMove(event: PointerEvent): void {
  if (event.pointerId !== lookPointer) return;
  const input = getGame()?.input;
  if (!input) return;
  const dx = event.clientX - lookX;
  const dy = event.clientY - lookY;
  lookX = event.clientX;
  lookY = event.clientY;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) lookMoved = true;
  const sensitivity = (getGame()?.settings.touchSens ?? 100) / 100 * 0.78;
  input.dx += dx * sensitivity;
  input.dy += dy * sensitivity;
}

function onLookEnd(event: PointerEvent): void {
  if (event.pointerId !== lookPointer) return;
  const element = event.currentTarget;
  if (!(element instanceof HTMLElement)) return;
  releasePointer(element, event.pointerId);
  if (!lookMoved) tapMine();
  lookPointer = -1;
}

function pressKey(code: string): void {
  const game = getGame();
  if (!game) return;
  game.input.keys[code] = true;
  if (code === 'Space') game.input.jumpPressed = true;
  game.onKey(code, new KeyboardEvent('keydown', { code }));
}
function releaseKey(code: string): void { const input = getGame()?.input; if (input) input.keys[code] = false; }
function triggerKey(code: string): void {
  pressKey(code);
  setTimeout(() => releaseKey(code), 80);
}
function scanOrWarp(): void { triggerKey(getGame()?.player?.inShip ? 'KeyJ' : 'KeyC'); }
function pressButton(button: number): void { const input = getGame()?.input; if (input) input.buttons[button] = true; }
function releaseButton(button: number): void { const input = getGame()?.input; if (input) input.buttons[button] = false; }
function tapMine(): void { pressButton(0); setTimeout(() => releaseButton(0), 140); }
function placeBlock(): void {
  const player = getGame()?.player;
  if (player && !player.inShip && !player.visor) player.placeBlock();
}

onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
});
</script>
