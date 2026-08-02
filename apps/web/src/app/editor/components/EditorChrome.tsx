"use client";

import { memo } from "react";
import { AppChrome } from "~/components/AppChrome";
import { EditorMenu, type EditorMenuItem } from "./EditorMenu";
import styles from "../editor.module.css";

export const EditorChrome = memo(function EditorChrome({
  subtitle,
  generateHref,
  layoutHref,
  copyDone,
  canRebuildFromScene,
  hasRecords,
  dirty,
  onOpenSim,
  onOpenExport,
  onCopyLua,
  onOpenImport,
  onRebuildFromScene,
  onNewBoard,
  onClearAllLayers,
  onOpenPrefs,
}: {
  subtitle: React.ReactNode;
  generateHref: string;
  layoutHref: string;
  copyDone: boolean;
  canRebuildFromScene: boolean;
  hasRecords: boolean;
  dirty: boolean;
  onOpenSim: () => void;
  onOpenExport: () => void;
  onCopyLua: () => void;
  onOpenImport: () => void;
  onRebuildFromScene: () => void;
  onNewBoard: () => void;
  onClearAllLayers: () => void;
  onOpenPrefs: () => void;
}) {
  const moreItems: EditorMenuItem[] = [
    {
      id: "copy",
      label: copyDone ? "Copied" : "Copy Lua",
      onClick: onCopyLua,
    },
    {
      id: "import",
      label: "Import Lua…",
      onClick: onOpenImport,
    },
    {
      id: "rebuild-from-scene",
      label: "Rebuild Lua from scene…",
      disabled: !canRebuildFromScene,
      separatorBefore: true,
      onClick: onRebuildFromScene,
    },
    {
      id: "new",
      label: "New board",
      separatorBefore: true,
      onClick: () => {
        if (dirty && !window.confirm("Discard unsaved changes?")) return;
        onNewBoard();
      },
    },
    {
      id: "clear-all",
      label: "Clear all layers…",
      disabled: !hasRecords,
      onClick: onClearAllLayers,
    },
    {
      id: "prefs",
      label: "Preferences…",
      separatorBefore: true,
      onClick: onOpenPrefs,
    },
  ];

  return (
    <AppChrome
      surface="layout"
      subtitle={subtitle}
      generateHref={generateHref}
      layoutHref={layoutHref}
      actions={
        <>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onOpenSim}
          >
            <span className={styles.actionLabelFull}>Simulator</span>
            <span className={styles.actionLabelShort}>Sim</span>
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onOpenExport}
          >
            <span className={styles.actionLabelFull}>Export</span>
            <span className={styles.actionLabelShort}>Export</span>
          </button>
          <EditorMenu
            label="More"
            variant="ghost"
            align="right"
            title="Copy, import, and preferences"
            items={moreItems}
          />
        </>
      }
    />
  );
});
