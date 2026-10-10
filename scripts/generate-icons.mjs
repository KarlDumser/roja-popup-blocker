import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "extension/icons");

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
};

const icon = (size) => {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);
  const center = (size - 1) / 2;
  const radius = size * 0.44;
  const stroke = Math.max(2, size * 0.09);

  for (let y = 0; y < size; y += 1) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const distance = Math.hypot(x - center, y - center);
      const inside = distance <= radius;
      const slashDistance = Math.abs((x - center) + (y - center)) / Math.SQRT2;
      const onSlash = slashDistance <= stroke && Math.abs(x - center) <= radius * 0.72;
      const border = distance >= radius - stroke && inside;
      const red = border || onSlash;
      pixels[offset] = red ? 230 : inside ? 19 : 0;
      pixels[offset + 1] = red ? 38 : inside ? 23 : 0;
      pixels[offset + 2] = red ? 62 : inside ? 31 : 0;
      pixels[offset + 3] = inside ? 255 : 0;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0))
  ]);
};

await mkdir(output, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await writeFile(path.join(output, `icon${size}.png`), icon(size));
}
console.log("Generated extension icons");

