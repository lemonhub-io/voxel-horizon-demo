import type { Game } from './main';

let gamePromise: Promise<Game> | null = null;

/** Load the renderer and game engine only when gameplay is requested. */
export function loadGame(): Promise<Game> {
  if (!gamePromise) {
    gamePromise = (async () => {
      const { Game: GameEngine } = await import('./main');
      const game = new GameEngine();
      (window as unknown as { game: Game }).game = game;
      await game.ready;
      return game;
    })();
  }
  return gamePromise;
}
