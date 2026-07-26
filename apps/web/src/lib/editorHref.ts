/**
 * Build /editor URLs for Generate → Layout navigation.
 * Works with or without an existing generated artifact.
 */
export type EditorHrefOptions = {
  protocol: string;
  radioId?: string | null;
  layoutProfileId?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  instanceId?: string | null;
  name?: string | null;
};

/** Layout entry that opens a blank/starter dashboard (no AI generate required). */
export function buildBlankEditorHref(options: {
  protocol: string;
  radioId?: string | null;
  layoutProfileId?: string | null;
  chatId?: string | null;
}): string {
  const params = new URLSearchParams({ protocol: options.protocol });
  if (options.layoutProfileId)
    params.set("layoutProfile", options.layoutProfileId);
  if (options.radioId) params.set("radioId", options.radioId);
  if (options.chatId) params.set("chatId", options.chatId);
  return `/editor?${params.toString()}`;
}

/** Layout entry for an existing widget workspace when available. */
export function buildEditorHref(options: EditorHrefOptions): string {
  const params = new URLSearchParams({ protocol: options.protocol });
  if (options.chatId) params.set("chatId", options.chatId);
  if (options.sessionId) params.set("sessionId", options.sessionId);
  if (options.instanceId) params.set("instanceId", options.instanceId);
  else if (options.name) params.set("name", options.name);
  if (options.layoutProfileId)
    params.set("layoutProfile", options.layoutProfileId);
  if (options.radioId) params.set("radioId", options.radioId);
  return `/editor?${params.toString()}`;
}
