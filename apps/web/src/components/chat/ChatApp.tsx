"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useArtifactPanel,
  useChatMessages,
  useChatSession,
  useSessionSettings,
  WidgetChatProvider,
} from "~/lib/useWidgetChat";
import type { PendingPromptImage } from "~/lib/promptImages";
import { usePanelCollapse } from "~/lib/usePanelCollapse";
import { AppChrome } from "../AppChrome";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatMessageList } from "./ChatMessageList";
import { CollapsibleAside } from "./CollapsibleAside";
import styles from "./ChatApp.module.css";

export function ChatApp() {
  return (
    <WidgetChatProvider>
      <Suspense fallback={<div className={styles.shell} />}>
        <ChatAppLayout />
      </Suspense>
    </WidgetChatProvider>
  );
}

function ChatAppLayout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlChatId = searchParams.get("chatId");
  const {
    historyCollapsed,
    artifactCollapsed,
    toggleHistory,
    toggleArtifact,
    expandArtifact,
  } = usePanelCollapse();
  const { artifact } = useArtifactPanel();
  const { chatId, loadChat, startNewChat } = useChatSession();
  const prevHadArtifact = useRef(false);
  const restoredUrlChat = useRef<string | null>(null);

  // Restore chat from ?chatId= (e.g. returning from Layout editor).
  useEffect(() => {
    if (!urlChatId) {
      restoredUrlChat.current = null;
      return;
    }
    if (urlChatId === chatId) {
      restoredUrlChat.current = urlChatId;
      return;
    }
    if (restoredUrlChat.current === urlChatId) return;
    restoredUrlChat.current = urlChatId;
    void loadChat(urlChatId);
  }, [urlChatId, chatId, loadChat]);

  // Keep the URL in sync with the active chat so Layout ↔ Generate round-trips.
  useEffect(() => {
    if (chatId && urlChatId === chatId) return;
    if (!chatId && !urlChatId) return;
    if (chatId) {
      router.replace(`/?chatId=${encodeURIComponent(chatId)}`, {
        scroll: false,
      });
    } else {
      router.replace("/", { scroll: false });
    }
  }, [chatId, urlChatId, router]);

  useEffect(() => {
    const hasArtifact = Boolean(artifact?.luaSource);
    if (hasArtifact && !prevHadArtifact.current) {
      expandArtifact();
    }
    prevHadArtifact.current = hasArtifact;
  }, [artifact?.luaSource, expandArtifact]);

  const handleNewChat = useCallback(() => {
    startNewChat();
    router.replace("/", { scroll: false });
  }, [startNewChat, router]);

  return (
    <div className={styles.shell}>
      <ChatAppHeader onNewChat={handleNewChat} />
      <div className={styles.body}>
        <ChatHistoryAside
          historyCollapsed={historyCollapsed}
          onToggleHistory={toggleHistory}
          onNewChat={handleNewChat}
        />
        <div className={styles.chatColumn}>
          <ChatMessageListSection />
          <ChatComposerSection />
        </div>
        <ArtifactAside
          artifactCollapsed={artifactCollapsed}
          onToggleArtifact={toggleArtifact}
        />
      </div>
    </div>
  );
}

function ChatAppHeader({ onNewChat }: { onNewChat: () => void }) {
  const { running, chatId } = useChatSession();
  const { artifact, sessionId } = useArtifactPanel();
  const { modelsLoading, selectedModel, modelId, selectedRadio, protocol } =
    useSessionSettings();
  const activeModelLabel = selectedModel?.label ?? modelId;

  const layoutHref = useMemo(() => {
    if (!artifact?.luaSource) return null;
    const params = new URLSearchParams({ protocol });
    if (chatId) params.set("chatId", chatId);
    if (sessionId) params.set("sessionId", sessionId);
    if (artifact.instanceId) params.set("instanceId", artifact.instanceId);
    else if (artifact.name) params.set("name", artifact.name);
    return `/editor?${params.toString()}`;
  }, [artifact, chatId, sessionId, protocol]);

  const subtitle = (
    <>
      <span className={styles.subtitleItem}>
        {modelsLoading ? "Loading models…" : activeModelLabel}
      </span>
      <span className={styles.subtitleSep} aria-hidden>
        ·
      </span>
      <span className={styles.subtitleItem}>
        {selectedRadio?.name ?? "RadioMaster TX15"}
      </span>
    </>
  );

  return (
    <AppChrome
      surface="generate"
      subtitle={subtitle}
      layoutHref={layoutHref}
      layoutDisabledReason="Generate a dashboard first to open Layout"
      actions={
        <>
          {running && (
            <span className={styles.streaming}>
              <span className={styles.pulse} />
              Generating
            </span>
          )}
          <button
            type="button"
            className={styles.newChatBtn}
            onClick={onNewChat}
            disabled={running}
          >
            New chat
          </button>
        </>
      }
    />
  );
}

