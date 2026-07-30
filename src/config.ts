// ============================================================
// config.ts — Game configuration with expanded crafting system
// ============================================================

import type { BlockDef, ItemDef, Recipe, Palette, MilestoneDef, Settings } from './types';

export const CFG = Object.freeze({
  VERSION: '1.0',
  CHUNK: 16,
  WORLD_H: 64,
  SEA: 29,
  DAY_LEN: 780,
  GRAVITY: 24,
  REACH: 6,
  /** Player height in voxels (exactly 2 blocks tall). */
  PLAYER_H: 2,
  /** Eye height from feet (slightly below top of capsule). */
  PLAYER_EYE: 1.75,
  /** Half-width of player collision on XZ. */
  PLAYER_R: 0.3,
  SAVE_KEY: 'voxelhorizon_save_v1',
  SET_KEY: 'voxelhorizon_settings_v1',
  /**
   * Cascaded Shadow Maps (WebGPU + TSL CSMShadowNode).
   * Near cascade: sharp block contact shadows; mid/far: broader, softer coverage.
   */
  CSM: Object.freeze({
    cascades: 3,
    /**
     * Custom splits (fractions of maxFar): near ~12%, mid ~40%, far 100%.
     * Better near texel density than pure practical with a tiny camera.near.
     */
    mode: 'custom' as const,
    /** Normalized cascade breaks (last must be 1). */
    breaks: Object.freeze([0.1, 0.35, 1] as const),
    mapSize: 2048,
    /** Orthographic depth range for each cascade light camera. */
    shadowNear: 0.5,
    shadowFar: 2000,
    /** Extra light-space depth so tall casters (trees/ship) still cast. */
    lightMargin: 120,
    /** Conservative bias — cascade 0 multiplies by 1, cascade 1 by 2, etc. */
    bias: -0.00006,
    normalBias: 0.03,
    /** Softness per cascade (PCF radius): sharp near → soft far. */
    radiusNear: 1.0,
    radiusMid: 1.75,
    radiusFar: 2.5,
    /** maxFar = clamp(dist * CHUNK * farScale, minFar, hardCap). */
    farScale: 2.8,
    minFar: 120,
    hardCap: 260,
    /** Sun light offset along sun direction from the shadow focus point. */
    lightDistance: 420,
  }),
  /**
   * Screen-space ambient occlusion (GTAO).
   * Enough contact shadow for voxels; keep intensity moderate to avoid mud.
   */
  SSAO: Object.freeze({
    enabled: true,
    resolutionScale: 0.5,
    samples: 12,
    /** ~0.4 blocks — crevices without large dark pools. */
    radius: 0.4,
    scale: 1.1,
    thickness: 1.0,
    distanceExponent: 1.15,
    distanceFallOff: 1.0,
    /** 0.65–0.75 reads natural on voxel terrain under soft sun. */
    intensity: 0.68,
  }),
  /** Master switch for the WebGPU cinematic RenderPipeline. */
  POST: Object.freeze({
    enabled: true,
  }),
  /**
   * Dynamic depth of field. The focus plane follows the reticle target with
   * a gentle response; coarse-pointer devices skip the pass by default.
   */
  DOF: Object.freeze({
    enabled: true,
    mobileEnabled: false,
    defaultFocus: 8,
    minFocus: 1.5,
    maxFocus: 16,
    focalLength: 7,
    bokehScale: 0.42,
    focusSmoothing: 8,
  }),
  /**
   * WebGPU terrain detail. Hardware tessellation stages are not part of
   * WebGPU, so opaque voxel faces are subdivided once while their chunk mesh
   * is built. POM remains desktop-first because it adds texture ray-marching.
   */
  TESSELLATION: Object.freeze({
    enabled: true,
    maxEdgeLength: 0.75,
    maxIterations: 1,
  }),
  POM: Object.freeze({
    enabled: true,
    mobileEnabled: false,
    layers: 6,
    heightScale: 0.015,
    minViewZ: 0.35,
    atlasCells: 8,
    edgeInset: 0.006,
  }),
  /**
   * Let native WebGPU remove CPU mesh churn where its command model is
   * available, while every other backend retains the established CPU path.
   */
  GPU_MESH: Object.freeze({
    mode: 'auto' as 'off' | 'auto' | 'force',
    maxJobsPerFrame: 2,
  }),
  /**
   * Bloom — only hot emissives (lamps / crystals / laser tips).
   * Threshold high enough that the soft LDR sky never blooms.
   */
  BLOOM: Object.freeze({
    enabled: true,
    strength: 0.18,
    radius: 0.35,
    threshold: 0.93,
  }),
  /**
   * Night readability (moon-fill). Day stays sun-driven; night leans on
   * hemi + ambient so terrain/UI stay legible without a pure black crush.
   */
  NIGHT: Object.freeze({
    /** Hemisphere fill when dayMix → 0 (moon/sky bounce). */
    hemiBase: 0.72,
    hemiNightBoost: 0.38,
    /** Ambient fill color (cool moonlight) and intensity curve. */
    ambientColor: '#3d5a82',
    ambientDay: 0.22,
    ambientNight: 0.78,
    /** Soft TSL sky night floor multiplier (was ~0.35, too crushed). */
    skyFloor: 0.58,
    /** Blend night fog toward horizon so mid-distance blocks stay readable. */
    fogHorizonMix: 0.62,
  }),
  /**
   * Cinematic grade balanced for:
   * - soft TSL sky (no HDR Preetham)
   * - ACES exposure ≈ 0.9
   * - FPS readability (vignette/grain stay subtle)
   *
   * Order in pipeline: contrast → sat → teal/orange split → gamma → gain → clip → vignette → grain → FXAA
   */
  /**
   * Restrained atmospheric scattering for the LDR TSL sky. Values are tuned
   * below HDR levels so the sun halo and aerial haze remain soft under ACES.
   */
  ATMOSPHERE: Object.freeze({
    rayleighStrength: 0.045,
    rayleighHorizonDensity: 0.34,
    mieStrength: 0.012,
    mieDirectionalG: 0.72,
    miePhaseCap: 7,
    mieHorizonDensity: 0.16,
    fogSunMix: 0.1,
    stormAttenuation: 0.72,
    skyCeiling: 1.12,
  }),
  CINEMATIC: Object.freeze({
    /** Mild S-curve; >1.1 feels crushed, <1.02 feels flat. */
    contrast: 1.05,
    /** Slight pop for biomes without looking cartoon. */
    saturation: 1.07,
    /** Slight mid lift (film toe); 0.97–1.0 is the safe band. */
    gamma: 0.98,
    /** Overall brightness after grade; 1.0 keeps ACES exposure honest. */
    gain: 1.02,
    /** Soft highlight ceiling so sky stays out of hard white. */
    clip: 1.1,
    /** Cool shadow lift (teal) — subtle, FPS-safe. */
    shadowLift: Object.freeze({ r: -0.008, g: 0.006, b: 0.016 }),
    /** Warm highlight push (orange) — very mild to avoid horizon cast. */
    highlightWarm: Object.freeze({ r: 0.01, g: 0.004, b: -0.003 }),
    /** Edge darkening; keep center of FOV clear for mining/aim. */
    vignetteStrength: 0.26,
    vignetteScale: 1.2,
    vignetteStart: 0.48,
    vignetteEnd: 1.15,
    /** Barely perceptible grain; higher fights soft sky look. */
    grain: 0.035,
    fxaa: true,
  }),
});

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7,
  GLASS: 8, ALLOY: 9, LAMP: 10, WATER: 11, TUFT: 12, PLANT: 13, NA_PLANT: 14,
  H_CRYS: 15, O_PLANT: 16, FERRITE: 17, COPPER: 18, BEDROCK: 19
};

