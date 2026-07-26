import type { StreamTodoItem } from "@widget-gen/shared";

export interface ToolDisplayInfo {
  label: string;
  detail?: string;
  todos?: StreamTodoItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function shortPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const generatedIdx = normalized.lastIndexOf("/generated/");
  if (generatedIdx >= 0) {
    return normalized.slice(generatedIdx + 1);
  }
  if (normalized.startsWith("generated/")) {
    return normalized;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "…";
  // Absolute paths: never echo directory structure (only leaf names).
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return parts.length === 1
      ? parts[0]!
      : `…/${parts.slice(-2).join("/")}`;
  }
  if (parts.length <= 2) return parts.join("/");
  return `…/${parts.slice(-2).join("/")}`;
}

function scrubAbsolutePaths(text: string): string {
  return text
    .replace(/(^|[\s"'=])(\/(?:[^/\s"']+\/)+[^/\s"']+)/g, (_m, prefix: string, path: string) => {
      const leaf = path.split("/").filter(Boolean).pop() ?? "…";
      return `${prefix}…/${leaf}`;
    })
    .replace(
      /(^|[\s"'=])([A-Za-z]:\\(?:[^\\/\s"']+\\)+[^\\/\s"']+)/g,
      (_m, prefix: string, path: string) => {
        const leaf = path.split(/[/\\]/).filter(Boolean).pop() ?? "…";
        return `${prefix}…/${leaf}`;
      },
    );
}

function sanitizeDetail(text: string): string {
  return scrubAbsolutePaths(text);
}

function truncate(text: string, max = 72): string {
  const oneLine = sanitizeDetail(text).replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function parseTodos(
  input: Record<string, unknown>,
): StreamTodoItem[] | undefined {
  const raw = input.todos;
  if (!Array.isArray(raw)) return undefined;

  const todos: StreamTodoItem[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;

    const content = readString(record.content);
    if (!content) continue;

    const id = readString(record.id) ?? String(todos.length + 1);
    const status = readString(record.status);
    const validStatus =
      status === "pending" ||
      status === "in_progress" ||
      status === "completed" ||
      status === "cancelled";

    todos.push({
      id,
      content,
      status: validStatus ? status : "pending",
    });
  }

  return todos.length > 0 ? todos : undefined;
}

function formatToolLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Turn SDK tool name + args into a human-readable label and optional detail line. */
export function describeToolUse(name: string, input: unknown): ToolDisplayInfo {
  const args = asRecord(input) ?? {};
  const normalized = name.toLowerCase();

  if (normalized === "todowrite" || normalized === "todo_write") {
    const todos = parseTodos(args);
    return {
      label: "Update todos",
      todos,
    };
  }

  if (normalized === "read") {
    const path = readString(args.path) ?? readString(args.target_file);
    return { label: "Read", detail: path ? shortPath(path) : undefined };
  }

  if (normalized === "write") {
    const path = readString(args.path) ?? readString(args.file_path);
    return { label: "Write", detail: path ? shortPath(path) : undefined };
  }

  if (normalized === "strreplace" || normalized === "str_replace") {
    const path = readString(args.path) ?? readString(args.file_path);
    return { label: "Edit", detail: path ? shortPath(path) : undefined };
  }

  if (normalized === "delete") {
    const path = readString(args.path);
    return { label: "Delete", detail: path ? shortPath(path) : undefined };
  }

  if (normalized === "grep") {
    const pattern = readString(args.pattern);
    const path = readString(args.path) ?? readString(args.glob);
    const detail = [
      pattern ? `/${pattern}/` : undefined,
      path ? shortPath(path) : undefined,
    ]
      .filter(Boolean)
      .join(" in ");
    return { label: "Search", detail: detail || undefined };
  }

  if (normalized === "semanticsearch") {
    const query = readString(args.query);
    const dirs = Array.isArray(args.target_directories)
      ? args.target_directories.map((d) => readString(d)).filter(Boolean)
      : [];
    const detail = query
      ? truncate(query)
      : dirs.length > 0
        ? dirs.map((d) => shortPath(d!)).join(", ")
        : undefined;
    return { label: "Explore", detail };
  }

  if (normalized === "shell") {
    const command = readString(args.command);
    const description = readString(args.description);
    return {
      label: "Terminal",
      detail: command ? truncate(command) : description,
    };
  }

  if (normalized === "callmcptool" || normalized === "mcp") {
    const server = readString(args.server);
    const toolName = readString(args.toolName) ?? readString(args.tool_name);
    const description = readString(args.description);
    const detail =
      [server, toolName].filter(Boolean).join(" · ") || description;
    return { label: "MCP", detail: detail || undefined };
  }

  if (normalized === "websearch") {
    const term = readString(args.search_term) ?? readString(args.query);
    return { label: "Web search", detail: term ? truncate(term) : undefined };
  }

  if (normalized === "webfetch") {
    const url = readString(args.url);
    return { label: "Fetch URL", detail: url ? truncate(url, 56) : undefined };
  }

  if (normalized === "task") {
    const description = readString(args.description);
    const subagent = readString(args.subagent_type);
    const detail = [description, subagent ? `(${subagent})` : undefined]
      .filter(Boolean)
      .join(" ");
    return { label: "Subagent", detail: detail ? truncate(detail) : undefined };
  }

  if (normalized === "generateimage") {
    const description = readString(args.description);
    return {
      label: "Generate image",
      detail: description ? truncate(description) : undefined,
    };
  }

  const fallbackDetail =
    readString(args.description) ??
    (readString(args.path) ? shortPath(readString(args.path)!) : undefined) ??
    readString(args.query) ??
    (readString(args.command)
      ? truncate(readString(args.command)!)
      : undefined);

  return {
    label: formatToolLabel(name),
    detail: fallbackDetail ? truncate(fallbackDetail) : undefined,
  };
}