function ChatHistoryAside({
  historyCollapsed,
  onToggleHistory,
  onNewChat,
}: {
  historyCollapsed: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
}) {
  const { chatHistory, chatId, historyLoading, running, loadChat, deleteChat } =
    useChatSession();
  const router = useRouter();

  const handleSelect = useCallback(
    (id: string) => {
      void loadChat(id);
      router.replace(`/?chatId=${encodeURIComponent(id)}`, { scroll: false });
    },
    [loadChat, router],
  );
  const handleDelete = useCallback(
    (id: string) => void deleteChat(id),
    [deleteChat],
  );

  return (
    <CollapsibleAside
      side="left"
      label="Chats"
      collapsed={historyCollapsed}
      onToggle={onToggleHistory}
    >
      <ChatHistorySidebar
        chats={chatHistory}
        activeChatId={chatId}
        loading={historyLoading}
        running={running}
        panelCollapsed={historyCollapsed}
        onTogglePanel={onToggleHistory}
        onSelect={handleSelect}
        onNewChat={onNewChat}
        onDelete={handleDelete}
      />
    </CollapsibleAside>
  );
}

function ChatMessageListSection() {
  const { messages, scrollRevision } = useChatMessages();
  const { running, sendMessage } = useChatSession();
  const { artifact } = useArtifactPanel();
  const handleSuggestion = useCallback(
    (text: string) => void sendMessage(text),
    [sendMessage],
  );
  const handleRetry = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "user" && (msg.content.trim() || msg.images?.length)) {
        void sendMessage(msg.content);
        return;
      }
    }
  }, [messages, sendMessage]);

  return (
    <ChatMessageList
      messages={messages}
      scrollRevision={scrollRevision}
      running={running}
      onSuggestion={handleSuggestion}
      dashboardReadyCue={Boolean(artifact?.luaSource) && !running}
      onRetry={handleRetry}
    />
  );
}

function ChatComposerSection() {
  const { running, sendMessage, canRefine } = useChatSession();
  const {
    protocol,
    setProtocol,
    radioId,
    setRadioId,
    radios,
    modelId,
    setModelId,
    models,
    modelsLoading,
    edgeTxVersion,
    setEdgeTxVersion,
  } = useSessionSettings();
  const handleSend = useCallback(
    (prompt: string, images?: PendingPromptImage[]) =>
      void sendMessage(prompt, images ? { images } : undefined),
    [sendMessage],
  );

  return (
    <ChatComposer
      running={running}
      canRefine={canRefine}
      protocol={protocol}
      modelId={modelId}
      models={models}
      modelsLoading={modelsLoading}
      edgeTxVersion={edgeTxVersion}
      radioId={radioId}
      radios={radios}
      onProtocolChange={setProtocol}
      onModelChange={setModelId}
      onEdgeTxChange={setEdgeTxVersion}
      onRadioChange={setRadioId}
      onSend={handleSend}
    />
  );
}

function ArtifactAside({
  artifactCollapsed,
  onToggleArtifact,
}: {
  artifactCollapsed: boolean;
  onToggleArtifact: () => void;
}) {
  return (
    <CollapsibleAside
      side="right"
      label="Preview"
      collapsed={artifactCollapsed}
      onToggle={onToggleArtifact}
      deferContentMount
    >
      <ExpandedArtifactPanel onToggleArtifact={onToggleArtifact} />
    </CollapsibleAside>
  );
}

function ExpandedArtifactPanel({
  onToggleArtifact,
}: {
  onToggleArtifact: () => void;
}) {
  const { chatId, running } = useChatSession();
  const { protocol, layoutProfileId, selectedRadio, edgeTxVersion } =
    useSessionSettings();
  const {
    artifact,
    artifactVersions,
    viewingVersion,
    latestVersion,
    selectViewingVersion,
    artifactLoading,
    sessionId,
  } = useArtifactPanel();

  return (
    <ArtifactPanel
      chatId={chatId}
      artifact={artifact}
      artifactVersions={artifactVersions}
      viewingVersion={viewingVersion}
      latestVersion={latestVersion}
      onSelectVersion={selectViewingVersion}
      sessionId={sessionId}
      protocol={protocol}
      running={running}
      artifactLoading={artifactLoading}
      layoutProfileId={layoutProfileId}
      radioName={selectedRadio?.name ?? null}
      edgeTxVersion={edgeTxVersion}
      panelCollapsed={false}
      onTogglePanel={onToggleArtifact}
    />
  );
}
