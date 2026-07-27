<template>
  <div v-if="isTouch" id="touch-controls">
    <!-- Full-screen camera look + tap-to-mine zone (base layer) -->
    <div
      id="touch-look-zone"
      @pointerdown.prevent="onLookStart"
      @pointermove.prevent="onLookMove"
      @pointerup.prevent="onLookEnd"
      @pointercancel.prevent="onLookEnd"
    >
      <div id="touch-look-indicator" :class="{ active: lookActive }"></div>
    </div>

    <!-- Left joystick area (movement) — on top of look zone -->
    <div
      id="touch-joy-zone"
      @pointerdown.prevent="onJoyStart"
      @pointermove.prevent="onJoyMove"
      @pointerup.prevent="onJoyEnd"
      @pointercancel.prevent="onJoyEnd"
    >
      <div id="touch-joy-base" :class="{ active: joyActive, fadeout: joyFading }" :style="joyBaseStyle">
        <div id="touch-joy-thumb" :class="{ snap: joySnapping }" :style="joyThumbStyle"></div>
      </div>
    </div>

    <!-- Action buttons (on top of look zone) -->
    <div id="touch-actions">
      <button class="touch-btn touch-btn-jump" @pointerdown.prevent="pressKey('Space')" @pointerup.prevent="releaseKey('Space')" @pointercancel.prevent="releaseKey('Space')">
        <span>跳</span>
      </button>
      <button class="touch-btn touch-btn-interact" @pointerdown.prevent="pressKey('KeyE')" @pointerup.prevent="releaseKey('KeyE')" @pointercancel.prevent="releaseKey('KeyE')">
        <span>E</span>
      </button>
      <button class="touch-btn touch-btn-mine" @pointerdown.prevent="pressBtn(0)" @pointerup.prevent="releaseBtn(0)" @pointercancel.prevent="releaseBtn(0)">
        <span>采</span>
      </button>
      <button class="touch-btn touch-btn-place" @pointerdown.prevent="onPlace">
        <span>放</span>
      </button>
    </div>

    <!-- Top bar: inventory / pause -->
    <div id="touch-top-bar">
      <button class="touch-top-btn" @pointerdown.prevent="onInventory">背 包</button>
      <button class="touch-top-btn" @pointerdown.prevent="onPause">暂 停</button>
    </div>

    <!-- Sprint indicator -->
    <div id="touch-sprint-indicator" :class="{ active: sprintActive }">疾跑</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Input } from '../main';

const isTouch = ref(false);
const joyBaseX = ref(0);
const joyBaseY = ref(0);
const joyThumbX = ref(0);
const joyThumbY = ref(0);
const joyActive = ref(false);
const joyFading = ref(false);
const joySnapping = ref(false);
const lookActive = ref(false);
const sprintActive = ref(false);
const joyRadius = 60;

// Dead zone + response curve constants
const DEAD_ZONE = 0.15; // 15% inner radius → no output
const CURVE_POWER = 1.4; // >1 = ease-out (precise small movements, quick ramp to max)

const joyBaseStyle = computed(() => ({
  left: `${joyBaseX.value}px`,
  top: `${joyBaseY.value}px`,
}));

const joyThumbStyle = computed(() => ({
  transform: `translate(${joyThumbX.value}px, ${joyThumbY.value}px)`,
}));

// ===== Movement joystick (semi-fixed, dead zone, non-linear curve) =====

function onJoyStart(e: PointerEvent): void {
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  // Cancel any in-progress fade-out / snap animation
  joyFading.value = false;
  joySnapping.value = false;

  // Semi-fixed: base snaps to touch position
  joyBaseX.value = e.clientX - joyRadius;
  joyBaseY.value = e.clientY - joyRadius;
  joyThumbX.value = 0;
  joyThumbY.value = 0;
  joyActive.value = true;
  Input.moveActive = true;
  Input.moveX = 0;
  Input.moveY = 0;

  const now = Date.now();
  if (now - _lastJoyTap < 350) {
    sprintActive.value = !sprintActive.value;
    _sprintToggled = sprintActive.value;
  }
  _lastJoyTap = now;
}
let _lastJoyTap = 0;

