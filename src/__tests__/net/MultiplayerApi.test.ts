import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiplayerApi } from "../../net/MultiplayerApi";

describe("MultiplayerApi", () => {
  const api = new MultiplayerApi("https://multiplayer.test");

  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps room discovery outside the WebSocket transport", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rooms: [{ roomId: "room-a", playerCount: 1 }] }),
    } as Response);

    await expect(api.listPublicRooms()).resolves.toEqual([
      { roomId: "room-a", playerCount: 1 },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://multiplayer.test/api/public/rooms",
    );
  });

  it("validates room allocation responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        roomId: "room-a",
        wsPath: "/ws?room=room-a",
      }),
    } as Response);
    await expect(api.createRoom()).resolves.toEqual({
      roomId: "room-a",
      wsPath: "/ws?room=room-a",
    });

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);
    await expect(api.createRoom()).rejects.toThrow("503");
  });

  it("normalizes an official status while preserving a supplied WebSocket path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        roomId: "official-main",
        wsPath: "/ws?room=official-main",
        live: true,
      }),
    } as Response);

    await expect(api.getOfficialStatus()).resolves.toMatchObject({
      roomId: "official-main",
      wsPath: "/ws?room=official-main",
      mode: "official",
      maxPlayers: 8,
    });
  });
});
