"use client";

import { useWidgetChat } from "@/lib/useWidgetChat";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatMessageList } from "./ChatMessageList";
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
    sendMessage,
    startNewChat,
    loadChat,
    deleteChat,
    canRefine,
  } = useWidgetChat();

  const activeModelLabel = selectedModel?.label ?? modelId;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo} aria-hidden>
            ETX
          </div>
          <div>
            <h1 className={styles.title}>EdgeTX Widget Generator</h1>
            <p className={styles.subtitle}>
              {activeModelLabel} · {selectedRadio?.name ?? "RadioMaster TX15"}
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
        <ChatHistorySidebar
          chats={chatHistory}
          activeChatId={chatId}
          loading={historyLoading}
          running={running}
          onSelect={(id) => void loadChat(id)}
          onNewChat={startNewChat}
          onDelete={(id) => void deleteChat(id)}
        />

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

        <ArtifactPanel
          artifact={artifact}
          sessionId={sessionId}
          protocol={protocol}
          running={running}
          layoutProfileId={layoutProfileId}
          radioName={selectedRadio?.name ?? null}
        />
      </div>
    </div>
  );
}
