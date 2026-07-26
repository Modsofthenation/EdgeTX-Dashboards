"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DENSE_CRSF_LAYOUT_ORDER,
  FREESTYLE_LAYOUT_ORDER,
  listPrefabCatalog,
  MINIMAL_QUAD_LAYOUT_ORDER,
  ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER,
  ROTORFLIGHT_NITRO_LAYOUT_ORDER,
  WHOOP_LAYOUT_ORDER,
} from "@widget-gen/editor-core";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { COMPANION_SUITES } from "~/lib/companionSuites";
import { DRAW_KIND_CATALOG, type InsertDrawKind } from "../elementMeta";
import styles from "../editor.module.css";

const EMPTY_SUITE_IDS: string[] = [];

interface InsertMenuProps {
  protocol: TelemetryProtocol;
  onInsert: (kind: InsertDrawKind) => void;
  onInsertPrefab?: (prefabId: string) => void;
  /** Insert every RF heli TX15 section in canonical order. */
  onInsertFullRfHeliElectric?: () => void;
  /** Insert nitro / OMP RF heli variant. */
  onInsertRfHeliNitro?: () => void;
  /** Insert a full whoop / freestyle / minimal / dense quad board. */
  onInsertQuadBoard?: (boardId: string) => void;
  /** Add companion suite stubs for SD install (tools/telemetry). */
  onInsertCompanionSuite?: (suiteId: string) => void;
  companionSuiteIds?: string[];
}

