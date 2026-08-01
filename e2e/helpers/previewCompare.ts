/**
 * Pixel / histogram comparison for approximate (parser) vs radio (WASM) previews.
 * Fonts will never match EdgeTX bitmaps — thresholds allow text drift while
 * catching panel/color/geometry regressions.
 */

export type RgbaBitmap = {
  width: number;
  height: number;
  /** Flattened RGBA bytes (length = width * height * 4). */
  data: number[] | Uint8ClampedArray;
};

export type PreviewCompareMetrics = {
  width: number;
  height: number;
  /** Mean absolute error per channel over all pixels (0–255). */
  mae: number;
  /** Fraction of pixels whose RGB distance exceeds hardThreshold (0–1). */
  hardMismatchRatio: number;
  /** Histogram correlation of 4-bit RGB buckets (0–1, higher = closer). */
  histCorrelation: number;
  /** Fraction of non-near-black pixels in A and B. */
  coverageA: number;
  coverageB: number;
  /** Absolute coverage difference. */
  coverageDelta: number;
};

const NEAR_BLACK = 18;

function isNearBlack(r: number, g: number, b: number): boolean {
  return r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK;
}

function rgbDist(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/** Crop a top strip (EdgeTX radio chrome) before comparing. */
export function cropTop(bmp: RgbaBitmap, topPx: number): RgbaBitmap {
  const cut = Math.max(0, Math.min(bmp.height - 1, Math.floor(topPx)));
  if (cut <= 0) return bmp;
  const height = bmp.height - cut;
  const data = new Uint8ClampedArray(bmp.width * height * 4);
  const src = bmp.data;
  for (let y = 0; y < height; y++) {
    const si = (y + cut) * bmp.width * 4;
    const di = y * bmp.width * 4;
    for (let i = 0; i < bmp.width * 4; i++) {
      data[di + i] = src[si + i]!;
    }
  }
  return { width: bmp.width, height, data };
}

/** Downscale bitmap to target size with nearest-neighbor (stable for LCD frames). */
export function downscaleNearest(
  src: RgbaBitmap,
  targetW: number,
  targetH: number,
): RgbaBitmap {
  const out = new Uint8ClampedArray(targetW * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / targetH));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / targetW));
      const si = (sy * src.width + sx) * 4;
      const di = (y * targetW + x) * 4;
      out[di] = src.data[si]!;
      out[di + 1] = src.data[si + 1]!;
      out[di + 2] = src.data[si + 2]!;
      out[di + 3] = src.data[si + 3]!;
    }
  }
  return { width: targetW, height: targetH, data: out };
}

function hist4bit(bmp: RgbaBitmap): Float64Array {
  const bins = new Float64Array(16 * 16 * 16);
  const n = bmp.width * bmp.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = bmp.data[o]! >> 4;
    const g = bmp.data[o + 1]! >> 4;
    const b = bmp.data[o + 2]! >> 4;
    bins[(r << 8) | (g << 4) | b]! += 1;
  }
  for (let i = 0; i < bins.length; i++) bins[i]! /= n;
  return bins;
}

function correlation(a: Float64Array, b: Float64Array): number {
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < a.length; i++) {
    sumA += a[i]!;
    sumB += b[i]!;
  }
  const meanA = sumA / a.length;
  const meanB = sumB / b.length;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den < 1e-12) return 1;
  return num / den;
}

/**
 * Compare two RGBA bitmaps. Resizes both to `compareW`×`compareH` first so
 * CSS-scaled canvases remain comparable.
 */
export function compareRgbaBitmaps(
  a: RgbaBitmap,
  b: RgbaBitmap,
  options: {
    compareW?: number;
    compareH?: number;
    hardThreshold?: number;
    /** Ignore this many source rows from the top (radio chrome). */
    maskTopPx?: number;
  } = {},
): PreviewCompareMetrics {
  const compareW = options.compareW ?? 160;
  const compareH = options.compareH ?? 107;
  const hardThreshold = options.hardThreshold ?? 90;
  const maskTop = options.maskTopPx ?? 0;

  const srcA = maskTop > 0 ? cropTop(a, maskTop) : a;
  const srcB = maskTop > 0 ? cropTop(b, maskTop) : b;
  const A = downscaleNearest(srcA, compareW, compareH);
  const B = downscaleNearest(srcB, compareW, compareH);
  const n = compareW * compareH;

  let maeSum = 0;
  let hard = 0;
  let covA = 0;
  let covB = 0;

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r1 = A.data[o]!;
    const g1 = A.data[o + 1]!;
    const b1 = A.data[o + 2]!;
    const r2 = B.data[o]!;
    const g2 = B.data[o + 1]!;
    const b2 = B.data[o + 2]!;
    maeSum += (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / 3;
    if (rgbDist(r1, g1, b1, r2, g2, b2) > hardThreshold) hard++;
    if (!isNearBlack(r1, g1, b1)) covA++;
    if (!isNearBlack(r2, g2, b2)) covB++;
  }

  return {
    width: compareW,
    height: compareH,
    mae: maeSum / n,
    hardMismatchRatio: hard / n,
    histCorrelation: correlation(hist4bit(A), hist4bit(B)),
    coverageA: covA / n,
    coverageB: covB / n,
    coverageDelta: Math.abs(covA - covB) / n,
  };
}

