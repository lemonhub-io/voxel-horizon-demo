import { describe, it, expect } from 'vitest';
import { CFG, B, BLOCK_DEF, ITEMS, RECIPES, PALETTES, HAZ_ICONS, MILESTONE_DEFS, DEFAULT_SETTINGS } from '../config';

describe('CFG constants', () => {
  it('has valid chunk size', () => expect(CFG.CHUNK).toBe(16));
  it('has valid world height', () => expect(CFG.WORLD_H).toBe(64));
  it('has valid sea level', () => expect(CFG.SEA).toBeLessThan(CFG.WORLD_H));
  it('has positive gravity', () => expect(CFG.GRAVITY).toBeGreaterThan(0));
  it('has positive reach', () => expect(CFG.REACH).toBeGreaterThan(0));
  it('has save key', () => expect(CFG.SAVE_KEY).toBeTruthy());
});

describe('Block types (B)', () => {
  it('AIR is 0', () => expect(B.AIR).toBe(0));
  it('has all expected types', () => {
    expect(B.GRASS).toBeDefined();
    expect(B.DIRT).toBeDefined();
    expect(B.STONE).toBeDefined();
    expect(B.WATER).toBeDefined();
    expect(B.BEDROCK).toBeDefined();
  });
});

describe('BLOCK_DEF', () => {
  it('has entry for every block type', () => {
    for (const key of Object.values(B)) {
      expect(BLOCK_DEF[key as number]).toBeDefined();
      expect(BLOCK_DEF[key as number].name).toBeTruthy();
    }
  });
  it('AIR is not solid', () => expect(BLOCK_DEF[B.AIR].solid).toBe(false));
  it('STONE is solid', () => expect(BLOCK_DEF[B.STONE].solid).toBe(true));
  it('WATER is not solid', () => expect(BLOCK_DEF[B.WATER].solid).toBe(false));
  it('BEDROCK has infinite hardness', () => expect(BLOCK_DEF[B.BEDROCK].hard).toBe(Infinity));
  it('solid blocks have tiles', () => {
    for (const def of BLOCK_DEF) {
      if (def && def.solid && !def.water) {
        expect(def.tiles).toBeDefined();
      }
    }
  });
});

describe('ITEMS', () => {
  it('has name and desc for every item', () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      expect(def.name, `item ${id} missing name`).toBeTruthy();
      expect(def.desc, `item ${id} missing desc`).toBeTruthy();
    }
  });
  it('placeable items reference valid block types', () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.place !== undefined) {
        expect(BLOCK_DEF[def.place], `item ${id} place=${def.place} has no BLOCK_DEF`).toBeDefined();
      }
    }
  });
  it('consumable items have use and useAmt', () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      if (def.use) {
        expect(def.useAmt, `item ${id} has use but no useAmt`).toBeDefined();
        expect(def.useAmt).toBeGreaterThan(0);
      }
    }
  });
});

describe('RECIPES', () => {
  it('all recipes produce valid items', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.id], `recipe produces unknown item ${r.id}`).toBeDefined();
    }
  });
  it('all recipes require valid items', () => {
    for (const r of RECIPES) {
      for (const [id, n] of r.req) {
        expect(ITEMS[id], `recipe requires unknown item ${id}`).toBeDefined();
        expect(n).toBeGreaterThan(0);
      }
    }
  });
  it('all recipes produce positive quantity', () => {
    for (const r of RECIPES) expect(r.out).toBeGreaterThan(0);
  });
});

describe('PALETTES', () => {
  it('has 4 palettes', () => expect(PALETTES.length).toBe(4));
  it('each palette has required fields', () => {
    for (const p of PALETTES) {
      expect(p.id).toBeTruthy();
      expect(p.climate).toBeTruthy();
      expect(p.grass).toBeTruthy();
      expect(p.hazard).toBeDefined();
      expect(p.hazard.type).toBeTruthy();
      expect(p.storm).toBeDefined();
      expect(p.trees).toBeDefined();
    }
  });
  it('hazard types are valid', () => {
    const valid = ['heat', 'cold', 'toxic', 'rad'];
    for (const p of PALETTES) expect(valid).toContain(p.hazard.type);
  });
});

describe('HAZ_ICONS', () => {
  it('has icons for all hazard types', () => {
    expect(HAZ_ICONS.cold).toBeDefined();
    expect(HAZ_ICONS.heat).toBeDefined();
    expect(HAZ_ICONS.toxic).toBeDefined();
    expect(HAZ_ICONS.rad).toBeDefined();
  });
});

describe('MILESTONE_DEFS', () => {
  it('has all milestones', () => expect(MILESTONE_DEFS.length).toBeGreaterThanOrEqual(7));
  it('each milestone has tiers and subs', () => {
    for (const m of MILESTONE_DEFS) {
      expect(m.key).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.tiers.length).toBeGreaterThan(0);
      expect(m.subs.length).toBe(m.tiers.length);
    }
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('has valid ranges', () => {
    expect(DEFAULT_SETTINGS.master).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_SETTINGS.master).toBeLessThanOrEqual(100);
    expect(DEFAULT_SETTINGS.fov).toBeGreaterThanOrEqual(60);
    expect(DEFAULT_SETTINGS.fov).toBeLessThanOrEqual(100);
    expect(DEFAULT_SETTINGS.dist).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_SETTINGS.dist).toBeLessThanOrEqual(6);
  });
});
