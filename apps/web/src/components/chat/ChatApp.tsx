"use client";

import { CHAT_MODELS } from "@/lib/chatModels";
import { useWidgetChat } from "@/lib/useWidgetChat";
import { ArtifactPanel } from "./ArtifactPanel";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageList } from "./ChatMessageList";
import styles from "./ChatApp.module.css";

export function ChatApp() {
  const {
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
    canRefine,
  } = useWidgetChat();

  const activeModel = CHAT_MODELS.find((m) => m.id === modelId);

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
              {activeModel?.label ?? modelId} · RadioMaster TX15
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
            edgeTxVersion={edgeTxVersion}
            onProtocolChange={setProtocol}
            onModelChange={setModelId}
            onEdgeTxChange={setEdgeTxVersion}
            onSend={(prompt) => void sendMessage(prompt)}
          />
        </div>

        <ArtifactPanel
          artifact={artifact}
          sessionId={sessionId}
          protocol={protocol}
          running={running}
        />
      </div>
    </div>
  );
}
