"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TelemetryProtocol, ValidationIssue } from "@widget-gen/shared";
import { consumeGenerationStream, type GenerationSsePayload } from "@/lib/generationStreamClient";
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
  restoreGeneratorSession,
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
  type WidgetVersionEntry,
} from "@/lib/chatTypes";
import {
  commitVersionSnapshot,
  buildVersionTimeline,
  resolveDisplayArtifact,
  resolveLatestVersion,
} from "@/lib/artifactVersionHistory";
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
  const [artifactVersions, setArtifactVersions] = useState<WidgetVersionEntry[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const chatIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const widgetNameRef = useRef<string | null>(null);
  const widgetInstanceIdRef = useRef<string | null>(null);
  const widgetVersionRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const fetchGenerationRef = useRef(0);
  const chatLoadGenRef = useRef(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const artifactRef = useRef<WidgetSnapshot | null>(null);
  const artifactVersionsRef = useRef<WidgetVersionEntry[]>([]);
  const viewingVersionRef = useRef<number | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamDraftRef = useRef<ChatMessage[] | null>(null);
  const streamFlushRef = useRef<number | null>(null);

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

  const latestVersion = resolveLatestVersion(artifact, artifactVersions);
  const effectiveViewingVersion = viewingVersion ?? latestVersion;

  const displayArtifact = useMemo(
    () => resolveDisplayArtifact(effectiveViewingVersion, latestVersion, artifact, artifactVersions),
    [effectiveViewingVersion, latestVersion, artifact, artifactVersions]
  );

  const versionTimeline = useMemo(
    () => buildVersionTimeline(artifactVersions, latestVersion, artifact),
    [artifactVersions, latestVersion, artifact]
  );

  const commitSnapshot = useCallback(
    (snapshot: WidgetSnapshot, options?: { messageId?: string | null; force?: boolean }) => {
      if (!snapshot.luaSource) return;
      const next = commitVersionSnapshot(artifactVersionsRef.current, snapshot, options);
      artifactVersionsRef.current = next;
      setArtifactVersions(next);
    },
    []
  );

  const setArtifactVersionsTracked = useCallback((entries: WidgetVersionEntry[]) => {
    artifactVersionsRef.current = entries;
    setArtifactVersions(entries);
  }, []);

  const persistChat = useCallback(
    async (id: string) => {
      const snapshot = artifactRef.current;
      await syncChatRecord(id, {
        sessionId: sessionIdRef.current,
        widgetName: widgetNameRef.current,
        widgetInstanceId: widgetInstanceIdRef.current,
        widgetVersion: widgetVersionRef.current,
        messages: messagesRef.current,
        artifact:
          snapshot?.luaSource != null && snapshot.luaSource.length > 0 ? snapshot : undefined,
        artifactVersions: artifactVersionsRef.current,
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

  const flushStreamDraft = useCallback(() => {
    if (streamFlushRef.current !== null) {
      cancelAnimationFrame(streamFlushRef.current);
      streamFlushRef.current = null;
    }
    if (!streamDraftRef.current) return;
    const next = streamDraftRef.current;
    streamDraftRef.current = null;
    setMessagesTracked(next);
  }, [setMessagesTracked]);

  const queueAssistantStreamLine = useCallback(
    (assistantId: string, line: StreamLine) => {
      const immediate = line.type !== "text";
      if (immediate && streamFlushRef.current !== null) {
        cancelAnimationFrame(streamFlushRef.current);
        streamFlushRef.current = null;
      }

      const base = streamDraftRef.current ?? messagesRef.current;
      streamDraftRef.current = appendAssistantLine(base, assistantId, line);

      if (immediate) {
        flushStreamDraft();
        return;
      }

      if (streamFlushRef.current !== null) return;
      streamFlushRef.current = requestAnimationFrame(() => {
        streamFlushRef.current = null;
        flushStreamDraft();
      });
    },
    [flushStreamDraft]
  );

  const setArtifactTracked = useCallback((updater: WidgetSnapshot | null | ((prev: WidgetSnapshot | null) => WidgetSnapshot | null)) => {
    setArtifact((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      artifactRef.current = next;
      return next;
    });
  }, []);

  const loadArtifact = useCallback(
    async (
      name: string,
      validated?: boolean,
      issues?: ValidationIssue[],
      session?: string | null,
      forChatId?: string | null,
      options?: { version?: number; forceHistory?: boolean }
    ) => {
      const generation = ++fetchGenerationRef.current;
      const expectedChatId = forChatId ?? chatIdRef.current;
      const targetVersion = options?.version;
      const fetched = await fetchWidgetSource(
        targetVersion !== undefined ? null : (session ?? sessionIdRef.current),
        {
          instanceId: widgetInstanceIdRef.current,
          widgetName: name,
          version: targetVersion,
        }
      );
      if (generation !== fetchGenerationRef.current) return;
      if (expectedChatId !== chatIdRef.current) return;
      if (!fetched) {
        setArtifactLoading(false);
        return;
      }

      widgetNameRef.current = fetched.name;
      if (fetched.instanceId) widgetInstanceIdRef.current = fetched.instanceId;
      widgetVersionRef.current = fetched.version;
      const snapshot: WidgetSnapshot = {
        name: fetched.name,
        instanceId: fetched.instanceId,
        version: fetched.version,
        luaSource: fetched.source,
        validated: validated ?? false,
        validationIssues: issues ?? [],
      };
      setArtifactTracked(snapshot);
      commitSnapshot(snapshot, { force: options?.forceHistory ?? targetVersion === undefined });
      setArtifactLoading(false);
    },
    [setArtifactTracked, commitSnapshot]
  );

  const selectViewingVersion = useCallback(
    async (version: number) => {
      viewingVersionRef.current = version;
      setViewingVersion(version);

      const entry = artifactVersionsRef.current.find((v) => v.version === version);
      if (entry?.luaSource) return;

      if (!widgetInstanceIdRef.current && !widgetNameRef.current) return;

      setArtifactLoading(true);
      try {
        const fetched = await fetchWidgetSource(null, {
          instanceId: widgetInstanceIdRef.current,
          widgetName: widgetNameRef.current,
          version,
        });
        if (!fetched?.source) return;

        commitSnapshot(
          {
            name: fetched.name,
            instanceId: fetched.instanceId,
            version: fetched.version,
            luaSource: fetched.source,
            validated: entry?.validated ?? false,
            validationIssues: entry?.validationIssues ?? [],
          },
          { force: false }
        );
      } finally {
        setArtifactLoading(false);
      }
    },
    [commitSnapshot]
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

      streamDraftRef.current = null;
      if (streamFlushRef.current !== null) {
        cancelAnimationFrame(streamFlushRef.current);
        streamFlushRef.current = null;
      }

      const isRefine =
        !!sessionIdRef.current ||
        (!!chatIdRef.current && !!(widgetInstanceIdRef.current || widgetNameRef.current));

      fetchGenerationRef.current += 1;
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = null;
      }

      if (!isRefine) {
        widgetNameRef.current = null;
        widgetInstanceIdRef.current = null;
        widgetVersionRef.current = 0;
        setArtifactTracked(null);
      } else if (chatIdRef.current && (widgetInstanceIdRef.current || widgetNameRef.current)) {
        const restored = await restoreGeneratorSession(chatIdRef.current);
        if (restored?.sessionId) {
          setSessionId(restored.sessionId);
          sessionIdRef.current = restored.sessionId;
          if (restored.widgetInstanceId) {
            widgetInstanceIdRef.current = restored.widgetInstanceId;
          }
          if (restored.widgetVersion !== undefined) {
            widgetVersionRef.current = restored.widgetVersion;
          }
          if (restored.widgetName) {
            widgetNameRef.current = restored.widgetName;
          }
        } else {
          setMessagesTracked((prev) => [
            ...prev,
            userMessage,
            {
              ...assistantMessage,
              isStreaming: false,
              error: true,
              content:
                "Session not found or expired. Reload this chat from history and try again.",
            },
          ]);
          return;
        }
      }

      setMessagesTracked((prev) => [...prev, userMessage, assistantMessage]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      setArtifactLoading(true);

      if (!isRefine) {
        await ensureChat(trimmed, proto, model, edgeTx, radio);
      }

      const url = isRefine ? "/api/refine" : "/api/generate";
      const body = isRefine
        ? {
            sessionId: sessionIdRef.current,
            chatId: chatIdRef.current,
            prompt: trimmed,
          }
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
          setArtifactLoading(false);
          return;
        }

        if (!res.body) return;

        const handlePayload = (data: GenerationSsePayload) => {
          if (data.sessionId) {
            setSessionId(data.sessionId);
            sessionIdRef.current = data.sessionId;
          }

          if (data.type === "widget" && data.widgetName) {
            const nextName = data.widgetName;
            const nextInstanceId = data.widgetInstanceId ?? null;
            const prevInstanceId = widgetInstanceIdRef.current;
            const prevName = widgetNameRef.current;

            if (prevInstanceId && nextInstanceId && prevInstanceId !== nextInstanceId) {
              return;
            }
            if (!nextInstanceId && prevName && prevName !== nextName) {
              return;
            }

            widgetNameRef.current = nextName;
            if (nextInstanceId) widgetInstanceIdRef.current = nextInstanceId;
            if (data.widgetVersion !== undefined) widgetVersionRef.current = data.widgetVersion;

            const identityChanged =
              prevInstanceId !== nextInstanceId ||
              (!nextInstanceId && prevName !== nextName);

            if (identityChanged) {
              fetchGenerationRef.current += 1;
              setArtifactTracked({
                name: nextName,
                instanceId: nextInstanceId,
                version: data.widgetVersion ?? widgetVersionRef.current,
                luaSource: null,
                validated: false,
                validationIssues: [],
              });
            }
            scheduleLoadArtifact(nextName, validated, validationIssues);
          }

          if (data.validated !== undefined) validated = data.validated;
          if (data.validationIssues) validationIssues = data.validationIssues;

          if (shouldRenderStreamEvent(data.type)) {
            const lineType =
              data.type === "done" && data.success === false ? "error" : (data.type as StreamLine["type"]);
            if (
              lineType === "text" ||
              lineType === "tool" ||
              lineType === "todo" ||
              lineType === "status" ||
              lineType === "error" ||
              lineType === "done"
            ) {
              queueAssistantStreamLine(assistantId, {
                type: lineType,
                content: data.content,
                detail: data.detail,
                todos: data.todos,
                toolName: data.toolName,
              });
            }
          }

          if (data.type === "done" || data.type === "error") {
            const name = data.widgetName ?? widgetNameRef.current;
            const instanceId = data.widgetInstanceId ?? widgetInstanceIdRef.current;
            const version = data.widgetVersion ?? widgetVersionRef.current;
            const finalValidated = data.validated ?? validated;
            const finalIssues = data.validationIssues ?? validationIssues;
            if (name) widgetNameRef.current = name;
            if (instanceId) widgetInstanceIdRef.current = instanceId;
            widgetVersionRef.current = version;
            setViewingVersion(null);
            viewingVersionRef.current = null;
            setArtifactTracked((prev) =>
              prev && name
                ? {
                    ...prev,
                    instanceId: instanceId ?? prev.instanceId,
                    validated: finalValidated,
                    validationIssues: finalIssues,
                  }
                : prev
            );

            flushStreamDraft();
            setMessagesTracked((prev) =>
              patchAssistant(prev, assistantId, {
                isStreaming: false,
                error: data.type === "error" && data.success === false,
              })
            );
          }
        };

        await consumeGenerationStream({
          response: res,
          signal: controller.signal,
          onPayload: handlePayload,
        });
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
        if (fetchDebounceRef.current) {
          clearTimeout(fetchDebounceRef.current);
          fetchDebounceRef.current = null;
        }
        flushStreamDraft();
        setRunning(false);
        const activeChatId = chatIdRef.current;

        const headBeforeLoad = artifactRef.current;
        if (headBeforeLoad?.luaSource) {
          commitSnapshot(headBeforeLoad);
        }

        if (widgetNameRef.current || widgetInstanceIdRef.current) {
          await loadArtifact(
            widgetNameRef.current ?? "",
            validated,
            validationIssues,
            sessionIdRef.current,
            activeChatId,
            { forceHistory: true }
          );
        } else {
          setArtifactLoading(false);
        }
        if (activeChatId) {
          await persistChat(activeChatId);
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
      queueAssistantStreamLine,
      flushStreamDraft,
      setMessagesTracked,
      commitSnapshot,
      setArtifactVersionsTracked,
    ]
  );

  const loadChat = useCallback(
    async (id: string) => {
      if (running) return;

      const outgoingId = chatIdRef.current;
      if (outgoingId && outgoingId !== id) {
        if (fetchDebounceRef.current) {
          clearTimeout(fetchDebounceRef.current);
          fetchDebounceRef.current = null;
        }
        await persistChat(outgoingId);
      }

      const loadGen = ++chatLoadGenRef.current;
      abortRef.current?.abort();
      fetchGenerationRef.current += 1;

      setArtifactLoading(true);
      setArtifactTracked(null);
      setArtifactVersionsTracked([]);
      setViewingVersion(null);
      viewingVersionRef.current = null;

      const chat = await fetchChat(id);
      if (!chat || loadGen !== chatLoadGenRef.current) {
        if (loadGen === chatLoadGenRef.current) setArtifactLoading(false);
        return;
      }

      chatIdRef.current = chat.id;
      setChatId(chat.id);
      widgetNameRef.current = chat.widgetName ?? chat.artifact?.name ?? null;
      widgetInstanceIdRef.current =
        chat.widgetInstanceId ?? chat.artifact?.instanceId ?? null;
      widgetVersionRef.current = chat.widgetVersion ?? chat.artifact?.version ?? 0;
      setProtocol(chat.protocol);
      setModelId(chat.modelId);
      setRadioId(chat.radioId);
      setEdgeTxVersion(chat.edgeTxVersion);
      setMessagesTracked(chat.messages);
      setArtifactVersionsTracked(chat.artifactVersions ?? []);

      const activeSessionId = chat.sessionId;
      if (widgetNameRef.current || widgetInstanceIdRef.current) {
        const restored = await restoreGeneratorSession(chat.id);
        if (loadGen !== chatLoadGenRef.current) return;
        if (restored?.sessionId) {
          setSessionId(restored.sessionId);
          sessionIdRef.current = restored.sessionId;
          if (restored.widgetInstanceId) {
            widgetInstanceIdRef.current = restored.widgetInstanceId;
          }
          if (restored.widgetVersion !== undefined) {
            widgetVersionRef.current = restored.widgetVersion;
          }
          if (restored.widgetName) {
            widgetNameRef.current = restored.widgetName;
          }
        } else {
          setSessionId(null);
          sessionIdRef.current = null;
        }
      } else {
        setSessionId(activeSessionId);
        sessionIdRef.current = activeSessionId;
      }

      // Each chat keeps its own Lua snapshot — never load from shared generated/ when a snapshot exists.
      if (chat.artifact?.luaSource) {
        setArtifactTracked(chat.artifact);
        const latest =
          chat.artifactVersions.at(-1)?.version ??
          chat.artifact.version ??
          chat.widgetVersion ??
          0;
        setViewingVersion(latest);
        viewingVersionRef.current = latest;
        setArtifactLoading(false);
        return;
      }

      if (chat.widgetName ?? chat.artifact?.name ?? chat.widgetInstanceId) {
        await loadArtifact(
          chat.widgetName ?? chat.artifact?.name ?? "",
          chat.artifact?.validated,
          chat.artifact?.validationIssues,
          sessionIdRef.current,
          chat.id
        );
        if (loadGen === chatLoadGenRef.current && chatIdRef.current === chat.id) {
          await persistChat(chat.id);
        }
        return;
      }

      setArtifactTracked(null);
      setArtifactLoading(false);
    },
    [running, loadArtifact, persistChat, setMessagesTracked, setArtifactTracked, setArtifactVersionsTracked]
  );

  const startNewChat = useCallback(() => {
    chatLoadGenRef.current += 1;
    abortRef.current?.abort();
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchGenerationRef.current += 1;
    chatIdRef.current = null;
    setChatId(null);
    setMessagesTracked([]);
    setSessionId(null);
    sessionIdRef.current = null;
    widgetNameRef.current = null;
    widgetInstanceIdRef.current = null;
    widgetVersionRef.current = 0;
    setArtifactTracked(null);
    setArtifactVersionsTracked([]);
    setViewingVersion(null);
    viewingVersionRef.current = null;
    setArtifactLoading(false);
    setRunning(false);
  }, [setMessagesTracked, setArtifactTracked, setArtifactVersionsTracked]);

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
    artifact: displayArtifact,
    artifactVersions: versionTimeline,
    viewingVersion: effectiveViewingVersion,
    latestVersion,
    selectViewingVersion,
    artifactLoading,
    sendMessage,
    startNewChat,
    loadChat,
    deleteChat,
    refreshHistory,
    canRefine: !!(artifact?.instanceId || artifact?.name || sessionId),
  };
}