export const T = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LOG_TOP: 6,
  LEAVES: 7, PLANKS: 8, GLASS: 9, ALLOY: 10, LAMP: 11, WATER: 12, TUFT: 13,
  PLANT: 14, NA: 15, H: 16, O2: 17, FERRITE: 18, COPPER: 19, BEDROCK: 20,
  CRACK0: 21, CRACK1: 22, CRACK2: 23
};

export const BLOCK_DEF: BlockDef[] = [];
BLOCK_DEF[B.AIR] = { name: '空气', solid: false };
BLOCK_DEF[B.GRASS] = { name: '苔原', solid: true, tiles: { top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT }, hard: 0.4, snd: 'grass', drops: [{ id: 'carbon', n: [1, 2] }] };
BLOCK_DEF[B.DIRT] = { name: '泥土', solid: true, tiles: { all: T.DIRT }, hard: 0.4, snd: 'grass', drops: [{ id: 'carbon', n: [1, 1] }] };
BLOCK_DEF[B.STONE] = { name: '岩石', solid: true, tiles: { all: T.STONE }, hard: 1.4, snd: 'stone', drops: [{ id: 'ferrite', n: [1, 3] }] };
BLOCK_DEF[B.SAND] = { name: '沙地', solid: true, tiles: { all: T.SAND }, hard: 0.38, snd: 'sand', drops: [{ id: 'sodium', n: [1, 2], p: 0.35 }] };
BLOCK_DEF[B.LOG] = { name: '原木', solid: true, tiles: { top: T.LOG_TOP, side: T.LOG, bottom: T.LOG_TOP }, hard: 1.1, snd: 'wood', drops: [{ id: 'carbon', n: [2, 4] }] };
BLOCK_DEF[B.LEAVES] = { name: '树叶', solid: true, cutout: true, tiles: { all: T.LEAVES }, hard: 0.2, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 2], p: 0.45 }] };
BLOCK_DEF[B.PLANKS] = { name: '木板', solid: true, tiles: { all: T.PLANKS }, hard: 0.55, snd: 'wood', drops: [{ id: 'carbon', n: [1, 2] }] };
BLOCK_DEF[B.GLASS] = { name: '玻璃', solid: true, glass: true, tiles: { all: T.GLASS }, hard: 0.3, snd: 'glass', drops: [{ id: 'sodium', n: [1, 1] }] };
BLOCK_DEF[B.ALLOY] = { name: '合金板', solid: true, tiles: { all: T.ALLOY }, hard: 2.8, snd: 'metal', drops: [{ id: 'ferrite', n: [2, 4] }] };
BLOCK_DEF[B.LAMP] = { name: '照明灯', solid: true, emissive: true, tiles: { all: T.LAMP }, hard: 0.4, snd: 'glass', drops: [{ id: 'sodium', n: [1, 2] }] };
BLOCK_DEF[B.WATER] = { name: '水', solid: false, water: true, tiles: { all: T.WATER } };
BLOCK_DEF[B.TUFT] = { name: '草丛', solid: false, cross: true, tiles: { all: T.TUFT }, hard: 0.12, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 1], p: 0.5 }], flora: true };
BLOCK_DEF[B.PLANT] = { name: '呼吸红花', solid: false, cross: true, tiles: { all: T.PLANT }, hard: 0.15, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 3] }], flora: true, scan: 'o2' };
BLOCK_DEF[B.NA_PLANT] = { name: '钠光花', solid: false, cross: true, tiles: { all: T.NA }, hard: 0.15, snd: 'grass', drops: [{ id: 'sodium', n: [1, 3] }], flora: true, scan: 'na' };
BLOCK_DEF[B.H_CRYS] = { name: '双氢晶簇', solid: false, cross: true, tiles: { all: T.H }, hard: 0.5, snd: 'crystal', drops: [{ id: 'dihydrogen', n: [2, 5] }], flora: true, scan: 'h2', emissive: true };
BLOCK_DEF[B.O_PLANT] = { name: '氧蕨', solid: false, cross: true, tiles: { all: T.O2 }, hard: 0.15, snd: 'grass', drops: [{ id: 'oxygen', n: [2, 4] }], flora: true, scan: 'o2' };
BLOCK_DEF[B.FERRITE] = { name: '铁屑岩', solid: true, tiles: { all: T.FERRITE }, hard: 1.8, snd: 'ferrite', drops: [{ id: 'ferrite', n: [2, 5] }], scan: 'fe' };
BLOCK_DEF[B.COPPER] = { name: '铜矿', solid: true, tiles: { all: T.COPPER }, hard: 2.2, snd: 'copper', drops: [{ id: 'copper', n: [2, 4] }], scan: 'cu' };
BLOCK_DEF[B.BEDROCK] = { name: '基岩', solid: true, tiles: { all: T.BEDROCK }, hard: Infinity, snd: 'stone' };

