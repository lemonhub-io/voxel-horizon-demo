const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  smooth(t) { return t * t * (3 - 2 * t); },
  rand(a, b) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(U.rand(a, b + 1)); },
  pick(arr, rng) { return arr[Math.floor((rng ? rng() : Math.random()) * arr.length)]; },
  dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); },
  fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm'; },
  fmtTime(s) { const m = Math.floor(s / 60), h = Math.floor(m / 60); return h > 0 ? h + '小时' + (m % 60) + '分' : m + '分' + Math.floor(s % 60) + '秒'; },

  xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  },
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  seedFromString(str) { return U.xmur3(String(str))(); },
  hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgbHex(r, g, b) {
    return '#' + ((1 << 24) | (U.clamp(Math.round(r), 0, 255) << 16) | (U.clamp(Math.round(g), 0, 255) << 8) | U.clamp(Math.round(b), 0, 255)).toString(16).slice(1);
  },
  mixHex(a, b, t) {
    const A = U.hexRgb(a), B = U.hexRgb(b);
    return U.rgbHex(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t));
  },
  shade(hex, f) {
    const c = U.hexRgb(hex);
    return U.rgbHex(c[0] * f, c[1] * f, c[2] * f);
  },
  vary(hex, rng, amt) {
    const c = U.hexRgb(hex), v = (rng() * 2 - 1) * amt;
    return U.rgbHex(c[0] + v, c[1] + v, c[2] + v);
  },

  roman(n) {
    const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
    return s;
  },
  planetName(rng) {
    const a = ['VE', 'KA', 'NO', 'TAU', 'OS', 'RIL', 'UM', 'ETH', 'AR', 'ZE', 'LU', 'MIR', 'HOR', 'KEL', 'SYN'];
    const b = ['LOS', 'VARA', 'DUN', 'MIA', 'THEA', 'RIS', 'GON', 'NIA', 'DRA', 'XIS', 'TERA', 'BOS'];
    let n = U.pick(a, rng) + U.pick(b, rng).toLowerCase();
    n = n[0] + n.slice(1).toLowerCase();
    return n.toUpperCase() + '-' + U.roman(1 + Math.floor(rng() * 12));
  },
  creatureName(rng) {
    const cn = ['洛姆', '凯特', '维拉', '诺克', '塔什', '乌鲁', '泽菲', '伊卡', '穆恩', '嘎伦', '席尔', '波克'];
    const suf = ['兽', '行者', '掠影', '跳跃者', '啃食兽', 'longback', '鸣禽'];
    const lat = ['Lomus', 'Ketra', 'Velia', 'Nokk', 'Tashi', 'Uruu', 'Zephi', 'Ikara', 'Muun', 'Garen', 'Ssiil', 'Bokk'];
    const i = Math.floor(rng() * cn.length);
    return cn[i] + U.pick(suf.slice(0, 5), rng) + ' · ' + lat[i];
  },
  floraName(rng) {
    const a = ['荧', '棘', '雾', '露', '晶', '孢', '焰', '霜'];
    const b = ['纹草', '冠花', '脉藤', '苞菌', '羽蕨', '灯树'];
    return U.pick(a, rng) + U.pick(b, rng);
  }
};

class SimplexNoise {
  constructor(seed) {
    const rng = U.mulberry32(seed);
    this.p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    this.g3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  }
  noise2(xin, yin) {
    const p = this.p, g = this.g3;
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; const gi = p[ii + p[jj]] % 12; n0 = t0 * t0 * (g[gi][0] * x0 + g[gi][1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; const gi = p[ii + i1 + p[jj + j1]] % 12; n1 = t1 * t1 * (g[gi][0] * x1 + g[gi][1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; const gi = p[ii + 1 + p[jj + 1]] % 12; n2 = t2 * t2 * (g[gi][0] * x2 + g[gi][1] * y2); }
    return 70 * (n0 + n1 + n2);
  }
  noise3(xin, yin, zin) {
    const p = this.p, g = this.g3;
    const F3 = 1 / 3, G3 = 1 / 6;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) { t0 *= t0; const gi = p[ii + p[jj + p[kk]]] % 12; n0 = t0 * t0 * (g[gi][0] * x0 + g[gi][1] * y0 + g[gi][2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) { t1 *= t1; const gi = p[ii + i1 + p[jj + j1 + p[kk + k1]]] % 12; n1 = t1 * t1 * (g[gi][0] * x1 + g[gi][1] * y1 + g[gi][2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) { t2 *= t2; const gi = p[ii + i2 + p[jj + j2 + p[kk + k2]]] % 12; n2 = t2 * t2 * (g[gi][0] * x2 + g[gi][1] * y2 + g[gi][2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) { t3 *= t3; const gi = p[ii + 1 + p[jj + 1 + p[kk + 1]]] % 12; n3 = t3 * t3 * (g[gi][0] * x3 + g[gi][1] * y3 + g[gi][2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }
  fbm2(x, y, oct, lac, gain) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.noise2(x * freq, y * freq) * amp;
      norm += amp; amp *= gain; freq *= lac;
    }
    return sum / norm;
  }
}
