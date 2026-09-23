import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICONS_DIR = path.resolve(__dirname, '../public/icons');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const typeAndData = Buffer.concat([t, data]);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Creates a valid RGBA PNG buffer with an anchor motif on dark slate background.
 */
function createIconPng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA (color type 6)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = makeChunk('IHDR', ihdrData);

  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: #020617 (slate-950) with subtle radial gradient to #0f172a
      let r = 2;
      let g = 6;
      let b = 23;
      let a = 255;

      if (dist < radius) {
        const factor = 1 - dist / radius;
        r = Math.round(2 + factor * 13);
        g = Math.round(6 + factor * 17);
        b = Math.round(23 + factor * 19);
      }

      // Outer golden border ring
      if (Math.abs(dist - radius) < size * 0.02) {
        r = 245; g = 158; b = 11; // Amber-500
      }

      // Normalized coordinates -1 to 1
      const nx = dx / (size * 0.5);
      const ny = dy / (size * 0.5);

      // Anchor top ring
      const ringDy = ny - (-0.45);
      const ringDist = Math.sqrt(nx * nx + ringDy * ringDy);
      if (ringDist < 0.16 && ringDist > 0.08) {
        r = 251; g = 191; b = 36; // Amber-400
      }

      // Anchor horizontal crossbar
      if (ny > -0.28 && ny < -0.22 && Math.abs(nx) < 0.35) {
        r = 245; g = 158; b = 11;
      }
      // Crossbar end spheres
      const leftSphere = Math.sqrt((nx - (-0.35)) ** 2 + (ny - (-0.25)) ** 2);
      const rightSphere = Math.sqrt((nx - 0.35) ** 2 + (ny - (-0.25)) ** 2);
      if (leftSphere < 0.06 || rightSphere < 0.06) {
        r = 251; g = 191; b = 36;
      }

      // Anchor vertical shaft
      if (Math.abs(nx) < 0.06 && ny >= -0.4 && ny <= 0.45) {
        r = 245; g = 158; b = 11;
      }

      // Anchor bottom curved flukes
      const flukeDist = Math.sqrt(nx * nx + (ny - 0.1) ** 2);
      if (flukeDist > 0.38 && flukeDist < 0.48 && ny > 0.05 && ny < 0.52) {
        r = 245; g = 158; b = 11;
      }

      // Fluke arrow tips
      const leftTipDist = Math.sqrt((nx - (-0.43)) ** 2 + (ny - 0.1) ** 2);
      const rightTipDist = Math.sqrt((nx - 0.43) ** 2 + (ny - 0.1) ** 2);
      if (leftTipDist < 0.08 || rightTipDist < 0.08) {
        r = 251; g = 191; b = 36;
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), createIconPng(192));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), createIconPng(512));
console.log('Successfully generated public/icons/icon-192.png and public/icons/icon-512.png');
