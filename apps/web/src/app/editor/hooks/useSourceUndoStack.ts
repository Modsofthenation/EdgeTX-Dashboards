"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_UNDO = 50;

export function useSourceUndoStack(initialSource: string) {
  const [source, setSourceState] = useState(initialSource);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const sourceRef = useRef(source);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const setSource = useCallback((next: string | ((prev: string) => string)) => {
    setSourceState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (resolved === prev) return prev;
      setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), prev]);
      setRedoStack([]);
      return resolved;
    });
  }, []);

  const replaceSource = useCallback((next: string) => {
    setUndoStack([]);
    setRedoStack([]);
    setSourceState(next);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1]!;
      setRedoStack((redo) => [...redo, sourceRef.current]);
      setSourceState(previous);
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1]!;
      setUndoStack((undo) => [...undo, sourceRef.current]);
      setSourceState(next);
      return stack.slice(0, -1);
    });
  }, []);

  return {
    source,
    setSource,
    replaceSource,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
