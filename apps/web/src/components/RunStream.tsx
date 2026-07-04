"use client";

import { useEffect, useRef } from "react";
import styles from "./RunStream.module.css";

interface StreamLine {
  type: "text" | "tool" | "status" | "error" | "done";
  content: string;
}

interface RunStreamProps {
  lines: StreamLine[];
  running?: boolean;
}

export function RunStream({ lines, running }: RunStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Agent log</h2>
        {running && <span className={styles.streaming}>Streaming</span>}
      </div>
      <div className={styles.log}>
        {lines.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>◇</span>
            <p>Describe your dashboard and hit Generate to start.</p>
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={`${styles.line} ${styles[line.type]}`}>
            {line.type !== "text" && <span className={styles.badge}>{line.type}</span>}
            <pre className={styles.content}>{line.content}</pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
