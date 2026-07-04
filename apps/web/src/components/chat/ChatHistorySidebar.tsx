"use client";

import type { ChatSummary } from "@/lib/chatTypes";
import styles from "./ChatHistorySidebar.module.css";

interface ChatHistorySidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  loading: boolean;
  running: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}

function formatWhen(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatHistorySidebar({
  chats,
  activeChatId,
  loading,
  running,
  onSelect,
  onNewChat,
  onDelete,
}: ChatHistorySidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>History</h2>
        <button type="button" className={styles.newBtn} onClick={onNewChat} disabled={running}>
          +
        </button>
      </div>

      <div className={styles.list} role="list">
        {loading && <p className={styles.empty}>Loading…</p>}

        {!loading && chats.length === 0 && (
          <p className={styles.empty}>No saved chats yet. Generate a widget to start.</p>
        )}

        {chats.map((chat) => {
          const active = chat.id === activeChatId;
          return (
            <div
              key={chat.id}
              role="listitem"
              className={`${styles.item} ${active ? styles.itemActive : ""}`}
            >
              <button
                type="button"
                className={styles.itemBtn}
                onClick={() => onSelect(chat.id)}
                disabled={running}
              >
                <span className={styles.itemTitle}>{chat.title}</span>
                <span className={styles.itemMeta}>
                  {chat.widgetName ? (
                    <>
                      <span className={chat.validated ? styles.badgeOk : styles.badgeDraft}>
                        {chat.widgetName}
                      </span>
                      <span className={styles.dot}>·</span>
                    </>
                  ) : null}
                  <span>{formatWhen(chat.updatedAt)}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                aria-label={`Delete ${chat.title}`}
                onClick={() => onDelete(chat.id)}
                disabled={running}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
