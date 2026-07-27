import * as THREE from 'three/webgpu';
import { U } from './utils';
import { T, ITEMS, BLOCK_DEF } from './config';
import type { Palette } from './types';

export class TextureAtlas {
  size: number;
  px: number;
  stride: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture | null;
  normalTexture: THREE.CanvasTexture | null;
  iconCache: Record<string, string>;
  avgCache: Record<string, string>;

  constructor() {
    this.size = 8;
    this.px = 32;
    // Leave one duplicated pixel around every tile to isolate atlas sampling.
    this.stride = this.px + 2;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size * this.stride;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = null;
    this.normalTexture = null;
    this.iconCache = {};
    this.avgCache = {};
  }

  tileRect(t: number): [number, number, number, number] {
    const s = this.px;
    return [(t % this.size) * this.stride + 1, Math.floor(t / this.size) * this.stride + 1, s, s];
  }

  uv(t: number): [number, number, number, number] {
    const atlasPx = this.size * this.stride;
    const [x, y] = this.tileRect(t);
    // Address texel centres inside the padded tile, never an adjacent tile.
    const u0 = (x + 0.5) / atlasPx, u1 = (x + this.px - 0.5) / atlasPx;
    const v0 = 1 - (y + this.px - 0.5) / atlasPx, v1 = 1 - (y + 0.5) / atlasPx;
    return [u0, v0, u1, v1];
  }

