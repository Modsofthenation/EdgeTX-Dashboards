"use client";

import { useCallback, useRef, useState } from "react";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { PromptForm } from "./PromptForm";
import { RunStream } from "./RunStream";
import { Preview480x320 } from "./Preview480x320";
import { DownloadPanel } from "./DownloadPanel";
import { InstallGuidePanel } from "./InstallGuidePanel";
import { appendStreamLine, type StreamLine } from "@/lib/streamLines";
import styles from "./GeneratorApp.module.css";

export function GeneratorApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [widgetName, setWidgetName] = useState<string | null>(null);
  const [luaSource, setLuaSource] = useState<string | null>(null);
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [running, setRunning] = useState(false);
  const [protocol, setProtocol] = useState<TelemetryProtocol>("betaflight");
  const [validated, setValidated] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const widgetNameRef = useRef<string | null>(null);

  const appendLine = useCallback((line: StreamLine) => {
    setLines((prev) => appendStreamLine(prev, line));
  }, []);

  const fetchLuaSource = useCallback(async (session?: string | null, name?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (session) {
        params.set("sessionId", session);
      }
      if (name) {
        params.set("name", name);
      }
      if (!session && !name) {
        return;
      }

      const res = await fetch(`/api/widget-source?${params}`);
      if (res.status === 204) {
        return;
      }
      if (!res.ok) {
        return;
      }

      const text = await res.text();
      if (text && !text.startsWith("{")) {
        setLuaSource(text);
        const headerName = res.headers.get("X-Widget-Name");
        if (headerName) {
          setWidgetName(headerName);
          widgetNameRef.current = headerName;
        }
      }
    } catch {
      // source may not exist yet
    }
  }, []);

  const runStream = useCallback(
    async (url: string, body: object) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setLines([]);
      setValidated(false);
      setValidationIssues([]);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          appendLine({ type: "error", content: err.error ?? "Request failed" });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(part.slice(6)) as {
                type: StreamLine["type"];
                content: string;
                detail?: string;
                todos?: StreamLine["todos"];
                toolName?: string;
                sessionId?: string;
                widgetName?: string;
                success?: boolean;
                validated?: boolean;
                validationIssues?: ValidationIssue[];
              };

              const lineType =
                data.type === "done" && data.success === false ? "error" : data.type;
              appendLine({
                type: lineType,
                content: data.content,
                detail: data.detail,
                todos: data.todos,
                toolName: data.toolName,
              });

              if (data.sessionId) {
                setSessionId(data.sessionId);
                sessionIdRef.current = data.sessionId;
              }
              if (data.widgetName) {
                setWidgetName(data.widgetName);
                widgetNameRef.current = data.widgetName;
                void fetchLuaSource(data.sessionId ?? sessionIdRef.current, data.widgetName);
              }
              if (data.validated !== undefined) setValidated(data.validated);
              if (data.validationIssues) setValidationIssues(data.validationIssues);

              if (data.type === "done" || data.type === "error") {
                void fetchLuaSource(
                  data.sessionId ?? sessionIdRef.current,
                  data.widgetName ?? widgetNameRef.current
                );
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          appendLine({ type: "error", content: (err as Error).message });
        }
      } finally {
        setRunning(false);
        void fetchLuaSource(sessionIdRef.current, widgetNameRef.current);
      }
    },
    [appendLine, fetchLuaSource]
  );

  const handleGenerate = useCallback(
    (prompt: string, radioId: string, proto: TelemetryProtocol, edgeTxVersion: string) => {
      setProtocol(proto);
      setSessionId(null);
      sessionIdRef.current = null;
      widgetNameRef.current = null;
      setWidgetName(null);
      setValidated(false);
      setValidationIssues([]);
      setLuaSource(null);
      void runStream("/api/generate", { prompt, radioId, protocol: proto, edgeTxVersion });
    },
    [runStream]
  );

  const handleRefine = useCallback(
    (prompt: string) => {
      if (!sessionId) return;
      void runStream("/api/refine", { sessionId, prompt });
    },
    [sessionId, runStream]
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo} aria-hidden>
            <span>ETX</span>
          </div>
          <div className={styles.brandText}>
            <h1>Dashboard Generator</h1>
            <p>AI-powered Lua dashboards for RadioMaster TX15</p>
          </div>
        </div>
        <div className={styles.headerMeta}>
          {running && (
            <span className={styles.statusLive}>
              <span className={styles.pulse} />
              Generating
            </span>
          )}
          {widgetName && !running && (
            <span className={validated ? styles.statusOk : styles.statusWarn}>
              {validated ? "Validated" : "Needs fixes"}
            </span>
          )}
          <span className={styles.chip}>480×320</span>
          <span className={styles.chip}>EdgeTX 2.11+</span>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.left} aria-label="Generator controls">
          <div className={styles.sectionLabel}>Create</div>
          <PromptForm onGenerate={handleGenerate} onRefine={handleRefine} running={running} canRefine={!!sessionId} />
          <RunStream lines={lines} running={running} />
        </section>

        <aside className={styles.right} aria-label="Preview and output">
          <div className={styles.sectionLabel}>Preview</div>
          <Preview480x320 luaSource={luaSource} widgetName={widgetName} live={!!luaSource} />
          <div className={styles.sectionLabel}>Deploy</div>
          <InstallGuidePanel protocol={protocol} widgetName={widgetName} />
          <DownloadPanel
            widgetName={widgetName}
            sessionId={sessionId}
            protocol={protocol}
            validated={validated}
            validationIssues={validationIssues}
          />
        </aside>
      </main>

      <footer className={styles.footer}>
        <span>Powered by Cursor SDK</span>
        <span className={styles.footerDot} aria-hidden>
          ·
        </span>
        <span>Betaflight · Rotorflight · CRSF</span>
      </footer>
    </div>
  );
}
