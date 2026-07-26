/** Allow only safe URL schemes in assistant markdown links. */
export function sanitizeMarkdownHref(
  href: string | undefined,
): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  return undefined;
}
