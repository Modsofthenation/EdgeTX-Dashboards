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

/**
 * Offloads applyMockToCommands to a worker. Keeps last-good commands while
 * pending so paint never blanks. Falls back to sync interpret if the worker
 * is unavailable.
 *
 * `pending` is derived from the applied snapshot vs current inputs so it flips
 * true synchronously on source change (critical for drag keep-alive).
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

  const pending = Boolean(
    source &&
    (!snapshot ||
      snapshot.source !== source ||
      snapshot.profileId !== profileId ||
      snapshot.scenarioKey !== key),
  );

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
  };
}
