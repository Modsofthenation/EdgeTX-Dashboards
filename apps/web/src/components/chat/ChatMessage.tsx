"use client";

import type { ChatMessage } from "@/lib/chatTypes";
import { AssistantStream } from "./AssistantStream";
import styles from "./ChatMessage.module.css";

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className={`${styles.row} ${styles.userRow}`}>
        <div className={styles.userBubble}>{message.content}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.row} ${styles.assistantRow}`}>
      <div className={styles.avatar} aria-hidden>
        ETX
      </div>
      <div className={styles.assistantBody}>
        {message.lines && message.lines.length > 0 ? (
          <AssistantStream lines={message.lines} isStreaming={message.isStreaming} />
        ) : message.content ? (
          <p className={styles.plainText}>{message.content}</p>
        ) : message.isStreaming ? (
          <AssistantStream lines={[]} isStreaming />
        ) : null}
      </div>
    </div>
  );
}
