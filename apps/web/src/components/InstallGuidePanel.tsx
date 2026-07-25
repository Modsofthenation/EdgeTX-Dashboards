"use client";

import { useMemo, useState } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import { buildInstallGuide } from "~/lib/installGuide";
import styles from "./InstallGuidePanel.module.css";

interface InstallGuidePanelProps {
  protocol: TelemetryProtocol;
  widgetName: string | null;
}

export function InstallGuidePanel({ protocol, widgetName }: InstallGuidePanelProps) {
  const [openSection, setOpenSection] = useState<string>("steps");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const guide = useMemo(
    () => buildInstallGuide(protocol, widgetName ?? undefined),
    [protocol, widgetName]
  );

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSteps = [...guide.steps, ...guide.verification];
  const doneCount = allSteps.filter((s) => checked.has(s.id)).length;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Install on TX15</h2>
        {widgetName && (
          <span className={styles.progress}>
            {doneCount}/{allSteps.length} checks
          </span>
        )}
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Before you start</h3>
        <ul className={styles.list}>
          {guide.prerequisites.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className={styles.protocol}>
          Protocol: <strong>{guide.protocolLabel}</strong>
          {widgetName && (
            <>
              {" "}
              · Widget: <strong>{widgetName}</strong>
            </>
          )}
        </p>
      </section>

      <div className={styles.accordion}>
        <button
          className={openSection === "steps" ? styles.accordionActive : styles.accordionBtn}
          onClick={() => setOpenSection(openSection === "steps" ? "" : "steps")}
        >
          Setup steps
        </button>
        {openSection === "steps" && (
          <ol className={styles.steps}>
            {guide.steps.map((step) => (
              <li key={step.id} className={styles.step}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={checked.has(step.id)}
                    onChange={() => toggleCheck(step.id)}
                  />
                  <span className={styles.stepTitle}>{step.title}</span>
                </label>
                <p className={styles.stepDetail}>{step.detail}</p>
                {step.verify && (
                  <p className={styles.verify}>
                    <strong>Ensure:</strong> {step.verify}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        <button
          className={openSection === "verify" ? styles.accordionActive : styles.accordionBtn}
          onClick={() => setOpenSection(openSection === "verify" ? "" : "verify")}
        >
          Verification checklist
        </button>
        {openSection === "verify" && (
          <ol className={styles.steps}>
            {guide.verification.map((step) => (
              <li key={step.id} className={styles.step}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={checked.has(step.id)}
                    onChange={() => toggleCheck(step.id)}
                  />
                  <span className={styles.stepTitle}>{step.title}</span>
                </label>
                <p className={styles.stepDetail}>{step.detail}</p>
                {step.verify && (
                  <p className={styles.verify}>
                    <strong>Ensure:</strong> {step.verify}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        <button
          className={openSection === "trouble" ? styles.accordionActive : styles.accordionBtn}
          onClick={() => setOpenSection(openSection === "trouble" ? "" : "trouble")}
        >
          Troubleshooting
        </button>
        {openSection === "trouble" && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Fix</th>
              </tr>
            </thead>
            <tbody>
              {guide.troubleshooting.map((row) => (
                <tr key={row.issue}>
                  <td>{row.issue}</td>
                  <td>{row.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {widgetName && (
        <p className={styles.note}>
          Full instructions are also included as <code>INSTALL.md</code> inside the downloaded zip.
        </p>
      )}
    </div>
  );
}
