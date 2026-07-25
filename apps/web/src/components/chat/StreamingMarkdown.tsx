"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { splitStreamingMarkdownBlocks } from "~/lib/streamLines";
import { MarkdownContent } from "./MarkdownContent";

const TAIL_THROTTLE_MS = 200;

const FrozenMarkdownBlock = memo(function FrozenMarkdownBlock({
  content,
  blockKey,
}: {
  content: string;
  blockKey: string;
}) {
  if (!content.trim()) return null;
  return <MarkdownContent key={blockKey}>{content}</MarkdownContent>;
});

function useThrottledValue(value: string, enabled: boolean): string {
  const [throttled, setThrottled] = useState(value);

  useEffect(() => {
    if (!enabled) {
      setThrottled(value);
      return;
    }
    const id = window.setTimeout(() => setThrottled(value), TAIL_THROTTLE_MS);
    return () => window.clearTimeout(id);
  }, [value, enabled]);

  return enabled ? throttled : value;
}

interface StreamingMarkdownProps {
  text: string;
  /** When true, the in-flight paragraph uses throttled partial Markdown. */
  streamPartial?: boolean;
}

export function StreamingMarkdown({ text, streamPartial = false }: StreamingMarkdownProps) {
  const { frozenBlocks, tail } = useMemo(
    () => splitStreamingMarkdownBlocks(text, streamPartial),
    [text, streamPartial]
  );

  const throttledTail = useThrottledValue(tail, streamPartial && tail.length > 0);

  if (!text.trim()) return null;

  return (
    <>
      {frozenBlocks.map((block, index) => (
        <FrozenMarkdownBlock
          key={`block-${index}-${block.length}`}
          blockKey={`block-${index}-${block.length}`}
          content={block}
        />
      ))}
      {streamPartial && throttledTail.trim() ? (
        <MarkdownContent>{throttledTail}</MarkdownContent>
      ) : null}
      {!streamPartial && frozenBlocks.length === 0 && text.trim() ? (
        <MarkdownContent>{text}</MarkdownContent>
      ) : null}
    </>
  );
}
