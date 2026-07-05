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
    return (
      <div className={`${styles.row} ${styles.userRow}`}>
        <div className={styles.userBubble}>
          {message.content ? <div>{message.content}</div> : null}
          {message.images && message.images.length > 0 && (
            <div className={styles.userImages}>
              {message.images.map((img, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${img.previewUrl}-${index}`}
                  src={img.previewUrl}
                  alt={img.name ?? "Reference image"}
                  className={styles.userImageThumb}
                />
              ))}
            </div>
          )}
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
