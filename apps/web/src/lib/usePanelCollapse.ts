"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "etx-panel-collapse";

type PanelCollapseState = {
  history: boolean;
  artifact: boolean;
};

const DEFAULT: PanelCollapseState = { history: false, artifact: false };

function readStored(): PanelCollapseState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<PanelCollapseState>;
    return {
      history: parsed.history ?? false,
      artifact: parsed.artifact ?? false,
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

  useEffect(() => {
    setState(readStored());
  }, []);

  const toggleHistory = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, history: !prev.history };
      writeStored(next);
      return next;
    });
  }, []);

  const toggleArtifact = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, artifact: !prev.artifact };
      writeStored(next);
      return next;
    });
  }, []);

  return {
    historyCollapsed: state.history,
    artifactCollapsed: state.artifact,
    toggleHistory,
    toggleArtifact,
  };
}
