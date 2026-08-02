"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "~/lib/chatTypes";
import { markChatScrolling } from "~/lib/chatScrollPause";
import {
  TEMPLATE_GALLERY,
  templatePreviewSrc,
  type TemplateGalleryItem,
} from "~/lib/templateGallery";
import { ChatMessageBubble } from "./ChatMessage";
import styles from "./ChatMessageList.module.css";

const VARIANT_FILTERS = [
  { id: "all", label: "All" },
  { id: "electric", label: "RF electric" },
  { id: "nitro", label: "RF nitro" },
  { id: "whoop", label: "BF whoop" },
  { id: "freestyle", label: "BF freestyle" },
] as const;

type VariantFilterId = (typeof VARIANT_FILTERS)[number]["id"];

interface ChatMessageListProps {
  messages: ChatMessage[];
  scrollRevision: number;
  running: boolean;
  /** When false, hide/disable Generate with AI on templates. */
  aiReady?: boolean;
  /** True while `/api/ai/status` has not resolved yet. */
  statusLoading?: boolean;
  /** Active radio layout profile — picks TX15 vs color272 gallery thumbs. */
  layoutProfileId?: string | null;
  /** Primary: open template prefab in Layout (no AI). */
  onSuggestion: (item: TemplateGalleryItem) => void;
  /** Secondary: send template prompt to the agent. */
  onGenerateSuggestion?: (item: TemplateGalleryItem) => void;
  dashboardReadyCue?: boolean;
  onRetry?: () => void;
  /** Open Layout with a starter dashboard (no AI generate). */
  blankLayoutHref?: string | null;
}

export function ChatMessageList({
  messages,
  scrollRevision,
  running,
  aiReady = false,
  statusLoading = false,
  layoutProfileId = null,
  onSuggestion,
  onGenerateSuggestion,
  dashboardReadyCue = false,
  onRetry,
  blankLayoutHref = null,
}: ChatMessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const lastScrollHeightRef = useRef(0);
  const [variantFilter, setVariantFilter] = useState<VariantFilterId>("all");

  const galleryItems = useMemo(() => {
    if (variantFilter === "all") return TEMPLATE_GALLERY;
    return TEMPLATE_GALLERY.filter((item) => item.variant === variantFilter);
  }, [variantFilter]);

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
    if (list.scrollHeight === lastScrollHeightRef.current && scrollRevision > 0)
      return;
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
          <h2 className={styles.emptyTitle}>
            What should your dashboard show?
          </h2>
          <p className={styles.emptyText}>
            Describe a full-screen dashboard for your radio — the agent writes
            Lua, validates it, and shows the preview on the right. Or skip AI
            and build visually in Layout with Insert / prefabs.
          </p>
          {blankLayoutHref ? (
            <div className={styles.emptyActions}>
              <Link href={blankLayoutHref} className={styles.buildManualBtn}>
                Build in Layout (no AI)
              </Link>
            </div>
          ) : null}
          <ol className={styles.steps} aria-label="How it works">
            <li>
              <span className={styles.stepNum}>1</span>
              <span>
                <strong>Describe</strong> or open Layout to place elements
              </span>
            </li>
            <li>
              <span className={styles.stepNum}>2</span>
              <span>
                <strong>Preview</strong> the result in the right panel
              </span>
            </li>
            <li>
              <span className={styles.stepNum}>3</span>
              <span>
                <strong>Layout</strong> to tweak placement visually (optional)
              </span>
            </li>
            <li>
              <span className={styles.stepNum}>4</span>
              <span>
                <strong>Download</strong> the zip for your radio SD card
              </span>
            </li>
          </ol>

          <h3 className={styles.galleryTitle}>Start from a template</h3>
          <div
            className={styles.galleryFilters}
            role="group"
            aria-label="Template variants"
          >
            {VARIANT_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={
                  variantFilter === f.id
                    ? styles.galleryFilterActive
                    : styles.galleryFilter
                }
                disabled={running}
                onClick={() => setVariantFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className={styles.gallery}>
            {galleryItems.map((item) => (
              <div key={item.id} className={styles.galleryCardWrap}>
                <button
                  type="button"
                  className={styles.galleryCard}
                  disabled={running}
                  onClick={() => onSuggestion(item)}
                >
                  <span className={styles.galleryCardThumb}>
                    <img
                      src={templatePreviewSrc(item.id, layoutProfileId)}
                      alt=""
                      width={480}
                      height={layoutProfileId === "color272" ? 272 : 320}
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span className={styles.galleryCardTitle}>{item.title}</span>
                  <span className={styles.galleryCardArchetype}>
                    {item.variant
                      ? `${item.variant} · ${item.archetype}`
                      : item.archetype}
                    {` · ${item.protocol}`}
                  </span>
                  <span className={styles.galleryCardAction}>
                    Open in Layout
                  </span>
                </button>
                {onGenerateSuggestion ? (
                  <button
                    type="button"
                    className={styles.galleryCardAi}
                    disabled={running || statusLoading || !aiReady}
                    onClick={() => onGenerateSuggestion(item)}
                    title={
                      !statusLoading && !aiReady
                        ? "Configure an AI provider in Preferences to generate"
                        : item.prompt
                    }
                  >
                    Generate with AI
                  </button>
                ) : null}
              </div>
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
          Preview ready — open the <strong>Preview</strong> panel to download,
          or switch to <strong>Layout</strong> to edit visually.
        </div>
      )}
    </div>
  );
}
