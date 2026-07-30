import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveGame,
  getGameIcon,
  getRuntimeGame,
  setActiveGame,
} from "../../runtime/game-runtime";

describe("game runtime boundary", () => {
  afterEach(() => {
    delete (window as unknown as { game?: unknown }).game;
  });

  it("owns the active engine registration and icon lookup", () => {
    const game = { atlas: { icon: vi.fn((id: string) => `/atlas/${id}`) } };
    setActiveGame(game as never);

    expect(getActiveGame()).toBe(game);
    expect(getGameIcon("ferrite")).toBe("/atlas/ferrite");
    expect(game.atlas.icon).toHaveBeenCalledWith("ferrite");
  });

  it("returns undefined safely before the lazy engine exists", () => {
    expect(getRuntimeGame<{ ready: boolean }>()).toBeUndefined();
    expect(getGameIcon("oxygen")).toBe("");
  });
});
