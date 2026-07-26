// ============================================================
// config.ts — Pure data declarations (identical to config.js)
// ============================================================

import type { BlockDef, ItemDef, Recipe, Palette, MilestoneDef, Settings } from './types';

export const CFG = {
  VERSION: '0.9.2',
  CHUNK: 16,
  WORLD_H: 64,
  SEA: 22,
  DAY_LEN: 360,
  GRAVITY: 22,
  REACH: 6.2,
  SAVE_KEY: 'vh_save_v1',
  SET_KEY: 'vh_settings'
};

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  GLASS: 8,
  ALLOY: 9,
  LAMP: 10,
  WATER: 11,
  TUFT: 12,
  PLANT: 13,
  NA_PLANT: 14,
  H_CRYS: 15,
  O_PLANT: 16,
  FERRITE: 17,
  COPPER: 18,
  BEDROCK: 19
};

export const T = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LOG_TOP: 6,
  LEAVES: 7,
  PLANKS: 8,
  GLASS: 9,
  ALLOY: 10,
  LAMP: 11,
  WATER: 12,
  TUFT: 13,
  PLANT: 14,
  NA: 15,
  H: 16,
  O2: 17,
  FERRITE: 18,
  COPPER: 19,
  BEDROCK: 20,
  CRACK0: 21,
  CRACK1: 22,
  CRACK2: 23
};

export const BLOCK_DEF: BlockDef[] = [
  /* 0 AIR */       { name: '空气', solid: false },
  /* 1 GRASS */     { name: '草方块', solid: true, tiles: { top: T.GRASS_TOP, side: T.GRASS_SIDE, bottom: T.DIRT }, snd: 'grass', drops: [{ id: 'carbon', n: [1, 2] }] },
  /* 2 DIRT */      { name: '泥土', solid: true, tiles: { all: T.DIRT }, snd: 'grass', drops: [{ id: 'carbon', n: [1, 1] }] },
  /* 3 STONE */     { name: '岩石', solid: true, tiles: { all: T.STONE }, hard: 1.4, snd: 'stone', drops: [{ id: 'ferrite', n: [1, 3] }] },
  /* 4 SAND */      { name: '沙地', solid: true, tiles: { all: T.SAND }, snd: 'sand', drops: [{ id: 'sodium', n: [1, 2], p: 0.35 }] },
  /* 5 LOG */       { name: '原木', solid: true, tiles: { all: T.LOG }, hard: 1.1, snd: 'wood', drops: [{ id: 'carbon', n: [2, 4] }] },
  /* 6 LEAVES */    { name: '树叶', solid: true, tiles: { all: T.LEAVES }, cutout: true, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 2], p: 0.45 }] },
  /* 7 PLANKS */    { name: '木板', solid: true, tiles: { all: T.PLANKS }, snd: 'wood', drops: [{ id: 'carbon', n: [1, 2] }] },
  /* 8 GLASS */     { name: '玻璃', solid: true, tiles: { all: T.GLASS }, glass: true, snd: 'glass', drops: [{ id: 'sodium', n: [1, 1] }] },
  /* 9 ALLOY */     { name: '合金板', solid: true, tiles: { all: T.ALLOY }, hard: 2.8, snd: 'metal', drops: [{ id: 'ferrite', n: [2, 4] }] },
  /* 10 LAMP */     { name: '照明灯', solid: true, tiles: { all: T.LAMP }, emissive: true, snd: 'glass', drops: [{ id: 'sodium', n: [1, 2] }] },
  /* 11 WATER */    { name: '水', solid: false, tiles: { all: T.WATER }, water: true },
  /* 12 TUFT */     { name: '草丛', solid: false, tiles: { all: T.TUFT }, cross: true, flora: true, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 1], p: 0.5 }] },
  /* 13 PLANT */    { name: '呼吸红花', solid: false, tiles: { all: T.PLANT }, cross: true, flora: true, snd: 'grass', drops: [{ id: 'oxygen', n: [1, 3] }], scan: 'o2' },
  /* 14 NA_PLANT */ { name: '钠光花', solid: false, tiles: { all: T.NA }, cross: true, flora: true, snd: 'grass', drops: [{ id: 'sodium', n: [1, 3] }], scan: 'na' },
  /* 15 H_CRYS */   { name: '双氢晶簇', solid: false, tiles: { all: T.H }, cross: true, snd: 'crystal', drops: [{ id: 'dihydrogen', n: [2, 5] }], scan: 'h2', emissive: true },
  /* 16 O_PLANT */  { name: '氧蕨', solid: false, tiles: { all: T.O2 }, cross: true, flora: true, snd: 'grass', drops: [{ id: 'oxygen', n: [2, 4] }], scan: 'o2' },
  /* 17 FERRITE */  { name: '铁屑岩', solid: true, tiles: { all: T.FERRITE }, hard: 1.8, snd: 'stone', drops: [{ id: 'ferrite', n: [2, 5] }], scan: 'fe' },
  /* 18 COPPER */   { name: '铜矿', solid: true, tiles: { all: T.COPPER }, hard: 2.2, snd: 'stone', drops: [{ id: 'copper', n: [2, 4] }], scan: 'cu' },
  /* 19 BEDROCK */  { name: '基岩', solid: true, tiles: { all: T.BEDROCK }, hard: Infinity }
];

