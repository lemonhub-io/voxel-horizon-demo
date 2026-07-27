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
