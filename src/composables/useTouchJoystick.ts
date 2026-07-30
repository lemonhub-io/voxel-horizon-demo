import { computed, onUnmounted, ref } from 'vue';
import { getRuntimeGame } from '../runtime/game-runtime';
import type { TouchInput, TouchRuntimeGame } from './touch-input';

const JOYSTICK_RADIUS = 58;

function releasePointer(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

function syncFlightThrottle(input: TouchInput, shipActive: boolean): void {
  if (!shipActive) return;
  input.keys.KeyW = input.moveY < -0.15;
  input.keys.KeyS = input.moveY > 0.15;
}

/** Manages movement, sprint and throttle state for the virtual joystick. */
export function useTouchJoystick() {
  const active = ref(false);
  const snapping = ref(false);
  const sprintActive = ref(false);
  const baseX = ref(0);
  const baseY = ref(0);
  const thumbX = ref(0);
  const thumbY = ref(0);
  let pointerId = -1;
  let lastTap = 0;
  let centerX = 0;
  let centerY = 0;
  let snapTimer: number | undefined;

  const baseStyle = computed(() => ({ left: `${baseX.value}px`, top: `${baseY.value}px` }));
  const thumbStyle = computed(() => ({ transform: `translate(${thumbX.value}px, ${thumbY.value}px)` }));
  const game = (): TouchRuntimeGame | undefined => getRuntimeGame<TouchRuntimeGame>();

  function start(event: PointerEvent): void {
    if (pointerId !== -1) return;
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    element.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    const bounds = element.getBoundingClientRect();
    centerX = event.clientX;
    centerY = event.clientY;
    baseX.value = event.clientX - bounds.left - JOYSTICK_RADIUS;
    baseY.value = event.clientY - bounds.top - JOYSTICK_RADIUS;
    thumbX.value = 0;
    thumbY.value = 0;
    active.value = true;
    snapping.value = false;
    const input = game()?.input;
    if (!input) return;
    input.moveActive = true;
    input.moveX = input.moveY = 0;
    const now = performance.now();
    if (now - lastTap < 320) {
      input.touchSprint = !input.touchSprint;
      sprintActive.value = input.touchSprint;
    }
    lastTap = now;
  }

  function move(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const input = game()?.input;
    if (!input) return;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const nx = distance > 0.001 ? dx / distance : 0;
    const ny = distance > 0.001 ? dy / distance : 0;
    const visualDistance = Math.min(distance, JOYSTICK_RADIUS);
    thumbX.value = nx * visualDistance;
    thumbY.value = ny * visualDistance;
    const raw = Math.min(distance / JOYSTICK_RADIUS, 1);
    const strength = raw <= 0.14 ? 0 : Math.pow((raw - 0.14) / 0.86, 1.35);
    input.moveX = nx * strength;
    input.moveY = ny * strength;
    const shipActive = game()?.player?.inShip ?? false;
    syncFlightThrottle(input, shipActive);
    if (!shipActive && input.moveY < -0.88 && Math.abs(input.moveX) < 0.38) sprintActive.value = true;
  }

  function end(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    releasePointer(element, event.pointerId);
    const input = game()?.input;
    if (input) {
      input.moveActive = false;
      input.moveX = input.moveY = 0;
      input.keys.KeyW = false;
      input.keys.KeyS = false;
    }
    pointerId = -1;
    active.value = false;
    snapping.value = true;
    thumbX.value = thumbY.value = 0;
    if (input && !input.touchSprint) sprintActive.value = false;
    snapTimer = window.setTimeout(() => {
      snapping.value = false;
      snapTimer = undefined;
    }, 120);
  }

  onUnmounted(() => {
    if (snapTimer !== undefined) window.clearTimeout(snapTimer);
  });

  return { active, snapping, sprintActive, baseStyle, thumbStyle, start, move, end };
}
