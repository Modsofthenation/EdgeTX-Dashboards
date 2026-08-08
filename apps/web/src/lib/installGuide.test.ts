import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInstallGuide,
  formatInstallGuideMarkdown,
} from "./installGuide.ts";

describe("formatInstallGuideMarkdown", () => {
  it("includes widget name, protocol, and SD path guidance", () => {
    const md = formatInstallGuideMarkdown(
      buildInstallGuide("rotorflight", "HeliDash"),
    );
    assert.match(md, /# Install HeliDash/);
    assert.match(md, /Rotorflight/i);
    assert.match(md, /WIDGETS/);
    assert.match(md, /rf2bg/i);
    assert.match(md, /## Troubleshooting/);
  });

  it("parameterizes radio name and LCD size", () => {
    const guide = buildInstallGuide("betaflight", "BoxerDash", {
      radioName: "RadioMaster Boxer",
      lcdW: 480,
      lcdH: 272,
      touch: false,
    });
    assert.equal(guide.radioName, "RadioMaster Boxer");
    assert.equal(guide.lcdW, 480);
    assert.equal(guide.lcdH, 272);
    const md = formatInstallGuideMarkdown(guide);
    assert.match(md, /RadioMaster Boxer/);
    assert.match(md, /480×272/);
    assert.doesNotMatch(
      guide.steps.find((s) => s.id === "fullscreen")!.detail,
      /double-tap/,
    );
  });
});
