"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

const STORAGE_KEY = "etx-panel-collapse";
const NARROW_MQ = "(max-width: 960px)";

type PanelCollapseState = {
  history: boolean;
  artifact: boolean;
};

/** Artifact panel starts expanded so preview/download are visible on first visit. */
const DEFAULT_DESKTOP: PanelCollapseState = { history: false, artifact: false };

/** On phones/tablets, start collapsed so the chat column keeps vertical space. */
const DEFAULT_NARROW: PanelCollapseState = { history: true, artifact: true };

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(NARROW_MQ).matches;
}

function defaultForViewport(): PanelCollapseState {
  return isNarrowViewport() ? DEFAULT_NARROW : DEFAULT_DESKTOP;
}

function readStored(): PanelCollapseState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelCollapseState>;
    return {
      history: parsed.history ?? DEFAULT_DESKTOP.history,
      artifact: parsed.artifact ?? DEFAULT_DESKTOP.artifact,
    };
  } catch {
    return null;
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
  const [state, setState] = useState<PanelCollapseState>(DEFAULT_DESKTOP);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const stored = readStored();
    setState(stored ?? defaultForViewport());
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

  const expandArtifact = useCallback(() => {
    startTransition(() => {
      setState((prev) => {
        if (!prev.artifact) return prev;
        const next = { ...prev, artifact: false };
        writeStored(next);
        return next;
      });
    });
  }, [startTransition]);

  const collapseArtifact = useCallback(() => {
    startTransition(() => {
      setState((prev) => {
        if (prev.artifact) return prev;
        const next = { ...prev, artifact: true };
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
    expandArtifact,
    collapseArtifact,
  };
}
