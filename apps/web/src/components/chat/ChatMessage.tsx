"use client";

import { memo } from "react";
import type { ChatMessage } from "@/lib/chatTypes";
import { AssistantStream } from "./AssistantStream";
import styles from "./ChatMessage.module.css";

interface ChatMessageProps {
  message: ChatMessage;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({ message }: ChatMessageProps) {
  if (message.role === "user") {
    const hasImages = message.images && message.images.length > 0;
    const hasText = !!message.content?.trim();

    return (
      <div className={`${styles.row} ${styles.userRow}`}>
        <div className={styles.userContent}>
          {hasImages ? (
            <div className={styles.userImages} aria-label="Attached images">
              {message.images!.map((img, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${img.previewUrl}-${index}`}
                  src={img.previewUrl}
                  alt={img.name ?? "Attached image"}
                  className={styles.userImageThumb}
                  title={img.name}
                />
              ))}
            </div>
          ) : null}
          {hasText ? <div className={styles.userBubble}>{message.content}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.row} ${styles.assistantRow} ${
        message.isStreaming && (!message.lines || message.lines.length === 0) && !message.content
          ? styles.assistantRowPending
          : ""
      }`}
    >
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
});
