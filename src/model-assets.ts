/**
 * CC0 models live in `public/models/cc0/` and are served with the app.
 * Prefer same-origin paths so the models work offline and with the PWA.
 */
const CC0_DIR = `${import.meta.env.BASE_URL}models/cc0`.replace(/\/?$/, '');
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/lemonhub-io/voxel-horizon-demo@main/public/models/cc0';

export const CC0_MODEL_URLS = Object.freeze({
  ship: `${CC0_DIR}/quaternius-bob.gltf`,
  fauna: [
    `${CC0_DIR}/mc-wolf.gltf`,
    `${CC0_DIR}/mc-raccoon.gltf`,
    `${CC0_DIR}/mc-sheep.gltf`,
  ],
  rifle: `${CC0_DIR}/quaternius-scifi-assault-rifle.glb`,
  /** Quaternius Ultimate Modular Men humanoid spacesuit. */
  player: `${CC0_DIR}/modular-men-astronaut.glb`,
  /** Legacy CDN mirror for external tooling and packaging documentation. */
  cdn: Object.freeze({
    base: CDN_BASE,
    player: `${CDN_BASE}/modular-men-astronaut.glb`,
  }),
});

export const CC0_MODEL_ASSETS = Object.freeze([
  { id: 'ship', label: '飞船模型', url: CC0_MODEL_URLS.ship },
  { id: 'fauna-wolf', label: '狼生物模型', url: CC0_MODEL_URLS.fauna[0] },
  { id: 'fauna-raccoon', label: '浣熊生物模型', url: CC0_MODEL_URLS.fauna[1] },
  { id: 'fauna-sheep', label: '绵羊生物模型', url: CC0_MODEL_URLS.fauna[2] },
  { id: 'rifle', label: '步枪模型', url: CC0_MODEL_URLS.rifle },
  { id: 'player', label: '宇航员玩家模型', url: CC0_MODEL_URLS.player },
]);
