/**
 * Multiplayer Worker entry point. Route handling and official-world status
 * discovery live in focused modules so Durable Object exports stay explicit.
 */
import type { Env } from './env';
import { handleRequest } from './router';

export { OfficialRoom } from './OfficialRoom';
export { PlanetRoom } from './PlanetRoom';
export { RoomDirectory } from './RoomDirectory';
export type { Env } from './env';

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
