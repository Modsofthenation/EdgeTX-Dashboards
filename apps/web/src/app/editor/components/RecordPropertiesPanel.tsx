"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type ReactNode,
} from "react";
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
import { listSrcBindings } from "@widget-gen/editor-core";
import type { EdgeColor } from "@widget-gen/layout-verify";
import { fontSizeToFlag } from "@widget-gen/layout-verify";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { catalogForDrawKind } from "../elementMeta";
import { SENSOR_CATALOG, formatSensorOptionLabel } from "../lib/sensorCatalog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import styles from "../editor.module.css";

const LAYOUT_OPTIONS = [
  "Layout1x1",
  "Layout1x2",
  "Layout2x1",
  "Layout2x2",
] as const;

const EMPTY_SENSORS: string[] = [];

function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  if (!hint) {
    return <span className={styles.fieldLabel}>{children}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`${styles.fieldLabel} ${styles.fieldLabelHint}`}
          tabIndex={0}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{hint}</TooltipContent>
    </Tooltip>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
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
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="number"
        className={styles.fieldInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        title={hint}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
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
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="text"
        className={styles.fieldInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        title={hint}
      />
    </label>
  );
}

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

export const RecordPropertiesPanel = memo(function RecordPropertiesPanel({
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
  const showDashboardProps = selectedRecords.length === 0;
  const background = useMemo(() => detectDashboardBackground(source), [source]);
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
  const resolvedFlag =
    record?.fontSize != null ? fontSizeToFlag(record.fontSize) : null;
  const textSize: TextSizeFlag =
    resolvedFlag === "MIDSIZE" || resolvedFlag === "DBLSIZE"
      ? resolvedFlag
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

      {showDashboardProps && (
        <section className={styles.propSection}>
          <h3
            className={styles.sectionTitle}
            title="Widget identity and where it sits on the radio screen"
          >
            Widget
          </h3>
          <label className={styles.propField}>
            <FieldLabel hint="Widget script name shown on the radio (max 10 characters).">
              Name
            </FieldLabel>
            <input
              type="text"
              className={styles.fieldInput}
              maxLength={10}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value.slice(0, 10))}
              onBlur={() => {
                if (nameDraft !== meta.name)
                  onPatchName(nameDraft.slice(0, 10));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  (e.currentTarget as HTMLInputElement).blur();
              }}
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.propField}>
              <FieldLabel hint="EdgeTX screen layout that hosts this widget (Layout1x1 fills the LCD).">
                Layout
              </FieldLabel>
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
              <FieldLabel hint="Zone index inside the layout (0 is the first/top-left cell).">
                Zone
              </FieldLabel>
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
      )}

      {showDashboardProps && onApplyBackground && (
        <section className={styles.propSection}>
          <h3
            className={styles.sectionTitle}
            title="Full-dashboard background behind cards and telemetry"
          >
            Background
          </h3>
          <p className={styles.propEmptyHint}>
            Full-dashboard fill behind cards. Color uses <code>lcd.clear</code>;
            model uses the EdgeTX model bitmap; custom loads a PNG from the SD
            card.
          </p>
          <label className={styles.propField}>
            <FieldLabel hint="How the full dashboard background is painted behind cards.">
              Fill
            </FieldLabel>
            <select
              className={styles.fieldInput}
              value={background.mode}
              onChange={(e) => {
                const mode = e.target.value as DashboardBgMode;
                onApplyBackground(
                  applyDashboardBackground(source, {
                    mode,
                    color: background.color,
                    imagePath: background.imagePath ?? DEFAULT_BG_IMAGE_PATH,
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
              <FieldLabel hint="lcd.clear color used for a solid dashboard background.">
                Color
              </FieldLabel>
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
                hint="Absolute path on the radio SD card for the custom background PNG."
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
                    {backgroundImageName ? `Replace PNG…` : "Upload PNG…"}
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

      {showDashboardProps && onRemapSrcSensor && liveBindings.length > 0 && (
        <section className={styles.propSection}>
          <h3
            className={styles.sectionTitle}
            title="Sensors cached in create() — remap CRSF names without rewriting Lua keys"
          >
            Telemetry sources
          </h3>
          <p className={styles.propEmptyHint}>
            Cached sensors in create(). Select a field on the canvas to edit
            that element only.
          </p>
          {liveBindings.map((binding) => (
            <label key={binding.key} className={styles.propField}>
              <FieldLabel
                hint={`create() cache key src.${binding.key}. Change the CRSF sensor name without renaming the Lua variable.`}
              >
                {binding.key}
              </FieldLabel>
              <select
                className={styles.fieldInput}
                value={binding.sensor}
                title={`src.${binding.key}`}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next || next === binding.sensor) return;
                  onRemapSrcSensor(binding.key, next);
                }}
              >
                {sensorOptions(binding.sensor).map((s) => (
                  <option key={s.label} value={s.label} title={s.hint}>
                    {formatSensorOptionLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      {selectedRecords.length > 1 && (
        <section className={styles.propSection}>
          <h3 className={styles.sectionTitle}>
            Multi-select ({selectedRecords.length})
          </h3>
          <label className={styles.propField}>
            <FieldLabel hint="Apply one EdgeTX color to every selected draw call.">
              Color
            </FieldLabel>
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
                  hint="Shared X for all selected elements (zone pixels)."
                  value={selectedZoneX}
                  onChange={(x) => onPatchSelectedRecords?.({ x: toLcdX(x) })}
                />
              )}
              {selectedZoneY != null && (
                <NumField
                  label="Y"
                  hint="Shared Y for all selected elements (zone pixels)."
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
              title="Move selection left by 12 px (grid step)"
              onClick={() => onTranslateSelected?.(-12, 0)}
            >
              ← 12
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              title="Move selection right by 12 px (grid step)"
              onClick={() => onTranslateSelected?.(12, 0)}
            >
              12 →
            </button>
          </div>
          <div className={styles.fieldRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              title="Move selection up by 12 px (grid step)"
              onClick={() => onTranslateSelected?.(0, -12)}
            >
              ↑ 12
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              title="Move selection down by 12 px (grid step)"
              onClick={() => onTranslateSelected?.(0, 12)}
            >
              ↓ 12
            </button>
          </div>
        </section>
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
                hint="Horizontal position in zone pixels (0 = left edge of the widget zone)."
                value={zoneX}
                onChange={(x) => onPatchRecord(record, { x: toLcdX(x) })}
              />
              <NumField
                label="Y"
                hint="Vertical position in zone pixels (0 = top edge of the widget zone)."
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
                hint="Width in pixels."
                value={record.w ?? 0}
                onChange={(w) => onPatchRecord(record, { w })}
              />
              <NumField
                label="H"
                hint="Height in pixels."
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
                  hint="Line start X in zone pixels."
                  value={(record.x ?? 0) - zone.zoneX}
                  onChange={(x) => onPatchRecord(record, { x: toLcdX(x) })}
                />
                <NumField
                  label="Y1"
                  hint="Line start Y in zone pixels."
                  value={(record.y ?? 0) - zone.zoneY}
                  onChange={(y) => onPatchRecord(record, { y: toLcdY(y) })}
                />
              </div>
              <div className={styles.fieldRow}>
                <NumField
                  label="X2"
                  hint="Line end X in zone pixels."
                  value={(record.x2 ?? 0) - zone.zoneX}
                  onChange={(x2) => onPatchRecord(record, { x2: toLcdX(x2) })}
                />
                <NumField
                  label="Y2"
                  hint="Line end Y in zone pixels."
                  value={(record.y2 ?? 0) - zone.zoneY}
                  onChange={(y2) => onPatchRecord(record, { y2: toLcdY(y2) })}
                />
              </div>
            </>
          )}

          {(record.kind === "circle" || record.kind === "filledCircle") && (
            <NumField
              label="Radius"
              hint="Circle radius in pixels from the center point."
              value={record.r ?? 0}
              onChange={(r) => onPatchRecord(record, { r })}
            />
          )}

          {record.kind === "arc" && (
            <>
              <NumField
                label="Radius"
                hint="Arc radius in pixels from the center point."
                value={record.r ?? 0}
                onChange={(r) => onPatchRecord(record, { r })}
              />
              <div className={styles.fieldRow}>
                <NumField
                  label="Start °"
                  hint="Arc start angle in degrees (0° is typically right / 3 o’clock)."
                  value={record.startAngle ?? 0}
                  onChange={(startAngle) =>
                    onPatchRecord(record, { startAngle })
                  }
                />
                <NumField
                  label="End °"
                  hint="Arc end angle in degrees."
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
                  hint="Inner hole radius of the ring."
                  value={record.rIn ?? 0}
                  onChange={(rIn) => onPatchRecord(record, { rIn })}
                />
                <NumField
                  label="Outer R"
                  hint="Outer radius of the ring."
                  value={record.rOut ?? 0}
                  onChange={(rOut) => onPatchRecord(record, { rOut })}
                />
              </div>
              <div className={styles.fieldRow}>
                <NumField
                  label="Start °"
                  hint="Ring segment start angle in degrees."
                  value={record.startAngle ?? 0}
                  onChange={(startAngle) =>
                    onPatchRecord(record, { startAngle })
                  }
                />
                <NumField
                  label="End °"
                  hint="Ring segment end angle in degrees."
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
                hint="Current gauge value drawn as a filled portion of the bar."
                value={record.fill ?? 0}
                onChange={(fill) => onPatchRecord(record, { fill })}
              />
              <NumField
                label="Max"
                hint="Gauge scale maximum (fill / max = filled fraction)."
                value={record.maxFill ?? 100}
                onChange={(maxFill) => onPatchRecord(record, { maxFill })}
              />
            </div>
          )}

          {record.kind === "text" && (
            <>
              <TextField
                label="Static text"
                hint="Literal string drawn when this text is not bound to telemetry."
                value={record.text ?? ""}
                onChange={(text) => onSetText(record, text)}
              />
              <div className={styles.fieldRow}>
                <label className={styles.propField}>
                  <FieldLabel hint="EdgeTX font flag: SMLSIZE, MIDSIZE, or DBLSIZE.">
                    Size
                  </FieldLabel>
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
                  <FieldLabel hint="Horizontal alignment of the text anchor point.">
                    Align
                  </FieldLabel>
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
                    <FieldLabel hint="How the live sensor value is formatted before drawText.">
                      Format
                    </FieldLabel>
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
                    <FieldLabel hint="CRSF/ELRS telemetry sensor name cached in create() and read each refresh.">
                      Sensor
                    </FieldLabel>
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
              <FieldLabel hint="EdgeTX named color for this draw call (radio-safe palette).">
                Color
              </FieldLabel>
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
});
