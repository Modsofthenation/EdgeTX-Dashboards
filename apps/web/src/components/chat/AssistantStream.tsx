"use client";

import { useMemo } from "react";
import { MarkdownContent } from "./MarkdownContent";
import { TodoPanel, ToolActivityStream } from "./ToolActivity";
import { collectToolEntries, formatEventContent, groupStreamLines, type StreamLine } from "@/lib/streamLines";
import styles from "./AssistantStream.module.css";

interface AssistantStreamProps {
  lines: StreamLine[];
  isStreaming?: boolean;
}

export function AssistantStream({ lines, isStreaming }: AssistantStreamProps) {
  const entries = useMemo(() => groupStreamLines(lines), [lines]);
  const tools = useMemo(() => collectToolEntries(lines), [lines]);
  const lastLine = lines[lines.length - 1];
  const showLiveTool = !!isStreaming && lastLine?.type === "tool" && tools.length > 0;

  if (entries.length === 0 && isStreaming) {
    return (
      <div className={styles.thinking}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    );
  }

  return (
    <div className={styles.stream}>
      {entries.map((entry, i) => {
        if (entry.kind === "text") {
          if (isStreaming) {
            return (
              <p key={i} className={styles.prose}>
                {entry.text}
              </p>
            );
          }
          return <MarkdownContent key={i}>{entry.text ?? ""}</MarkdownContent>;
        }

        if (entry.kind === "tools") {
          return null;
        }

        if (entry.kind === "todo" && entry.todos?.length) {
          return <TodoPanel key={i} title={entry.title} todos={entry.todos} />;
        }

        const line = entry.line!;
        return (
          <div key={i} className={`${styles.event} ${styles[line.type]}`}>
            <span className={styles.badge}>{line.type}</span>
            <span>{formatEventContent(line.type, line.content)}</span>
          </div>
        );
      })}
      {showLiveTool ? <ToolActivityStream tools={tools} isStreaming /> : null}
      {isStreaming && entries.length > 0 && (
        <span className={styles.cursor} aria-hidden>
          ▍
        </span>
      )}
    </div>
  );
}
