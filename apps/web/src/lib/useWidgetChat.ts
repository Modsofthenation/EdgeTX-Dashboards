"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { DEFAULT_RADIO_ID } from "@widget-gen/shared";
import { DEFAULT_CHAT_MODEL, FALLBACK_CHAT_MODELS, type ChatModel } from "@/lib/chatModels";
import {
  fetchModelCatalog,
  findModel,
} from "@/lib/modelCatalog";
import {
  createChatRecord,
  fetchChat,
  fetchChatList,
  removeChatRecord,
  syncChatRecord,
} from "@/lib/chatHistoryApi";
import {
  fetchRadioCatalog,
  findRadio,
  type RadioCatalogEntry,
} from "@/lib/radioCatalog";
import {
  appendAssistantLine,
  createAssistantPlaceholder,
  createUserMessage,
  fetchWidgetSource,
  patchAssistant,
  type ChatMessage,
  type ChatSendOptions,
  type ChatSummary,
  type WidgetSnapshot,
} from "@/lib/chatTypes";
import type { StreamLine } from "@/lib/streamLines";

function shouldRenderStreamEvent(type: string): boolean {
  return type !== "widget" && type !== "status" && type !== "done";
}

export function useWidgetChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<TelemetryProtocol>("betaflight");
  const [radioId, setRadioId] = useState(DEFAULT_RADIO_ID);
  const [radios, setRadios] = useState<RadioCatalogEntry[]>([]);
  const [models, setModels] = useState<ChatModel[]>(FALLBACK_CHAT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelId, setModelId] = useState(DEFAULT_CHAT_MODEL);
  const [edgeTxVersion, setEdgeTxVersion] = useState("2.11.0");
  const [running, setRunning] = useState(false);
  const [artifact, setArtifact] = useState<WidgetSnapshot | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const chatIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const widgetNameRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenerationRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const artifactRef = useRef<WidgetSnapshot | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshHistory = useCallback(async () => {
    const chats = await fetchChatList();
    setChatHistory(chats);
  }, []);

  useEffect(() => {
    void refreshHistory().finally(() => setHistoryLoading(false));
    void fetchRadioCatalog().then((catalog) => setRadios(catalog.radios));
    void fetchModelCatalog()
      .then((catalog) => {
        setModels(catalog.models);
        setModelId((current) =>
          catalog.models.some((m) => m.id === current) ? current : catalog.defaultId
        );
      })
      .finally(() => setModelsLoading(false));
  }, [refreshHistory]);

  const selectedRadio = useMemo(
    () => findRadio({ defaultId: DEFAULT_RADIO_ID, radios }, radioId),
    [radioId, radios]
  );

  const selectedModel = useMemo(
    () => findModel({ defaultId: DEFAULT_CHAT_MODEL, models }, modelId),
    [modelId, models]
  );

  const layoutProfileId = selectedRadio?.layoutProfile ?? DEFAULT_RADIO_ID;

  const persistChat = useCallback(
    async (id: string) => {
      await syncChatRecord(id, {
        sessionId: sessionIdRef.current,
        widgetName: widgetNameRef.current,
        messages: messagesRef.current,
        artifact: artifactRef.current,
      });
      await refreshHistory();
    },
    [refreshHistory]
  );

  const setMessagesTracked = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const setArtifactTracked = useCallback((updater: WidgetSnapshot | null | ((prev: WidgetSnapshot | null) => WidgetSnapshot | null)) => {
    setArtifact((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      artifactRef.current = next;
      return next;
    });
  }, []);

  const loadArtifact = useCallback(
    async (name: string, validated?: boolean, issues?: ValidationIssue[]) => {
      const generation = ++fetchGenerationRef.current;
      const fetched = await fetchWidgetSource(null, name);
      if (!fetched || generation !== fetchGenerationRef.current) return;

      widgetNameRef.current = fetched.name;
      setArtifactTracked((prev) => ({
        name: fetched.name,
        luaSource: fetched.source,
        validated: validated ?? prev?.validated ?? false,
        validationIssues: issues ?? prev?.validationIssues ?? [],
      }));
    },
    [setArtifactTracked]
  );

  const scheduleLoadArtifact = useCallback(
    (name: string, validated?: boolean, issues?: ValidationIssue[]) => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        void loadArtifact(name, validated, issues);
      }, 500);
    },
    [loadArtifact]
  );

  const ensureChat = useCallback(
    async (title: string, proto: TelemetryProtocol, model: string, edgeTx: string, radio: string) => {
      if (chatIdRef.current) return chatIdRef.current;

      const chat = await createChatRecord({
        title,
        protocol: proto,
        modelId: model,
        edgeTxVersion: edgeTx,
        radioId: radio,
      });
      if (!chat) return null;

      chatIdRef.current = chat.id;
      setChatId(chat.id);
      await refreshHistory();
      return chat.id;
    },
    [refreshHistory]
  );

  const sendMessage = useCallback(
    async (prompt: string, options?: Partial<ChatSendOptions>) => {
      const trimmed = prompt.trim();
      if (!trimmed || running) return;

      const proto = options?.protocol ?? protocol;
      const model = options?.modelId ?? modelId;
      const edgeTx = options?.edgeTxVersion ?? edgeTxVersion;
      const radio = options?.radioId ?? radioId;

      setProtocol(proto);
      setModelId(model);
      setRadioId(radio);

      const userMessage = createUserMessage(trimmed);
      const assistantMessage = createAssistantPlaceholder();
      const assistantId = assistantMessage.id;

      setMessagesTracked((prev) => [...prev, userMessage, assistantMessage]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);

      const isRefine = !!sessionIdRef.current;
      if (!isRefine) {
        await ensureChat(trimmed, proto, model, edgeTx, radio);
      }

      const url = isRefine ? "/api/refine" : "/api/generate";
      const body = isRefine
        ? { sessionId: sessionIdRef.current, prompt: trimmed }
        : {
            prompt: trimmed,
            radioId: radio,
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
          setMessagesTracked((prev) =>
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
                  setMessagesTracked((prev) =>
                    appendAssistantLine(prev, assistantId, { type: lineType, content: data.content })
                  );
                }
              }

              if (data.type === "done" || data.type === "error") {
                const name = data.widgetName ?? widgetNameRef.current;
                if (name) {
                  await loadArtifact(name, validated, validationIssues);
                }

                setArtifactTracked((prev) =>
                  prev ? { ...prev, validated, validationIssues } : prev
                );

                setMessagesTracked((prev) =>
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
          setMessagesTracked((prev) =>
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
        if (chatIdRef.current) {
          await persistChat(chatIdRef.current);
        }
      }
    },
    [
      running,
      protocol,
      modelId,
      edgeTxVersion,
      radioId,
      radios,
      layoutProfileId,
      selectedRadio,
      setRadioId,
      loadArtifact,
      scheduleLoadArtifact,
      ensureChat,
      persistChat,
      setMessagesTracked,
      setArtifactTracked,
    ]
  );

  const loadChat = useCallback(
    async (id: string) => {
      if (running) return;

      abortRef.current?.abort();
      const chat = await fetchChat(id);
      if (!chat) return;

      chatIdRef.current = chat.id;
      setChatId(chat.id);
      setSessionId(chat.sessionId);
      sessionIdRef.current = chat.sessionId;
      widgetNameRef.current = chat.artifact?.name ?? chat.widgetName;
      setProtocol(chat.protocol);
      setModelId(chat.modelId);
      setRadioId(chat.radioId);
      setEdgeTxVersion(chat.edgeTxVersion);
      setMessagesTracked(chat.messages);
      setArtifactTracked(chat.artifact);

      if (!chat.artifact?.luaSource && chat.widgetName) {
        await loadArtifact(chat.widgetName, chat.artifact?.validated, chat.artifact?.validationIssues);
        if (chatIdRef.current) {
          await persistChat(chatIdRef.current);
        }
      }
    },
    [running, loadArtifact, persistChat, setMessagesTracked, setArtifactTracked]
  );

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchGenerationRef.current += 1;
    chatIdRef.current = null;
    setChatId(null);
    setMessagesTracked([]);
    setSessionId(null);
    sessionIdRef.current = null;
    widgetNameRef.current = null;
    setArtifactTracked(null);
    setRunning(false);
  }, [setMessagesTracked, setArtifactTracked]);

  const deleteChat = useCallback(
    async (id: string) => {
      if (running) return;
      const removed = await removeChatRecord(id);
      if (!removed) return;

      if (chatIdRef.current === id) {
        startNewChat();
      }
      await refreshHistory();
    },
    [running, startNewChat, refreshHistory]
  );

  return {
    messages,
    chatId,
    chatHistory,
    historyLoading,
    sessionId,
    protocol,
    setProtocol,
    radioId,
    setRadioId,
    radios,
    layoutProfileId,
    selectedRadio,
    models,
    modelsLoading,
    selectedModel,
    modelId,
    setModelId,
    edgeTxVersion,
    setEdgeTxVersion,
    running,
    artifact,
    sendMessage,
    startNewChat,
    loadChat,
    deleteChat,
    refreshHistory,
    canRefine: !!sessionId,
  };
}
