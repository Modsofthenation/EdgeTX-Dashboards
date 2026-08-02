"use client";

import { memo } from "react";
import { AppShell } from "~/components/AppShell";
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
  children,
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
  children?: React.ReactNode;
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
      label: "Settings…",
      separatorBefore: true,
      onClick: onOpenPrefs,
    },
  ];

  return (
    <AppShell
      surface="editor"
      iconRail
      subtitle={subtitle}
      studioHref={generateHref}
      editorHref={layoutHref}
      actions={
        <>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onOpenSim}
            title="Open the full interactive EdgeTX radio simulator"
          >
            <span className={styles.actionLabelFull}>Simulator</span>
            <span className={styles.actionLabelShort}>Sim</span>
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onOpenExport}
            title="Package the widget zip and install guide for the SD card"
          >
            <span className={styles.actionLabelFull}>Export</span>
            <span className={styles.actionLabelShort}>Export</span>
          </button>
          <EditorMenu
            label="More"
            variant="ghost"
            align="right"
            title="Copy, import, and settings"
            items={moreItems}
          />
        </>
      }
    >
      {children ?? null}
    </AppShell>
  );
});
