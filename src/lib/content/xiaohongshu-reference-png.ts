import { deflateSync } from "node:zlib";

import type { XiaohongshuColorScheme, XiaohongshuImageAsset } from "@/lib/types";

type Rgb = [number, number, number];

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]);
const PNG_CACHE = new Map<string, string>();

const COLOR_PALETTES: Record<
  XiaohongshuColorScheme,
  {
    background: Rgb;
    backgroundAlt: Rgb;
    accent: Rgb;
    accentSoft: Rgb;
    line: Rgb;
  }
> = {
  warm: {
    background: [252, 246, 233],
    backgroundAlt: [255, 250, 239],
    accent: [151, 47, 25],
    accentSoft: [246, 198, 152],
    line: [94, 54, 35]
  },
  cool: {
    background: [239, 247, 250],
    backgroundAlt: [250, 253, 254],
    accent: [43, 103, 145],
    accentSoft: [175, 214, 232],
    line: [36, 68, 89]
  },
  vibrant: {
    background: [255, 246, 239],
    backgroundAlt: [255, 252, 246],
    accent: [219, 73, 95],
    accentSoft: [255, 204, 92],
    line: [98, 44, 66]
  },
  classic: {
    background: [245, 243, 233],
    backgroundAlt: [252, 249, 239],
    accent: [30, 72, 124],
    accentSoft: [222, 184, 92],
    line: [54, 47, 38]
  }
};

function buildCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);

  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function mixColor(a: Rgb, b: Rgb, ratio: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * ratio),
    Math.round(a[1] + (b[1] - a[1]) * ratio),
    Math.round(a[2] + (b[2] - a[2]) * ratio)
  ];
}

function isInsideRoundedPanel(
  x: number,
  y: number,
  panel: { x: number; y: number; width: number; height: number }
) {
  return (
    x >= panel.x &&
    x <= panel.x + panel.width &&
    y >= panel.y &&
    y <= panel.y + panel.height
  );
}

function createReferencePngBuffer(colorScheme: XiaohongshuColorScheme) {
  const width = 540;
  const height = 720;
  const palette = COLOR_PALETTES[colorScheme];
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  const panels = [
    { x: 42, y: 180, width: 456, height: 96 },
    { x: 42, y: 302, width: 456, height: 96 },
    { x: 42, y: 424, width: 456, height: 96 },
    { x: 42, y: 570, width: 456, height: 56 }
  ];

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const t = y / height;
      let color = mixColor(palette.backgroundAlt, palette.background, t);
      const wave =
        height * 0.67 +
        Math.sin((x / width) * Math.PI * 1.18) * 24 -
        Math.cos((x / width) * Math.PI * 2) * 9;

      if (y < 72) {
        color = mixColor(palette.accentSoft, palette.backgroundAlt, y / 72);
      } else if (Math.abs(y - wave) < 7) {
        color = palette.accentSoft;
      } else if (y > wave && y < wave + 68) {
        color = mixColor(palette.background, palette.accentSoft, 0.24);
      } else if (panels.some((panel) => isInsideRoundedPanel(x, y, panel))) {
        color = mixColor(palette.backgroundAlt, [255, 255, 255], 0.72);
      } else if (
        (x > 44 && x < 496 && (y === 160 || y === 548)) ||
        (x > 58 && x < 482 && y % 42 === 0 && y > 170 && y < 530)
      ) {
        color = mixColor(palette.line, palette.background, 0.68);
      } else if (
        (x - 76) ** 2 + (y - 108) ** 2 < 17 ** 2 ||
        (x - 464) ** 2 + (y - 116) ** 2 < 22 ** 2 ||
        (x - 430) ** 2 + (y - 650) ** 2 < 16 ** 2
      ) {
        color = palette.accent;
      }

      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = color[0];
      raw[pixelOffset + 1] = color[1];
      raw[pixelOffset + 2] = color[2];
      raw[pixelOffset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

export function createXiaohongshuReferencePngDataUrl(
  asset: XiaohongshuImageAsset
) {
  const colorScheme = asset.colorScheme ?? "warm";
  const cacheKey = `${colorScheme}`;
  const cached = PNG_CACHE.get(cacheKey);

  if (cached) {
    return cached;
  }

  const dataUrl = `data:image/png;base64,${createReferencePngBuffer(
    colorScheme
  ).toString("base64")}`;

  PNG_CACHE.set(cacheKey, dataUrl);

  return dataUrl;
}
