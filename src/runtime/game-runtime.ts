import type { Game } from "../types";

/**
 * Single browser boundary for the lazily-created engine instance.
 * UI modules depend on this small contract instead of reading window globals.
 */
export function getActiveGame(): Game | undefined {
  return window.game;
}

/** Register the engine after lazy initialization. */
export function setActiveGame(game: Game): void {
  window.game = game;
}

/** Read a procedural atlas icon without exposing the complete engine to a view. */
export function getGameIcon(id: string): string {
  return getActiveGame()?.atlas.icon(id) || "";
}

/**
 * Adapts narrowly typed runtime contracts used by low-level input/UI modules.
 * Keep this at the boundary while the engine's public Game interface evolves.
 */
export function getRuntimeGame<T>(): T | undefined {
  return getActiveGame() as T | undefined;
}
