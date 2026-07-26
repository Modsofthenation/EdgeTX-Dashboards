"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../editor.module.css";

export type EditorMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Visual separator before this item */
  separatorBefore?: boolean;
};

interface EditorMenuProps {
  label: string;
  items: EditorMenuItem[];
  /** Optional short label for narrow layouts */
  shortLabel?: string;
  title?: string;
  disabled?: boolean;
  /** Visual weight of the trigger */
  variant?: "ghost" | "secondary";
  align?: "left" | "right";
}

/**
 * Compact overflow / grouping menu for the editor chrome and toolbar.
 */
export function EditorMenu({
  label,
  items,
  shortLabel,
  title,
  disabled,
  variant = "secondary",
  align = "left",
}: EditorMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 220;
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setMenuPos({ top: rect.bottom + 6, left });
  }, [align]);

  const openMenu = useCallback(() => {
    updateMenuPosition();
    setOpen(true);
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className={`${styles.editorMenu} appScrollbar`}
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
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
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  const triggerClass =
    variant === "ghost" ? styles.ghostBtn : styles.secondaryBtn;

  return (
    <div className={styles.editorMenuRoot}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        title={title ?? label}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {shortLabel ? (
          <>
            <span className={styles.actionLabelFull}>{label}</span>
            <span className={styles.actionLabelShort}>{shortLabel}</span>
          </>
        ) : (
          label
        )}
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