// ============================================================
// ITEMS — Raw elements → Refined materials → Advanced tech
// ============================================================
export const ITEMS: Record<string, ItemDef> = {
  // --- Raw Elements ---
  carbon:      { name: '碳', type: '元素', sym: 'C', col: '#7a7a7a', stack: 99, desc: '基础有机元素，来源于植物。' },
  ferrite:     { name: '铁尘', type: '元素', sym: 'Fe', col: '#c9825a', stack: 99, desc: '灰色金属粉末，来源于岩石。' },
  sodium:      { name: '钠', type: '元素', sym: 'Na', col: '#ffd166', stack: 99, desc: '黄色碱金属，可为防护充能。', use: 'hazard', useAmt: 22 },
  dihydrogen:  { name: '双氢', type: '元素', sym: 'H₂', col: '#6aaaf4', stack: 99, desc: '蓝色晶体燃料前驱体。' },
  oxygen:      { name: '氧', type: '元素', sym: 'O₂', col: '#ff8a7a', stack: 99, desc: '红色呼吸花提取物。', use: 'ls', useAmt: 22 },
  copper:      { name: '铜', type: '元素', sym: 'Cu', col: '#7de8c3', stack: 99, desc: '导电金属，来源于铜矿。' },
  biomass:     { name: '生物质', type: '有机物', col: '#6aaa5a', stack: 64, desc: '外星生物组织样本。' },

  // --- Refined Materials (Tier 1 crafted) ---
  metal_plate: { name: '金属镀层', type: '材料', col: '#c8cdd4', stack: 32, desc: '铁尘压制而成的装甲板。', glyph: 'plate' },
  nanotube:    { name: '碳纳米管', type: '材料', col: '#555a60', stack: 32, desc: '碳原子排列而成的高强度结构。', glyph: 'tube' },
  glass_sheet: { name: '玻璃板', type: '材料', col: '#a8d8e8', stack: 32, desc: '硅沙熔炼的透明板材。', glyph: 'plate' },
  cable:       { name: '导线', type: '材料', col: '#ffd166', stack: 32, desc: '铜拉制而成的导线。', glyph: 'tube' },

  // --- Advanced Tech (Tier 2 crafted) ---
  launch_fuel: { name: '启动燃料', type: '燃料', col: '#ff8a5c', stack: 1, desc: '飞船起飞所需燃料。', glyph: 'fuel' },
  warp_cell:   { name: '跃迁电池', type: '跃迁', col: '#8a7aff', stack: 3, desc: '星际跃迁引擎能量源。', glyph: 'warp' },
  microchip:   { name: '微芯片', type: '科技', col: '#66d9e8', stack: 16, desc: '导线与碳纳米管集成的处理器。', glyph: 'batt' },
  power_cell:  { name: '能量电池', type: '科技', col: '#9be564', stack: 8, desc: '双氢驱动的高密度储能单元。', glyph: 'batt' },

  // --- Survival Items ---
  sodium_cell: { name: '钠电池', type: '补给', col: '#ffd166', stack: 20, desc: '高效防护充能装置。+50防护', glyph: 'batt', use: 'hazard', useAmt: 50 },
  o2_canister: { name: '氧气罐', type: '补给', col: '#ff8a7a', stack: 20, desc: '压缩氧气容器。+50生命维持', glyph: 'o2c', use: 'ls', useAmt: 50 },
  medkit:      { name: '修复凝胶', type: '补给', col: '#7de8a0', stack: 10, desc: '外星生物修复凝胶。+60生命', glyph: 'med', use: 'hp', useAmt: 60 },

  // --- Building Blocks ---
  b_dirt:   { name: '泥土块', type: '建材', place: B.DIRT, stack: 64, desc: '最朴素的建材。' },
  b_stone:  { name: '岩石块', type: '建材', place: B.STONE, stack: 64, desc: '坚固的岩石。' },
  b_sand:   { name: '沙块', type: '建材', place: B.SAND, stack: 64, desc: '细腻的沙粒。' },
  b_log:    { name: '原木', type: '建材', place: B.LOG, stack: 64, desc: '异星树木躯干。' },
  b_planks: { name: '木板', type: '建材', place: B.PLANKS, stack: 64, desc: '加工后的板材。' },
  b_glass:  { name: '玻璃块', type: '建材', place: B.GLASS, stack: 64, desc: '透明玻璃。' },
  b_alloy:  { name: '合金块', type: '建材', place: B.ALLOY, stack: 64, desc: '星际标准建材。' },
  b_lamp:   { name: '灯柱', type: '建材', place: B.LAMP, stack: 64, desc: '恒久发光的灯柱。' },
};

