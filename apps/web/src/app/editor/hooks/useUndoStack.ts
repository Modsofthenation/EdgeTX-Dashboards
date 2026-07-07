"use client";

import { useCallback, useState } from "react";
import type { WidgetScene } from "@widget-gen/editor-core";

const MAX_UNDO = 50;

export function useUndoStack(initialScene: WidgetScene) {
  const [scene, setSceneState] = useState<WidgetScene>(initialScene);
  const [undoStack, setUndoStack] = useState<WidgetScene[]>([]);
  const [redoStack, setRedoStack] = useState<WidgetScene[]>([]);

  const setScene = useCallback((next: WidgetScene | ((prev: WidgetScene) => WidgetScene)) => {
    setSceneState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (resolved === prev) return prev;
      setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), structuredClone(prev)]);
      setRedoStack([]);
      return resolved;
    });
  }, []);

  const replaceScene = useCallback((next: WidgetScene) => {
    setUndoStack([]);
    setRedoStack([]);
    setSceneState(next);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1]!;
      setRedoStack((redo) => [...redo, structuredClone(scene)]);
      setSceneState(structuredClone(previous));
      return stack.slice(0, -1);
    });
  }, [scene]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1]!;
      setUndoStack((undo) => [...undo, structuredClone(scene)]);
      setSceneState(structuredClone(next));
      return stack.slice(0, -1);
    });
  }, [scene]);

  return {
    scene,
    setScene,
    replaceScene,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
