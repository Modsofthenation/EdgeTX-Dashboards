"use client";

import { useWidgetChat } from "@/lib/useWidgetChat";
import { usePanelCollapse } from "@/lib/usePanelCollapse";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatMessageList } from "./ChatMessageList";
import { CollapsibleAside } from "./CollapsibleAside";
import styles from "./ChatApp.module.css";

export function ChatApp() {
  const {
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
    selectedModel,
    modelId,
    setModelId,
    models,
    modelsLoading,
    edgeTxVersion,
    setEdgeTxVersion,
    running,
    artifact,
    artifactVersions,
    viewingVersion,
    latestVersion,
    selectViewingVersion,
    artifactLoading,
    sendMessage,
    startNewChat,
    loadChat,
    deleteChat,
    canRefine,
  } = useWidgetChat();

  const { historyCollapsed, artifactCollapsed, toggleHistory, toggleArtifact } = usePanelCollapse();

  const activeModelLabel = selectedModel?.label ?? modelId;

  return (
    <div className={styles.shell}>
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

      <div className={styles.body}>
        <CollapsibleAside
          side="left"
          label="History"
          collapsed={historyCollapsed}
          onToggle={toggleHistory}
        >
          <ChatHistorySidebar
            chats={chatHistory}
            activeChatId={chatId}
            loading={historyLoading}
            running={running}
            panelCollapsed={historyCollapsed}
            onTogglePanel={toggleHistory}
            onSelect={(id) => void loadChat(id)}
            onNewChat={startNewChat}
            onDelete={(id) => void deleteChat(id)}
          />
        </CollapsibleAside>

        <div className={styles.chatColumn}>
          <ChatMessageList
            messages={messages}
            running={running}
            onSuggestion={(text) => void sendMessage(text)}
          />
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
            onSend={(prompt) => void sendMessage(prompt)}
          />
        </div>

        <CollapsibleAside
          side="right"
          label="Dashboard"
          collapsed={artifactCollapsed}
          onToggle={toggleArtifact}
        >
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
            panelCollapsed={artifactCollapsed}
            onTogglePanel={toggleArtifact}
          />
        </CollapsibleAside>
      </div>
    </div>
  );
}
