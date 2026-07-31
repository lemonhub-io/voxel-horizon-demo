import { describe, expect, it } from 'vitest';
import { buildGreedyQuads, greedyQuadPositions } from '../greedy-mesh';

const cell = (key: string, tile = 3) => ({
  key,
  tile,
  blockId: 1,
  brightness: [1, 1, 1, 1] as const,
});

describe('greedy mesh', () => {
  it('merges a flat 2x2 face into one quad', () => {
    const quads = buildGreedyQuads({
      width: 2,
      height: 1,
      depth: 2,
      getCell: (_x, _y, _z, face) => face === 0 ? cell('grass') : null,
    });

    expect(quads).toEqual([{
      face: 0,
      x: 0,
      y: 0,
      z: 0,
      width: 2,
      height: 2,
      tile: 3,
      blockId: 1,
      brightness: [1, 1, 1, 1],
    }]);
  });

  it('does not merge different material or AO buckets', () => {
    const quads = buildGreedyQuads({
      width: 2,
      height: 1,
      depth: 1,
      getCell: (x, _y, _z, face) => face === 0 ? cell(x === 0 ? 'a' : 'b') : null,
    });

    expect(quads).toHaveLength(2);
    expect(quads.every(quad => quad.width === 1 && quad.height === 1)).toBe(true);
  });

  it('keeps X and Z face plane dimensions aligned with their axes', () => {
    const xQuads = buildGreedyQuads({
      width: 1,
      height: 3,
      depth: 2,
      getCell: (_x, _y, _z, face) => face === 2 ? cell('x') : null,
    });
    const zQuads = buildGreedyQuads({
      width: 2,
      height: 3,
      depth: 1,
      getCell: (_x, _y, _z, face) => face === 4 ? cell('z') : null,
    });

    expect(xQuads[0]).toMatchObject({ face: 2, width: 2, height: 3, x: 0, y: 0, z: 0 });
    expect(zQuads[0]).toMatchObject({ face: 4, width: 2, height: 3, x: 0, y: 0, z: 0 });
  });

  it('maps X-face width to Z and height to Y when emitting vertices', () => {
    const quad = { face: 2 as const, x: 4, y: 8, z: 3, width: 1, height: 6, tile: 3, blockId: 1, brightness: [1, 1, 1, 1] as const };
    expect(greedyQuadPositions(quad)).toEqual([
      [5, 8, 4], [5, 8, 3], [5, 14, 3], [5, 14, 4],
    ]);
  });
});
