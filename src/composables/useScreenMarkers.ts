import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { getActiveGame } from '../runtime/game-runtime';

export interface WorldMarker {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
}

export interface ScreenMarker {
  id: string;
  type: string;
  sx: number;
  sy: number;
  opacity: number;
  dist: string;
}

interface MatrixLike {
  elements: ArrayLike<number>;
}

interface CameraLike {
  matrixWorldInverse: MatrixLike;
  projectionMatrix: MatrixLike;
}

function projectMarker(x: number, y: number, z: number, camera: CameraLike): { x: number; y: number; z: number } | null {
  const view = camera.matrixWorldInverse.elements;
  const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
  const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
  const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
  const vw = view[3] * x + view[7] * y + view[11] * z + view[15];
  const projection = camera.projectionMatrix.elements;
  const clipX = projection[0] * vx + projection[4] * vy + projection[8] * vz + projection[12] * vw;
  const clipY = projection[1] * vx + projection[5] * vy + projection[9] * vz + projection[13] * vw;
  const clipZ = projection[2] * vx + projection[6] * vy + projection[10] * vz + projection[14] * vw;
  const clipW = projection[3] * vx + projection[7] * vy + projection[11] * vz + projection[15] * vw;
  if (clipW <= 0) return null;
  return { x: clipX / clipW, y: clipY / clipW, z: clipZ / clipW };
}

/** Projects engine-space HUD markers and owns the throttled render-frame loop. */
export function useScreenMarkers(markers: Readonly<Ref<WorldMarker[]>>) {
  const screenMarkers = ref<ScreenMarker[]>([]);
  let frame = 0;
  let lastUpdate = 0;

  function update(): void {
    const engine = getActiveGame();
    const camera = engine?.camera as CameraLike | undefined;
    const playerPos = engine?.player?.pos;
    if (!camera || !playerPos || markers.value.length === 0) {
      if (screenMarkers.value.length) screenMarkers.value = [];
      return;
    }

    const width = innerWidth;
    const height = innerHeight;
    screenMarkers.value = markers.value.flatMap((marker) => {
      const point = projectMarker(marker.x, marker.y, marker.z, camera);
      if (!point || point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return [];
      const dx = marker.x - playerPos.x;
      const dy = marker.y - playerPos.y;
      const dz = marker.z - playerPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const opacity = Math.max(0, 1 - distance / 60);
      if (opacity <= 0) return [];
      return [{
        id: marker.id,
        type: marker.type,
        sx: (point.x * 0.5 + 0.5) * width,
        sy: (-point.y * 0.5 + 0.5) * height,
        opacity,
        dist: distance >= 1000 ? `${(distance / 1000).toFixed(1)}km` : `${Math.round(distance)}m`,
      }];
    });
  }

  function refresh(timestamp: number): void {
    if (timestamp - lastUpdate >= 1000 / 30) {
      lastUpdate = timestamp;
      update();
    }
    frame = requestAnimationFrame(refresh);
  }

  onMounted(() => {
    frame = requestAnimationFrame(refresh);
  });
  onUnmounted(() => cancelAnimationFrame(frame));

  return { screenMarkers };
}
