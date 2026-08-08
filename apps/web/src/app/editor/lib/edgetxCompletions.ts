import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import {
  DEFAULT_EDGE_TX_VERSION,
  stubFolderForEdgeTxVersion,
  type EdgeTxStubVersion,
} from "~/lib/edgeTxVersions";
import catalogFile from "./edgetxCompletionsData.json";

export type EdgeTxCompletionItem = {
  kind: "function" | "constant";
  label: string;
  insert: string;
  detail: string;
  info: string;
  module?: string;
  name: string;
};

type CatalogBundle = {
  version: string;
  source: string;
  items: EdgeTxCompletionItem[];
};

type CatalogIndex = {
  items: EdgeTxCompletionItem[];
  byLabel: Map<string, EdgeTxCompletionItem>;
  byName: Map<string, EdgeTxCompletionItem[]>;
  source: string;
  stubVersion: EdgeTxStubVersion;
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

const versions = catalogFile.versions as Record<string, CatalogBundle>;
const defaultStub = (catalogFile.defaultVersion ?? "2.11") as EdgeTxStubVersion;

const indexCache = new Map<string, CatalogIndex>();

function buildIndex(stubVersion: EdgeTxStubVersion): CatalogIndex {
  const cached = indexCache.get(stubVersion);
  if (cached) return cached;

  const bundle =
    versions[stubVersion] ??
    versions[defaultStub] ??
    versions[Object.keys(versions)[0]!]!;
  const items = bundle.items;
  const byLabel = new Map(items.map((item) => [item.label, item]));
  const byName = new Map<string, EdgeTxCompletionItem[]>();
  for (const item of items) {
    const list = byName.get(item.name) ?? [];
    list.push(item);
    byName.set(item.name, list);
  }
  const index: CatalogIndex = {
    items,
    byLabel,
    byName,
    source: bundle.source,
    stubVersion,
  };
  indexCache.set(stubVersion, index);
  return index;
}

export function resolveCompletionCatalog(
  edgeTxVersion: string = DEFAULT_EDGE_TX_VERSION,
): CatalogIndex {
  return buildIndex(stubFolderForEdgeTxVersion(edgeTxVersion));
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
  index: CatalogIndex,
  moduleName: string,
  prefix: string,
): Completion[] {
  const needle = prefix.toLowerCase();
  return index.items
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

export function edgeTxCompletionsFor(
  edgeTxVersion: string,
): (context: CompletionContext) => CompletionResult | null {
  const index = resolveCompletionCatalog(edgeTxVersion);
  return (context: CompletionContext): CompletionResult | null => {
    const member = context.matchBefore(/([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)?/);
    if (member) {
      const [, moduleName, partial = ""] = member.text.match(
        /^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)?$/,
      )!;
      const options = moduleMemberCompletions(index, moduleName, partial);
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

    for (const item of index.items) {
      const labelMatch = item.label.toLowerCase().startsWith(needle);
      const nameMatch = item.name.toLowerCase().startsWith(needle);
      if (!labelMatch && !nameMatch) continue;
      // Bare-word accept must keep the module qualifier (typing "lcd" →
      // accept "lcd.clear" must insert "lcd.clear()", not "clear()").
      const insert = item.module
        ? `${item.module}.${item.insert}`
        : item.insert;
      options.push(
        toCompletion(item, {
          insertOverride: insert,
          boost: item.module ? 1 : 2,
        }),
      );
    }

    return {
      from: word.from,
      options,
      validFor: /^[\w.]*$/,
    };
  };
}

/** @deprecated Prefer edgeTxCompletionsFor(version) — defaults to 2.11. */
export function edgeTxCompletions(
  context: CompletionContext,
): CompletionResult | null {
  return edgeTxCompletionsFor(DEFAULT_EDGE_TX_VERSION)(context);
}

function tokenAround(
  pos: number,
  doc: string,
): { from: number; to: number; text: string } | null {
  let start = pos;
  let end = pos;
  while (start > 0 && /[\w.]/.test(doc[start - 1]!)) start--;
  while (end < doc.length && /[\w.]/.test(doc[end]!)) end++;
  const raw = doc.slice(start, end);
  if (!raw) return null;
  const parts = [...raw.matchAll(/[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g)];
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1]!;
  const text = last[0]!;
  const from = start + (last.index ?? 0);
  return { from, to: from + text.length, text };
}

function lookupAt(
  index: CatalogIndex,
  pos: number,
  doc: string,
): { item: EdgeTxCompletionItem; from: number; to: number } | null {
  const token = tokenAround(pos, doc);
  if (!token) return null;
  let item = index.byLabel.get(token.text) ?? null;
  if (!item) {
    const bare = token.text.includes(".")
      ? token.text.split(".").pop()!
      : token.text;
    item =
      index.byName.get(bare)?.find((i) => !i.module) ??
      index.byName.get(bare)?.[0] ??
      null;
  }
  if (!item) return null;
  return { item, from: token.from, to: token.to };
}

function edgeTxHoverTooltip(edgeTxVersion: string): Extension {
  const index = resolveCompletionCatalog(edgeTxVersion);
  return hoverTooltip((view, pos): Tooltip | null => {
    const hit = lookupAt(index, pos, view.state.doc.toString());
    if (!hit) return null;
    return {
      pos: hit.from,
      end: hit.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-edgetx-hover";
        const title = document.createElement("div");
        title.className = "cm-edgetx-hover-title";
        title.textContent = hit.item.detail || hit.item.label;
        dom.appendChild(title);
        if (hit.item.info) {
          const body = document.createElement("div");
          body.className = "cm-edgetx-hover-body";
          body.textContent = hit.item.info;
          dom.appendChild(body);
        }
        return { dom };
      },
    };
  });
}

/** EdgeTX-aware autocomplete + hover docs for the selected firmware version. */
export function edgeTxLuaSupport(
  edgeTxVersion: string = DEFAULT_EDGE_TX_VERSION,
): Extension[] {
  return [
    autocompletion({
      override: [edgeTxCompletionsFor(edgeTxVersion)],
      defaultKeymap: true,
      closeOnBlur: true,
      activateOnTyping: true,
      icons: true,
    }),
    edgeTxHoverTooltip(edgeTxVersion),
  ];
}

export function listEdgeTxCompletionLabels(
  edgeTxVersion: string = DEFAULT_EDGE_TX_VERSION,
): string[] {
  return resolveCompletionCatalog(edgeTxVersion).items.map(
    (item) => item.label,
  );
}

export function availableCompletionStubVersions(): string[] {
  return Object.keys(versions);
}
