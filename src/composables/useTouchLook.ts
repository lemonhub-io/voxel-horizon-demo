import { onUnmounted } from 'vue';
import { getRuntimeGame } from '../runtime/game-runtime';
import type { TouchRuntimeGame } from './touch-input';

const LONG_PRESS_DELAY = 360;
const MOVE_THRESHOLD = 12;
const LOOK_SCALE = 2.3;

function releasePointer(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

/** Handles camera drag, mining hold and tap-to-place interactions. */
export function useTouchLook() {
  let pointerId = -1;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let moved = false;
  let mining = false;
  let longPressTimer: number | undefined;
  const game = (): TouchRuntimeGame | undefined => getRuntimeGame<TouchRuntimeGame>();

  function clearLongPressTimer(): void {
    if (longPressTimer === undefined) return;
    window.clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }

  function stopMining(): void {
    if (mining) {
      const input = game()?.input;
      if (input) input.buttons[0] = false;
    }
    mining = false;
  }

  function startMining(expectedPointerId: number): void {
    if (pointerId !== expectedPointerId || moved) return;
    const currentGame = game();
    const player = currentGame?.player;
    if (!currentGame || !player || player.inShip || player.visor) return;
    currentGame.input.buttons[0] = true;
    mining = true;
  }

  function start(event: PointerEvent): void {
    if (pointerId !== -1) return;
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    element.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    x = startX = event.clientX;
    y = startY = event.clientY;
    moved = false;
    mining = false;
    clearLongPressTimer();
    longPressTimer = window.setTimeout(() => startMining(event.pointerId), LONG_PRESS_DELAY);
  }

  function move(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return;
    const input = game()?.input;
    if (!input) return;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    x = event.clientX;
    y = event.clientY;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_THRESHOLD) {
      moved = true;
      clearLongPressTimer();
      stopMining();
    }
    const sensitivity = (game()?.settings.touchSens ?? 100) / 100 * LOOK_SCALE;
    input.dx += dx * sensitivity;
    input.dy += dy * sensitivity;
  }

  function placeOrOpenShip(event: PointerEvent): void {
    const player = game()?.player;
    if (!player || player.inShip || player.visor) return;
    if (!player.tryOpenShipPanel(event.clientX, event.clientY)) player.placeBlock();
  }

  function finish(event: PointerEvent, placeOnRelease: boolean): void {
    if (event.pointerId !== pointerId) return;
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    releasePointer(element, event.pointerId);
    clearLongPressTimer();
    const shouldPlace = placeOnRelease && !moved && !mining;
    stopMining();
    pointerId = -1;
    if (shouldPlace) placeOrOpenShip(event);
  }

  onUnmounted(() => {
    clearLongPressTimer();
    stopMining();
  });

  return {
    start,
    move,
    end: (event: PointerEvent) => finish(event, true),
    cancel: (event: PointerEvent) => finish(event, false),
  };
}
