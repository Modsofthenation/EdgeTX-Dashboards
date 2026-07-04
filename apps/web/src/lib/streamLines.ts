import type { StreamEvent, StreamTodoItem } from "@widget-gen/shared";

/** UI stream line — same shape as shared StreamEvent from the generator seam. */
export type StreamLine = StreamEvent;

export interface ToolChipEntry {
  label: string;
  detail?: string;
  failed?: boolean;
  key: string;
}

function toolLineKey(line: StreamLine): string {
  return `${line.toolName ?? line.content}|${line.detail ?? ""}`;
}

/** Merge streaming chunks and dedupe tool events for readable log output. */
export function appendStreamLine(prev: StreamLine[], line: StreamLine): StreamLine[] {
  const content = line.content.trim();
  if (!content && line.type !== "text") {
    return prev;
  }

  if (line.type === "text") {
    if (!line.content) return prev;
    const last = prev[prev.length - 1];
    if (last?.type === "text") {
      const updated = [...prev];
      updated[updated.length - 1] = { type: "text", content: last.content + line.content };
      return updated;
    }
    return [...prev, line];
  }

  if (line.type === "todo") {
    if (!line.todos?.length) return prev;
    const last = prev[prev.length - 1];
    if (last?.type === "todo") {
      const updated = [...prev];
      updated[updated.length - 1] = line;
      return updated;
    }
    return [...prev, line];
  }

  if (line.type === "tool") {
    const last = prev[prev.length - 1];
    if (last?.type === "tool") {
      if (toolLineKey(last) === toolLineKey(line)) {
        if (last.content === content && last.detail === line.detail) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = line;
        return updated;
      }

      const lastFailed = last.content.endsWith("(failed)");
      const nextFailed = content.endsWith("(failed)");
      const lastBase = last.content.replace(/\s\(failed\)$/, "");
      const nextBase = content.replace(/\s\(failed\)$/, "");
      if (lastBase === nextBase && (last.detail ?? "") === (line.detail ?? "")) {
        const updated = [...prev];
        updated[updated.length - 1] = line;
        return updated;
      }

      if (!lastFailed && nextFailed && lastBase === nextBase && (last.detail ?? "") === (line.detail ?? "")) {
        const updated = [...prev];
        updated[updated.length - 1] = line;
        return updated;
      }
    }
    return [...prev, line];
  }

  if (line.type === "status") {
    if (content.startsWith("Widget source updated:")) return prev;
    const last = prev[prev.length - 1];
    if (last?.type === "status" && last.content === line.content) return prev;
  }

  if (line.type === "done") {
    const last = prev[prev.length - 1];
    if (last?.type === "done" && last.content === line.content) return prev;
  }

  return [...prev, line];
}

export interface LogEntry {
  kind: "text" | "tools" | "todo" | "event";
  text?: string;
  tools?: ToolChipEntry[];
  todos?: StreamTodoItem[];
  title?: string;
  line?: StreamLine;
}

function toToolChip(line: StreamLine): ToolChipEntry {
  const failed = line.content.endsWith("(failed)");
  return {
    label: failed ? line.content.replace(/\s\(failed\)$/, "") : line.content,
    detail: line.detail,
    failed,
    key: toolLineKey(line),
  };
}

/** Group consecutive tool lines into chip rows for display. */
export function groupStreamLines(lines: StreamLine[]): LogEntry[] {
  const entries: LogEntry[] = [];
  let textBuffer = "";

  const flushText = () => {
    if (!textBuffer) return;
    entries.push({ kind: "text", text: textBuffer });
    textBuffer = "";
  };

  for (const line of lines) {
    if (line.type === "text") {
      textBuffer += line.content;
      continue;
    }

    flushText();

    if (line.type === "todo") {
      const last = entries[entries.length - 1];
      if (last?.kind === "todo") {
        last.todos = line.todos;
        last.title = line.content;
        last.line = line;
      } else {
        entries.push({
          kind: "todo",
          title: line.content,
          todos: line.todos,
          line,
        });
      }
      continue;
    }

    if (line.type === "tool") {
      const chip = toToolChip(line);
      const last = entries[entries.length - 1];
      if (last?.kind === "tools") {
        const existing = last.tools!.find((tool) => tool.key === chip.key);
        if (existing) {
          Object.assign(existing, chip);
        } else {
          last.tools!.push(chip);
        }
      } else {
        entries.push({ kind: "tools", tools: [chip] });
      }
      continue;
    }

    entries.push({ kind: "event", line });
  }

  flushText();
  return entries;
}

export function formatEventContent(type: StreamLine["type"], content: string): string {
  if (type === "status" && content.startsWith("Run started: ")) {
    return "Agent run started";
  }
  return content;
}
