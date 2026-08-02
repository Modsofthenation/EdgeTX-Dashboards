"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useArtifactPanel,
  useChatMessages,
  useChatSession,
  useSessionSettings,
  WidgetChatProvider,
} from "~/lib/useWidgetChat";
import type { PendingPromptImage } from "~/lib/promptImages";
import {
  buildTemplateEditorHref,
  type TemplateGalleryItem,
} from "~/lib/templateGallery";
import { buildBlankEditorHref, buildEditorHref } from "~/lib/editorHref";
import { usePanelCollapse } from "~/lib/usePanelCollapse";
import { AppShell } from "../AppShell";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatMessageList } from "./ChatMessageList";
import { CollapsibleAside } from "./CollapsibleAside";
import { AppPreferencesButton } from "~/components/AppPreferences";
import { useOptionalAiSettings } from "~/components/AiSettingsProvider";
import { buildStudioHref } from "~/lib/studioHref";
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
    collapseArtifact,
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

  // Keep the URL in sync with the active chat so Editor ↔ Studio round-trips.
  useEffect(() => {
    if (chatId && urlChatId === chatId) return;
    if (!chatId && !urlChatId) return;
    if (chatId) {
      router.replace(buildStudioHref({ chatId }), {
        scroll: false,
      });
    } else {
      router.replace("/studio", { scroll: false });
    }
  }, [chatId, urlChatId, router]);

  useEffect(() => {
    const hasArtifact = Boolean(artifact?.luaSource);
    if (hasArtifact && !prevHadArtifact.current) {
      expandArtifact();
    }
    // Keep empty preview collapsed on narrow screens so chat stays usable.
    if (
      !hasArtifact &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 960px)").matches
    ) {
      collapseArtifact();
    }
    prevHadArtifact.current = hasArtifact;
  }, [artifact?.luaSource, expandArtifact, collapseArtifact]);

  const handleNewChat = useCallback(() => {
    startNewChat();
    router.replace("/studio", { scroll: false });
  }, [startNewChat, router]);

  return (
    <StudioShell onNewChat={handleNewChat}>
      <AiSetupBanner />
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
    </StudioShell>
  );
}

function StudioShell({
  onNewChat,
  children,
}: {
  onNewChat: () => void;
  children: React.ReactNode;
}) {
  const { running, chatId } = useChatSession();
  const { artifact, sessionId } = useArtifactPanel();
  const {
    modelsLoading,
    selectedModel,
    modelId,
    selectedRadio,
    protocol,
    radioId,
    layoutProfileId,
    edgeTxVersion,
  } = useSessionSettings();
  const activeModelLabel = selectedModel?.label ?? modelId;

  const layoutHref = useMemo(() => {
    if (artifact?.luaSource) {
      return buildEditorHref({
        protocol,
        chatId,
        sessionId,
        instanceId: artifact.instanceId,
        name: artifact.name,
        layoutProfileId,
        radioId,
        edgeTxVersion,
      });
    }
    return buildBlankEditorHref({
      protocol,
      radioId,
      layoutProfileId,
      chatId,
      edgeTxVersion,
    });
  }, [
    artifact,
    chatId,
    sessionId,
    protocol,
    layoutProfileId,
    radioId,
    edgeTxVersion,
  ]);

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
    <AppShell
      surface="studio"
      subtitle={subtitle}
      studioHref={buildStudioHref({ chatId })}
      editorHref={layoutHref}
      actions={
        <>
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
            onClick={onNewChat}
            disabled={running}
          >
            New chat
          </button>
        </>
      }
    >
      <div className={styles.shell}>{children}</div>
    </AppShell>
  );
}

function AiSetupBanner() {
  const ai = useOptionalAiSettings();
  const { protocol, radioId, layoutProfileId, edgeTxVersion } =
    useSessionSettings();
  const { chatId } = useChatSession();
  if (!ai || ai.statusLoading || ai.ready) return null;

  const layoutHref = buildBlankEditorHref({
    protocol,
    radioId,
    layoutProfileId,
    chatId,
    edgeTxVersion,
  });

  return (
    <div className={styles.aiBanner} role="status">
      <div className={styles.aiBannerCopy}>
        <strong>AI not configured</strong>
        <span>
          Add an API key for Cursor, Anthropic, OpenAI, or Gemini in Settings to
          generate, or open Editor to build a dashboard by hand (no AI
          required).
        </span>
      </div>
      <div className={styles.aiBannerActions}>
        <Link href={layoutHref} className={styles.aiBannerBtnSecondary}>
          Open Editor
        </Link>
        <Link href="/settings?tab=ai" className={styles.aiBannerBtn}>
          Open AI settings
        </Link>
      </div>
    </div>
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
      router.replace(buildStudioHref({ chatId: id }), { scroll: false });
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
  const router = useRouter();
  const { messages, scrollRevision } = useChatMessages();
  const { running, sendMessage, chatId } = useChatSession();
  const { artifact } = useArtifactPanel();
  const ai = useOptionalAiSettings();
  const { protocol, radioId, layoutProfileId, edgeTxVersion } =
    useSessionSettings();
  const blankLayoutHref = useMemo(
    () =>
      buildBlankEditorHref({
        protocol,
        radioId,
        layoutProfileId,
        chatId,
        edgeTxVersion,
      }),
    [protocol, radioId, layoutProfileId, chatId, edgeTxVersion],
  );
  const handleSuggestion = useCallback(
    (item: TemplateGalleryItem) => {
      router.push(
        buildTemplateEditorHref({
          templateId: item.id,
          protocol: item.protocol,
          radioId,
          layoutProfileId,
          chatId,
        }),
      );
    },
    [router, radioId, layoutProfileId, chatId],
  );
  const handleGenerateSuggestion = useCallback(
    (item: TemplateGalleryItem) =>
      void sendMessage(item.prompt, { protocol: item.protocol }),
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
      aiReady={Boolean(ai?.ready)}
      statusLoading={Boolean(ai?.statusLoading)}
      layoutProfileId={layoutProfileId}
      onSuggestion={handleSuggestion}
      onGenerateSuggestion={handleGenerateSuggestion}
      dashboardReadyCue={Boolean(artifact?.luaSource) && !running}
      onRetry={handleRetry}
      blankLayoutHref={blankLayoutHref}
    />
  );
}

function ChatComposerSection() {
  const { running, sendMessage, stopGeneration, canRefine } = useChatSession();
  const ai = useOptionalAiSettings();
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
      aiReady={Boolean(ai?.ready)}
      statusLoading={Boolean(ai?.statusLoading)}
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
      onStop={stopGeneration}
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
  const { protocol, layoutProfileId, selectedRadio, edgeTxVersion, radioId } =
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
      radioId={radioId}
      radioName={selectedRadio?.name ?? null}
      edgeTxVersion={edgeTxVersion}
      panelCollapsed={false}
      onTogglePanel={onToggleArtifact}
    />
  );
}
