"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_UNDO = 100;

export function useSourceUndoStack(initialSource: string) {
  const [source, setSourceState] = useState(initialSource);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const sourceRef = useRef(source);
  const transientBaseRef = useRef<string | null>(null);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const setSource = useCallback(
    (
      next: string | ((prev: string) => string),
      opts?: { history?: boolean },
    ) => {
      const recordHistory = opts?.history !== false;
      setSourceState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved === prev) return prev;
        if (recordHistory && transientBaseRef.current == null) {
          setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), prev]);
          setRedoStack([]);
        }
        sourceRef.current = resolved;
        return resolved;
      });
    },
    [],
  );

  const replaceSource = useCallback((next: string) => {
    transientBaseRef.current = null;
    setUndoStack([]);
    setRedoStack([]);
    sourceRef.current = next;
    setSourceState(next);
  }, []);

  /** Start a drag/gesture: subsequent setSource calls skip undo until endTransient. */
  const beginTransient = useCallback(() => {
    if (transientBaseRef.current == null) {
      transientBaseRef.current = sourceRef.current;
    }
  }, []);

  /** Commit one undo entry for the whole transient gesture (if source changed). */
  const endTransient = useCallback(() => {
    const base = transientBaseRef.current;
    transientBaseRef.current = null;
    if (base == null || base === sourceRef.current) return;
    setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), base]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    transientBaseRef.current = null;
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1]!;
      setRedoStack((redo) => [...redo, sourceRef.current]);
      sourceRef.current = previous;
      setSourceState(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    transientBaseRef.current = null;
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1]!;
      setUndoStack((undo) => [...undo, sourceRef.current]);
      sourceRef.current = next;
      setSourceState(next);
      return stack.slice(0, -1);
    });
  }, []);

  return {
    source,
    setSource,
    replaceSource,
    beginTransient,
    endTransient,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoDepth: undoStack.length,
    maxUndo: MAX_UNDO,
  };
}
