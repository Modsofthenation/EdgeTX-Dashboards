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
    bottomRef.current?.scrollIntoView({
      behavior: running ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, running]);

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
          <div className={styles.suggestions}>
            {[
              "Minimal quad dashboard: large timer, battery bar, and RSSI strip",
              "Rotorflight heli board with headspeed hero and motor temps",
              "Dense CRSF telemetry grid with link, GPS, and attitude",
              "Battery dashboard plus a TOOLS script to select 4S/6S pack",
              "Flight logger telemetry script with last-flight summary on the dashboard",
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