  build(pal: Palette, seed: number): THREE.CanvasTexture {
    const ctx = this.ctx, px = this.px;
    const sf = px / 16; // scale factor from original 16px tiles
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const rng = U.mulberry32(seed ^ 0x51ab);

    const tile = (t: number, fn: (put: (x: number, y: number, c: string) => void) => void) => {
      const [ox, oy] = this.tileRect(t);
      ctx.save();
      ctx.translate(ox, oy);
      fn((x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); });
      ctx.restore();
      // Duplicate edge texels into the surrounding gutter. This prevents mipmaps
      // from sampling a neighbouring tile (notably the green grass tile).
      ctx.drawImage(this.canvas, ox, oy, px, 1, ox, oy - 1, px, 1);
      ctx.drawImage(this.canvas, ox, oy + px - 1, px, 1, ox, oy + px, px, 1);
      ctx.drawImage(this.canvas, ox, oy, 1, px, ox - 1, oy, 1, px);
      ctx.drawImage(this.canvas, ox + px - 1, oy, 1, px, ox + px, oy, 1, px);
      ctx.drawImage(this.canvas, ox, oy, 1, 1, ox - 1, oy - 1, 1, 1);
      ctx.drawImage(this.canvas, ox + px - 1, oy, 1, 1, ox + px, oy - 1, 1, 1);
      ctx.drawImage(this.canvas, ox, oy + px - 1, 1, 1, ox - 1, oy + px, 1, 1);
      ctx.drawImage(this.canvas, ox + px - 1, oy + px - 1, 1, 1, ox + px, oy + px, 1, 1);
    };
    const noiseFill = (put: (x: number, y: number, c: string) => void, base: string, amt: number, holes?: number) => {
      for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
        if (holes && rng() < holes) continue;
        put(x, y, U.vary(base, rng, amt));
      }
    };

    tile(T.GRASS_TOP, p => {
      noiseFill(p, pal.grass, 20);
      for (let i = 0; i < 26 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), U.vary(pal.grassAlt, rng, 16));
      for (let i = 0; i < 5 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), U.shade(pal.grass, 1.35));
    });
    tile(T.DIRT, p => {
      noiseFill(p, pal.dirt, 18);
      for (let i = 0; i < 10 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), U.shade(pal.dirt, 0.72));
    });
    tile(T.GRASS_SIDE, p => {
      noiseFill(p, pal.dirt, 18);
      for (let x = 0; x < px; x++) {
        const d = (2 + Math.floor(rng() * 3)) * sf;
        for (let y = 0; y < d; y++) p(x, y, U.vary(y < d - 1 ? pal.grass : pal.grassAlt, rng, 18));
      }
    });
    tile(T.STONE, p => {
      noiseFill(p, '#8a8f96', 14);
      for (let i = 0; i < 9 * sf; i++) { const x = U.randi(0, px - 2), y = U.randi(0, px - 2); p(x, y, '#6f747c'); p(x + 1, y, '#7a7f88'); }
    });
    tile(T.SAND, p => {
      noiseFill(p, pal.sand, 12);
      for (let i = 0; i < 8 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), U.shade(pal.sand, 0.82));
    });
    tile(T.LOG, p => {
      for (let x = 0; x < px; x++) {
        const c = (x % (4 * sf) === 0) ? U.shade(pal.wood, 0.68) : pal.wood;
        for (let y = 0; y < px; y++) p(x, y, U.vary(c, rng, 10));
      }
    });
    tile(T.LOG_TOP, p => {
      noiseFill(p, U.shade(pal.wood, 1.15), 10);
      const cx = px / 2;
      for (let r = 2 * sf; r < 8 * sf; r += 2 * sf) for (let a = 0; a < 30; a++) {
        const x = Math.round(cx + Math.cos(a) * r * 0.8), y = Math.round(cx + Math.sin(a) * r * 0.8);
        if (x >= 0 && x < px && y >= 0 && y < px) p(x, y, U.shade(pal.wood, 0.75));
      }
    });
    tile(T.LEAVES, p => {
      noiseFill(p, pal.leaves[0], 22, 0.16);
      for (let i = 0; i < 20 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), U.vary(pal.leaves[1] || pal.leaves[0], rng, 18));
    });
    tile(T.PLANKS, p => {
      const base = U.shade(pal.wood, 1.25);
      for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
        let c = U.vary(base, rng, 8);
        if (y % (4 * sf) === 3 * sf) c = U.shade(base, 0.6);
        if ((y < 4 * sf && x === 7 * sf) || (y >= 4 * sf && y < 8 * sf && x === 13 * sf) || (y >= 8 * sf && y < 12 * sf && x === 3 * sf) || (y >= 12 * sf && x === 10 * sf)) c = U.shade(base, 0.6);
        p(x, y, c);
      }
    });
    tile(T.GLASS, p => {
      const e = px - 1;
      for (let i = 0; i < px; i++) { p(i, 0, '#dfeef4'); p(i, e, '#dfeef4'); p(0, i, '#dfeef4'); p(e, i, '#dfeef4'); }
      p(3 * sf, 3 * sf, '#ffffff'); p(4 * sf, 4 * sf, '#ffffff'); p(5 * sf, 5 * sf, '#cfe8f0'); p(11 * sf, 10 * sf, '#cfe8f0'); p(12 * sf, 11 * sf, '#ffffff');
    });
    tile(T.ALLOY, p => {
      const e = px - 1;
      noiseFill(p, '#c8cdd4', 6);
      for (let i = 0; i < px; i++) { p(i, 0, '#e8ecf0'); p(i, e, '#8f959e'); p(0, i, '#dfe3e8'); p(e, i, '#9aa0a8'); }
      for (let x = 2 * sf; x < 6 * sf; x++) p(x, 12 * sf, '#ff8a5c');
      p(2 * sf, 2 * sf, '#7a8088'); p(13 * sf, 2 * sf, '#7a8088'); p(2 * sf, 13 * sf, '#7a8088'); p(13 * sf, 13 * sf, '#7a8088');
    });
    tile(T.LAMP, p => {
      const e = px - 1;
      noiseFill(p, '#ffe9b0', 8);
      for (let y = 2 * sf; y < 14 * sf; y++) for (let x = 2 * sf; x < 14 * sf; x++) p(x, y, U.vary('#fff4cf', rng, 6));
      for (let i = 0; i < px; i++) { p(i, 0, '#a89058'); p(i, e, '#a89058'); p(0, i, '#a89058'); p(e, i, '#a89058'); }
    });
    tile(T.WATER, p => {
      const w = pal.water || '#2e7fa8';
      noiseFill(p, w, 10);
      for (let i = 0; i < 6 * sf; i++) { const x = U.randi(0, px - 4), y = U.randi(0, px - 1); p(x, y, U.shade(w, 1.3)); p(x + 1, y, U.shade(w, 1.2)); }
    });

    const drawCross = (t: number, fn: (put: (x: number, y: number, c: string) => void) => void) => tile(t, fn);
    drawCross(T.TUFT, p => {
      const e = px - 1;
      for (let i = 0; i < 9 * sf; i++) {
        const x = 1 + U.randi(0, px - 3), h = (4 + U.randi(0, 7)) * sf;
        for (let y = 0; y < h; y++) p(x + (y > h - 3 * sf && rng() < 0.4 ? (rng() < 0.5 ? 1 : -1) : 0), e - y, U.vary(pal.grassAlt, rng, 26));
      }
    });
    drawCross(T.PLANT, p => {
      const cx = px / 2;
      for (let y = 8 * sf; y < px; y++) p(cx, y, U.shade(pal.wood, 1.1));
      const c = pal.leaves[1] || pal.leaves[0];
      for (let i = 0; i < 22 * sf; i++) {
        const a = rng() * 6.28, r = rng() * 4.2 * sf;
        p(Math.round(cx + Math.cos(a) * r), Math.round(6 * sf + Math.sin(a) * r * 0.75), U.vary(c, rng, 24));
      }
      p(cx, 5 * sf, '#ffffff');
    });
    drawCross(T.NA, p => {
      const cx = px / 2;
      for (let y = 9 * sf; y < px; y++) p(cx, y, '#7a6a30');
      const pts: [number, number][] = [[8, 4], [6, 6], [10, 6], [7, 8], [9, 8], [8, 6], [5, 5], [11, 5]];
      for (const [bx, by] of pts) { const x = bx * sf, y = by * sf; p(x, y, '#ffd166'); p(x, y - 1, '#ffe9a8'); }
      p(cx, 3 * sf, '#fff6d0'); p(4 * sf, 8 * sf, '#ffd166'); p(12 * sf, 8 * sf, '#ffd166');
    });
    drawCross(T.H, p => {
      const shard = (bx: number, by: number, h: number, c1: string, c2: string) => {
        for (let y = 0; y < h; y++) { p(bx, px - 1 - y, y > h - 3 ? c2 : c1); if (y < h - 4) p(bx + 1, px - 1 - y, U.shade(c1, 0.8)); }
      };
      shard(4 * sf, px - 1, 8 * sf, '#5a9ae8', '#bcd9ff'); shard(8 * sf, px - 1, 12 * sf, '#6aaaf4', '#e0eeff'); shard(11 * sf, px - 1, 6 * sf, '#4a8ad8', '#a8ccff');
      p(8 * sf, 3 * sf, '#ffffff');
    });
    drawCross(T.O2, p => {
      const cx = px / 2;
      for (let y = 8 * sf; y < px; y++) p(cx, y, '#5f7a40');
      const c = ['#ff6a5a', '#ff8a7a', '#ffb0a0'];
      const pts: [number, number][] = [[8, 4], [6, 5], [10, 5], [7, 7], [9, 7], [8, 6], [8, 2], [5, 7], [11, 7]];
      for (const [bx, by] of pts) p(bx * sf, by * sf, U.pick(c, rng));
      p(cx, 5 * sf, '#fff0e8'); p(4 * sf, 10 * sf, '#ff8a7a'); p(12 * sf, 10 * sf, '#ff8a7a');
    });
    tile(T.FERRITE, p => {
      noiseFill(p, '#6f6a62', 12);
      for (let i = 0; i < 14 * sf; i++) { const x = U.randi(1, px - 2), y = U.randi(1, px - 2); p(x, y, '#c9825a'); if (rng() < 0.5) p(x + 1, y, '#a86a48'); }
    });
    tile(T.COPPER, p => {
      noiseFill(p, '#7d8288', 12);
      for (let i = 0; i < 12 * sf; i++) { const x = U.randi(1, px - 3), y = U.randi(1, px - 3); p(x, y, '#7de8c3'); p(x + 1, y, '#4ec9a0'); if (rng() < 0.4) p(x, y + 1, '#a8f4dc'); }
    });
    tile(T.BEDROCK, p => {
      noiseFill(p, '#3a3d44', 20);
      for (let i = 0; i < 12 * sf; i++) p(U.randi(0, px - 1), U.randi(0, px - 1), '#14161c');
    });

    for (let s = 0; s < 3; s++) {
      tile(T.CRACK0 + s, p => {
        const n = (8 + s * 12) * sf;
        const cx = px / 2, cy = px / 2;
        let x = cx, y = cy;
        for (let i = 0; i < n; i++) {
          p(x & (px - 1), y & (px - 1), 'rgba(10,8,6,0.85)');
          x += U.randi(-2, 2); y += U.randi(-2, 2);
          if (rng() < 0.3) { x = U.randi(3 * sf, 12 * sf); y = U.randi(3 * sf, 12 * sf); }
        }
      });
    }

    if (this.texture) this.texture.dispose();
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    this.texture = tex;

    if (this.normalTexture) this.normalTexture.dispose();
    this.normalTexture = this._buildNormalTexture();
    this.iconCache = {};
    this.avgCache = {};
    return tex;
  }

  /** Derive a subtle normal map from the procedural atlas for richer PBR lighting. */
  private _buildNormalTexture(): THREE.CanvasTexture {
    const width = this.canvas.width;
    const source = this.ctx.getImageData(0, 0, width, this.canvas.height).data;
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = width;
    const normalCtx = normalCanvas.getContext('2d')!;
    const normal = normalCtx.createImageData(width, width);

    const heightAt = (x: number, y: number): number => {
      // Tile gutters already duplicate edge pixels, so clamping to the atlas is
      // sufficient and keeps normal-map gradients inside the correct tile.
      const sx = Math.max(0, Math.min(width - 1, x));
      const sy = Math.max(0, Math.min(width - 1, y));
      const i = (sy * width + sx) * 4;
      if (source[i + 3] < 16) return 0.5;
      return (source[i] * 0.2126 + source[i + 1] * 0.7152 + source[i + 2] * 0.0722) / 255;
    };

    for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
      const dx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * 0.6;
      const dy = (heightAt(x, y - 1) - heightAt(x, y + 1)) * 0.6;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      normal.data[i] = Math.round((dx / length * 0.5 + 0.5) * 255);
      normal.data[i + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
      normal.data[i + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      normal.data[i + 3] = source[i + 3];
    }

    normalCtx.putImageData(normal, 0, 0);
    const texture = new THREE.CanvasTexture(normalCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  tileAvg(t: number, f: number): string {
    this.avgCache = this.avgCache || {};
    const key = t + '_' + f;
    if (this.avgCache[key]) return this.avgCache[key];
    const [ox, oy, s] = this.tileRect(t);
    const d = this.ctx.getImageData(ox, oy, s, s).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 40) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    n = Math.max(n, 1);
    const out = U.rgbHex((r / n) * f, (g / n) * f, (b / n) * f);
    this.avgCache[key] = out;
    return out;
  }

  icon(itemId: string): string {
    if (this.iconCache[itemId]) return this.iconCache[itemId];
    const def = ITEMS[itemId];
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;

    if (def.place !== undefined) {
      const bd = BLOCK_DEF[def.place];
      const tt = bd.tiles!.top !== undefined ? bd.tiles!.top : bd.tiles!.all!;
      const ts = bd.tiles!.side !== undefined ? bd.tiles!.side : bd.tiles!.all!;
      if (bd.cross) {
        const [ox, oy, s] = this.tileRect(tt);
        x.drawImage(this.canvas, ox, oy, s, s, 4, 4, 40, 40);
      } else {
        const top = this.tileAvg(tt, 1.0), left = this.tileAvg(ts, 0.78), right = this.tileAvg(ts, 0.56);
        const cx = 24, cy = 25, w = 19, h = 10;
        x.fillStyle = top;
        x.beginPath(); x.moveTo(cx, cy - h * 2 + 1); x.lineTo(cx + w, cy - h + 1); x.lineTo(cx, cy + 1); x.lineTo(cx - w, cy - h + 1); x.closePath(); x.fill();
        x.fillStyle = left;
        x.beginPath(); x.moveTo(cx - w, cy - h + 1); x.lineTo(cx, cy + 1); x.lineTo(cx, cy + h * 2); x.lineTo(cx - w, cy + h); x.closePath(); x.fill();
        x.fillStyle = right;
        x.beginPath(); x.moveTo(cx + w, cy - h + 1); x.lineTo(cx, cy + 1); x.lineTo(cx, cy + h * 2); x.lineTo(cx + w, cy + h); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, cy - h * 2 + 1); x.lineTo(cx + w, cy - h + 1); x.lineTo(cx, cy + 1); x.lineTo(cx - w, cy - h + 1); x.closePath(); x.stroke();
      }
    } else if (def.sym) {
      x.fillStyle = def.col + '33';
      x.strokeStyle = def.col!;
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(24, 3); x.lineTo(45, 24); x.lineTo(24, 45); x.lineTo(3, 24); x.closePath();
      x.fill(); x.stroke();
      x.fillStyle = def.col!;
      x.font = '700 ' + (def.sym.length > 1 ? 15 : 19) + 'px Rajdhani, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(def.sym, 24, 25);
    } else {
      const g = def.glyph!, col = def.col || '#fff';
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2.4;
      if (g === 'plate') {
        for (let i = 0; i < 3; i++) { x.strokeRect(9 + i * 3, 12 + i * 5, 26, 8); }
      } else if (g === 'tube') {
        x.beginPath();
        for (let t = 0; t <= 40; t++) { const px2 = 6 + t * 0.9, py = 24 + Math.sin(t * 0.55) * 8; if (t) x.lineTo(px2, py); else x.moveTo(px2, py); }
        x.stroke();
        x.beginPath();
        for (let t = 0; t <= 40; t++) { const px2 = 6 + t * 0.9, py = 24 - Math.sin(t * 0.55) * 8; if (t) x.lineTo(px2, py); else x.moveTo(px2, py); }
        x.stroke();
      } else if (g === 'fuel') {
        x.strokeRect(15, 8, 18, 32); x.fillRect(19, 4, 10, 5);
        x.fillRect(18, 26, 12, 11);
      } else if (g === 'warp') {
        x.beginPath(); x.arc(24, 24, 15, 0, 6.28); x.stroke();
        x.beginPath(); x.arc(24, 24, 7, 0, 6.28); x.fill();
        x.beginPath(); x.moveTo(24, 2); x.lineTo(24, 12); x.moveTo(24, 36); x.lineTo(24, 46); x.moveTo(2, 24); x.lineTo(12, 24); x.moveTo(36, 24); x.lineTo(46, 24); x.stroke();
      } else if (g === 'batt') {
        x.strokeRect(14, 10, 20, 32); x.fillRect(20, 5, 8, 5);
        x.beginPath(); x.moveTo(26, 16); x.lineTo(19, 27); x.lineTo(24, 27); x.lineTo(21, 37); x.lineTo(30, 24); x.lineTo(25, 24); x.closePath(); x.fill();
      } else if (g === 'o2c') {
        x.beginPath(); x.ellipse(24, 24, 10, 17, 0, 0, 6.28); x.stroke();
        x.font = '700 13px Rajdhani'; x.textAlign = 'center'; x.fillText('O₂', 24, 28);
      } else if (g === 'med') {
        x.strokeRect(10, 14, 28, 22);
        x.fillRect(21, 19, 6, 12); x.fillRect(18, 22, 12, 6);
      }
    }
    const url = c.toDataURL();
    this.iconCache[itemId] = url;
    return url;
  }
}
