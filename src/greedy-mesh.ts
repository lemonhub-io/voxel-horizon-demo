// ============================================================
// greedy-mesh.ts — shared CPU greedy mesher
// ============================================================

export type GreedyFace = 0 | 1 | 2 | 3 | 4 | 5;

export interface GreedyCell {
  /** Cells with the same key may be merged without changing their material. */
  key: string | number;
  tile: number;
  blockId: number;
  /** Per-corner brightness in the face winding order. */
  brightness: readonly [number, number, number, number];
}

export interface GreedyQuad {
  face: GreedyFace;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  tile: number;
  blockId: number;
  brightness: readonly [number, number, number, number];
}

export interface GreedyMesherOptions {
  width: number;
  height: number;
  depth: number;
  getCell: (x: number, y: number, z: number, face: GreedyFace) => GreedyCell | null;
}

/** Convert a greedy quad's plane dimensions into its four world-space corners. */
export function greedyQuadPositions(quad: GreedyQuad): number[][] {
  const { x, y, z, width, height, face } = quad;
  return face === 0 ? [[x, y + 1, z + height], [x + width, y + 1, z + height], [x + width, y + 1, z], [x, y + 1, z]]
    : face === 1 ? [[x, y, z], [x + width, y, z], [x + width, y, z + height], [x, y, z + height]]
      : face === 2 ? [[x + 1, y, z + width], [x + 1, y, z], [x + 1, y + height, z], [x + 1, y + height, z + width]]
        : face === 3 ? [[x, y, z], [x, y, z + width], [x, y + height, z + width], [x, y + height, z]]
          : face === 4 ? [[x, y, z + 1], [x + width, y, z + 1], [x + width, y + height, z + 1], [x, y + height, z + 1]]
            : [[x + width, y, z], [x, y, z], [x, y + height, z], [x + width, y + height, z]];
}

/**
 * Merge coplanar faces in the same material/AO bucket.
 *
 * The plane convention matches the terrain renderer:
 * - Y faces use X/Z as (u/v)
 * - X faces use Z/Y as (u/v)
 * - Z faces use X/Y as (u/v)
 *
 * Keeping AO in the merge key prevents a large quad from erasing the baked
 * voxel corner shading that the original per-face path provided.
 */
export function buildGreedyQuads(options: GreedyMesherOptions): GreedyQuad[] {
  const { width, height, depth, getCell } = options;
  const out: GreedyQuad[] = [];

  const faces: Array<{ face: GreedyFace; axis: 0 | 1 | 2; planeU: number; planeV: number }> = [
    { face: 0, axis: 1, planeU: width, planeV: depth },
    { face: 1, axis: 1, planeU: width, planeV: depth },
    { face: 2, axis: 0, planeU: depth, planeV: height },
    { face: 3, axis: 0, planeU: depth, planeV: height },
    { face: 4, axis: 2, planeU: width, planeV: height },
    { face: 5, axis: 2, planeU: width, planeV: height },
  ];

  for (const { face, axis, planeU, planeV } of faces) {
    for (let slice = 0; slice < [width, height, depth][axis]; slice++) {
      const mask: Array<GreedyCell | null> = Array.from({ length: planeU * planeV }, () => null);

      for (let v = 0; v < planeV; v++) {
        for (let u = 0; u < planeU; u++) {
          const coords = faceCoords(axis, slice, u, v);
          mask[v * planeU + u] = getCell(coords.x, coords.y, coords.z, face);
        }
      }

      for (let v = 0; v < planeV; v++) {
        for (let u = 0; u < planeU; u++) {
          const start = mask[v * planeU + u];
          if (!start) continue;

          let quadWidth = 1;
          while (
            u + quadWidth < planeU &&
            sameCell(start, mask[v * planeU + u + quadWidth])
          ) {
            quadWidth++;
          }

          let quadHeight = 1;
          while (v + quadHeight < planeV) {
            let rowMatches = true;
            for (let x = 0; x < quadWidth; x++) {
              if (!sameCell(start, mask[(v + quadHeight) * planeU + u + x])) {
                rowMatches = false;
                break;
              }
            }
            if (!rowMatches) break;
            quadHeight++;
          }

          const origin = faceCoords(axis, slice, u, v);
          out.push({
            face,
            x: origin.x,
            y: origin.y,
            z: origin.z,
            width: quadWidth,
            height: quadHeight,
            tile: start.tile,
            blockId: start.blockId,
            brightness: start.brightness,
          });

          for (let dy = 0; dy < quadHeight; dy++) {
            for (let dx = 0; dx < quadWidth; dx++) {
              mask[(v + dy) * planeU + u + dx] = null;
            }
          }
        }
      }
    }
  }

  return out;
}

function sameCell(a: GreedyCell | null, b: GreedyCell | null): boolean {
  return a !== null && b !== null && a.key === b.key;
}

function faceCoords(axis: 0 | 1 | 2, slice: number, u: number, v: number): { x: number; y: number; z: number } {
  if (axis === 1) return { x: u, y: slice, z: v };
  if (axis === 0) return { x: slice, y: v, z: u };
  return { x: u, y: v, z: slice };
}
