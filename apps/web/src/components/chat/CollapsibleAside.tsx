"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./CollapsibleAside.module.css";

const PANEL_TRANSITION_MS = 280;

interface CollapsibleAsideProps {
  side: "left" | "right";
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Wait for the width animation before mounting children (avoids jank on heavy panels). */
  deferContentMount?: boolean;
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

function PanelExpandSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label={`Loading ${label} panel`}>
      <div className={styles.skeletonBar} />
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlockShort} />
    </div>
  );
}

export function CollapsibleAside({
  side,
  label,
  collapsed,
  onToggle,
  deferContentMount = false,
  children,
}: CollapsibleAsideProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [contentReady, setContentReady] = useState(!collapsed && !deferContentMount);
  const [transitioning, setTransitioning] = useState(false);
  const expandLabel = `Show ${label} panel`;

  useEffect(() => {
    setTransitioning(true);
    const el = wrapRef.current;
    const stop = () => setTransitioning(false);
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "width") stop();
    };
    el?.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(stop, PANEL_TRANSITION_MS + 40);
    return () => {
      el?.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
    };
  }, [collapsed]);

  useEffect(() => {
    if (collapsed) {
      setContentReady(false);
      return;
    }
    if (!deferContentMount) {
      setContentReady(true);
      return;
    }

    const el = wrapRef.current;
    const alreadyExpanded = (el?.getBoundingClientRect().width ?? 0) > 96;
    if (alreadyExpanded) {
      setContentReady(true);
      return;
    }

    setContentReady(false);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setContentReady(true);
    };

    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "width") finish();
    };
    el?.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, PANEL_TRANSITION_MS + 40);
    return () => {
      el?.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
    };
  }, [collapsed, deferContentMount]);

  const showContent = !collapsed && contentReady;
  const showSkeleton = !collapsed && deferContentMount && !contentReady;

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${styles[side]} ${collapsed ? styles.collapsed : ""} ${
        transitioning ? styles.transitioning : ""
      }`}
      data-collapsed={collapsed || undefined}
    >
      <div
        className={`${styles.inner} ${showContent ? styles.innerReady : ""}`}
        aria-hidden={collapsed}
      >
        {showContent ? children : null}
        {showSkeleton ? <PanelExpandSkeleton label={label} /> : null}
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
