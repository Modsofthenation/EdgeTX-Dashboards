"use client";

import { useEffect, useMemo, useState } from "react";
import { EDGE_COLOR_NAMES, hexToEdgeColor } from "@widget-gen/editor-core";
import type {
  DocumentRecord,
  TextFormat,
  ZoneOffset,
} from "@widget-gen/editor-core";
import type { EdgeColor } from "@widget-gen/layout-verify";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { catalogForDrawKind } from "../elementMeta";
import { SENSOR_CATALOG } from "../lib/sensorCatalog";
import styles from "../editor.module.css";

const LAYOUT_OPTIONS = [
  "Layout1x1",
  "Layout1x2",
  "Layout2x1",
  "Layout2x2",
] as const;

interface RecordPropertiesPanelProps {
  meta: { name: string; layout: string; zone: number };
  selectedRecords: DocumentRecord[];
  zone: ZoneOffset;
  protocol?: TelemetryProtocol;
  onPatchName: (name: string) => void;
  onPatchRecord: (
    record: DocumentRecord,
    patch: Record<string, string | number>,
  ) => void;
  onTranslateSelected?: (dx: number, dy: number) => void;
  onSetColor: (record: DocumentRecord, color: EdgeColor) => void;
  onSetText: (record: DocumentRecord, text: string) => void;
  onBindTelemetry?: (
    record: DocumentRecord,
    sensor: string,
    format: TextFormat,
  ) => void;
  onPatchSimulate?: (layout: string, zone: number) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.fieldLabel}>{children}</span>;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    if (parsed === value) return;
    onChange(parsed);
  };

  return (
    <label className={styles.propField}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        className={styles.fieldInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft === value) return;
    onChange(draft);
  };

  return (
    <label className={styles.propField}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        className={styles.fieldInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function RecordPropertiesPanel({
  meta,
  selectedRecords,
  zone,
  protocol = "betaflight",
  onPatchName,
  onPatchRecord,
  onTranslateSelected,
  onSetColor,
  onSetText,
  onBindTelemetry,
  onPatchSimulate,
}: RecordPropertiesPanelProps) {
  const record = selectedRecords.length === 1 ? selectedRecords[0] : null;
  const kindMeta = record ? catalogForDrawKind(record.kind) : null;
  const sensors = useMemo(
    () => SENSOR_CATALOG[protocol] ?? SENSOR_CATALOG.betaflight,
    [protocol],
  );
  const [bindFormat, setBindFormat] = useState<TextFormat>("raw");
  const [nameDraft, setNameDraft] = useState(meta.name);

  useEffect(() => {
    setNameDraft(meta.name);
  }, [meta.name]);

  const zoneX = record?.x != null ? record.x - zone.zoneX : 0;
  const zoneY = record?.y != null ? record.y - zone.zoneY : 0;
  const maxZone =
    meta.layout === "Layout2x2"
      ? 3
      : meta.layout === "Layout1x2" || meta.layout === "Layout2x1"
        ? 1
        : 0;

  const sharedXY =
    selectedRecords.length > 1 &&
    selectedRecords.every((r) => r.x != null && r.y != null);

  const toLcdX = (x: number) => x + zone.zoneX;
  const toLcdY = (y: number) => y + zone.zoneY;

  return (
    <aside className={`${styles.sidePanel} ${styles.propsPanel}`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Properties</h2>
      </div>

      <section className={styles.propSection}>
        <h3 className={styles.sectionTitle}>Widget</h3>
        <label className={styles.propField}>
          <FieldLabel>Name</FieldLabel>
          <input
            type="text"
            className={styles.fieldInput}
            maxLength={10}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.slice(0, 10))}
            onBlur={() => {
              if (nameDraft !== meta.name) onPatchName(nameDraft.slice(0, 10));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                (e.currentTarget as HTMLInputElement).blur();
            }}
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.propField}>
            <FieldLabel>Layout</FieldLabel>
            {onPatchSimulate ? (
              <select
                className={styles.fieldInput}
                value={meta.layout}
                onChange={(e) => onPatchSimulate(e.target.value, 0)}
              >
                {LAYOUT_OPTIONS.map((layout) => (
                  <option key={layout} value={layout}>
                    {layout}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className={styles.fieldInput}
                value={meta.layout}
                readOnly
              />
            )}
          </label>
          <label className={styles.propField}>
            <FieldLabel>Zone</FieldLabel>
            {onPatchSimulate ? (
              <select
                className={styles.fieldInput}
                value={meta.zone}
                onChange={(e) =>
                  onPatchSimulate(meta.layout, Number(e.target.value))
                }
              >
                {Array.from({ length: maxZone + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                className={styles.fieldInput}
                value={meta.zone}
                readOnly
              />
            )}
          </label>
        </div>
      </section>

      {sharedXY && !record && (
        <section className={styles.propSection}>
          <h3 className={styles.sectionTitle}>
            Multi-select ({selectedRecords.length})
          </h3>
          <p className={styles.propEmptyHint}>Nudge all selected elements:</p>
          <div className={styles.fieldRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onTranslateSelected?.(-12, 0)}
            >
              ← 12
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onTranslateSelected?.(12, 0)}
            >
              12 →
            </button>
          </div>
          <div className={styles.fieldRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onTranslateSelected?.(0, -12)}
            >
              ↑ 12
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onTranslateSelected?.(0, 12)}
            >
              ↓ 12
            </button>
          </div>
        </section>
      )}

      {!record && selectedRecords.length <= 1 && (
        <div className={styles.propEmpty}>
          <p className={styles.propEmptyTitle}>Nothing selected</p>
          <p className={styles.propEmptyHint}>
            Click a drawable element on the canvas or pick a layer to edit its
            source line.
          </p>
        </div>
      )}

      {record && (
        <section className={styles.propSection}>
          <div className={styles.elementHead}>
            <span className={styles.elementKindIcon} aria-hidden>
              {kindMeta?.shortLabel ?? "?"}
            </span>
            <div>
              <h3 className={styles.sectionTitle}>
                {kindMeta?.label ?? record.kind}
              </h3>
              <p className={styles.elementSub}>Line {record.sourceLine}</p>
            </div>
          </div>

          {record.x != null && record.y != null && record.kind !== "line" && (
            <div className={styles.fieldRow}>
              <NumField
                label="X"
                value={zoneX}
                onChange={(x) => onPatchRecord(record, { x: toLcdX(x) })}
              />
              <NumField
                label="Y"
                value={zoneY}
                onChange={(y) => onPatchRecord(record, { y: toLcdY(y) })}
              />
            </div>
          )}

          {(record.kind === "filledRect" ||
            record.kind === "rect" ||
            record.kind === "gauge") && (
            <div className={styles.fieldRow}>
              <NumField
                label="W"
                value={record.w ?? 0}
                onChange={(w) => onPatchRecord(record, { w })}
              />
              <NumField
                label="H"
                value={record.h ?? 0}
                onChange={(h) => onPatchRecord(record, { h })}
              />
            </div>
          )}

          {record.kind === "line" && (
            <>
              <div className={styles.fieldRow}>
                <NumField
                  label="X1"
                  value={(record.x ?? 0) - zone.zoneX}
                  onChange={(x) => onPatchRecord(record, { x: toLcdX(x) })}
                />
                <NumField
                  label="Y1"
                  value={(record.y ?? 0) - zone.zoneY}
                  onChange={(y) => onPatchRecord(record, { y: toLcdY(y) })}
                />
              </div>
              <div className={styles.fieldRow}>
                <NumField
                  label="X2"
                  value={(record.x2 ?? 0) - zone.zoneX}
                  onChange={(x2) => onPatchRecord(record, { x2: toLcdX(x2) })}
                />
                <NumField
                  label="Y2"
                  value={(record.y2 ?? 0) - zone.zoneY}
                  onChange={(y2) => onPatchRecord(record, { y2: toLcdY(y2) })}
                />
              </div>
            </>
          )}

          {(record.kind === "circle" || record.kind === "filledCircle") && (
            <NumField
              label="Radius"
              value={record.r ?? 0}
              onChange={(r) => onPatchRecord(record, { r })}
            />
          )}

          {record.kind === "arc" && (
            <>
              <NumField
                label="Radius"
                value={record.r ?? 0}
                onChange={(r) => onPatchRecord(record, { r })}
              />
              <div className={styles.fieldRow}>
                <NumField
                  label="Start °"
                  value={record.startAngle ?? 0}
                  onChange={(startAngle) =>
                    onPatchRecord(record, { startAngle })
                  }
                />
                <NumField
                  label="End °"
                  value={record.endAngle ?? 0}
                  onChange={(endAngle) => onPatchRecord(record, { endAngle })}
                />
              </div>
            </>
          )}

          {record.kind === "annulus" && (
            <>
              <div className={styles.fieldRow}>
                <NumField
                  label="Inner R"
                  value={record.rIn ?? 0}
                  onChange={(rIn) => onPatchRecord(record, { rIn })}
                />
                <NumField
                  label="Outer R"
                  value={record.rOut ?? 0}
                  onChange={(rOut) => onPatchRecord(record, { rOut })}
                />
              </div>
              <div className={styles.fieldRow}>
                <NumField
                  label="Start °"
                  value={record.startAngle ?? 0}
                  onChange={(startAngle) =>
                    onPatchRecord(record, { startAngle })
                  }
                />
                <NumField
                  label="End °"
                  value={record.endAngle ?? 0}
                  onChange={(endAngle) => onPatchRecord(record, { endAngle })}
                />
              </div>
            </>
          )}

          {record.kind === "gauge" && (
            <div className={styles.fieldRow}>
              <NumField
                label="Fill"
                value={record.fill ?? 0}
                onChange={(fill) => onPatchRecord(record, { fill })}
              />
              <NumField
                label="Max"
                value={record.maxFill ?? 100}
                onChange={(maxFill) => onPatchRecord(record, { maxFill })}
              />
            </div>
          )}

          {record.kind === "text" && (
            <>
              <TextField
                label="Static text"
                value={record.text ?? ""}
                onChange={(text) => onSetText(record, text)}
              />
              {onBindTelemetry && (
                <div className={styles.propSection}>
                  <h3 className={styles.sectionTitle}>Telemetry binding</h3>
                  <label className={styles.propField}>
                    <FieldLabel>Format</FieldLabel>
                    <select
                      className={styles.fieldInput}
                      value={bindFormat}
                      onChange={(e) =>
                        setBindFormat(e.target.value as TextFormat)
                      }
                    >
                      <option value="raw">Raw number</option>
                      <option value="percent">Percent</option>
                      <option value="float1">1 decimal</option>
                      <option value="float1_amps">Amps (1 decimal)</option>
                      <option value="string">String</option>
                    </select>
                  </label>
                  <label className={styles.propField}>
                    <FieldLabel>Sensor</FieldLabel>
                    <select
                      className={styles.fieldInput}
                      defaultValue=""
                      onChange={(e) => {
                        const sensor = e.target.value;
                        if (!sensor) return;
                        onBindTelemetry(record, sensor, bindFormat);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Bind sensor…</option>
                      {sensors.map((s) => (
                        <option key={s.label} value={s.label}>
                          {s.label}
                          {s.formatHint !== bindFormat
                            ? ` (${s.formatHint})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className={styles.propEmptyHint}>
                    Binds with the Format above. Caches the sensor in create()
                    and rewrites this drawText.
                  </p>
                </div>
              )}
            </>
          )}

          {record.kind !== "bitmap" && (
            <label className={styles.propField}>
              <FieldLabel>Color</FieldLabel>
              <select
                className={styles.fieldInput}
                value={hexToEdgeColor(record.color)}
                onChange={(e) =>
                  onSetColor(record, e.target.value as EdgeColor)
                }
              >
                {EDGE_COLOR_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}
    </aside>
  );
}
