"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

const STORAGE_KEY = "etx-panel-collapse";

type PanelCollapseState = {
  history: boolean;
  artifact: boolean;
};

const DEFAULT: PanelCollapseState = { history: false, artifact: true };

function readStored(): PanelCollapseState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PanelCollapseState>;
    return {
      history: parsed.history ?? false,
      artifact: parsed.artifact ?? true,
    };
  } catch {
    return DEFAULT;
  }
}

function writeStored(state: PanelCollapseState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function usePanelCollapse() {
  const [state, setState] = useState<PanelCollapseState>(DEFAULT);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setState(readStored());
  }, []);

  const toggleHistory = useCallback(() => {
    startTransition(() => {
      setState((prev) => {
        const next = { ...prev, history: !prev.history };
        writeStored(next);
        return next;
      });
    });
  }, [startTransition]);

  const toggleArtifact = useCallback(() => {
    startTransition(() => {
      setState((prev) => {
        const next = { ...prev, artifact: !prev.artifact };
        writeStored(next);
        return next;
      });
    });
  }, [startTransition]);

  return {
    historyCollapsed: state.history,
    artifactCollapsed: state.artifact,
    toggleHistory,
    toggleArtifact,
  };
}
