"use client";

import { useMemo } from "react";
import { MarkdownContent } from "./MarkdownContent";
import { TodoPanel, ToolActivityStream } from "./ToolActivity";
import { collectToolEntries, displayStreamTextEntry, formatEventContent, groupStreamLines, type StreamLine } from "@/lib/streamLines";
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

  const renderedEntries = useMemo(
    () =>
      entries.map((entry, i) => {
        if (entry.kind === "text") {
          const displayText = displayStreamTextEntry(entry.text ?? "", i, entries, lines, !!isStreaming);
          if (!displayText.trim()) return null;
          return { kind: "text" as const, key: i, displayText };
        }

        if (entry.kind === "tools") return null;

        if (entry.kind === "todo" && entry.todos?.length) {
          return { kind: "todo" as const, key: i, entry };
        }

        return { kind: "event" as const, key: i, entry };
      }),
    [entries, lines, isStreaming]
  );

  const hasVisibleContent = renderedEntries.some(Boolean) || showLiveTool;

  if (!hasVisibleContent && isStreaming) {
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
      {renderedEntries.map((item) => {
        if (!item) return null;

        if (item.kind === "text") {
          return <MarkdownContent key={item.key}>{item.displayText}</MarkdownContent>;
        }

        if (item.kind === "todo") {
          return (
            <TodoPanel key={item.key} title={item.entry.title} todos={item.entry.todos!} />
          );
        }

        const line = item.entry.line!;
        return (
          <div key={item.key} className={`${styles.event} ${styles[line.type]}`}>
            <span className={styles.badge}>{line.type}</span>
            <span>{formatEventContent(line.type, line.content)}</span>
          </div>
        );
      })}
      {showLiveTool ? <ToolActivityStream tools={tools} isStreaming /> : null}
      {isStreaming ? (
        <div className={styles.thinking} aria-label="Generating">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      ) : null}
    </div>
  );
}
