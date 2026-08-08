import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/**
 * CodeMirror theme that follows product CSS variables so light/dark/appearance
 * themes stay consistent with the rest of the editor.
 */
export function buildEdgeTxEditorTheme(): Extension {
  const highlight = HighlightStyle.define([
    { tag: t.keyword, color: "var(--accent-bright)", fontWeight: "600" },
    { tag: t.controlKeyword, color: "var(--accent-bright)", fontWeight: "600" },
    { tag: t.operatorKeyword, color: "var(--accent)" },
    { tag: t.comment, color: "var(--text-muted)", fontStyle: "italic" },
    { tag: t.string, color: "var(--ok, #16a34a)" },
    { tag: t.number, color: "var(--accent)" },
    { tag: t.bool, color: "var(--accent-bright)" },
    { tag: t.null, color: "var(--accent-bright)" },
    { tag: t.function(t.variableName), color: "var(--text)" },
    { tag: t.variableName, color: "var(--text)" },
    { tag: t.propertyName, color: "var(--text-secondary)" },
    { tag: t.definition(t.variableName), color: "var(--text)" },
    { tag: t.paren, color: "var(--text-muted)" },
    { tag: t.bracket, color: "var(--text-muted)" },
    { tag: t.punctuation, color: "var(--text-muted)" },
  ]);

  const appearance =
    typeof document !== "undefined"
      ? (document.documentElement.getAttribute("data-theme") ?? "light")
      : "light";
  const dark = appearance !== "light";

  const theme = EditorView.theme(
    {
      "&": {
        height: "100%",
        fontSize: "13px",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-mono)",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.55",
        overflow: "auto",
      },
      ".cm-content": {
        caretColor: "var(--accent-bright)",
        padding: "0.75rem 0",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--accent-bright)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        {
          backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
        },
      ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-muted)",
        border: "none",
        borderRight: "1px solid var(--border)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
        color: "var(--text-secondary)",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "2.75rem",
        padding: "0 0.6rem 0 0.4rem",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.25))",
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        fontFamily: "var(--font-mono)",
        maxHeight: "240px",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        padding: "0.3rem 0.55rem",
        lineHeight: "1.35",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
        color: "var(--text)",
      },
      ".cm-completionLabel": {
        fontFamily: "var(--font-mono)",
      },
      ".cm-completionDetail": {
        marginLeft: "0.6rem",
        color: "var(--text-muted)",
        fontStyle: "normal",
      },
      ".cm-completionIcon": {
        opacity: 0.7,
      },
      ".cm-diagnostic-error": {
        borderBottom: "2px solid var(--danger, #dc2626)",
      },
      ".cm-diagnostic-warning": {
        borderBottom: "2px solid var(--warn, #d97706)",
      },
      ".cm-edgetx-hover": {
        padding: "0.45rem 0.6rem",
        maxWidth: "360px",
      },
      ".cm-edgetx-hover-title": {
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        color: "var(--accent-bright)",
        marginBottom: "0.25rem",
      },
      ".cm-edgetx-hover-body": {
        color: "var(--text-secondary)",
        lineHeight: 1.4,
      },
      ".cm-panels": {
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text)",
        borderTop: "1px solid var(--border)",
      },
      ".cm-searchMatch": {
        backgroundColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor:
          "color-mix(in srgb, var(--accent-bright) 45%, transparent)",
      },
    },
    { dark },
  );

  return [theme, syntaxHighlighting(highlight)];
}
