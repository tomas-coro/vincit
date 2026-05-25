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

const BG_OUTER = hexRgb('#091408');   // verde notte — sfondo
const BG_INNER = hexRgb('#08160b');   // verde centrale — area chip
const GOLD     = hexRgb('#d4a830');   // oro principale
const GOLD_LIT = hexRgb('#f0d060');   // oro chiaro — top gradiente V

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawIcon(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const rr  = size * 0.211;  // corner radius — 108/512

  // rounded-rect mask
  const inR1 = x >= rr && x < size - rr && y >= 0 && y < size;
  const inR2 = y >= rr && y < size - rr && x >= 0 && x < size;
  const corners = [[rr,rr],[size-rr,rr],[rr,size-rr],[size-rr,size-rr]];
  const inside  = inR1 || inR2 || corners.some(([cx2,cy2]) => Math.hypot(x-cx2, y-cy2) < rr);
  if (!inside) return BG_OUTER;

  const dx   = x - cx, dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const outerR = size * 0.449;  // 230/512
  const innerR = size * 0.375;  // 192/512

  // chip ring: 6 settori oro
  if (dist >= innerR && dist <= outerR) {
    const angle      = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
    const sectorSpan = (2 * Math.PI) / 6;
    const goldWidth  = sectorSpan * 0.714;  // 60.21/(60.21+24.08)
    const offset     = 0.21;
    const relAngle   = (angle + offset) % sectorSpan;
    return relAngle < goldWidth ? GOLD : BG_OUTER;
  }

  if (dist > outerR) return BG_OUTER;

  // V geometrica — due segmenti con gradiente verticale
  const vStroke = size * 0.062;
  const p1x = size * 0.270, p1y = size * 0.293;  // top-left
  const p2x = size * 0.500, p2y = size * 0.715;  // bottom tip
  const p3x = size * 0.730, p3y = size * 0.293;  // top-right

  const dV = Math.min(
    distToSeg(x, y, p1x, p1y, p2x, p2y),
    distToSeg(x, y, p2x, p2y, p3x, p3y)
  );

  if (dV < vStroke) {
    const t = Math.max(0, Math.min(1, (y - p1y) / (p2y - p1y)));
    return [
      Math.round(GOLD_LIT[0] + (GOLD[0] - GOLD_LIT[0]) * t),
      Math.round(GOLD_LIT[1] + (GOLD[1] - GOLD_LIT[1]) * t),
      Math.round(GOLD_LIT[2] + (GOLD[2] - GOLD_LIT[2]) * t),
    ];
  }

  return BG_INNER;
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
