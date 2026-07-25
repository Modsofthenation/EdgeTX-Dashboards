/** Header used by the browser to supply a Cursor API key (never log this value). */
export const CURSOR_API_KEY_HEADER = "x-cursor-api-key";

export function getServerCursorApiKey(): string | undefined {
  const key = process.env.CURSOR_API_KEY?.trim();
  return key ? key : undefined;
}

export function readBrowserCursorApiKey(request: Request): string | undefined {
  const header = request.headers.get(CURSOR_API_KEY_HEADER)?.trim();
  return header ? header : undefined;
}

/**
 * Prefer a per-request browser key, otherwise the server env key.
 * Returns undefined when neither is set.
 */
export function resolveCursorApiKey(request: Request): string | undefined {
  return readBrowserCursorApiKey(request) ?? getServerCursorApiKey();
}

export function isServerCursorApiKeyConfigured(): boolean {
  return Boolean(getServerCursorApiKey());
}