// ============================================================
// RECIPES — No Man's Sky style: Raw → Refined → Advanced
// ============================================================
export const RECIPES: Recipe[] = [
  // --- Tier 1: Raw → Refined ---
  { id: 'metal_plate', out: 1, cat: '材料', req: [['ferrite', 30]], desc: '铁尘压制为金属镀层。' },
  { id: 'nanotube',    out: 1, cat: '材料', req: [['carbon', 40]], desc: '碳原子排列为纳米管。' },
  { id: 'glass_sheet', out: 1, cat: '材料', req: [['sodium', 10], ['ferrite', 5]], desc: '钠与铁尘熔炼为玻璃板。' },
  { id: 'cable',       out: 2, cat: '材料', req: [['copper', 12]], desc: '铜拉制为导线。' },

  // --- Tier 2: Refined → Advanced ---
  { id: 'microchip',   out: 1, cat: '科技', req: [['cable', 2], ['nanotube', 1]], desc: '导线与纳米管集成微芯片。' },
  { id: 'power_cell',  out: 1, cat: '科技', req: [['dihydrogen', 25], ['metal_plate', 1]], desc: '双氢驱动的高密度储能单元。' },
  { id: 'launch_fuel', out: 1, cat: '燃料', req: [['dihydrogen', 25]], desc: '双氢聚合为启动燃料。' },
  { id: 'warp_cell',   out: 1, cat: '跃迁', req: [['copper', 20], ['nanotube', 1], ['dihydrogen', 15]], desc: '组装跃迁电池。' },

  // --- Survival ---
  { id: 'sodium_cell', out: 1, cat: '补给', req: [['sodium', 8], ['ferrite', 5]], desc: '钠元素封装为高效防护电池。' },
  { id: 'o2_canister', out: 1, cat: '补给', req: [['oxygen', 8], ['ferrite', 5]], desc: '氧气压缩存储于金属容器。' },
  { id: 'medkit',      out: 1, cat: '补给', req: [['biomass', 12], ['oxygen', 6]], desc: '外星组织合成修复凝胶。' },

  // --- Building ---
  { id: 'b_planks', out: 4, cat: '建材', req: [['b_log', 1]], desc: '原木加工为板材。' },
  { id: 'b_glass',  out: 2, cat: '建材', req: [['b_sand', 3], ['carbon', 8]], desc: '硅沙熔炼为玻璃。' },
  { id: 'b_alloy',  out: 4, cat: '建材', req: [['ferrite', 35]], desc: '铁尘压制为合金板。' },
  { id: 'b_lamp',   out: 2, cat: '建材', req: [['carbon', 15], ['ferrite', 10], ['sodium', 5]], desc: '组装发光灯柱。' },
];