export const ITEMS: Record<string, ItemDef> = {
  carbon:      { name: '碳', type: '元素', sym: 'C', col: '#7a7a7a', stack: 99, desc: '基础有机元素。' },
  ferrite:     { name: '铁尘', type: '元素', sym: 'Fe', col: '#c9825a', stack: 99, desc: '灰色金属粉末。' },
  sodium:      { name: '钠', type: '元素', sym: 'Na', col: '#ffd166', stack: 99, desc: '黄色碱金属，可为防护充能。', use: 'hazard', useAmt: 22 },
  dihydrogen:  { name: '双氢', type: '元素', sym: 'H₂', col: '#6aaaf4', stack: 99, desc: '蓝色晶体燃料前驱体。' },
  oxygen:      { name: '氧', type: '元素', sym: 'O₂', col: '#ff8a7a', stack: 99, desc: '红色呼吸花提取物。', use: 'ls', useAmt: 22 },
  copper:      { name: '铜', type: '元素', sym: 'Cu', col: '#7de8c3', stack: 99, desc: '导电金属。' },
  biomass:     { name: '生物质', type: '有机物', col: '#6aaa5a', stack: 64, desc: '外星生物组织样本。' },
  metal_plate: { name: '金属镀层', type: '合成材料', col: '#c8cdd4', stack: 32, desc: '用于修复飞船组件。', glyph: 'plate' },
  nanotube:    { name: '碳纳米管', type: '合成材料', col: '#555a60', stack: 32, desc: '高强度碳结构。', glyph: 'tube' },
  launch_fuel: { name: '启动燃料', type: '合成材料', col: '#ff8a5c', stack: 1, desc: '飞船起飞所需燃料。', glyph: 'fuel' },
  warp_cell:   { name: '跃迁电池', type: '合成材料', col: '#8a7aff', stack: 3, desc: '星际跃迁引擎能量源。', glyph: 'warp' },
  sodium_cell: { name: '钠电池', type: '生存补给', col: '#ffd166', stack: 20, desc: '高效防护充能装置。+50防护', glyph: 'batt', use: 'hazard', useAmt: 50 },
  o2_canister: { name: '氧气罐', type: '生存补给', col: '#ff8a7a', stack: 20, desc: '压缩氧气容器。+50生命维持', glyph: 'o2c', use: 'ls', useAmt: 50 },
  medkit:      { name: '修复凝胶', type: '生存补给', col: '#7de8a0', stack: 10, desc: '外星生物修复凝胶。+60生命', glyph: 'med', use: 'hp', useAmt: 60 },
};

export const RECIPES: Recipe[] = [
  { id: 'metal_plate', out: 1, cat: '材料', req: [['ferrite', 30]], desc: '铁尘压制为金属镀层。' },
  { id: 'nanotube',    out: 1, cat: '材料', req: [['carbon', 40]], desc: '碳原子排列为纳米管。' },
  { id: 'launch_fuel', out: 1, cat: '燃料', req: [['dihydrogen', 25]], desc: '双氢聚合为启动燃料。' },
  { id: 'warp_cell',   out: 1, cat: '跃迁', req: [['copper', 20], ['nanotube', 1], ['dihydrogen', 15]], desc: '组装跃迁电池。' },
  { id: 'sodium_cell', out: 1, cat: '生存', req: [['sodium', 8], ['ferrite', 5]], desc: '钠元素封装为高效防护电池。' },
  { id: 'o2_canister', out: 1, cat: '生存', req: [['oxygen', 8], ['ferrite', 5]], desc: '氧气压缩存储于金属容器。' },
  { id: 'medkit',      out: 1, cat: '生存', req: [['biomass', 12], ['oxygen', 6]], desc: '外星组织合成修复凝胶。' }
];

