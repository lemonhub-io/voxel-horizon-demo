const CDN_BASE = 'https://cdn.jsdelivr.net/gh/lemonhub-io/voxel-horizon-demo@main/public/models/cc0';

export const CC0_MODEL_URLS = Object.freeze({
  ship: `${CDN_BASE}/quaternius-bob.gltf`,
  fauna: [
    `${CDN_BASE}/quaternius-alien.gltf`,
    `${CDN_BASE}/quaternius-crab.gltf`,
    `${CDN_BASE}/quaternius-deer.gltf`
  ],
  rifle: `${CDN_BASE}/quaternius-scifi-assault-rifle.glb`
});

export const CC0_MODEL_ASSETS = Object.freeze([
  { id: 'ship', label: '飞船模型', url: CC0_MODEL_URLS.ship },
  { id: 'fauna-alien', label: '异星生物模型', url: CC0_MODEL_URLS.fauna[0] },
  { id: 'fauna-crab', label: '甲壳生物模型', url: CC0_MODEL_URLS.fauna[1] },
  { id: 'fauna-deer', label: '四足生物模型', url: CC0_MODEL_URLS.fauna[2] },
  { id: 'rifle', label: '步枪模型', url: CC0_MODEL_URLS.rifle }
]);