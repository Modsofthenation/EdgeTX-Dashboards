"use client";

import { memo } from "react";
import styles from "../editor.module.css";

export type MobileTab = "layers" | "canvas" | "properties";

const TABS: { id: MobileTab; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "canvas", label: "Canvas" },
  { id: "properties", label: "Properties" },
];

export const EditorMobileTabs = memo(function EditorMobileTabs({
  mobileTab,
  onChange,
}: {
  mobileTab: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <div
      className={styles.mobileTabs}
      role="tablist"
      aria-label="Editor panels"
    >
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`editor-tab-${id}`}
          aria-controls={`editor-panel-${id}`}
          aria-selected={mobileTab === id}
          className={
            mobileTab === id ? styles.mobileTabActive : styles.mobileTab
          }
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
});