// ============================================================
// PALETTES — Planet biomes
// ============================================================
export const PALETTES: Palette[] = [
  {
    id: 'temperate', climate: '温带',
    grass: '#5abf74', grassAlt: '#4fae8e', dirt: '#8a6a4d', sand: '#d8c9a0',
    leaves: ['#3da566', '#69c98a', '#3f9e8e'], wood: '#7a5a40',
    skyDayTop: '#3a8fd4', skyDayHor: '#bfe4ee', skyNightTop: '#121c38', skyNightHor: '#2a4068',
    fogDay: '#c4e2e8', fogNight: '#1a2840', sun: '#fff2d0',
    water: '#2e7fa8', sea: true,
    hazard: { type: 'cold', label: '严寒', day: 0.05, night: 0.22, nightType: 'cold', nightLabel: '严寒' },
    storm: { chance: 0.35, label: '热浪风暴' },
    trees: { density: 0.014, types: ['blob', 'tall'] }, tuft: 0.09, plant: 0.02, na: 0.010, o2: 0.010, h2: 0.008, rock: 0.014,
    creatures: ['#8a6f5a', '#5f8a72', '#a08a50'], fauna: 4, floraLevel: '丰饶', stormLevel: '偶发'
  },
  {
    id: 'scorched', climate: '灼热',
    grass: '#c08a4a', grassAlt: '#b07040', dirt: '#8f5f3a', sand: '#e0b076',
    leaves: ['#c07a3a', '#d09a50'], wood: '#6f4a34',
    skyDayTop: '#c96a3f', skyDayHor: '#f2c58a', skyNightTop: '#1a0e1c', skyNightHor: '#4a2830',
    fogDay: '#e8bc8e', fogNight: '#2a1820', sun: '#ffd9a0',
    water: null, sea: false,
    hazard: { type: 'heat', label: '极端高温', day: 0.30, night: 0.10, nightType: 'heat', nightLabel: '余热' },
    storm: { chance: 0.75, label: '烈焰风暴' },
    trees: { density: 0.004, types: ['spire'] }, tuft: 0.03, plant: 0.012, na: 0.012, o2: 0.008, h2: 0.016, rock: 0.02,
    creatures: ['#b0764a', '#8f5a3a', '#caa060'], fauna: 3, floraLevel: '稀疏', stormLevel: '频繁'
  },
  {
    id: 'frozen', climate: '冰封',
    grass: '#cfe2ec', grassAlt: '#b8d4e2', dirt: '#7a8a96', sand: '#c2cdd6',
    leaves: ['#9fd3e8', '#c8ecf4', '#8fb8d8'], wood: '#5f6a78',
    skyDayTop: '#7aa8cc', skyDayHor: '#e8f2f8', skyNightTop: '#0e1828', skyNightHor: '#243e58',
    fogDay: '#dcecf4', fogNight: '#182838', sun: '#eef6ff',
    water: '#3a6f96', sea: true,
    hazard: { type: 'cold', label: '严寒', day: 0.22, night: 0.45, nightType: 'cold', nightLabel: '极寒' },
    storm: { chance: 0.6, label: '暴风雪' },
    trees: { density: 0.009, types: ['tall', 'blob'] }, tuft: 0.04, plant: 0.014, na: 0.010, o2: 0.010, h2: 0.014, rock: 0.016,
    creatures: ['#c8d8e0', '#8fa8b8', '#e8f0f4'], fauna: 3, floraLevel: '稀疏', stormLevel: '常见'
  },
  {
    id: 'exotic', climate: '异常',
    grass: '#a86ad0', grassAlt: '#8f5cc0', dirt: '#5f4470', sand: '#c8a0d8',
    leaves: ['#ff7ad9', '#8f5cff', '#e08aff'], wood: '#4a3860',
    skyDayTop: '#5d3f9e', skyDayHor: '#e8a9f4', skyNightTop: '#160a28', skyNightHor: '#3a2060',
    fogDay: '#caa6e8', fogNight: '#241438', sun: '#ffd9f4',
    water: '#6a4a9e', sea: true,
    hazard: { type: 'rad', label: '辐射', day: 0.18, night: 0.32, nightType: 'rad', nightLabel: '强辐射' },
    storm: { chance: 0.5, label: '辐射风暴' },
    trees: { density: 0.013, types: ['shroom', 'blob'] }, tuft: 0.07, plant: 0.022, na: 0.010, o2: 0.010, h2: 0.012, rock: 0.014,
    creatures: ['#b06ad4', '#e08aa0', '#6a5ac0'], fauna: 5, floraLevel: '奇异', stormLevel: '常见'
  },
];

