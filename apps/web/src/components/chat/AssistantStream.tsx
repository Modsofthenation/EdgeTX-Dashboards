"use client";

import { useMemo } from "react";
import { StreamingMarkdown } from "./StreamingMarkdown";
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
  const activeTool = tools[tools.length - 1];
  const toolInProgress = showLiveTool && !!activeTool && !activeTool.failed;
  const showThinkingDots = !!isStreaming && !toolInProgress;

  const lastTextEntryIndex = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.kind === "text") return i;
    }
    return -1;
  }, [entries]);

  const renderedEntries = useMemo(
    () =>
      entries.map((entry, i) => {
        if (entry.kind === "text") {
          const fullText = entry.text ?? "";
          if (!fullText.trim() && !(isStreaming && i === lastTextEntryIndex)) return null;
          const streamPartial =
            !!isStreaming && i === lastTextEntryIndex && lastLine?.type === "text";
          return { kind: "text" as const, key: i, fullText, streamPartial };
        }

        if (entry.kind === "tools") return null;

        if (entry.kind === "todo" && entry.todos?.length) {
          return { kind: "todo" as const, key: i, entry };
        }

        return { kind: "event" as const, key: i, entry };
      }),
    [entries, isStreaming, lastTextEntryIndex, lastLine?.type]
  );

  const hasVisibleContent = renderedEntries.some(Boolean) || showLiveTool;

  if (!hasVisibleContent && showThinkingDots) {
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
          return (
            <StreamingMarkdown
              key={item.key}
              text={item.fullText}
              streamPartial={item.streamPartial}
            />
          );
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
      {showThinkingDots ? (
        <div className={styles.thinking} aria-label="Generating">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      ) : null}
    </div>
  );
}
