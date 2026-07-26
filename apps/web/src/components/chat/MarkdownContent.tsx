"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownContent.module.css";
import { sanitizeMarkdownHref } from "./markdownHref.ts";

interface MarkdownContentProps {
  children: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  children,
}: MarkdownContentProps) {
  if (!children.trim()) return null;

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children, ...props }) => (
            <pre className="appScrollbar" {...props}>
              {children}
            </pre>
          ),
          a: ({ href, children, ...props }) => {
            const safe = sanitizeMarkdownHref(href);
            if (!safe) {
              return <span {...props}>{children}</span>;
            }
            const external = safe.startsWith("http");
            return (
              <a
                {...props}
                href={safe}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
