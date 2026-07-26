import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBlankEditorHref, buildEditorHref } from "./editorHref.ts";

describe("editorHref", () => {
  it("builds a blank Layout URL with protocol and radio", () => {
    const href = buildBlankEditorHref({
      protocol: "rotorflight",
      radioId: "tx16",
      layoutProfileId: "color272",
    });
    assert.equal(
      href,
      "/editor?protocol=rotorflight&layoutProfile=color272&radioId=tx16",
    );
  });

  it("builds an artifact Layout URL with workspace keys", () => {
    const href = buildEditorHref({
      protocol: "betaflight",
      chatId: "c1",
      sessionId: "s1",
      instanceId: "i1",
      radioId: "tx15",
      layoutProfileId: "tx15",
    });
    assert.match(href, /instanceId=i1/);
    assert.match(href, /chatId=c1/);
    assert.doesNotMatch(href, /[?&]name=/);
  });
});
