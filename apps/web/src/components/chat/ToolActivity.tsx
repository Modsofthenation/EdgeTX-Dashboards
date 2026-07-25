"use client";

import { useEffect, useRef, useState } from "react";
import type { StreamTodoItem } from "@widget-gen/shared";
import type { ToolChipEntry } from "~/lib/streamLines";
import styles from "./ToolActivity.module.css";

function ToolLineContent({ tool, shimmer }: { tool: ToolChipEntry; shimmer?: boolean }) {
  if (shimmer) {
    const text = tool.detail ? `${tool.label} · ${tool.detail}` : tool.label;
    return <span className={styles.toolShimmerText}>{text}</span>;
  }

  return (
    <>
      <span className={styles.toolLineLabel}>{tool.label}</span>
      {tool.detail ? <span className={styles.toolLineDetail}>{tool.detail}</span> : null}
    </>
  );
}

/** Cursor-style single active tool line with shimmer and slide-up handoff. */
export function ToolActivityStream({
  tools,
  isStreaming,
}: {
  tools: ToolChipEntry[];
  isStreaming?: boolean;
}) {
  const activeTool = tools[tools.length - 1];
  const prevToolRef = useRef<ToolChipEntry | null>(null);
  const [exitingTool, setExitingTool] = useState<ToolChipEntry | null>(null);

  useEffect(() => {
    if (tools.length === 0) {
      prevToolRef.current = null;
      setExitingTool(null);
    }
  }, [tools.length]);

  useEffect(() => {
    if (!activeTool) return;

    if (prevToolRef.current && prevToolRef.current.key !== activeTool.key) {
      setExitingTool(prevToolRef.current);
      const timer = window.setTimeout(() => setExitingTool(null), 420);
      prevToolRef.current = activeTool;
      return () => window.clearTimeout(timer);
    }

    prevToolRef.current = activeTool;
  }, [activeTool]);

  if (!activeTool && !exitingTool) return null;

  const isActiveRunning = !!isStreaming && !!activeTool && !activeTool.failed;

  return (
    <div className={styles.toolStream} aria-live="polite" aria-atomic="true">
      {exitingTool ? (
        <div className={`${styles.toolLine} ${styles.toolLineExit}`} key={`exit-${exitingTool.key}`}>
          <ToolLineContent tool={exitingTool} />
        </div>
      ) : null}
      {activeTool ? (
        <div
          className={`${styles.toolLine} ${exitingTool ? styles.toolLineEnter : ""} ${
            isActiveRunning ? styles.toolLineActive : ""
          } ${activeTool.failed ? styles.toolLineFailed : ""}`}
          key={activeTool.key}
        >
          <ToolLineContent tool={activeTool} shimmer={isActiveRunning} />
        </div>
      ) : null}
    </div>
  );
}

const TODO_STATUS_LABEL: Record<StreamTodoItem["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Done",
  cancelled: "Cancelled",
};

export function ToolChipRow({ tools }: { tools: ToolChipEntry[] }) {
  return (
    <div className={styles.toolGroup}>
      {tools.map((tool) => (
        <span
          key={tool.key}
          className={`${styles.toolChip} ${tool.failed ? styles.toolChipFailed : ""}`}
          title={tool.detail}
        >
          <span className={styles.toolChipLabel}>{tool.label}</span>
          {tool.detail ? <span className={styles.toolChipDetail}>{tool.detail}</span> : null}
        </span>
      ))}
    </div>
  );
}

export function TodoPanel({ title, todos }: { title?: string; todos: StreamTodoItem[] }) {
  return (
    <div className={styles.todoPanel}>
      <div className={styles.todoHeader}>{title ?? "Todos"}</div>
      <ul className={styles.todoList}>
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={`${styles.todoItem} ${styles[`todo_${todo.status}`]}`}
          >
            <span className={styles.todoStatus} aria-label={TODO_STATUS_LABEL[todo.status]}>
              {todo.status === "completed" ? "✓" : todo.status === "in_progress" ? "◐" : todo.status === "cancelled" ? "—" : "○"}
            </span>
            <span className={styles.todoText}>{todo.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
