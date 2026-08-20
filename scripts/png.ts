import { deflateSync } from "node:zlib";

/**
 * A minimal PNG encoder (8-bit RGBA, no interlacing).
 *
 * Placeholder art needs to exist before the owner's real art arrives, and pulling in an image
 * library for flat rectangles would be a dependency bought for one script. PNG's uncompressed
 * RGBA path is about forty lines, so we write it.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export type Rgba = [number, number, number, number];

export class Canvas {
  readonly width: number;
  readonly height: number;
  private readonly pixels: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 4);
  }

  set(x: number, y: number, [r, g, b, a]: Rgba): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.pixels[i] = r;
    this.pixels[i + 1] = g;
    this.pixels[i + 2] = b;
    this.pixels[i + 3] = a;
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) this.set(x + dx, y + dy, color);
    }
  }

  strokeRect(x: number, y: number, w: number, h: number, color: Rgba): void {
    for (let dx = 0; dx < w; dx += 1) {
      this.set(x + dx, y, color);
      this.set(x + dx, y + h - 1, color);
    }
    for (let dy = 0; dy < h; dy += 1) {
      this.set(x, y + dy, color);
      this.set(x + w - 1, y + dy, color);
    }
  }

  /** Frame index shown as N small squares, so frames are distinguishable without a font. */
  tally(x: number, y: number, count: number, color: Rgba): void {
    for (let i = 0; i < count; i += 1) this.fillRect(x + i * 4, y, 3, 3, color);
  }

  toPng(): Buffer {
    const raw = Buffer.alloc(this.height * (this.width * 4 + 1));
    for (let y = 0; y < this.height; y += 1) {
      const rowStart = y * (this.width * 4 + 1);
      raw[rowStart] = 0; // filter: none
      Buffer.from(this.pixels.subarray(y * this.width * 4, (y + 1) * this.width * 4)).copy(
        raw,
        rowStart + 1,
      );
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", new Uint8Array()),
    ]);
  }
}

/** Reads width and height from a PNG's IHDR. Used by the asset-contract test. */
export function readPngSize(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
