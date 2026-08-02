import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { hoverTooltip, keymap, type Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import catalog from "./edgetxCompletionsData.json";

export type EdgeTxCompletionItem = {
  kind: "function" | "constant";
  label: string;
  insert: string;
  detail: string;
  info: string;
  module?: string;
  name: string;
};

const LUA_KEYWORDS = [
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
] as const;

const items = catalog.items as EdgeTxCompletionItem[];

const byLabel = new Map(items.map((item) => [item.label, item]));
const byName = new Map<string, EdgeTxCompletionItem[]>();
for (const item of items) {
  const list = byName.get(item.name) ?? [];
  list.push(item);
  byName.set(item.name, list);
}

function completionType(kind: EdgeTxCompletionItem["kind"]): string {
  return kind === "function" ? "function" : "constant";
}

function toCompletion(
  item: EdgeTxCompletionItem,
  opts?: { insertOverride?: string; boost?: number },
): Completion {
  return {
    label: item.label,
    detail: item.detail,
    info: item.info || undefined,
    type: completionType(item.kind),
    apply: opts?.insertOverride ?? item.insert,
    boost: opts?.boost,
  };
}

function moduleMemberCompletions(
  moduleName: string,
  prefix: string,
): Completion[] {
  const needle = prefix.toLowerCase();
  return items
    .filter(
      (item) =>
        item.module === moduleName &&
        (!needle || item.name.toLowerCase().startsWith(needle)),
    )
    .map((item) =>
      toCompletion(item, {
        insertOverride: item.insert,
        boost: item.kind === "function" ? 2 : 1,
      }),
    );
}

export function edgeTxCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const member = context.matchBefore(/([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)?/);
  if (member) {
    const [, moduleName, partial = ""] = member.text.match(
      /^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)?$/,
    )!;
    const options = moduleMemberCompletions(moduleName, partial);
    if (options.length > 0 || context.explicit) {
      const dot = member.from + moduleName.length + 1;
      return { from: dot, options, validFor: /^[\w]*$/ };
    }
  }

  const word = context.matchBefore(/[A-Za-z_][\w]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const needle = word.text.toLowerCase();
  const options: Completion[] = [];

  for (const kw of LUA_KEYWORDS) {
    if (kw.startsWith(needle)) {
      options.push({
        label: kw,
        type: "keyword",
        boost: 3,
      });
    }
  }

  for (const item of items) {
    const labelMatch = item.label.toLowerCase().startsWith(needle);
    const nameMatch = item.name.toLowerCase().startsWith(needle);
    if (!labelMatch && !nameMatch) continue;
    options.push(
      toCompletion(item, {
        boost: item.module ? 1 : 2,
      }),
    );
  }

  return {
    from: word.from,
    options,
    validFor: /^[\w.]*$/,
  };
}

function tokenAround(pos: number, doc: string): string | null {
  let start = pos;
  let end = pos;
  while (start > 0 && /[\w.]/.test(doc[start - 1]!)) start--;
  while (end < doc.length && /[\w.]/.test(doc[end]!)) end++;
  const raw = doc.slice(start, end);
  if (!raw) return null;
  // Prefer the qualified identifier under / just before the cursor.
  const parts = raw.match(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g);
  if (!parts || parts.length === 0) return null;
  return parts[parts.length - 1]!;
}

function lookupAt(pos: number, doc: string): EdgeTxCompletionItem | null {
  const token = tokenAround(pos, doc);
  if (!token) return null;
  if (byLabel.has(token)) return byLabel.get(token)!;
  const bare = token.includes(".") ? token.split(".").pop()! : token;
  return (
    byName.get(bare)?.find((i) => !i.module) ?? byName.get(bare)?.[0] ?? null
  );
}

function edgeTxHoverTooltip(): Extension {
  return hoverTooltip((view, pos): Tooltip | null => {
    const item = lookupAt(pos, view.state.doc.toString());
    if (!item) return null;
    const start = Math.max(0, pos - item.label.length);
    return {
      pos: start,
      end: pos + 1,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-edgetx-hover";
        const title = document.createElement("div");
        title.className = "cm-edgetx-hover-title";
        title.textContent = item.detail || item.label;
        dom.appendChild(title);
        if (item.info) {
          const body = document.createElement("div");
          body.className = "cm-edgetx-hover-body";
          body.textContent = item.info;
          dom.appendChild(body);
        }
        return { dom };
      },
    };
  });
}

/** EdgeTX-aware autocomplete + hover docs for the Lua source editor. */
export function edgeTxLuaSupport(): Extension[] {
  return [
    autocompletion({
      override: [edgeTxCompletions],
      defaultKeymap: true,
      closeOnBlur: true,
      activateOnTyping: true,
      icons: true,
    }),
    keymap.of(completionKeymap),
    edgeTxHoverTooltip(),
  ];
}

export function listEdgeTxCompletionLabels(): string[] {
  return items.map((item) => item.label);
}

export { items as edgeTxCompletionItems };
