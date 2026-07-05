/** True while the chat message list is scrolling (clears ~200ms after last scroll event). */
export const chatScrollActiveRef = { current: false };

let scrollEndTimer: ReturnType<typeof setTimeout> | null = null;

export function markChatScrolling(): void {
  chatScrollActiveRef.current = true;
  if (scrollEndTimer !== null) clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(() => {
    chatScrollActiveRef.current = false;
    scrollEndTimer = null;
  }, 200);
}

export function isChatScrolling(): boolean {
  return chatScrollActiveRef.current;
}
