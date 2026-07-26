"use client";

import { useMemo } from "react";
import { summarizeDiff, unifiedDiff } from "~/lib/luaDiff";
import styles from "./RefineDiffPanel.module.css";

interface RefineDiffPanelProps {
  previousLua: string | null | undefined;
  currentLua: string | null | undefined;
  previousLabel?: string;
  currentLabel?: string;
}

export function RefineDiffPanel({
  previousLua,
  currentLua,
  previousLabel = "previous",
  currentLabel = "current",
}: RefineDiffPanelProps) {
  const diff = useMemo(() => {
    if (!previousLua || !currentLua || previousLua === currentLua) return null;
    return unifiedDiff(previousLua, currentLua, {
      fromLabel: previousLabel,
      toLabel: currentLabel,
      maxLines: 160,
    });
  }, [previousLua, currentLua, previousLabel, currentLabel]);

  const summary = useMemo(() => (diff ? summarizeDiff(diff) : null), [diff]);

  if (!diff || !summary) return null;

  return (
    <details className={styles.root} open>
      <summary className={styles.summary}>
        Layout/Lua changes · +{summary.added} −{summary.removed}
      </summary>
      <pre className={styles.diff} tabIndex={0}>
        {diff}
      </pre>
    </details>
  );
}