export function InsertMenu({
  protocol,
  onInsert,
  onInsertPrefab,
  onInsertFullRfHeliElectric,
  onInsertRfHeliNitro,
  onInsertQuadBoard,
  onInsertCompanionSuite,
  companionSuiteIds = EMPTY_SUITE_IDS,
}: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const rotorflightPrefabs = useMemo(
    () =>
      protocol === "rotorflight"
        ? listPrefabCatalog({ protocol: "rotorflight" })
        : [],
    [protocol],
  );

  const quadPrefabs = useMemo(
    () =>
      protocol === "betaflight" || protocol === "generic-crsf"
        ? listPrefabCatalog({ protocol })
        : [],
    [protocol],
  );

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
        <div className={styles.insertGroupLabel}>Primitives</div>
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
        {onInsertPrefab && rotorflightPrefabs.length > 0 ? (
          <>
            <div className={styles.insertGroupLabel}>
              Rotorflight sections
              <span className={styles.insertGroupHint}>
                Needs rf2bg · Discover new
              </span>
            </div>
            {onInsertFullRfHeliElectric ? (
              <button
                type="button"
                role="menuitem"
                className={styles.insertItem}
                title={`Insert ${ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER.length} sections in order`}
                onClick={() => {
                  onInsertFullRfHeliElectric();
                  setOpen(false);
                }}
              >
                <span className={styles.insertItemIcon} aria-hidden>
                  SD
                </span>
                <span className={styles.insertItemCopy}>
                  <span className={styles.insertItemLabel}>
                    Full RF heli board
                  </span>
                  <span className={styles.insertItemDesc}>
                    Electric · all {ROTORFLIGHT_ELECTRIC_LAYOUT_ORDER.length}{" "}
                    TX15 sections
                  </span>
                </span>
              </button>
            ) : null}
            {onInsertRfHeliNitro ? (
              <button
                type="button"
                role="menuitem"
                className={styles.insertItem}
                title={`Insert ${ROTORFLIGHT_NITRO_LAYOUT_ORDER.length} nitro sections`}
                onClick={() => {
                  onInsertRfHeliNitro();
                  setOpen(false);
                }}
              >
                <span className={styles.insertItemIcon} aria-hidden>
                  N2
                </span>
                <span className={styles.insertItemCopy}>
                  <span className={styles.insertItemLabel}>
                    RF heli nitro board
                  </span>
                  <span className={styles.insertItemDesc}>
                    Nitro/OMP · RX pack tiles + voltage bar
                  </span>
                </span>
              </button>
            ) : null}
            {rotorflightPrefabs.map((prefab) => (
              <button
                key={prefab.id}
                type="button"
                role="menuitem"
                className={styles.insertItem}
                title={prefab.telemetryNotes.join("\n")}
                onClick={() => {
                  onInsertPrefab(prefab.id);
                  setOpen(false);
                }}
              >
                <span className={styles.insertItemIcon} aria-hidden>
                  {prefab.shortLabel}
                </span>
                <span className={styles.insertItemCopy}>
                  <span className={styles.insertItemLabel}>{prefab.label}</span>
                  <span className={styles.insertItemDesc}>
                    {prefab.description}
                    {prefab.requiredSensors.length > 0
                      ? ` · ${prefab.requiredSensors.join(", ")}`
                      : ""}
                  </span>
                </span>
              </button>
            ))}
          </>
        ) : null}
        {onInsertPrefab && quadPrefabs.length > 0 ? (
          <>
            <div className={styles.insertGroupLabel}>
              Quad sections
              <span className={styles.insertGroupHint}>
                Betaflight / CRSF · TX15
              </span>
            </div>
            {onInsertQuadBoard ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.insertItem}
                  title={`Insert ${WHOOP_LAYOUT_ORDER.length} whoop sections`}
                  onClick={() => {
                    onInsertQuadBoard("whoop");
                    setOpen(false);
                  }}
                >
                  <span className={styles.insertItemIcon} aria-hidden>
                    WP
                  </span>
                  <span className={styles.insertItemCopy}>
                    <span className={styles.insertItemLabel}>
                      Full whoop board
                    </span>
                    <span className={styles.insertItemDesc}>
                      Armed banner · bars · voltage · attitude ·{" "}
                      {WHOOP_LAYOUT_ORDER.length} sections
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.insertItem}
                  title={`Insert ${FREESTYLE_LAYOUT_ORDER.length} freestyle sections`}
                  onClick={() => {
                    onInsertQuadBoard("freestyle-quad");
                    setOpen(false);
                  }}
                >
                  <span className={styles.insertItemIcon} aria-hidden>
                    FS
                  </span>
                  <span className={styles.insertItemCopy}>
                    <span className={styles.insertItemLabel}>
                      Full freestyle board
                    </span>
                    <span className={styles.insertItemDesc}>
                      Timer hero · power strip · GPS ·{" "}
                      {FREESTYLE_LAYOUT_ORDER.length} sections
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.insertItem}
                  title={`Insert ${MINIMAL_QUAD_LAYOUT_ORDER.length} minimal sections`}
                  onClick={() => {
                    onInsertQuadBoard("minimal-quad");
                    setOpen(false);
                  }}
                >
                  <span className={styles.insertItemIcon} aria-hidden>
                    MN
                  </span>
                  <span className={styles.insertItemCopy}>
                    <span className={styles.insertItemLabel}>
                      Full minimal board
                    </span>
                    <span className={styles.insertItemDesc}>
                      Voltage-first · timer card · link ·{" "}
                      {MINIMAL_QUAD_LAYOUT_ORDER.length} sections
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.insertItem}
                  title={`Insert ${DENSE_CRSF_LAYOUT_ORDER.length} dense sections`}
                  onClick={() => {
                    onInsertQuadBoard("dense-crsf");
                    setOpen(false);
                  }}
                >
                  <span className={styles.insertItemIcon} aria-hidden>
                    DG
                  </span>
                  <span className={styles.insertItemCopy}>
                    <span className={styles.insertItemLabel}>
                      Full dense CRSF board
                    </span>
                    <span className={styles.insertItemDesc}>
                      Metric grid · attitude ·{" "}
                      {DENSE_CRSF_LAYOUT_ORDER.length} sections
                    </span>
                  </span>
                </button>
              </>
            ) : null}
            {quadPrefabs.map((prefab) => (
              <button
                key={prefab.id}
                type="button"
                role="menuitem"
                className={styles.insertItem}
                title={prefab.telemetryNotes.join("\n")}
                onClick={() => {
                  onInsertPrefab(prefab.id);
                  setOpen(false);
                }}
              >
                <span className={styles.insertItemIcon} aria-hidden>
                  {prefab.shortLabel}
                </span>
                <span className={styles.insertItemCopy}>
                  <span className={styles.insertItemLabel}>{prefab.label}</span>
                  <span className={styles.insertItemDesc}>
                    {prefab.description}
                    {prefab.requiredSensors.length > 0
                      ? ` · ${prefab.requiredSensors.join(", ")}`
                      : ""}
                  </span>
                </span>
              </button>
            ))}
          </>
        ) : null}
        {onInsertCompanionSuite ? (
          <>
            <div className={styles.insertGroupLabel}>
              Companion suites
              <span className={styles.insertGroupHint}>
                SCRIPTS/TOOLS · TELEMETRY
              </span>
            </div>
            {COMPANION_SUITES.map((suite) => {
              const added = companionSuiteIds.includes(suite.id);
              return (
                <button
                  key={suite.id}
                  type="button"
                  role="menuitem"
                  className={styles.insertItem}
                  title={suite.description}
                  onClick={() => {
                    onInsertCompanionSuite(suite.id);
                    setOpen(false);
                  }}
                >
                  <span className={styles.insertItemIcon} aria-hidden>
                    {suite.shortLabel}
                  </span>
                  <span className={styles.insertItemCopy}>
                    <span className={styles.insertItemLabel}>
                      {suite.label}
                      {added ? " · added" : ""}
                    </span>
                    <span className={styles.insertItemDesc}>
                      {suite.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        ) : null}
      </div>,
      document.body,
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
