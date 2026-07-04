"use client";

import { useEffect, useMemo, useRef } from "react";
import { formatEventContent, groupStreamLines, type StreamLine } from "@/lib/streamLines";
import styles from "./RunStream.module.css";

interface RunStreamProps {
  lines: StreamLine[];
  running?: boolean;
}

export function RunStream({ lines, running }: RunStreamProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const entries = useMemo(() => groupStreamLines(lines), [lines]);

  const handleScroll = () => {
    const log = logRef.current;
    if (!log) return;
    const distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < 48;
  };

  useEffect(() => {
    const log = logRef.current;
    if (!log || !pinnedToBottomRef.current) return;
    log.scrollTop = log.scrollHeight;
  }, [lines, running]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Agent log</h2>
        {running && <span className={styles.streaming}>Streaming</span>}
      </div>
      <div ref={logRef} className={styles.log} onScroll={handleScroll}>
        {entries.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>◇</span>
            <p>Describe your dashboard and hit Generate to start.</p>
          </div>
        )}
        {entries.map((entry, i) => {
          if (entry.kind === "text") {
            return (
              <p key={i} className={styles.prose}>
                {entry.text}
              </p>
            );
          }

          if (entry.kind === "tools") {
            return (
              <div key={i} className={styles.toolGroup}>
                <span className={styles.toolGroupLabel}>Tools</span>
                <div className={styles.toolChips}>
                  {entry.tools!.map((tool) => (
                    <span key={tool} className={styles.toolChip}>
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            );
          }

          const line = entry.line!;
          return (
            <div key={i} className={`${styles.event} ${styles[line.type]}`}>
              <span className={styles.badge}>{line.type}</span>
              <span className={styles.eventText}>
                {formatEventContent(line.type, line.content)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
