"use client";

import { EDGE_COLOR_NAMES } from "@widget-gen/editor-core";
import type { EditorElement, WidgetScene } from "@widget-gen/editor-core";
import type { EdgeColor } from "@widget-gen/layout-verify";
import { catalogForKind } from "../elementMeta";
import styles from "../editor.module.css";

interface PropertiesPanelProps {
  scene: WidgetScene;
  selectedElements: EditorElement[];
  onUpdateElement: (id: string, patch: Partial<EditorElement>) => void;
  onUpdateScene: (patch: Partial<WidgetScene>) => void;
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
  return (
    <label className={styles.propField}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        className={styles.fieldInput}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function PropertiesPanel({
  scene,
  selectedElements,
  onUpdateElement,
  onUpdateScene,
}: PropertiesPanelProps) {
  const el = selectedElements.length === 1 ? selectedElements[0] : null;
  const meta = el ? catalogForKind(el.kind) : null;

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
            value={scene.name}
            onChange={(e) => onUpdateScene({ name: e.target.value.slice(0, 10) })}
          />
        </label>
        <div className={styles.fieldRow}>
          <label className={styles.propField}>
            <FieldLabel>Layout</FieldLabel>
            <input
              type="text"
              className={styles.fieldInput}
              value={scene.simulate.layout}
              onChange={(e) =>
                onUpdateScene({ simulate: { ...scene.simulate, layout: e.target.value } })
              }
            />
          </label>
          <NumField
            label="Zone"
            value={scene.simulate.zone}
            onChange={(zone) => onUpdateScene({ simulate: { ...scene.simulate, zone } })}
          />
        </div>
      </section>

      {!el && (
        <div className={styles.propEmpty}>
          <p className={styles.propEmptyTitle}>
            {selectedElements.length > 1
              ? `${selectedElements.length} elements selected`
              : "Nothing selected"}
          </p>
          <p className={styles.propEmptyHint}>
            Click an element on the canvas or pick a layer to edit its properties.
          </p>
        </div>
      )}

      {el && (
        <section className={styles.propSection}>
          <div className={styles.elementHead}>
            <span className={styles.elementKindIcon} aria-hidden>
              {meta?.shortLabel ?? "?"}
            </span>
            <div>
              <h3 className={styles.sectionTitle}>{meta?.label ?? el.kind}</h3>
              <p className={styles.elementSub}>{el.kind}</p>
            </div>
          </div>

          <label className={styles.propField}>
            <FieldLabel>Layer label</FieldLabel>
            <input
              type="text"
              className={styles.fieldInput}
              value={el.label ?? ""}
              onChange={(e) => onUpdateElement(el.id, { label: e.target.value })}
            />
          </label>

          <label className={styles.propField}>
            <FieldLabel>Option gate</FieldLabel>
            <select
              className={styles.fieldInput}
              value={el.optionGate ?? ""}
              onChange={(e) =>
                onUpdateElement(el.id, { optionGate: e.target.value || undefined })
              }
            >
              <option value="">Always visible</option>
              {scene.options.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          {"x" in el && "y" in el && (
            <div className={styles.fieldRow}>
              <NumField label="X" value={el.x} onChange={(x) => onUpdateElement(el.id, { x })} />
              <NumField label="Y" value={el.y} onChange={(y) => onUpdateElement(el.id, { y })} />
            </div>
          )}

          {(el.kind === "filledRect" || el.kind === "rect" || el.kind === "gauge") && (
            <div className={styles.fieldRow}>
              <NumField label="W" value={el.w} onChange={(w) => onUpdateElement(el.id, { w })} />
              <NumField label="H" value={el.h} onChange={(h) => onUpdateElement(el.id, { h })} />
            </div>
          )}

          {el.kind === "line" && (
            <>
              <div className={styles.fieldRow}>
                <NumField label="X1" value={el.x1} onChange={(x1) => onUpdateElement(el.id, { x1 })} />
                <NumField label="Y1" value={el.y1} onChange={(y1) => onUpdateElement(el.id, { y1 })} />
              </div>
              <div className={styles.fieldRow}>
                <NumField label="X2" value={el.x2} onChange={(x2) => onUpdateElement(el.id, { x2 })} />
                <NumField label="Y2" value={el.y2} onChange={(y2) => onUpdateElement(el.id, { y2 })} />
              </div>
            </>
          )}

          {(el.kind === "circle" || el.kind === "filledCircle" || el.kind === "arc") && (
            <NumField label="Radius" value={el.r} onChange={(r) => onUpdateElement(el.id, { r })} />
          )}

          {el.kind === "annulus" && (
            <>
              <div className={styles.fieldRow}>
                <NumField
                  label="R inner"
                  value={el.rIn}
                  onChange={(rIn) => onUpdateElement(el.id, { rIn })}
                />
                <NumField
                  label="R outer"
                  value={el.rOut}
                  onChange={(rOut) => onUpdateElement(el.id, { rOut })}
                />
              </div>
              <div className={styles.fieldRow}>
                <NumField
                  label="Start °"
                  value={el.startAngle}
                  onChange={(startAngle) => onUpdateElement(el.id, { startAngle })}
                />
                <NumField
                  label="End °"
                  value={el.endAngle}
                  onChange={(endAngle) => onUpdateElement(el.id, { endAngle })}
                />
              </div>
            </>
          )}

          {el.kind === "arc" && (
            <div className={styles.fieldRow}>
              <NumField
                label="Start °"
                value={el.startAngle}
                onChange={(startAngle) => onUpdateElement(el.id, { startAngle })}
              />
              <NumField
                label="End °"
                value={el.endAngle}
                onChange={(endAngle) => onUpdateElement(el.id, { endAngle })}
              />
            </div>
          )}

          {el.kind === "gauge" && (
            <div className={styles.fieldRow}>
              <NumField label="Fill" value={el.fill} onChange={(fill) => onUpdateElement(el.id, { fill })} />
              <NumField
                label="Max"
                value={el.maxFill}
                onChange={(maxFill) => onUpdateElement(el.id, { maxFill })}
              />
            </div>
          )}

          {el.kind === "text" && (
            <>
              <label className={styles.propField}>
                <FieldLabel>Text</FieldLabel>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={el.content ?? ""}
                  onChange={(e) =>
                    onUpdateElement(el.id, { content: e.target.value, binding: undefined })
                  }
                />
              </label>
              <NumField
                label="Font size"
                value={el.fontSize}
                onChange={(fontSize) => onUpdateElement(el.id, { fontSize })}
              />
            </>
          )}

          {"color" in el && (
            <label className={styles.propField}>
              <FieldLabel>Color</FieldLabel>
              <div className={styles.colorField}>
                <select
                  className={styles.fieldInput}
                  value={
                    EDGE_COLOR_NAMES.includes(el.color as EdgeColor) ? el.color : EDGE_COLOR_NAMES[0]
                  }
                  onChange={(e) =>
                    onUpdateElement(el.id, { color: e.target.value as EdgeColor })
                  }
                >
                  {EDGE_COLOR_NAMES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          )}
        </section>
      )}
    </aside>
  );
}