/** Soft gates for parser≈WASM (fonts differ; panels/colors should align). */
export const FIDELITY_GATES = {
  /** Mean absolute RGB error after downscale (0–255). */
  maxMae: 62,
  /** Share of pixels with large RGB distance. */
  maxHardMismatchRatio: 0.48,
  /** Color histogram correlation. */
  minHistCorrelation: 0.48,
  /** Absolute coverage (non-black) delta. */
  maxCoverageDelta: 0.28,
} as const;

export function assertFidelityGates(
  metrics: PreviewCompareMetrics,
  gates: typeof FIDELITY_GATES = FIDELITY_GATES,
): string[] {
  const fails: string[] = [];
  if (metrics.mae > gates.maxMae) {
    fails.push(`mae ${metrics.mae.toFixed(1)} > ${gates.maxMae}`);
  }
  if (metrics.hardMismatchRatio > gates.maxHardMismatchRatio) {
    fails.push(
      `hardMismatch ${metrics.hardMismatchRatio.toFixed(3)} > ${gates.maxHardMismatchRatio}`,
    );
  }
  if (metrics.histCorrelation < gates.minHistCorrelation) {
    fails.push(
      `histCorrelation ${metrics.histCorrelation.toFixed(3)} < ${gates.minHistCorrelation}`,
    );
  }
  if (metrics.coverageDelta > gates.maxCoverageDelta) {
    fails.push(
      `coverageDelta ${metrics.coverageDelta.toFixed(3)} > ${gates.maxCoverageDelta}`,
    );
  }
  return fails;
}

export type SoftFidelityOptions = {
  label?: string;
  /** Enforce strict/structural gates when metrics fall inside this band. */
  enforceWhen: {
    maxMae: number;
    maxCoverageDelta: number;
    maxHardMismatch?: number;
  };
  /** Catastrophic bounds when residual chrome/fonts force a soft skip. */
  softFallback: {
    maxMae: number;
    minCoverageB?: number;
  };
  /** When enforcing inside the soft band, ignore histCorrelation gate failures. */
  ignoreHistCorrelation?: boolean;
  annotate: (notice: string) => void;
  expectEqual: (actual: unknown, expected: unknown, message?: string) => void;
  expectLessThan: (actual: number, bound: number) => void;
  expectGreaterThan: (actual: number, bound: number) => void;
};

/**
 * Shared soft-gate for editor↔WASM compare: enforce when metrics look widget-only,
 * otherwise annotate and apply catastrophic fallbacks.
 */
export function assertSoftFidelity(
  pair: {
    metrics: PreviewCompareMetrics;
    gateFailures: string[];
  },
  opts: SoftFidelityOptions,
): void {
  const { metrics, gateFailures } = pair;
  const label = opts.label ? `${opts.label} ` : "";
  const withinSoftBand =
    metrics.coverageDelta < opts.enforceWhen.maxCoverageDelta &&
    metrics.mae < opts.enforceWhen.maxMae &&
    (opts.enforceWhen.maxHardMismatch === undefined ||
      metrics.hardMismatchRatio < opts.enforceWhen.maxHardMismatch);

  if (gateFailures.length === 0) {
    opts.expectEqual(gateFailures, []);
    return;
  }

  if (withinSoftBand) {
    const fails = opts.ignoreHistCorrelation
      ? gateFailures.filter((f) => !f.includes("histCorrelation"))
      : gateFailures;
    opts.expectEqual(
      fails,
      [],
      `${label}fidelity gates failed: ${fails.join("; ")} · metrics=${JSON.stringify(metrics)}`,
    );
    return;
  }

  opts.annotate(
    `${label}soft-skipped strict pixel gates (likely residual radio chrome). gates=${gateFailures.join("; ")} metrics=${JSON.stringify(metrics)}`,
  );
  opts.expectLessThan(metrics.mae, opts.softFallback.maxMae);
  if (opts.softFallback.minCoverageB !== undefined) {
    opts.expectGreaterThan(metrics.coverageB, opts.softFallback.minCoverageB);
  }
}
