import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Unit-test the base64 encoder path via a tiny inline copy of the chunking
// logic used by saveBlobToDisk (DOM APIs are exercised in the app, not here).
function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]!);
    }
  }
  return Buffer.from(binary, "binary").toString("base64");
}

describe("desktopDownload base64 encoding", () => {
  it("round-trips small binary payloads", () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const b64 = bytesToBase64(bytes);
    assert.equal(Buffer.from(b64, "base64").equals(Buffer.from(bytes)), true);
  });

  it("handles multi-chunk payloads", () => {
    const bytes = new Uint8Array(0x8000 + 17);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    const b64 = bytesToBase64(bytes);
    assert.equal(Buffer.from(b64, "base64").equals(Buffer.from(bytes)), true);
  });
});
