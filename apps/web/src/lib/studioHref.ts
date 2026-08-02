/**
 * Studio (AI generate) URL helpers.
 * Studio replaces the former Generate surface at `/`.
 */

export function buildStudioHref(options?: { chatId?: string | null }): string {
  if (options?.chatId) {
    return `/studio?chatId=${encodeURIComponent(options.chatId)}`;
  }
  return "/studio";
}
