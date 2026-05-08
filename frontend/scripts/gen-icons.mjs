// Pure-Node PNG generator — no npm deps required
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }

function chunk(type, data) {
  const t = Buffer.from(type);
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const c = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32(d.length), t, d, u32(c)]);
}

function deflateRaw(data) {
  // minimal zlib: store blocks (no compression) — valid for PNG
  const chunks = [];
  const BSIZE = 65535;
  for (let off = 0; off < data.length; off += BSIZE) {
    const block = data.slice(off, off + BSIZE);
    const last  = (off + BSIZE >= data.length) ? 1 : 0;
    const hdr   = Buffer.from([last, block.length & 0xFF, (block.length >> 8) & 0xFF,
                                ~block.length & 0xFF, (~block.length >> 8) & 0xFF]);
    chunks.push(hdr, block);
  }
  const raw = Buffer.concat(chunks);
  // adler32
  let s1 = 1, s2 = 0;
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521; }
  const adler = u32((s2 << 16) | s1);
  // zlib wrapper: CMF=0x78 FLG=0x01 (deflate, no dict, check bits)
  return Buffer.concat([Buffer.from([0x78, 0x01]), raw, adler]);
}

function png(size, drawFn) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  // Build raw pixel data
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      row[1 + x * 3]     = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rows.push(row);
  }
  const raw  = Buffer.concat(rows);
  const idat = deflateRaw(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

const BG   = hexRgb('#07060f');
const GOLD = hexRgb('#c8973f');

function drawIcon(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.16;
  // rounded-rect mask
  const inRect = x >= r && x < size - r && y >= 0 && y < size;
  const inRect2 = y >= r && y < size - r && x >= 0 && x < size;
  const corners = [
    [r, r], [size - r, r], [r, size - r], [size - r, size - r]
  ];
  const inCorner = corners.some(([cx2, cy2]) => Math.hypot(x - cx2, y - cy2) < r);
  const inside = inRect || inRect2 || inCorner;
  if (!inside) return BG; // outside = background (transparent workaround: use dark bg)
  // gold circle
  const circ = Math.hypot(x - cx, y - cy) < size * 0.3;
  return circ ? GOLD : BG;
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512, 180]) {
  const buf = png(size, drawIcon);
  const name = size === 180 ? 'public/icons/apple-touch-icon.png' : `public/icons/icon-${size}.png`;
  writeFileSync(name, buf);
  console.log(`Generated ${name} (${buf.length} bytes)`);
}
// Also write icon-180 alias
writeFileSync('public/icons/icon-180.png', png(180, drawIcon));
console.log('Done.');
