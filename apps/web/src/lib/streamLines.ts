export interface StreamLine {
  type: "text" | "tool" | "status" | "error" | "done";
  content: string;
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

  if (line.type === "tool") {
    const last = prev[prev.length - 1];
    if (last?.type === "tool") {
      if (last.content === content) return prev;
      const lastBase = last.content.replace(/\s\(failed\)$/, "");
      const nextBase = content.replace(/\s\(failed\)$/, "");
      if (lastBase === nextBase) {
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
    if (content.includes("Generation finished and validated")) return prev;
    const last = prev[prev.length - 1];
    if (last?.type === "done" && last.content === line.content) return prev;
  }

  return [...prev, line];
}

export interface LogEntry {
  kind: "text" | "tools" | "event";
  text?: string;
  tools?: string[];
  line?: StreamLine;
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

    if (line.type === "tool") {
      const last = entries[entries.length - 1];
      if (last?.kind === "tools") {
        if (!last.tools!.includes(line.content)) {
          last.tools!.push(line.content);
        }
      } else {
        entries.push({ kind: "tools", tools: [line.content] });
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
