import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateCliArgs } from "./cli.ts";

describe("parseGenerateCliArgs", () => {
  it("parses explicit --protocol and --radio flags", () => {
    const parsed = parseGenerateCliArgs([
      "--protocol",
      "rotorflight",
      "--radio",
      "tx15",
      "heli",
      "dashboard",
    ]);
    assert.ok(parsed);
    assert.equal(parsed!.protocol, "rotorflight");
    assert.equal(parsed!.radio, "tx15");
    assert.equal(parsed!.prompt, "heli dashboard");
  });

  it("recovers when nested npm strips flags into positionals", () => {
    const parsed = parseGenerateCliArgs([
      "rotorflight",
      "tx15",
      "Rotorflight",
      "heli",
      "dashboard",
      "with",
      "headspeed",
    ]);
    assert.ok(parsed);
    assert.equal(parsed!.protocol, "rotorflight");
    assert.equal(parsed!.radio, "tx15");
    assert.equal(parsed!.prompt, "Rotorflight heli dashboard with headspeed");
  });

  it("defaults protocol to betaflight", () => {
    const parsed = parseGenerateCliArgs(["Clean", "battery", "dash"]);
    assert.ok(parsed);
    assert.equal(parsed!.protocol, "betaflight");
    assert.equal(parsed!.prompt, "Clean battery dash");
  });

  it("returns null without a prompt", () => {
    assert.equal(parseGenerateCliArgs(["--protocol", "betaflight"]), null);
  });
});
