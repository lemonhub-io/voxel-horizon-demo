import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const iconsDir = path.join(root, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crc]);
}

/** Simple square icon: dark bg + solid cyan square inset. */
function makeSquarePng(size) {
  const rows = [];
  const margin = Math.round(size * 0.18);
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const i = 1 + x * 4;
      const inSquare = x >= margin && x < size - margin && y >= margin && y < size - margin;
      if (inSquare) {
        row[i] = 0x5e;
        row[i + 1] = 0xc8;
        row[i + 2] = 0xff;
        row[i + 3] = 0xff;
      } else {
        row[i] = 0x0a;
        row[i + 1] = 0x14;
        row[i + 2] = 0x20;
        row[i + 3] = 0xff;
      }
    }
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIcoFromPng(pngBuf, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuf]);
}

const outputs = [
  [32, path.join(root, 'favicon-32.png')],
  [180, path.join(iconsDir, 'apple-touch-icon.png')],
  [192, path.join(iconsDir, 'icon-192.png')],
  [512, path.join(iconsDir, 'icon-512.png')],
];

for (const [size, file] of outputs) {
  fs.writeFileSync(file, makeSquarePng(size));
  console.log('wrote', file);
}

const icoPng = makeSquarePng(32);
fs.writeFileSync(path.join(root, 'favicon.ico'), makeIcoFromPng(icoPng, 32));
console.log('wrote favicon.ico');
