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

    <div id="touch-actions" :class="{ flight: isInShip }" :aria-label="isInShip ? '飞船操作' : '移动操作'">
      <template v-if="isInShip">
        <button class="touch-btn touch-btn-boost" aria-label="按住加速" @pointerdown.prevent="pressKey('Space')" @pointerup.prevent="releaseKey('Space')" @pointercancel.prevent="releaseKey('Space')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5-7 5 7M8 21h8M9 17l-2 4m8-4 2 4"/></svg>
        </button>
        <button class="touch-btn touch-btn-land" aria-label="着陆" @pointerdown.prevent="triggerKey('KeyE')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0-4-4m4 4 4-4M4 19h16M7 16l-2 3m12-3 2 3"/></svg>
        </button>
        <button class="touch-btn touch-btn-warp" aria-label="跃迁" @pointerdown.prevent="triggerKey('KeyJ')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1"/><path d="M12 12 21 3"/></svg>
        </button>
      </template>
      <button v-else class="touch-btn touch-btn-jump" aria-label="跳跃或喷气" @pointerdown.prevent="pressKey('Space')" @pointerup.prevent="releaseKey('Space')" @pointercancel.prevent="releaseKey('Space')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5m0 0-5 5m5-5 5 5M5 21h14"/></svg>
      </button>
    </div>

    <div id="touch-utilities" aria-label="功能操作">
      <template v-if="!isInShip">
        <button class="touch-utility-btn" aria-label="扫描脉冲" @pointerdown.prevent="triggerKey('KeyC')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1"/><path d="M12 12 21 3"/></svg></button>
        <button class="touch-utility-btn" aria-label="分析目镜" @pointerdown.prevent="triggerKey('KeyF')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.5"/></svg></button>
        <button class="touch-utility-btn" aria-label="打开背包" @pointerdown.prevent="triggerKey('Tab')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14v12H5zM8 8V5h8v3M9 13h6"/></svg></button>
      </template>
      <button class="touch-utility-btn" aria-label="暂停游戏" @pointerdown.prevent="triggerKey('Escape')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg></button>
    </div>
    <div id="touch-sprint-indicator" :class="{ active: sprintActive }" :aria-label="sprintActive ? '疾跑已开启' : '双击摇杆切换疾跑'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 11h6l-1 9 9-13h-6z"/></svg></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePlayerStore } from '../stores/playerStore';
import { getRuntimeGame } from '../runtime/game-runtime';
import { useTouchJoystick } from '../composables/useTouchJoystick';
import { useTouchLook } from '../composables/useTouchLook';
import type { TouchRuntimeGame } from '../composables/touch-input';

const isTouch = ref(false);
const playerStore = usePlayerStore();
const isInShip = computed(() => playerStore.inShip);
const {
  active: joyActive,
  snapping: joySnapping,
  sprintActive,
  baseStyle: joyBaseStyle,
  thumbStyle: joyThumbStyle,
  start: onJoyStart,
  move: onJoyMove,
  end: onJoyEnd,
} = useTouchJoystick();
const {
  start: onLookStart,
  move: onLookMove,
  end: onLookEnd,
  cancel: onLookCancel,
} = useTouchLook();

function pressKey(code: string): void {
  const game = getRuntimeGame<TouchRuntimeGame>();
  if (!game) return;
  game.input.keys[code] = true;
  if (code === 'Space') game.input.jumpPressed = true;
  game.onKey(code, new KeyboardEvent('keydown', { code }));
}
function releaseKey(code: string): void {
  const input = getRuntimeGame<TouchRuntimeGame>()?.input;
  if (input) input.keys[code] = false;
}
function triggerKey(code: string): void {
  pressKey(code);
  window.setTimeout(() => releaseKey(code), 80);
}

onMounted(() => {
  isTouch.value = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
});
</script>
