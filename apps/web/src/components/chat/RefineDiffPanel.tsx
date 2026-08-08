"use client";

import { useMemo } from "react";
import {
  EDITOR_PREVIEW_SCENARIO,
  parseLuaToDrawCommands,
} from "@widget-gen/layout-verify";
import {
  getSimulateLayoutProfile,
  resolvePreviewDimensions,
} from "@widget-gen/shared";
import { summarizeDiff, unifiedDiff } from "~/lib/luaDiff";
import { renderPreviewCommands } from "~/lib/luaPreviewEngine";
import styles from "./RefineDiffPanel.module.css";

interface RefineDiffPanelProps {
  previousLua: string | null | undefined;
  currentLua: string | null | undefined;
  previousLabel?: string;
  currentLabel?: string;
  layoutProfileId?: string;
}

function MiniCanvas({
  luaSource,
  label,
  layoutProfileId,
}: {
  luaSource: string;
  label: string;
  layoutProfileId: string;
}) {
  const profile = useMemo(() => {
    try {
      return getSimulateLayoutProfile(layoutProfileId);
    } catch {
      return getSimulateLayoutProfile("tx15");
    }
  }, [layoutProfileId]);

  const dims = useMemo(
    () => resolvePreviewDimensions(luaSource, profile),
    [luaSource, profile],
  );

  const commands = useMemo(() => {
    const records = parseLuaToDrawCommands(luaSource, {
      ...EDITOR_PREVIEW_SCENARIO,
      mock: EDITOR_PREVIEW_SCENARIO.mock,
    });
    return records.map((r) => ({
      ...r,
      x: r.x != null ? r.x - dims.zoneX : r.x,
      y: r.y != null ? r.y - dims.zoneY : r.y,
      x2: r.x2 != null ? r.x2 - dims.zoneX : r.x2,
      y2: r.y2 != null ? r.y2 - dims.zoneY : r.y2,
    }));
  }, [luaSource, dims.zoneX, dims.zoneY]);

  return (
    <div className={styles.visualPane}>
      <span className={styles.visualLabel}>{label}</span>
      <canvas
        className={styles.visualCanvas}
        width={dims.zoneW}
        height={dims.zoneH}
        ref={(canvas) => {
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#0a0a0c";
          ctx.fillRect(0, 0, dims.zoneW, dims.zoneH);
          renderPreviewCommands(ctx, commands, 1, dims.zoneW, dims.zoneH);
        }}
        aria-label={`${label} layout preview`}
      />
    </div>
  );
}

export function RefineDiffPanel({
  previousLua,
  currentLua,
  previousLabel = "previous",
  currentLabel = "current",
  layoutProfileId = "tx15",
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

  if (!diff || !summary || !previousLua || !currentLua) return null;

  return (
    <details className={styles.root} open>
      <summary className={styles.summary}>
        Layout/Lua changes · +{summary.added} −{summary.removed}
      </summary>
      <div className={styles.visualCompare}>
        <MiniCanvas
          luaSource={previousLua}
          label={previousLabel}
          layoutProfileId={layoutProfileId}
        />
        <MiniCanvas
          luaSource={currentLua}
          label={currentLabel}
          layoutProfileId={layoutProfileId}
        />
      </div>
      <pre className={styles.diff} tabIndex={0}>
        {diff}
      </pre>
    </details>
  );
}
