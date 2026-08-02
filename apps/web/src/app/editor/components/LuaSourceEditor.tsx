"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorSelection, type Extension } from "@codemirror/state";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { edgeTxLuaSupport } from "../lib/edgetxCompletions";
import { buildEdgeTxEditorTheme } from "../lib/edgetxEditorTheme";
import styles from "../editor.module.css";

export type LuaSourceEditorHandle = {
  revealLine: (line: number) => void;
  focus: () => void;
};

export type LuaLintIssue = {
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
};

function issuesToDiagnostics(
  doc: string,
  issues: LuaLintIssue[],
): Diagnostic[] {
  const lineCount = doc === "" ? 1 : doc.split("\n").length;
  const out: Diagnostic[] = [];
  for (const issue of issues) {
    if (issue.line == null || issue.line < 1) continue;
    const line = Math.min(issue.line, lineCount);
    let from = 0;
    const lines = doc.split("\n");
    for (let i = 0; i < line - 1; i++) {
      from += (lines[i]?.length ?? 0) + 1;
    }
    const to = from + (lines[line - 1]?.length ?? 0);
    out.push({
      from,
      to: Math.max(from, to),
      severity: issue.severity === "info" ? "info" : issue.severity,
      message: issue.message,
    });
  }
  return out;
}

function isAppUndoKey(binding: { key?: string }): boolean {
  const key = binding.key ?? "";
  return (
    key === "Mod-z" ||
    key === "Mod-Z" ||
    key === "Mod-y" ||
    key === "Mod-Y" ||
    key === "Mod-Shift-z" ||
    key === "Mod-Shift-Z"
  );
}

const EMPTY_LUA_ISSUES: LuaLintIssue[] = [];

export const LuaSourceEditor = memo(
  forwardRef<
    LuaSourceEditorHandle,
    {
      value: string;
      onChange: (next: string) => void;
      onBlur?: () => void;
      issues?: LuaLintIssue[];
      readOnly?: boolean;
    }
  >(function LuaSourceEditor(
    { value, onChange, onBlur, issues = EMPTY_LUA_ISSUES, readOnly = false },
    ref,
  ) {
    const cmRef = useRef<ReactCodeMirrorRef>(null);
    const issuesRef = useRef(issues);
    issuesRef.current = issues;

    useImperativeHandle(
      ref,
      () => ({
        revealLine(line: number) {
          const view = cmRef.current?.view;
          if (!view) return;
          const safe = Math.max(1, Math.min(line, view.state.doc.lines));
          const lineObj = view.state.doc.line(safe);
          view.dispatch({
            selection: EditorSelection.cursor(lineObj.from),
            effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }),
          });
          view.focus();
        },
        focus() {
          cmRef.current?.view?.focus();
        },
      }),
      [],
    );

    const extensions = useMemo((): Extension[] => {
      return [
        StreamLanguage.define(lua),
        lineNumbers(),
        highlightSelectionMatches(),
        lintGutter(),
        linter((view) =>
          issuesToDiagnostics(view.state.doc.toString(), issuesRef.current),
        ),
        edgeTxLuaSupport(),
        buildEdgeTxEditorTheme(),
        keymap.of([
          indentWithTab,
          // App-level undo/redo owns the shared source history with the canvas.
          ...defaultKeymap.filter((b) => !isAppUndoKey(b)),
          ...searchKeymap,
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "EdgeTX Lua source",
          spellcheck: "false",
        }),
      ];
    }, []);

    // Re-run linter when validation issues change.
    useEffect(() => {
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({});
    }, [issues]);

    return (
      <div className={styles.luaEditorHost} data-testid="lua-source-editor">
        <div className={styles.luaEditorMeta}>
          <span className={styles.luaEditorMetaFact}>EdgeTX Lua</span>
          <span className={styles.luaEditorMetaSep} aria-hidden>
            ·
          </span>
          <span className={styles.luaEditorMetaFact}>
            autocomplete from stubs 2.11
          </span>
          <span className={styles.luaEditorMetaSep} aria-hidden>
            ·
          </span>
          <span className={styles.luaEditorMetaHints}>
            Ctrl+Space for completions · hover for docs
          </span>
        </div>
        <CodeMirror
          ref={cmRef}
          value={value}
          height="100%"
          theme="none"
          readOnly={readOnly}
          basicSetup={false}
          extensions={extensions}
          onChange={onChange}
          onBlur={onBlur}
          className={styles.luaCodeMirror}
        />
      </div>
    );
  }),
);
