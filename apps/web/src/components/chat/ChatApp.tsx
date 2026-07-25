"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useArtifactPanel,
  useChatMessages,
  useChatSession,
  useSessionSettings,
  WidgetChatProvider,
} from "~/lib/useWidgetChat";
import type { PendingPromptImage } from "~/lib/promptImages";
import { usePanelCollapse } from "~/lib/usePanelCollapse";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatMessageList } from "./ChatMessageList";
import { CollapsibleAside } from "./CollapsibleAside";
import { AppPreferencesButton } from "~/components/AppPreferences";
import styles from "./ChatApp.module.css";

export function ChatApp() {
  return (
    <WidgetChatProvider>
      <ChatAppLayout />
    </WidgetChatProvider>
  );
}

function ChatAppLayout() {
  const {
    historyCollapsed,
    artifactCollapsed,
    toggleHistory,
    toggleArtifact,
    expandArtifact,
  } = usePanelCollapse();
  const { artifact } = useArtifactPanel();
  const prevHadArtifact = useRef(false);

  useEffect(() => {
    const hasArtifact = Boolean(artifact?.luaSource);
    if (hasArtifact && !prevHadArtifact.current) {
      expandArtifact();
    }
    prevHadArtifact.current = hasArtifact;
  }, [artifact?.luaSource, expandArtifact]);

  return (
    <div className={styles.shell}>
      <ChatAppHeader />
      <div className={styles.body}>
        <ChatHistoryAside
          historyCollapsed={historyCollapsed}
          onToggleHistory={toggleHistory}
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

function ChatAppHeader() {
  const { running, startNewChat } = useChatSession();
  const { modelsLoading, selectedModel, modelId, selectedRadio } =
    useSessionSettings();
  const activeModelLabel = selectedModel?.label ?? modelId;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden>
          ETX
        </div>
        <div className={styles.brandCopy}>
          <h1 className={styles.title}>Dashboard Generator</h1>
          <p className={styles.subtitle}>
            <span className={styles.subtitleItem}>
              {modelsLoading ? "Loading models…" : activeModelLabel}
            </span>
            <span className={styles.subtitleSep} aria-hidden>
              ·
            </span>
            <span className={styles.subtitleItem}>
              {selectedRadio?.name ?? "RadioMaster TX15"}
            </span>
          </p>
        </div>
      </div>

      <div className={styles.headerActions}>
        {running && (
          <span className={styles.streaming}>
            <span className={styles.pulse} />
            Generating
          </span>
        )}
        <AppPreferencesButton className={styles.prefsBtn} />
        <button
          type="button"
          className={styles.newChatBtn}
          onClick={startNewChat}
          disabled={running}
        >
          New chat
        </button>
      </div>
    </header>
  );
}

function ChatHistoryAside({
  historyCollapsed,
  onToggleHistory,
}: {
  historyCollapsed: boolean;
  onToggleHistory: () => void;
}) {
  const {
    chatHistory,
    chatId,
    historyLoading,
    running,
    loadChat,
    startNewChat,
    deleteChat,
  } = useChatSession();

  const handleSelect = useCallback(
    (id: string) => void loadChat(id),
    [loadChat],
  );
  const handleDelete = useCallback(
    (id: string) => void deleteChat(id),
    [deleteChat],
  );

  return (
    <CollapsibleAside
      side="left"
      label="History"
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
        onNewChat={startNewChat}
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
      label="Dashboard"
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
