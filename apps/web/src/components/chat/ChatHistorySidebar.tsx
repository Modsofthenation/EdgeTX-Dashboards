"use client";

import { memo, useState } from "react";
import type { ChatSummary } from "~/lib/chatTypes";
import { PROTOCOL_BADGE_LABELS, protocolBadgeClass } from "~/lib/protocolLabels";
import { ConfirmDialog } from "./ConfirmDialog";
import { PanelCollapseButton } from "./CollapsibleAside";
import styles from "./ChatHistorySidebar.module.css";

interface ChatHistorySidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  loading: boolean;
  running: boolean;
  panelCollapsed?: boolean;
  onTogglePanel?: () => void;
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

export const ChatHistorySidebar = memo(function ChatHistorySidebar({
  chats,
  activeChatId,
  loading,
  running,
  panelCollapsed = false,
  onTogglePanel,
  onSelect,
  onNewChat,
  onDelete,
}: ChatHistorySidebarProps) {
  const [pendingDelete, setPendingDelete] = useState<ChatSummary | null>(null);

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    onDelete(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h2 className={styles.title}>History</h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.newBtn} onClick={onNewChat} disabled={running} title="New chat">
            +
          </button>
          {onTogglePanel && (
            <PanelCollapseButton label="History" collapsed={panelCollapsed} onToggle={onTogglePanel} />
          )}
        </div>
      </div>

      <div className={styles.list} role="list">
        {loading && <p className={styles.empty}>Loading…</p>}

        {!loading && chats.length === 0 && (
          <p className={styles.empty}>No saved chats yet. Generate a dashboard to start.</p>
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
                  <span
                    className={`${styles.protocolBadge} ${styles[protocolBadgeClass(chat.protocol)]}`}
                  >
                    {PROTOCOL_BADGE_LABELS[chat.protocol]}
                  </span>
                  {chat.widgetName ? (
                    <>
                      <span className={styles.dot}>·</span>
                      <span className={chat.validated ? styles.badgeOk : styles.badgeDraft}>
                        {chat.widgetName}
                      </span>
                    </>
                  ) : null}
                  <span className={styles.dot}>·</span>
                  <span>{formatWhen(chat.updatedAt)}</span>
                </span>
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                aria-label={`Delete ${chat.title}`}
                onClick={() => setPendingDelete(chat)}
                disabled={running}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete chat?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" and its widget history will be permanently removed.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  );
});