function onJoyMove(e: PointerEvent): void {
  const cx = joyBaseX.value + joyRadius;
  const cy = joyBaseY.value + joyRadius;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dist > 0.001 ? dx / dist : 0;
  const ny = dist > 0.001 ? dy / dist : 0;

  // Visual thumb: follows finger exactly, clamped to radius
  const visualClamp = Math.min(dist, joyRadius);
  joyThumbX.value = nx * visualClamp;
  joyThumbY.value = ny * visualClamp;

  // Output: dead zone → non-linear curve
  const rawMag = Math.min(dist / joyRadius, 1.0);
  let effective: number;
  if (rawMag <= DEAD_ZONE) {
    effective = 0;
  } else {
    // Remap from [DEAD_ZONE, 1.0] → [0, 1.0]
    const t = (rawMag - DEAD_ZONE) / (1.0 - DEAD_ZONE);
    effective = Math.pow(t, CURVE_POWER);
  }
  Input.moveX = nx * effective;
  Input.moveY = ny * effective;

  // Sprint: triggered by far-forward push (not toggle)
  sprintActive.value = sprintActive.value || (Input.moveY < -0.85 && Math.abs(Input.moveX) < 0.4);
}

function onJoyEnd(e: PointerEvent): void {
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  Input.moveActive = false;
  Input.moveX = 0;
  Input.moveY = 0;

  if (sprintActive.value && !_sprintToggled) {
    sprintActive.value = false;
  }
  _sprintToggled = false;

  // Strong snap: animate thumb back to center via CSS transition
  joySnapping.value = true;
  joyThumbX.value = 0;
  joyThumbY.value = 0;

  // Fade out base after snap completes
  joyFading.value = true;
  joyActive.value = false;

  // Clean up snap class after transition (100ms matches CSS)
  setTimeout(() => {
    joySnapping.value = false;
    joyFading.value = false;
  }, 110);
}
let _sprintToggled = false;

// ===== Camera look (full-screen, base layer) =====

let _lookPointerId = -1;
let _lookLastX = 0;
let _lookLastY = 0;
let _lookMoved = false;

function onLookStart(e: PointerEvent): void {
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  _lookPointerId = e.pointerId;
  _lookLastX = e.clientX;
  _lookLastY = e.clientY;
  _lookMoved = false;
  lookActive.value = true;
}

function onLookMove(e: PointerEvent): void {
  if (e.pointerId !== _lookPointerId) return;
  const dx = e.clientX - _lookLastX;
  const dy = e.clientY - _lookLastY;
  _lookLastX = e.clientX;
  _lookLastY = e.clientY;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) _lookMoved = true;
  Input.dx += dx * Input.touchLookSensitivity;
  Input.dy += dy * Input.touchLookSensitivity;
}

function onLookEnd(e: PointerEvent): void {
  if (e.pointerId !== _lookPointerId) return;
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  if (!_lookMoved) {
    Input.buttons[0] = true;
    setTimeout(() => { Input.buttons[0] = false; }, 150);
  }
  _lookPointerId = -1;
  lookActive.value = false;
}

// ===== Action button helpers =====

function pressKey(code: string): void {
  Input.keys[code] = true;
  const engine = (window as unknown as { game: { onKey: (code: string, e: KeyboardEvent) => void } }).game;
  if (engine?.onKey) {
    try { engine.onKey(code, new KeyboardEvent('keydown', { code })); } catch { /* ignore */ }
  }
}

function releaseKey(code: string): void {
  Input.keys[code] = false;
}

function pressBtn(btn: number): void {
  Input.buttons[btn] = true;
}

function releaseBtn(btn: number): void {
  Input.buttons[btn] = false;
}

function onPlace(): void {
  Input.buttons[2] = true;
  setTimeout(() => { Input.buttons[2] = false; }, 80);
  const engine = (window as unknown as { game: { player: { placeBlock: () => void } } }).game;
  if (engine?.player?.placeBlock) {
    try { engine.player.placeBlock(); } catch { /* ignore */ }
  }
}

function onInventory(): void {
  const engine = (window as unknown as { game: { onKey: (code: string, e: KeyboardEvent) => void } }).game;
  if (engine?.onKey) {
    try { engine.onKey('Tab', new KeyboardEvent('keydown', { code: 'Tab' })); } catch { /* ignore */ }
  }
}

function onPause(): void {
  const engine = (window as unknown as { game: { onKey: (code: string, e: KeyboardEvent) => void } }).game;
  if (engine?.onKey) {
    try { engine.onKey('Escape', new KeyboardEvent('keydown', { code: 'Escape' })); } catch { /* ignore */ }
  }
}

onMounted(() => {
  isTouch.value = Input.isTouchDevice;
});
</script>
