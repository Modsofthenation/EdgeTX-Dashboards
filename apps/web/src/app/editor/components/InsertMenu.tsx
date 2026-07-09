"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DRAW_KIND_CATALOG, type InsertDrawKind } from "../elementMeta";
import styles from "../editor.module.css";

interface InsertMenuProps {
  onInsert: (kind: InsertDrawKind) => void;
}

export function InsertMenu({ onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 6,
      left: rect.left,
    });
  }, []);

  const openMenu = useCallback(() => {
    updateMenuPosition();
    setOpen(true);
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onLayout = () => updateMenuPosition();

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);

    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className={styles.insertDropdown}
        role="menu"
        style={{ top: menuPos.top, left: menuPos.left }}
      >
        {DRAW_KIND_CATALOG.map(({ kind, label, shortLabel, description }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            className={styles.insertItem}
            onClick={() => {
              onInsert(kind);
              setOpen(false);
            }}
          >
            <span className={styles.insertItemIcon} aria-hidden>
              {shortLabel}
            </span>
            <span className={styles.insertItemCopy}>
              <span className={styles.insertItemLabel}>{label}</span>
              <span className={styles.insertItemDesc}>{description}</span>
            </span>
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div className={styles.insertMenuRoot}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.insertTrigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className={styles.insertTriggerIcon} aria-hidden>
          +
        </span>
        Insert
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
