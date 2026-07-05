import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildReferenceImagesSection,
  buildSdkUserMessage,
  validatePromptImages,
} from "../promptImages.js";

describe("promptImages", () => {
  it("buildSdkUserMessage passes images to SDK shape", () => {
    const msg = buildSdkUserMessage("hello", [
      { data: "abc123", mimeType: "image/png", name: "shot.png" },
    ]);
    assert.equal(typeof msg, "object");
    if (typeof msg === "string") {
      assert.fail("expected SDKUserMessage");
    }
    assert.equal(msg.text, "hello");
    assert.equal(msg.images?.length, 1);
    const first = msg.images?.[0];
    assert.ok(first && "mimeType" in first);
    if (first && "mimeType" in first) {
      assert.equal(first.mimeType, "image/png");
    }
  });

  it("validatePromptImages rejects oversize payloads", () => {
    const big = Buffer.alloc(5 * 1024 * 1024, 1).toString("base64");
    const result = validatePromptImages([{ data: big, mimeType: "image/png" }]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /4MB/);
  });

  it("buildReferenceImagesSection is empty without images", () => {
    assert.equal(buildReferenceImagesSection(0, "TX15"), "");
    assert.match(buildReferenceImagesSection(2, "TX15"), /2 reference images/);
  });
});
