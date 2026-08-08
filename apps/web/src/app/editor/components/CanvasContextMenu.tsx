"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "../editor.module.css";

export type CanvasContextMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
  shortcut?: string;
};

interface CanvasContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: CanvasContextMenuItem[];
  onClose: () => void;
}

/**
 * Fixed-position right-click menu for the canvas (portal to document.body).
 */
export function CanvasContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Use capture so we close before other handlers steal the click.
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [open, x, y, items]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      className={`${styles.editorMenu} ${styles.canvasContextMenu} appScrollbar`}
      role="menu"
      style={{ top: y, left: x }}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? (
            <div className={styles.editorMenuSep} role="separator" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={styles.editorMenuItem}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              onClose();
              item.onClick();
            }}
          >
            <span className={styles.contextMenuLabel}>{item.label}</span>
            {item.shortcut ? (
              <span className={styles.contextMenuShortcut}>
                {item.shortcut}
              </span>
            ) : null}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
