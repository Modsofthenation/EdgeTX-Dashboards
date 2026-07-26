import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeMarkdownHref } from "./markdownHref.ts";

describe("sanitizeMarkdownHref", () => {
  it("allows http(s), mailto, and hash links", () => {
    assert.equal(
      sanitizeMarkdownHref("https://example.com"),
      "https://example.com",
    );
    assert.equal(
      sanitizeMarkdownHref("http://example.com"),
      "http://example.com",
    );
    assert.equal(sanitizeMarkdownHref("mailto:a@b.c"), "mailto:a@b.c");
    assert.equal(sanitizeMarkdownHref("#section"), "#section");
  });

  it("rejects javascript and other schemes", () => {
    assert.equal(sanitizeMarkdownHref("javascript:alert(1)"), undefined);
    assert.equal(sanitizeMarkdownHref("data:text/html,hi"), undefined);
    assert.equal(sanitizeMarkdownHref("file:///etc/passwd"), undefined);
  });
});
