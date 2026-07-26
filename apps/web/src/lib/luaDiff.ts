/**
 * Line-oriented unified diff for refine version compare (no external deps).
 */
export function unifiedDiff(
  before: string,
  after: string,
  opts?: { maxLines?: number; fromLabel?: string; toLabel?: string },
): string {
  const maxLines = opts?.maxLines ?? 200;
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [
    `--- ${opts?.fromLabel ?? "previous"}`,
    `+++ ${opts?.toLabel ?? "current"}`,
  ];

  // Simple LCS-based diff for moderate Lua files.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        a[i] === b[j]
          ? (dp[i + 1]![j + 1] ?? 0) + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      lines.push(`-${a[i]}`);
      i++;
    } else {
      lines.push(`+${b[j]}`);
      j++;
    }
    if (lines.length >= maxLines) {
      lines.push("… (diff truncated)");
      return lines.join("\n");
    }
  }
  while (i < n) {
    lines.push(`-${a[i++]}`);
    if (lines.length >= maxLines) {
      lines.push("… (diff truncated)");
      return lines.join("\n");
    }
  }
  while (j < m) {
    lines.push(`+${b[j++]}`);
    if (lines.length >= maxLines) {
      lines.push("… (diff truncated)");
      return lines.join("\n");
    }
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
