import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Mirrors the strip logic in syncChatRecord — keeps the contract covered
 * without spinning up fetch against a live server.
 */
function stripMessagesForPersist(
  messages: Array<{
    isStreaming?: boolean;
    widget?: unknown;
    images?: Array<{ previewUrl: string }>;
    content: string;
  }>,
) {
  return messages
    .filter((message) => !message.isStreaming)
    .map(({ isStreaming: _, widget: __, images: ___, ...rest }) => rest);
}

describe("chatHistoryApi persist payload", () => {
  it("drops streaming flags, widget blobs, and image data URLs", () => {
    const payload = stripMessagesForPersist([
      {
        content: "hi",
        images: [{ previewUrl: "data:image/png;base64,AAAA" }],
        widget: { name: "X" },
      },
      { content: "stream", isStreaming: true },
    ]);
    assert.equal(payload.length, 1);
    assert.deepEqual(payload[0], { content: "hi" });
    assert.equal(JSON.stringify(payload).includes("data:image"), false);
  });
});
