"use client";

import type { ReactNode } from "react";
import styles from "./CollapsibleAside.module.css";

interface CollapsibleAsideProps {
  side: "left" | "right";
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function PanelIcon({ side }: { side: "left" | "right" }) {
  if (side === "left") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2 3.5h12M2 8h8M2 12.5h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 2v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CollapsibleAside({
  side,
  label,
  collapsed,
  onToggle,
  children,
}: CollapsibleAsideProps) {
  const expandLabel = `Show ${label} panel`;

  return (
    <div
      className={`${styles.wrap} ${styles[side]} ${collapsed ? styles.collapsed : ""}`}
      data-collapsed={collapsed || undefined}
    >
      <div className={styles.inner} aria-hidden={collapsed}>
        {!collapsed ? children : null}
      </div>

      {collapsed && (
        <button
          type="button"
          className={styles.rail}
          onClick={onToggle}
          aria-label={expandLabel}
          title={expandLabel}
        >
          <PanelIcon side={side} />
          <span className={styles.railLabel}>{label}</span>
        </button>
      )}
    </div>
  );
}

export function PanelCollapseButton({
  label,
  collapsed,
  onToggle,
  side = "left",
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  side?: "left" | "right";
}) {
  const action = collapsed ? `Show ${label}` : `Hide ${label}`;
  return (
    <button
      type="button"
      className={`${styles.headerToggle} ${side === "right" ? styles.headerToggleRight : ""}`}
      onClick={onToggle}
      aria-label={action}
      aria-expanded={!collapsed}
      title={action}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M10 4L6 8l4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
