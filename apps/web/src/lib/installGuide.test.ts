import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInstallGuide,
  formatInstallGuideMarkdown,
} from "./installGuide.ts";

describe("formatInstallGuideMarkdown", () => {
  it("includes widget name, protocol, and SD path guidance", () => {
    const md = formatInstallGuideMarkdown(
      buildInstallGuide("rotorflight", "StacyDash"),
    );
    assert.match(md, /# Install StacyDash/);
    assert.match(md, /Rotorflight/i);
    assert.match(md, /WIDGETS/);
    assert.match(md, /rf2bg/i);
    assert.match(md, /## Troubleshooting/);
  });
});
