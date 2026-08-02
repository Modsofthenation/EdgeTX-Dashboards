/**
 * Line-oriented unified diff for refine version compare (no external deps).
 * Caps LCS matrix size so large imported Lua cannot freeze the main thread.
 */

const DEFAULT_MAX_LINES = 200;
/** Soft cap on (n+1)*(m+1) DP cells before falling back to a simplified diff. */
const DEFAULT_MAX_MATRIX_CELLS = 250_000;

function stripCommonEdges(
  a: string[],
  b: string[],
): {
  prefix: string[];
  suffix: string[];
  midA: string[];
  midB: string[];
} {
  let start = 0;
  const minLen = Math.min(a.length, b.length);
  while (start < minLen && a[start] === b[start]) start++;

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  return {
    prefix: a.slice(0, start),
    suffix: a.slice(endA + 1),
    midA: a.slice(start, endA + 1),
    midB: b.slice(start, endB + 1),
  };
}

function pushTruncated(
  lines: string[],
  maxLines: number,
  row: string,
): boolean {
  if (lines.length >= maxLines) {
    lines.push("… (diff truncated)");
    return true;
  }
  lines.push(row);
  return lines.length >= maxLines
    ? (lines.push("… (diff truncated)"), true)
    : false;
}

function simplifiedMiddleDiff(
  midA: string[],
  midB: string[],
  lines: string[],
  maxLines: number,
): void {
  for (const row of midA) {
    if (pushTruncated(lines, maxLines, `-${row}`)) return;
  }
  for (const row of midB) {
    if (pushTruncated(lines, maxLines, `+${row}`)) return;
  }
  if (lines.length < maxLines) {
    lines.push("… (diff simplified: input too large)");
  }
}

export function unifiedDiff(
  before: string,
  after: string,
  opts?: {
    maxLines?: number;
    maxMatrixCells?: number;
    fromLabel?: string;
    toLabel?: string;
  },
): string {
  const maxLines = opts?.maxLines ?? DEFAULT_MAX_LINES;
  const maxMatrixCells = opts?.maxMatrixCells ?? DEFAULT_MAX_MATRIX_CELLS;
  const rawA = before.replace(/\r\n/g, "\n").split("\n");
  const rawB = after.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [
    `--- ${opts?.fromLabel ?? "previous"}`,
    `+++ ${opts?.toLabel ?? "current"}`,
  ];

  const { prefix, suffix, midA, midB } = stripCommonEdges(rawA, rawB);

  for (const row of prefix) {
    if (pushTruncated(lines, maxLines, ` ${row}`)) return lines.join("\n");
  }

  const n = midA.length;
  const m = midB.length;
  if ((n + 1) * (m + 1) > maxMatrixCells) {
    simplifiedMiddleDiff(midA, midB, lines, maxLines);
    if (lines[lines.length - 1] === "… (diff truncated)") {
      return lines.join("\n");
    }
    for (const row of suffix) {
      if (pushTruncated(lines, maxLines, ` ${row}`)) return lines.join("\n");
    }
    return lines.join("\n");
  }

  // Simple LCS-based diff for moderate Lua files.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        midA[i] === midB[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      if (pushTruncated(lines, maxLines, ` ${midA[i]}`))
        return lines.join("\n");
      i++;
      j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      if (pushTruncated(lines, maxLines, `-${midA[i]}`))
        return lines.join("\n");
      i++;
    } else {
      if (pushTruncated(lines, maxLines, `+${midB[j]}`))
        return lines.join("\n");
      j++;
    }
  }
  while (i < n) {
    if (pushTruncated(lines, maxLines, `-${midA[i++]}`))
      return lines.join("\n");
  }
  while (j < m) {
    if (pushTruncated(lines, maxLines, `+${midB[j++]}`))
      return lines.join("\n");
  }

  for (const row of suffix) {
    if (pushTruncated(lines, maxLines, ` ${row}`)) return lines.join("\n");
  }
  return lines.join("\n");
}

export function summarizeDiff(diffText: string): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }
  return { added, removed };
}
