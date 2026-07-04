"use client";

import type { StreamTodoItem } from "@widget-gen/shared";
import type { ToolChipEntry } from "@/lib/streamLines";
import styles from "./ToolActivity.module.css";

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
