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
} from "./luaPreviewWorkerClient";

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

/**
 * Offloads applyMockToCommands to a worker. Keeps last-good commands while
 * pending so paint never blanks. Falls back to sync interpret if the worker
 * is unavailable.
 */
export function useLuaPreviewCommands(
  source: string | null | undefined,
  scenario: LayoutScenario,
  profileId = "tx15",
): UseLuaPreviewCommandsResult {
  const [commands, setCommands] = useState<PreviewDrawCommand[]>([]);
  const [meta, setMeta] = useState<PreviewParseMeta | null>(null);
  const [pending, setPending] = useState(false);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!source) {
      setCommands([]);
      setMeta(null);
      setPending(false);
      return;
    }

    const seq = ++requestSeq.current;
    setPending(true);
    const client = getLuaPreviewWorkerClient();
    const generation = client.setSource(source, profileId);

    const applyResult = (result: LuaPreviewResult) => {
      if (seq !== requestSeq.current) return;
      setCommands(result.commands);
      setMeta(result.meta);
      setPending(false);
    };

    void client
      .applyMock(scenario, generation)
      .then(applyResult)
      .catch(() => {
        if (seq !== requestSeq.current) return;
        applyResult(interpretPreviewSync(source, scenario, profileId));
      });
  }, [source, scenario, profileId]);

  return {
    commands,
    meta: meta ?? (source ? EMPTY_META : null),
    pending,
  };
}
