import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  stubFolderForEdgeTxVersion,
  normalizeEdgeTxVersion,
} from "./edgeTxVersions.ts";

describe("stubFolderForEdgeTxVersion", () => {
  it("maps semver picker values to stub folders", () => {
    assert.equal(stubFolderForEdgeTxVersion("2.10.0"), "2.10");
    assert.equal(stubFolderForEdgeTxVersion("2.11.0"), "2.11");
    assert.equal(stubFolderForEdgeTxVersion("2.12.0"), "2.12");
    assert.equal(stubFolderForEdgeTxVersion("2.12"), "2.12");
  });

  it("falls back for unknown versions", () => {
    assert.equal(stubFolderForEdgeTxVersion("2.9.0"), "2.10");
    assert.equal(stubFolderForEdgeTxVersion("2.13.0"), "2.12");
    assert.equal(normalizeEdgeTxVersion("2.11"), "2.11.0");
  });
});
