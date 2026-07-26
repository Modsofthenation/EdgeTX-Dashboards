import type { AiProviderId } from "@widget-gen/shared";
import { parseAiProviderId, providerMeta } from "@widget-gen/shared";

export {
  CURSOR_API_KEY_HEADER,
  getServerCursorApiKey,
  readBrowserCursorApiKey,
  resolveCursorApiKey,
  isServerCursorApiKeyConfigured,
} from "./cursorApiKey.ts";

export function readBrowserProvider(request: Request): AiProviderId {
  return parseAiProviderId(request.headers.get("x-ai-provider"));
}

export function getServerApiKey(provider: AiProviderId): string | undefined {
  const env = providerMeta(provider).envVar;
  const key = process.env[env]?.trim();
  return key ? key : undefined;
}

export function readBrowserApiKey(
  request: Request,
  provider: AiProviderId,
): string | undefined {
  const header = providerMeta(provider).header;
  const value = request.headers.get(header)?.trim();
  return value ? value : undefined;
}

/**
 * Prefer a per-request browser key for the selected provider, otherwise the
 * matching server env key.
 */
export function resolveProviderApiKey(
  request: Request,
  provider: AiProviderId = readBrowserProvider(request),
): string | undefined {
  return readBrowserApiKey(request, provider) ?? getServerApiKey(provider);
}

export function isServerProviderConfigured(provider: AiProviderId): boolean {
  return Boolean(getServerApiKey(provider));
}
