"use client";

import { memo } from "react";
import type { TelemetryProtocol } from "@widget-gen/shared";
import styles from "../editor.module.css";

export const EditorCallouts = memo(function EditorCallouts({
  protocol,
  lastProjectOffer,
  onOpenLastProject,
  onDismissProjectOffer,
  liveTelemetryNote,
  liveTelemetryActive,
  enrichRotorflight,
}: {
  protocol: TelemetryProtocol;
  lastProjectOffer: { id: string; name: string } | null;
  onOpenLastProject: (id: string) => void;
  onDismissProjectOffer: () => void;
  liveTelemetryNote: string | null;
  liveTelemetryActive: boolean;
  enrichRotorflight: boolean;
}) {
  return (
    <>
      {protocol === "rotorflight" ? (
        <div className={styles.protocolCallout} role="status">
          Rotorflight: enable <strong>rf2bg</strong> (Special Function, Repeat
          On), then Telemetry → Discover new for HSpd / EscT / Vbec / Vcel /
          Gov. Insert → Full RF heli (electric) or RF heli nitro board.
        </div>
      ) : null}
      {lastProjectOffer ? (
        <div className={styles.protocolCallout} role="status">
          Resume <strong>{lastProjectOffer.name}</strong>?{" "}
          <button
            type="button"
            className={styles.calloutLink}
            onClick={() => onOpenLastProject(lastProjectOffer.id)}
          >
            Open last
          </button>
          <button
            type="button"
            className={styles.calloutLink}
            onClick={onDismissProjectOffer}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {liveTelemetryNote ? (
        <div className={styles.protocolCallout} role="status">
          {liveTelemetryNote}
          {liveTelemetryActive && protocol === "rotorflight" ? (
            <>
              {" "}
              <span className={styles.calloutMuted}>
                Enrich {enrichRotorflight ? "ON" : "OFF"} —{" "}
                {enrichRotorflight
                  ? "fills missing HSpd/Gov/Vbec (not true FC sensors until rf2bg + Discover new)."
                  : "showing wire CRSF sensors only."}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
});