export const PALETTES: Palette[] = [
  {
    id: 'temperate', climate: '温带',
    grass: '#5a9e4a', grassAlt: '#4a8a3a', dirt: '#8a7050', sand: '#d4c090',
    leaves: ['#4a8a3a', '#6aaa5a'], wood: '#8a6a40',
    skyDayTop: '#3a8fd4', skyDayHor: '#bfe4ee', skyNightTop: '#0a0e1a', skyNightHor: '#1a2238',
    fogDay: '#cfe8f0', fogNight: '#1a2238', sun: '#fff2d0', water: '#2e7fa8', sea: true,
    hazard: { type: 'cold', label: '寒冷', day: 1.8, night: 6, nightType: 'freeze', nightLabel: '极寒' },
    storm: { chance: 0.45, label: '雷暴' },
    trees: { density: 0.028, types: ['round', 'tall', 'shroom'] },
    tuft: 0.035, plant: 0.012, na: 0.006, o2: 0.008, h2: 0.008, rock: 0.008,
    creatures: ['#8a7a5a', '#6a8a5a', '#9a6a4a', '#5a6a7a'], fauna: 3,
    floraLevel: '繁盛', stormLevel: '中等'
  },
  {
    id: 'arid', climate: '干旱',
    grass: '#9a8a5a', grassAlt: '#8a7a4a', dirt: '#a08060', sand: '#e0c890',
    leaves: ['#7a8a3a', '#9aaa4a'], wood: '#9a7a50',
    skyDayTop: '#5a9ac4', skyDayHor: '#d4d8b0', skyNightTop: '#0c0e14', skyNightHor: '#1c1e28',
    fogDay: '#d8d4b0', fogNight: '#1c1e28', sun: '#ffe8a0', water: null, sea: false,
    hazard: { type: 'heat', label: '酷热', day: 5, night: 1.2, nightType: 'cold', nightLabel: '寒冷' },
    storm: { chance: 0.25, label: '沙尘暴' },
    trees: { density: 0.006, types: ['spire'] },
    tuft: 0.008, plant: 0.004, na: 0.01, o2: 0.003, h2: 0.008, rock: 0.014,
    creatures: ['#b09060', '#8a7a5a', '#a08050', '#c0a070'], fauna: 2,
    floraLevel: '稀疏', stormLevel: '低'
  },
  {
    id: 'toxic', climate: '剧毒',
    grass: '#5a7a3a', grassAlt: '#4a6a2a', dirt: '#6a6a40', sand: '#8a8a50',
    leaves: ['#3a6a2a', '#5a8a3a'], wood: '#6a5a30',
    skyDayTop: '#3a6a4a', skyDayHor: '#8aaa7a', skyNightTop: '#0a0e0a', skyNightHor: '#1a2818',
    fogDay: '#8aaa7a', fogNight: '#1a2818', sun: '#d0e0a0', water: '#3a6a4a', sea: true,
    hazard: { type: 'toxic', label: '剧毒', day: 8, night: 12, nightType: 'toxic', nightLabel: '剧毒' },
    storm: { chance: 0.6, label: '毒雾' },
    trees: { density: 0.018, types: ['shroom', 'round'] },
    tuft: 0.025, plant: 0.015, na: 0.01, o2: 0.012, h2: 0.006, rock: 0.01,
    creatures: ['#5a8a3a', '#4a7a2a', '#6a9a4a', '#3a6a2a'], fauna: 4,
    floraLevel: '茂盛', stormLevel: '高'
  },
  {
    id: 'frozen', climate: '冰封',
    grass: '#8a9aaa', grassAlt: '#7a8a9a', dirt: '#6a7a8a', sand: '#b0c0d0',
    leaves: ['#5a7a8a', '#7a9aaa'], wood: '#6a7a8a',
    skyDayTop: '#4a7aaa', skyDayHor: '#b0c8e0', skyNightTop: '#080c14', skyNightHor: '#141e2c',
    fogDay: '#b0c8e0', fogNight: '#141e2c', sun: '#d0e0f0', water: '#3a6a8a', sea: true,
    hazard: { type: 'freeze', label: '极寒', day: 6, night: 14, nightType: 'freeze', nightLabel: '致命极寒' },
    storm: { chance: 0.55, label: '暴风雪' },
    trees: { density: 0.008, types: ['tall', 'spire'] },
    tuft: 0.01, plant: 0.003, na: 0.008, o2: 0.004, h2: 0.01, rock: 0.012,
    creatures: ['#8a9aaa', '#6a7a8a', '#9aaaba', '#5a6a7a'], fauna: 2,
    floraLevel: '稀疏', stormLevel: '高'
  }
];

export const HAZ_ICONS: Record<string, string> = {
  cold: '❄', heat: '☀', toxic: '☣', freeze: '❆'
};

export const MILESTONE_DEFS: MilestoneDef[] = [
  { key: 'walk',   name: '行者',    unit: 'm',   tiers: [100, 500, 2000, 8000], subs: ['初行百里', '行者无疆', '远行者', '星际流浪者'] },
  { key: 'mined',  name: '采集者',  unit: '次',  tiers: [10, 50, 200, 800],     subs: ['初识矿物', '矿脉猎手', '采集大师', '星球矿工'] },
  { key: 'scans',  name: '观察者',  unit: '种',  tiers: [1, 5, 12, 25],         subs: ['初次记录', '博物学者', '万物皆明', '百科全书'] },
  { key: 'placed', name: '建造者',  unit: '块',  tiers: [5, 30, 100, 400],      subs: ['初筑根基', '建造者', '建筑师', '星球塑造者'] },
  { key: 'warps',  name: '跃迁者',  unit: '次',  tiers: [1, 3, 8, 20],          subs: ['初次跃迁', '星际旅者', '跃迁大师', '银河行者'] },
  { key: 'crafted',name: '工匠',    unit: '件',  tiers: [1, 10, 40, 120],       subs: ['初次合成', '工匠', '合成大师', '万物皆可造'] },
  { key: 'survive',name: '生存者',  unit: '秒',  tiers: [60, 300, 900, 3600],   subs: ['活过一分钟', '坚持五分钟', '生存专家', '不死远行者'] }
];

export const DEFAULT_SETTINGS: Settings = {
  master: 80, music: 60, sfx: 90, sens: 50, fov: 72, dist: 4, invert: false
};
