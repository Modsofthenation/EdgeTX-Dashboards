"use client";

import { useCallback, useRef, useState } from "react";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { DEFAULT_CHAT_MODEL } from "@/lib/chatModels";
import {
  appendAssistantLine,
  createAssistantPlaceholder,
  createUserMessage,
  fetchWidgetSource,
  patchAssistant,
  type ChatMessage,
  type ChatSendOptions,
  type WidgetSnapshot,
} from "@/lib/chatTypes";
import type { StreamLine } from "@/lib/streamLines";

function shouldRenderStreamEvent(type: string): boolean {
  return type !== "widget" && type !== "status" && type !== "done";
}

export function useWidgetChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<TelemetryProtocol>("betaflight");
  const [modelId, setModelId] = useState(DEFAULT_CHAT_MODEL);
  const [edgeTxVersion, setEdgeTxVersion] = useState("2.11.0");
  const [running, setRunning] = useState(false);
  const [artifact, setArtifact] = useState<WidgetSnapshot | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const widgetNameRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenerationRef = useRef(0);

  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadArtifact = useCallback(async (name: string, validated?: boolean, issues?: ValidationIssue[]) => {
    const generation = ++fetchGenerationRef.current;
    const fetched = await fetchWidgetSource(null, name);
    if (!fetched || generation !== fetchGenerationRef.current) return;

    widgetNameRef.current = fetched.name;
    setArtifact((prev) => ({
      name: fetched.name,
      luaSource: fetched.source,
      validated: validated ?? prev?.validated ?? false,
      validationIssues: issues ?? prev?.validationIssues ?? [],
    }));
  }, []);

  const scheduleLoadArtifact = useCallback(
    (name: string, validated?: boolean, issues?: ValidationIssue[]) => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        void loadArtifact(name, validated, issues);
      }, 500);
    },
    [loadArtifact]
  );

  const sendMessage = useCallback(
    async (prompt: string, options?: Partial<ChatSendOptions>) => {
      const trimmed = prompt.trim();
      if (!trimmed || running) return;

      const proto = options?.protocol ?? protocol;
      const model = options?.modelId ?? modelId;
      const edgeTx = options?.edgeTxVersion ?? edgeTxVersion;

      setProtocol(proto);
      setModelId(model);

      const userMessage = createUserMessage(trimmed);
      const assistantMessage = createAssistantPlaceholder();
      const assistantId = assistantMessage.id;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);

      const isRefine = !!sessionIdRef.current;
      const url = isRefine ? "/api/refine" : "/api/generate";
      const body = isRefine
        ? { sessionId: sessionIdRef.current, prompt: trimmed }
        : {
            prompt: trimmed,
            radioId: "tx15",
            protocol: proto,
            edgeTxVersion: edgeTx,
            modelId: model,
          };

      let validated = false;
      let validationIssues: ValidationIssue[] = [];

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setMessages((prev) =>
            patchAssistant(prev, assistantId, {
              isStreaming: false,
              error: true,
              content: err.error ?? "Request failed",
            })
          );
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
                type: string;
                content: string;
                sessionId?: string;
                widgetName?: string;
                success?: boolean;
                validated?: boolean;
                validationIssues?: ValidationIssue[];
              };

              if (data.sessionId) {
                setSessionId(data.sessionId);
                sessionIdRef.current = data.sessionId;
              }

              if (data.type === "widget" && data.widgetName) {
                widgetNameRef.current = data.widgetName;
                scheduleLoadArtifact(data.widgetName, validated, validationIssues);
              }

              if (data.validated !== undefined) validated = data.validated;
              if (data.validationIssues) validationIssues = data.validationIssues;

              if (shouldRenderStreamEvent(data.type)) {
                const lineType =
                  data.type === "done" && data.success === false ? "error" : (data.type as StreamLine["type"]);
                if (lineType === "text" || lineType === "tool" || lineType === "status" || lineType === "error" || lineType === "done") {
                  setMessages((prev) =>
                    appendAssistantLine(prev, assistantId, { type: lineType, content: data.content })
                  );
                }
              }

              if (data.type === "done" || data.type === "error") {
                const name = data.widgetName ?? widgetNameRef.current;
                if (name) {
                  await loadArtifact(name, validated, validationIssues);
                }

                setArtifact((prev) =>
                  prev
                    ? { ...prev, validated, validationIssues }
                    : prev
                );

                setMessages((prev) =>
                  patchAssistant(prev, assistantId, {
                    isStreaming: false,
                    error: data.type === "error" && data.success === false,
                  })
                );
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            patchAssistant(prev, assistantId, {
              isStreaming: false,
              error: true,
              content: (err as Error).message,
            })
          );
        }
      } finally {
        setRunning(false);
        if (widgetNameRef.current) {
          await loadArtifact(widgetNameRef.current, validated, validationIssues);
        }
      }
    },
    [running, protocol, modelId, edgeTxVersion, loadArtifact, scheduleLoadArtifact]
  );

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchGenerationRef.current += 1;
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    widgetNameRef.current = null;
    setArtifact(null);
    setRunning(false);
  }, []);

  return {
    messages,
    sessionId,
    protocol,
    setProtocol,
    modelId,
    setModelId,
    edgeTxVersion,
    setEdgeTxVersion,
    running,
    artifact,
    sendMessage,
    startNewChat,
    canRefine: !!sessionId,
  };
}
