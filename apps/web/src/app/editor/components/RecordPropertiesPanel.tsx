"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BG_IMAGE_PATH,
  RADIO_SAFE_COLOR_NAMES,
  applyDashboardBackground,
  detectDashboardBackground,
  detectTextBinding,
  hexToEdgeColor,
  toRadioSafeColor,
} from "@widget-gen/editor-core";
import type {
  DashboardBgMode,
  DocumentRecord,
  TextAlignFlag,
  TextFormat,
  TextSizeFlag,
  ZoneOffset,
} from "@widget-gen/editor-core";
import {
  getPrefabSection,
  getPrefabSensorSlotsForId,
  listSrcBindings,
  prefabIdForSourceLine,
} from "@widget-gen/editor-core";
import type { EdgeColor } from "@widget-gen/layout-verify";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { catalogForDrawKind } from "../elementMeta";
import { SENSOR_CATALOG, formatSensorOptionLabel } from "../lib/sensorCatalog";
import styles from "../editor.module.css";

const LAYOUT_OPTIONS = [
  "Layout1x1",
  "Layout1x2",
  "Layout2x1",
  "Layout2x2",
] as const;

const EMPTY_SENSORS: string[] = [];

interface RecordPropertiesPanelProps {
  meta: { name: string; layout: string; zone: number };
  source: string;
  selectedRecords: DocumentRecord[];
  zone: ZoneOffset;
  protocol?: TelemetryProtocol;
  /** Sensors seen on the live radio Web Serial stream. */
  discoveredSensors?: string[];
  /** Enrich-only RF keys (preview fill — not on the CRSF wire). */
  enrichOnlySensors?: string[];
  onPatchName: (name: string) => void;
  onPatchRecord: (
    record: DocumentRecord,
    patch: Record<string, string | number>,
  ) => void;
  onTranslateSelected?: (dx: number, dy: number) => void;
  onSetColor: (record: DocumentRecord, color: EdgeColor) => void;
  onSetColorSelected?: (color: EdgeColor) => void;
  onPatchSelectedRecords?: (patch: Record<string, string | number>) => void;
  onSetText: (record: DocumentRecord, text: string) => void;
  onSetTextFlags?: (
    record: DocumentRecord,
    flags: { size?: TextSizeFlag; align?: TextAlignFlag | null },
  ) => void;
  onBindTelemetry?: (
    record: DocumentRecord,
    sensor: string,
    format: TextFormat,
  ) => void;
  /** Remap a create() src key to a different catalog sensor (prefab-safe). */
  onRemapSrcSensor?: (key: string, sensor: string) => void;
  onPatchSimulate?: (layout: string, zone: number) => void;
  /** Rewrite dashboard background mode (color / model / custom image). */
  onApplyBackground?: (nextSource: string) => void;
  /** Upload a PNG for custom background (and sim preview). */
  onBackgroundImageChange?: (file: File | null) => void;
  backgroundImageName?: string | null;
  backgroundImageUrl?: string | null;
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
  source,
  selectedRecords,
  zone,
  protocol = "betaflight",
  discoveredSensors = EMPTY_SENSORS,
  enrichOnlySensors = EMPTY_SENSORS,
  onPatchName,
  onPatchRecord,
  onTranslateSelected,
  onSetColor,
  onSetColorSelected,
  onPatchSelectedRecords,
  onSetText,
  onSetTextFlags,
  onBindTelemetry,
  onRemapSrcSensor,
  onPatchSimulate,
  onApplyBackground,
  onBackgroundImageChange,
  backgroundImageName = null,
  backgroundImageUrl = null,
}: RecordPropertiesPanelProps) {
  const bgFileRef = useRef<HTMLInputElement>(null);
  const record = selectedRecords.length === 1 ? selectedRecords[0] : null;
  const background = useMemo(
    () => detectDashboardBackground(source),
    [source],
  );
  const kindMeta = record ? catalogForDrawKind(record.kind) : null;
  const sensors = useMemo(() => {
    const base = SENSOR_CATALOG[protocol] ?? SENSOR_CATALOG.betaflight;
    const known = new Set(base.map((s) => s.label));
    const extras = [
      ...discoveredSensors.map((label) => ({
        label,
        formatHint: "raw" as const,
        hint: "Seen on live radio",
      })),
      ...enrichOnlySensors.map((label) => ({
        label,
        formatHint: "raw" as const,
        hint: "Preview fill (not on wire)",
      })),
    ].filter((s) => s.label && !known.has(s.label));
    // Dedupe enrich vs wire if both lists somehow overlap.
    const seen = new Set(base.map((s) => s.label));
    const uniqueExtras = extras.filter((s) => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });
    return uniqueExtras.length ? [...base, ...uniqueExtras] : base;
  }, [protocol, discoveredSensors, enrichOnlySensors]);
  const [bindFormat, setBindFormat] = useState<TextFormat>("raw");
  const [bindSensor, setBindSensor] = useState("");
  const [nameDraft, setNameDraft] = useState(meta.name);

  useEffect(() => {
    setNameDraft(meta.name);
  }, [meta.name]);

  const liveBindings = useMemo(
    () => (source ? listSrcBindings(source) : []),
    [source],
  );

  const activePrefabId = useMemo(() => {
    if (!record?.sourceLine) return null;
    return prefabIdForSourceLine(source, record.sourceLine);
  }, [source, record?.sourceLine]);

  const prefabMeta = activePrefabId ? getPrefabSection(activePrefabId) : null;
  const prefabSlots = useMemo(() => {
    if (!activePrefabId) return null;
    return getPrefabSensorSlotsForId(activePrefabId, liveBindings);
  }, [activePrefabId, liveBindings]);

  const zoneX = record?.x != null ? record.x - zone.zoneX : 0;
  const zoneY = record?.y != null ? record.y - zone.zoneY : 0;
  const selectedColor = useMemo(() => {
    if (selectedRecords.length <= 1) return "";
    const colors = selectedRecords.map((r) =>
      toRadioSafeColor(hexToEdgeColor(r.color)),
    );
    return colors.every((color) => color === colors[0]) ? colors[0] : "";
  }, [selectedRecords]);
  const selectedZoneX = useMemo(() => {
    if (selectedRecords.length <= 1) return null;
    const first = selectedRecords[0]?.x;
    if (first == null || !selectedRecords.every((r) => r.x === first)) {
      return null;
    }
    return first - zone.zoneX;
  }, [selectedRecords, zone.zoneX]);
  const selectedZoneY = useMemo(() => {
    if (selectedRecords.length <= 1) return null;
    const first = selectedRecords[0]?.y;
    if (first == null || !selectedRecords.every((r) => r.y === first)) {
      return null;
    }
    return first - zone.zoneY;
  }, [selectedRecords, zone.zoneY]);
  const textSize =
    record?.fontSize && record.fontSize >= 20
      ? "DBLSIZE"
      : record?.fontSize && record.fontSize >= 14
        ? "MIDSIZE"
        : "SMLSIZE";
  const textAlign = record?.textAlign ?? "left";
  const detectedBinding = useMemo(
    () => (record ? detectTextBinding(source, record) : null),
    [source, record],
  );
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

  useEffect(() => {
    if (!detectedBinding) {
      setBindSensor("");
      return;
    }
    setBindFormat(detectedBinding.format);
    setBindSensor(detectedBinding.sensor);
  }, [detectedBinding]);

  const sensorOptions = (current: string) => {
    const labels = new Set(sensors.map((s) => s.label));
    const opts = [...sensors];
    if (current && !labels.has(current)) {
      opts.unshift({ label: current, formatHint: "raw" });
    }
    return opts;
  };

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

      {onApplyBackground && (
        <section className={styles.propSection}>
          <h3 className={styles.sectionTitle}>Background</h3>
          <p className={styles.propEmptyHint}>
            Full-dashboard fill behind cards. Color uses{" "}
            <code>lcd.clear</code>; model uses the EdgeTX model bitmap; custom
            loads a PNG from the SD card.
          </p>
          <label className={styles.propField}>
            <FieldLabel>Fill</FieldLabel>
            <select
              className={styles.fieldInput}
              value={background.mode}
              onChange={(e) => {
                const mode = e.target.value as DashboardBgMode;
                onApplyBackground(
                  applyDashboardBackground(source, {
                    mode,
                    color: background.color,
                    imagePath:
                      background.imagePath ?? DEFAULT_BG_IMAGE_PATH,
                  }),
                );
              }}
            >
              <option value="color">Solid color</option>
              <option value="model">Model image</option>
              <option value="image">Custom image</option>
            </select>
          </label>
          {background.mode === "color" && (
            <label className={styles.propField}>
              <FieldLabel>Color</FieldLabel>
              <select
                className={styles.fieldInput}
                value={toRadioSafeColor(background.color as EdgeColor)}
                onChange={(e) => {
                  onApplyBackground(
                    applyDashboardBackground(source, {
                      mode: "color",
                      color: e.target.value,
                    }),
                  );
                }}
              >
                {RADIO_SAFE_COLOR_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          {background.mode === "model" && (
            <p className={styles.propEmptyHint}>
              Draws <code>model.getInfo().bitmap</code> fullscreen. Upload a
              model PNG from the toolbar to preview it in the sim.
            </p>
          )}
          {background.mode === "image" && (
            <>
              <TextField
                label="SD path"
                value={background.imagePath ?? DEFAULT_BG_IMAGE_PATH}
                onChange={(path) => {
                  const trimmed = path.trim() || DEFAULT_BG_IMAGE_PATH;
                  onApplyBackground(
                    applyDashboardBackground(source, {
                      mode: "image",
                      imagePath: trimmed.startsWith("/")
                        ? trimmed
                        : `/IMAGES/${trimmed}`,
                    }),
                  );
                }}
              />
              {onBackgroundImageChange && (
                <div className={styles.fieldRow}>
                  <button
                    type="button"
                    className={styles.fieldInput}
                    style={{ cursor: "pointer" }}
                    onClick={() => bgFileRef.current?.click()}
                  >
                    {backgroundImageName
                      ? `Replace PNG…`
                      : "Upload PNG…"}
                  </button>
                  {backgroundImageName && (
                    <button
                      type="button"
                      className={styles.fieldInput}
                      style={{ cursor: "pointer" }}
                      onClick={() => onBackgroundImageChange(null)}
                    >
                      Clear
                    </button>
                  )}
                  <input
                    ref={bgFileRef}
                    type="file"
                    accept="image/png"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      onBackgroundImageChange(file);
                    }}
                  />
                </div>
              )}
              {backgroundImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={backgroundImageUrl}
                  alt={backgroundImageName ?? "Background"}
                  className={styles.modelPngThumb}
                  style={{ width: 64, height: 40, marginTop: 6 }}
                />
              ) : (
                <p className={styles.propEmptyHint}>
                  Upload a PNG to preview and include{" "}
                  <code>IMAGES/dashbg.png</code> in the export zip.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {onRemapSrcSensor && liveBindings.length > 0 && (
        <section className={styles.propSection}>
          <h3 className={styles.sectionTitle}>
            {prefabSlots && prefabSlots.length > 0
              ? `Prefab sensors${prefabMeta ? ` · ${prefabMeta.shortLabel}` : ""}`
              : "Telemetry sources"}
          </h3>
          <p className={styles.propEmptyHint}>
            {prefabSlots && prefabSlots.length > 0
              ? "Defaults match the inserted block. Change a sensor to use a different CRSF name (src key stays the same)."
              : "Cached sensors in create(). Select a prefab draw to focus that block’s slots."}
          </p>
          {(prefabSlots && prefabSlots.length > 0
            ? prefabSlots
            : liveBindings.map((b) => ({
                key: b.key,
                sensor: b.sensor,
                label: b.key,
                defaultSensor: b.sensor,
              }))
          ).map((slot) => (
            <label key={slot.key} className={styles.propField}>
              <FieldLabel>
                {slot.label}
                {"defaultSensor" in slot && slot.sensor !== slot.defaultSensor
                  ? " *"
                  : ""}
              </FieldLabel>
              <select
                className={styles.fieldInput}
                value={slot.sensor}
                title={`src.${slot.key}${
                  "defaultSensor" in slot
                    ? ` (default ${slot.defaultSensor})`
                    : ""
                }`}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next || next === slot.sensor) return;
                  onRemapSrcSensor(slot.key, next);
                }}
              >
                {sensorOptions(slot.sensor).map((s) => (
                  <option key={s.label} value={s.label} title={s.hint}>
                    {formatSensorOptionLabel(s)}
                    {"defaultSensor" in slot && s.label === slot.defaultSensor
                      ? " (default)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {prefabMeta && prefabMeta.telemetryNotes[0] ? (
            <p className={styles.propEmptyHint}>
              {prefabMeta.telemetryNotes[0]}
            </p>
          ) : null}
          {prefabSlots &&
            prefabSlots.length > 0 &&
            liveBindings.length > prefabSlots.length && (
              <details className={styles.propDetails}>
                <summary className={styles.propDetailsSummary}>
                  All telemetry sources ({liveBindings.length})
                </summary>
                <div className={styles.propDetailsBody}>
                  {liveBindings.map((binding) => (
                    <label key={binding.key} className={styles.propField}>
                      <FieldLabel>{binding.key}</FieldLabel>
                      <select
                        className={styles.fieldInput}
                        value={binding.sensor}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next || next === binding.sensor) return;
                          onRemapSrcSensor(binding.key, next);
                        }}
                      >
                        {sensorOptions(binding.sensor).map((s) => (
                          <option key={s.label} value={s.label}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
            )}
        </section>
      )}

      {selectedRecords.length > 1 && (
        <section className={styles.propSection}>
          <h3 className={styles.sectionTitle}>
            Multi-select ({selectedRecords.length})
          </h3>
          <label className={styles.propField}>
            <FieldLabel>Color</FieldLabel>
            <select
              className={styles.fieldInput}
              value={selectedColor}
              onChange={(e) => {
                const color = e.target.value as EdgeColor;
                if (!color) return;
                onSetColorSelected?.(color);
              }}
            >
              {selectedColor ? null : <option value="">Mixed</option>}
              {RADIO_SAFE_COLOR_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {sharedXY && (selectedZoneX != null || selectedZoneY != null) && (
            <div className={styles.fieldRow}>
              {selectedZoneX != null && (
                <NumField
                  label="X"
                  value={selectedZoneX}
                  onChange={(x) => onPatchSelectedRecords?.({ x: toLcdX(x) })}
                />
              )}
              {selectedZoneY != null && (
                <NumField
                  label="Y"
                  value={selectedZoneY}
                  onChange={(y) => onPatchSelectedRecords?.({ y: toLcdY(y) })}
                />
              )}
            </div>
          )}
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

      {!record && selectedRecords.length === 0 && (
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
              <div className={styles.fieldRow}>
                <label className={styles.propField}>
                  <FieldLabel>Size</FieldLabel>
                  <select
                    className={styles.fieldInput}
                    value={textSize}
                    onChange={(e) =>
                      onSetTextFlags?.(record, {
                        size: e.target.value as TextSizeFlag,
                      })
                    }
                  >
                    <option value="SMLSIZE">SMLSIZE</option>
                    <option value="MIDSIZE">MIDSIZE</option>
                    <option value="DBLSIZE">DBLSIZE</option>
                  </select>
                </label>
                <label className={styles.propField}>
                  <FieldLabel>Align</FieldLabel>
                  <select
                    className={styles.fieldInput}
                    value={textAlign}
                    onChange={(e) => {
                      const align = e.target.value;
                      onSetTextFlags?.(record, {
                        align:
                          align === "left"
                            ? null
                            : (align.toUpperCase() as TextAlignFlag),
                      });
                    }}
                  >
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                  </select>
                </label>
              </div>
              {onBindTelemetry && (
                <div className={styles.propSection}>
                  <h3 className={styles.sectionTitle}>Telemetry binding</h3>
                  <p className={styles.propEmptyHint}>
                    {detectedBinding
                      ? `Bound: ${detectedBinding.sensor} · ${detectedBinding.format}`
                      : "Static text (not bound)"}
                  </p>
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
                      value={detectedBinding?.sensor ?? bindSensor}
                      onChange={(e) => {
                        const sensor = e.target.value;
                        setBindSensor(sensor);
                        if (!sensor) return;
                        onBindTelemetry(record, sensor, bindFormat);
                      }}
                    >
                      <option value="">Bind sensor…</option>
                      {sensorOptions(detectedBinding?.sensor ?? bindSensor).map(
                        (s) => (
                          <option
                            key={s.label}
                            value={s.label}
                            title={s.hint ?? undefined}
                          >
                            {formatSensorOptionLabel(s)}
                            {s.formatHint !== bindFormat
                              ? ` (${s.formatHint})`
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <p className={styles.propEmptyHint}>
                    Binds with the selected Format, caches the sensor in
                    create(), and rewrites this drawText. The current binding
                    stays selected after bind.
                  </p>
                  {discoveredSensors.length > 0 ? (
                    <div className={styles.liveSeenRow}>
                      <p className={styles.sectionTitle}>Seen on live radio</p>
                      <div className={styles.liveSeenChips}>
                        {discoveredSensors.map((sensor) => (
                          <button
                            key={sensor}
                            type="button"
                            className={styles.liveSeenChip}
                            onClick={() => {
                              setBindSensor(sensor);
                              onBindTelemetry(record, sensor, bindFormat);
                            }}
                          >
                            Bind {sensor}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {enrichOnlySensors.length > 0 ? (
                    <div className={styles.liveSeenRow}>
                      <p className={styles.sectionTitle}>
                        Preview fill (not on wire)
                      </p>
                      <div className={styles.liveSeenChips}>
                        {enrichOnlySensors.map((sensor) => (
                          <button
                            key={`enrich-${sensor}`}
                            type="button"
                            className={styles.liveSeenChip}
                            title="Synthesized for Rotorflight preview — enable rf2bg + Discover new for true FC sensors"
                            onClick={() => {
                              setBindSensor(sensor);
                              onBindTelemetry(record, sensor, bindFormat);
                            }}
                          >
                            Bind {sensor}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {record.kind !== "bitmap" && (
            <label className={styles.propField}>
              <FieldLabel>Color</FieldLabel>
              <select
                className={styles.fieldInput}
                value={toRadioSafeColor(hexToEdgeColor(record.color))}
                onChange={(e) =>
                  onSetColor(record, e.target.value as EdgeColor)
                }
              >
                {RADIO_SAFE_COLOR_NAMES.map((c) => (
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
