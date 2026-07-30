import type { Game } from './main';
import { setActiveGame } from './runtime/game-runtime';

let gamePromise: Promise<Game> | null = null;

/**
 * Keep the engine behind this boundary so title, help, and save management do
 * not force Three.js/WebGPU into the initial UI bundle.
 */
export function loadGame(): Promise<Game> {
  if (!gamePromise) {
    // Several UI actions can request startup before the import resolves; sharing
    // this promise prevents duplicate renderers and competing global input hooks.
    gamePromise = (async () => {
      const { Game: GameEngine } = await import('./main');
      const game = new GameEngine();
      setActiveGame(game);
      await game.ready;
      return game;
    })();
  }
  return gamePromise;
}
