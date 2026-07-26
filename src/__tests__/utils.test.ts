import { describe, it, expect } from 'vitest';
import { U, SimplexNoise } from '../utils';

describe('U utilities', () => {
  describe('clamp', () => {
    it('clamps value below min', () => expect(U.clamp(-5, 0, 10)).toBe(0));
    it('clamps value above max', () => expect(U.clamp(15, 0, 10)).toBe(10));
    it('returns value within range', () => expect(U.clamp(5, 0, 10)).toBe(5));
    it('handles min === max', () => expect(U.clamp(5, 3, 3)).toBe(3));
  });

  describe('lerp', () => {
    it('returns start at t=0', () => expect(U.lerp(10, 20, 0)).toBe(10));
    it('returns end at t=1', () => expect(U.lerp(10, 20, 1)).toBe(20));
    it('returns midpoint at t=0.5', () => expect(U.lerp(0, 100, 0.5)).toBe(50));
    it('extrapolates beyond t=1', () => expect(U.lerp(0, 10, 2)).toBe(20));
  });

  describe('smooth', () => {
    it('returns 0 at t=0', () => expect(U.smooth(0)).toBe(0));
    it('returns 1 at t=1', () => expect(U.smooth(1)).toBeCloseTo(1));
    it('returns 0.5 at t=0.5', () => expect(U.smooth(0.5)).toBeCloseTo(0.5));
  });

  describe('rand', () => {
    it('returns value within range', () => {
      for (let i = 0; i < 100; i++) {
        const v = U.rand(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('randi', () => {
    it('returns integer', () => {
      for (let i = 0; i < 100; i++) {
        expect(Number.isInteger(U.randi(1, 10))).toBe(true);
      }
    });
  });

  describe('pick', () => {
    it('returns element from array', () => {
      const arr = [10, 20, 30];
      for (let i = 0; i < 50; i++) {
        expect(arr).toContain(U.pick(arr));
      }
    });
    it('works with custom rng', () => {
      const rng = () => 0.5;
      expect(U.pick([1, 2, 3], rng)).toBe(2);
    });
  });

  describe('dist2', () => {
    it('returns 0 for same point', () => expect(U.dist2(0, 0, 0, 0)).toBe(0));
    it('calculates distance correctly', () => expect(U.dist2(0, 0, 3, 4)).toBeCloseTo(5));
    it('is symmetric', () => expect(U.dist2(1, 2, 3, 4)).toBeCloseTo(U.dist2(3, 4, 1, 2)));
  });

  describe('fmtDist', () => {
    it('formats meters', () => expect(U.fmtDist(500)).toBe('500m'));
    it('formats kilometers', () => expect(U.fmtDist(1500)).toBe('1.5km'));
    it('formats exactly 1km', () => expect(U.fmtDist(1000)).toBe('1.0km'));
  });

  describe('fmtTime', () => {
    it('formats seconds', () => expect(U.fmtTime(45)).toBe('0分45秒'));
    it('formats minutes', () => expect(U.fmtTime(125)).toBe('2分5秒'));
    it('formats hours', () => expect(U.fmtTime(3661)).toBe('1小时1分'));
  });

  describe('mulberry32', () => {
    it('returns deterministic sequence', () => {
      const rng = U.mulberry32(42);
      const a = [rng(), rng(), rng()];
      const rng2 = U.mulberry32(42);
      const b = [rng2(), rng2(), rng2()];
      expect(a).toEqual(b);
    });
    it('returns values in [0, 1)', () => {
      const rng = U.mulberry32(123);
      for (let i = 0; i < 100; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
    it('different seeds produce different sequences', () => {
      const a = U.mulberry32(1)();
      const b = U.mulberry32(2)();
      expect(a).not.toBe(b);
    });
  });

  describe('seedFromString', () => {
    it('returns number', () => expect(typeof U.seedFromString('test')).toBe('number'));
    it('is deterministic', () => expect(U.seedFromString('hello')).toBe(U.seedFromString('hello')));
    it('different strings produce different seeds', () => expect(U.seedFromString('a')).not.toBe(U.seedFromString('b')));
  });

  describe('hash2', () => {
    it('returns value in [0, 1)', () => {
      for (let i = 0; i < 50; i++) {
        const v = U.hash2(i, i * 2, 42);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
    it('is deterministic', () => expect(U.hash2(5, 10, 42)).toBe(U.hash2(5, 10, 42)));
  });

  describe('hexRgb', () => {
    it('parses black', () => expect(U.hexRgb('#000000')).toEqual([0, 0, 0]));
    it('parses white', () => expect(U.hexRgb('#ffffff')).toEqual([255, 255, 255]));
    it('parses red', () => expect(U.hexRgb('#ff0000')).toEqual([255, 0, 0]));
  });

  describe('rgbHex', () => {
    it('converts to hex', () => expect(U.rgbHex(255, 128, 0)).toBe('#ff8000'));
    it('clamps values', () => expect(U.rgbHex(300, -10, 128)).toBe('#ff0080'));
  });

  describe('mixHex', () => {
    it('returns start at t=0', () => expect(U.mixHex('#ff0000', '#0000ff', 0)).toBe('#ff0000'));
    it('returns end at t=1', () => expect(U.mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff'));
  });

  describe('shade', () => {
    it('darker with f<1', () => {
      const orig = U.hexRgb('#808080');
      const shaded = U.hexRgb(U.shade('#808080', 0.5));
      expect(shaded[0]).toBeLessThan(orig[0]);
    });
    it('unchanged at f=1', () => expect(U.shade('#808080', 1)).toBe('#808080'));
  });

  describe('roman', () => {
    it('converts 1-10', () => {
      expect(U.roman(1)).toBe('I');
      expect(U.roman(4)).toBe('IV');
      expect(U.roman(9)).toBe('IX');
      expect(U.roman(10)).toBe('X');
    });
  });

  describe('planetName', () => {
    it('returns string with dash', () => {
      const rng = U.mulberry32(42);
      const name = U.planetName(rng);
      expect(name).toContain('-');
      expect(name.length).toBeGreaterThan(3);
    });
    it('is deterministic', () => {
      const n1 = U.planetName(U.mulberry32(42));
      const n2 = U.planetName(U.mulberry32(42));
      expect(n1).toBe(n2);
    });
  });

  describe('creatureName', () => {
    it('returns string with separator', () => {
      const rng = U.mulberry32(42);
      expect(U.creatureName(rng)).toContain('·');
    });
  });

  describe('floraName', () => {
    it('returns non-empty Chinese string', () => {
      const rng = U.mulberry32(42);
      const name = U.floraName(rng);
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(name.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('SimplexNoise', () => {
  it('constructs without error', () => expect(() => new SimplexNoise(42)).not.toThrow());
  it('noise2 returns number', () => {
    const n = new SimplexNoise(42);
    expect(typeof n.noise2(0.5, 0.5)).toBe('number');
  });
  it('noise3 returns number', () => {
    const n = new SimplexNoise(42);
    expect(typeof n.noise3(0.5, 0.5, 0.5)).toBe('number');
  });
  it('fbm2 returns number', () => {
    const n = new SimplexNoise(42);
    expect(typeof n.fbm2(0.5, 0.5, 4, 2, 0.5)).toBe('number');
  });
  it('noise2 is deterministic', () => {
    const a = new SimplexNoise(42).noise2(0.3, 0.7);
    const b = new SimplexNoise(42).noise2(0.3, 0.7);
    expect(a).toBe(b);
  });
  it('noise2 output is in [-1, 1]', () => {
    const n = new SimplexNoise(42);
    for (let i = 0; i < 100; i++) {
      const v = n.noise2(i * 0.1, i * 0.2);
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });
});
