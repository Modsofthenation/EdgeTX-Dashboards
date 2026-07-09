"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chatTypes";
import { markChatScrolling } from "@/lib/chatScrollPause";
import { TEMPLATE_GALLERY } from "@/lib/templateGallery";
import { ChatMessageBubble } from "./ChatMessage";
import styles from "./ChatMessageList.module.css";

interface ChatMessageListProps {
  messages: ChatMessage[];
  scrollRevision: number;
  running: boolean;
  onSuggestion: (text: string) => void;
  dashboardReadyCue?: boolean;
  onRetry?: () => void;
}

export function ChatMessageList({
  messages,
  scrollRevision,
  running,
  onSuggestion,
  dashboardReadyCue = false,
  onRetry,
}: ChatMessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const lastScrollHeightRef = useRef(0);

  const handleScroll = () => {
    markChatScrolling();
    const list = listRef.current;
    if (!list) return;
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    pinnedRef.current = distance < 80;
  };

  useEffect(() => {
    if (!pinnedRef.current) return;
    const list = listRef.current;
    if (!list) return;
    if (list.scrollHeight === lastScrollHeightRef.current && scrollRevision > 0) return;
    lastScrollHeightRef.current = list.scrollHeight;
    list.scrollTop = list.scrollHeight;
  }, [scrollRevision, running]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!pinnedRef.current) return;
    const list = listRef.current;
    if (!list) return;
    lastScrollHeightRef.current = list.scrollHeight;
    list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={listRef} className={styles.list} onScroll={handleScroll}>
      {messages.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>What should your dashboard show?</h2>
          <p className={styles.emptyText}>
            Describe a full-screen TX15 dashboard — the agent writes Lua, validates it, and shows the
            preview in the panel on the right. Ask for companion tools (battery selector, flight
            logger) when you need them.
          </p>
          <ol className={styles.steps} aria-label="How it works">
            <li>
              <span className={styles.stepNum}>1</span>
              <span>
                <strong>Describe</strong> the telemetry and layout you want
              </span>
            </li>
            <li>
              <span className={styles.stepNum}>2</span>
              <span>
                <strong>Preview</strong> validates in the Dashboard panel
              </span>
            </li>
            <li>
              <span className={styles.stepNum}>3</span>
              <span>
                <strong>Download</strong> the zip for your radio SD card
              </span>
            </li>
          </ol>

          <h3 className={styles.galleryTitle}>Start from a template</h3>
          <div className={styles.gallery}>
            {TEMPLATE_GALLERY.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.galleryCard}
                disabled={running}
                onClick={() => onSuggestion(item.prompt)}
              >
                <span className={styles.galleryCardTitle}>{item.title}</span>
                <span className={styles.galleryCardArchetype}>{item.archetype}</span>
              </button>
            ))}
          </div>

          <div className={styles.suggestions}>
            {TEMPLATE_GALLERY.map((item) => (
              <button
                key={`s-${item.id}`}
                type="button"
                className={styles.suggestion}
                disabled={running}
                onClick={() => onSuggestion(item.prompt)}
              >
                {item.prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          onRetry={message.error && !running ? onRetry : undefined}
        />
      ))}

      {dashboardReadyCue && messages.length > 0 && (
        <div className={styles.readyCue} role="status">
          Dashboard ready — preview and download are in the <strong>Dashboard</strong> panel on the
          right.
        </div>
      )}
    </div>
  );
}
