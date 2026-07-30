import type { OfficialRoom } from './OfficialRoom';
import type { PlanetRoom } from './PlanetRoom';
import type { RoomDirectory } from './RoomDirectory';

/** Bindings supplied by the multiplayer Worker deployment. */
export interface Env {
  PLANET_ROOM: DurableObjectNamespace<PlanetRoom>;
  ROOM_DIRECTORY: DurableObjectNamespace<RoomDirectory>;
  OFFICIAL_ROOM: DurableObjectNamespace<OfficialRoom>;
  WORLD_SAVES?: R2Bucket;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
}