export const MILESTONE_DEFS: MilestoneDef[] = [
  { key: 'walk', name: '行者', unit: 'm', tiers: [100, 500, 2000, 8000], subs: ['初行百里', '行者无疆', '远行者', '星际流浪者'] },
  { key: 'mined', name: '采集者', unit: '次', tiers: [10, 50, 200, 800], subs: ['初识矿物', '矿脉猎手', '采集大师', '星球矿工'] },
  { key: 'scans', name: '观察者', unit: '种', tiers: [1, 5, 12, 25], subs: ['初次记录', '博物学者', '万物皆明', '百科全书'] },
  { key: 'placed', name: '建造者', unit: '块', tiers: [5, 30, 100, 400], subs: ['初筑根基', '建造者', '建筑师', '星球塑造者'] },
  { key: 'warps', name: '跃迁者', unit: '次', tiers: [1, 3, 8, 20], subs: ['初次跃迁', '星际旅者', '跃迁大师', '银河行者'] },
  { key: 'crafted', name: '工匠', unit: '件', tiers: [5, 20, 60, 120], subs: ['初次合成', '工匠', '合成大师', '万物皆可造'] },
  { key: 'survive', name: '不灭者', unit: '秒', tiers: [120, 600, 1800, 5400], subs: ['存活两分钟', '十分钟', '半小时坚守', '与星球共存'] },
];

export const DEFAULT_SETTINGS: Settings = { master: 80, music: 60, sfx: 90, sens: 100, fov: 78, dist: 4, invert: false, touchSens: 100 };
