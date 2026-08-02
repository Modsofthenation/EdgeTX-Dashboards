"use client";

import { useEffect, useRef, useState } from "react";
import type {
  LayoutScenario,
  PreviewDrawCommand,
  PreviewParseMeta,
} from "@widget-gen/layout-verify";
import {
  getLuaPreviewWorkerClient,
  interpretPreviewSync,
  type LuaPreviewResult,
} from "./luaPreviewWorkerClient.ts";

export type UseLuaPreviewCommandsResult = {
  commands: PreviewDrawCommand[];
  meta: PreviewParseMeta | null;
  /** True while a newer interpret is in flight (previous commands still painted). */
  pending: boolean;
  /**
   * True only while the applied snapshot source lags the current source.
   * Scenario/profile pending must not keep drag hold transforms alive once
   * geometry commands already match the committed Lua.
   */
  sourcePending: boolean;
};

const EMPTY_META: PreviewParseMeta = {
  warnings: [],
  skippedTextCount: 0,
  zeroCoordCount: 0,
};

function scenarioKey(scenario: LayoutScenario): string {
  // Stable enough for pending derivation; scenarios are small plain objects.
  return JSON.stringify(scenario);
}

/** Pure pending flags for tests and the hook. */
export function deriveLuaPreviewPending(input: {
  source: string | null | undefined;
  snapshot: {
    source: string;
    profileId: string;
    scenarioKey: string;
  } | null;
  profileId: string;
  scenarioKey: string;
}): { pending: boolean; sourcePending: boolean } {
  const { source, snapshot, profileId, scenarioKey: key } = input;
  if (!source) return { pending: false, sourcePending: false };
  const sourcePending = !snapshot || snapshot.source !== source;
  const pending =
    sourcePending ||
    !snapshot ||
    snapshot.profileId !== profileId ||
    snapshot.scenarioKey !== key;
  return { pending, sourcePending };
}

/**
 * Offloads applyMockToCommands to a worker. Keeps last-good commands while
 * pending so paint never blanks. Falls back to sync interpret if the worker
 * is unavailable.
 *
 * `pending` / `sourcePending` are derived from the applied snapshot vs current
 * inputs so they flip true synchronously on source change (critical for drag
 * keep-alive). Drag hold must use `sourcePending` only.
 */
export function useLuaPreviewCommands(
  source: string | null | undefined,
  scenario: LayoutScenario,
  profileId = "tx15",
): UseLuaPreviewCommandsResult {
  const [snapshot, setSnapshot] = useState<{
    source: string;
    profileId: string;
    scenarioKey: string;
    commands: PreviewDrawCommand[];
    meta: PreviewParseMeta | null;
  } | null>(null);
  const requestSeq = useRef(0);
  const key = scenarioKey(scenario);

  const { pending, sourcePending } = deriveLuaPreviewPending({
    source,
    snapshot,
    profileId,
    scenarioKey: key,
  });

  useEffect(() => {
    if (!source) {
      setSnapshot(null);
      return;
    }

    const seq = ++requestSeq.current;
    const client = getLuaPreviewWorkerClient();
    const generation = client.setSource(source, profileId);
    const appliedSource = source;
    const appliedProfile = profileId;
    const appliedKey = key;

    const applyResult = (result: LuaPreviewResult) => {
      if (seq !== requestSeq.current) return;
      setSnapshot({
        source: appliedSource,
        profileId: appliedProfile,
        scenarioKey: appliedKey,
        commands: result.commands,
        meta: result.meta,
      });
    };

    void client
      .applyMock(scenario, generation)
      .then(applyResult)
      .catch(() => {
        if (seq !== requestSeq.current) return;
        applyResult(interpretPreviewSync(source, scenario, profileId));
      });
  }, [source, scenario, profileId, key]);

  return {
    commands: snapshot?.commands ?? [],
    meta: snapshot?.meta ?? (source ? EMPTY_META : null),
    pending,
    sourcePending,
  };
}
