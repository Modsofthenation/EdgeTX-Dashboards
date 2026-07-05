/** Compute LCD framebuffer byte size from dimensions and bit depth. */
export function lcdFrameByteSize(width: number, height: number, depth: number): number {
  if (depth === 1) {
    return width * ((height + 7) >> 3);
  }
  if (depth === 4) {
    return (width * height * 4) >> 3;
  }
  return width * height * (depth >> 3);
}

/** Crop a full LCD RGB565/RGB888 buffer to a widget zone rectangle. */
export function cropZoneFromFramebuffer(
  data: Uint8Array,
  lcdW: number,
  lcdH: number,
  depth: number,
  zoneX: number,
  zoneY: number,
  zoneW: number,
  zoneH: number
): Uint8Array {
  if (zoneX === 0 && zoneY === 0 && zoneW === lcdW && zoneH === lcdH) {
    return data.slice();
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
export function rgb565ToImageData(data: Uint8Array, width: number, height: number): ImageData {
  const out = new Uint8ClampedArray(width * height * 4);
  let si = 0;
  for (let i = 0; i < width * height; i++) {
    const lo = data[si++];
    const hi = data[si++];
    const rgb565 = lo | (hi << 8);
    const r = ((rgb565 >> 11) & 0x1f) * 255 / 31;
    const g = ((rgb565 >> 5) & 0x3f) * 255 / 63;
    const b = (rgb565 & 0x1f) * 255 / 31;
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return new ImageData(out, width, height);
}
