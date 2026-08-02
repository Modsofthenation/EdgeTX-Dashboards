"use client";

import { memo } from "react";
import styles from "../editor.module.css";

export type CenterView = "canvas" | "lua";

const VIEWS: { id: CenterView; label: string; title: string }[] = [
  {
    id: "canvas",
    label: "Canvas",
    title: "Visual layout canvas",
  },
  {
    id: "lua",
    label: "Lua",
    title: "Raw EdgeTX Lua source editor",
  },
];

export const CenterViewTabs = memo(function CenterViewTabs({
  view,
  onChange,
}: {
  view: CenterView;
  onChange: (view: CenterView) => void;
}) {
  return (
    <div
      className={styles.centerViewTabs}
      role="tablist"
      aria-label="Center editor view"
      data-testid="center-view-tabs"
    >
      {VIEWS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`center-view-${id}`}
          aria-controls={
            id === "canvas" ? "editor-panel-canvas" : "editor-panel-lua"
          }
          aria-selected={view === id}
          title={title}
          className={
            view === id ? styles.centerViewTabActive : styles.centerViewTab
          }
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
});
