/** EdgeTX B&W backlight (matches @edgetx/simulator-ui). */
export const LCD_BACKLIGHT_RGB = { r: 47, g: 123, b: 227 } as const;

/** Compute LCD framebuffer byte size from dimensions and bit depth. */
export function lcdFrameByteSize(
  width: number,
  height: number,
  depth: number,
): number {
  if (depth === 1) {
    return width * ((height + 7) >> 3);
  }
  if (depth === 4) {
    return (width * height * 4) >> 3;
  }
  return width * height * (depth >> 3);
}

function cropDepth1(
  data: Uint8Array,
  lcdW: number,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number,
): Uint8Array {
  const outPages = (zoneH + 7) >> 3;
  const out = new Uint8Array(zoneW * outPages);
  for (let y = 0; y < zoneH; y++) {
    const srcY = zoneY + y;
    for (let x = 0; x < zoneW; x++) {
      const srcX = zoneX + x;
      const srcByte = data[(srcY >> 3) * lcdW + srcX] ?? 0;
      const bit = (srcByte >> (srcY & 7)) & 1;
      if (bit) {
        out[(y >> 3) * zoneW + x]! |= 1 << (y & 7);
      }
    }
  }
  return out;
}

function cropDepth4(
  data: Uint8Array,
  lcdW: number,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number,
): Uint8Array {
  const out = new Uint8Array((zoneW * zoneH * 4) >> 3);
  for (let y = 0; y < zoneH; y++) {
    const srcY = zoneY + y;
    for (let x = 0; x < zoneW; x++) {
      const srcX = zoneX + x;
      const srcByte = data[(srcY >> 1) * lcdW + srcX] ?? 0;
      const nibble = srcY & 1 ? (srcByte >> 4) & 15 : srcByte & 15;
      const dstIdx = (y >> 1) * zoneW + x;
      if (y & 1) {
        out[dstIdx] = (out[dstIdx]! & 0x0f) | (nibble << 4);
      } else {
        out[dstIdx] = (out[dstIdx]! & 0xf0) | nibble;
      }
    }
  }
  return out;
}

/** Crop a full LCD buffer to a widget zone rectangle. */
export function cropZoneFromFramebuffer(
  data: Uint8Array,
  lcdW: number,
  lcdH: number,
  depth: number,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number,
): Uint8Array {
  if (zoneX === 0 && zoneY === 0 && zoneW === lcdW && zoneH === lcdH) {
    // Callers that need an owned buffer should copy; paint path reuses the view.
    return data;
  }

  if (depth === 1) {
    return cropDepth1(data, lcdW, zoneX, zoneY, zoneW, zoneH);
  }
  if (depth === 4) {
    return cropDepth4(data, lcdW, zoneX, zoneY, zoneW, zoneH);
  }

  const bpp = depth >> 3;
  const rowBytes = lcdW * bpp;
  const out = new Uint8Array(zoneW * zoneH * bpp);

  for (let y = 0; y < zoneH; y++) {
    const srcOff = (zoneY + y) * rowBytes + zoneX * bpp;
    const dstOff = y * zoneW * bpp;
    out.set(data.subarray(srcOff, srcOff + zoneW * bpp), dstOff);
  }

  return out;
}

/** Convert RGB565 little-endian buffer to RGBA ImageData (for 2D canvas fallback). */
export function rgb565ToImageData(
  data: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const out = new Uint8ClampedArray(width * height * 4);
  let si = 0;
  for (let i = 0; i < width * height; i++) {
    const lo = data[si++]!;
    const hi = data[si++]!;
    const rgb565 = lo | (hi << 8);
    const r = (((rgb565 >> 11) & 0x1f) * 255) / 31;
    const g = (((rgb565 >> 5) & 0x3f) * 255) / 63;
    const b = ((rgb565 & 0x1f) * 255) / 31;
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return new ImageData(out, width, height);
}

/**
 * Convert 1-bit vertical bitplane LCD buffer to RGBA.
 * Lit pixels are black; unlit pixels use the EdgeTX backlight color.
 */
export function mono1ToImageData(
  data: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const { r: br, g: bg, b: bb } = LCD_BACKLIGHT_RGB;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = (data[(y >> 3) * width + x]! >> (y & 7)) & 1;
      const o = (y * width + x) * 4;
      if (bit) {
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
      } else {
        out[o] = br;
        out[o + 1] = bg;
        out[o + 2] = bb;
      }
      out[o + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}

/**
 * Convert 4-bit grayscale LCD buffer to RGBA (nibble ink toward black from backlight).
 */
export function gray4ToImageData(
  data: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const { r: br, g: bg, b: bb } = LCD_BACKLIGHT_RGB;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = data[(y >> 1) * width + x] ?? 0;
      const level = (y & 1 ? (byte >> 4) & 15 : byte & 15) / 15;
      const ink = 1 - level;
      const o = (y * width + x) * 4;
      out[o] = (br * ink) | 0;
      out[o + 1] = (bg * ink) | 0;
      out[o + 2] = (bb * ink) | 0;
      out[o + 3] = 255;
    }
  }
  return new ImageData(out, width, height);
}
