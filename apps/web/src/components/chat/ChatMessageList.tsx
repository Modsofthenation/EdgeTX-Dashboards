"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chatTypes";
import { ChatMessageBubble } from "./ChatMessage";
import styles from "./ChatMessageList.module.css";

interface ChatMessageListProps {
  messages: ChatMessage[];
  running: boolean;
  onSuggestion: (text: string) => void;
}

export function ChatMessageList({ messages, running, onSuggestion }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    pinnedRef.current = distance < 80;
  };

  useEffect(() => {
    if (!pinnedRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, running]);

  return (
    <div ref={listRef} className={styles.list} onScroll={handleScroll}>
      {messages.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>What should your widget show?</h2>
          <p className={styles.emptyText}>
            Describe a TX15 dashboard — the agent writes Lua, validates it, and shows the preview in
            the panel on the right.
          </p>
          <div className={styles.suggestions}>
            {[
              "Betaflight dashboard with link bar, battery card, and GPS strip",
              "Rotorflight heli panel with headspeed and voltage cards",
              "Minimal CRSF widget with large battery voltage readout",
            ].map((text) => (
              <button
                key={text}
                type="button"
                className={styles.suggestion}
                disabled={running}
                onClick={() => onSuggestion(text)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} className={styles.anchor} />
    </div>
  );
}
