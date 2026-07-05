"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownContent.module.css";

interface MarkdownContentProps {
  children: string;
}

export const MarkdownContent = memo(function MarkdownContent({ children }: MarkdownContentProps) {
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
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
