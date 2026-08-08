import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDownloadValidationFailure } from "./downloadValidation.ts";

describe("parseDownloadValidationFailure", () => {
  it("prefers message, hint, and nested validation issues", () => {
    const failure = parseDownloadValidationFailure(
      {
        error: "Widget failed validation",
        message: "Download blocked: 2 validation errors must be fixed first.",
        hint: "Open Layout and fix issues.",
        protocol: "rotorflight",
        radioId: "tx16s",
        validation: {
          issues: [
            { severity: "error", message: "Unknown sensor Foo", line: 12 },
            { severity: "warning", message: "Dense text", line: 40 },
          ],
        },
      },
      422,
    );

    assert.equal(failure.title, "Download blocked");
    assert.match(failure.message, /2 validation errors/);
    assert.equal(failure.hint, "Open Layout and fix issues.");
    assert.equal(failure.protocol, "rotorflight");
    assert.equal(failure.radioId, "tx16s");
    assert.equal(failure.issues.length, 2);
    assert.equal(failure.issues[0]?.message, "Unknown sensor Foo");
  });

  it("falls back when body only has the short error string", () => {
    const failure = parseDownloadValidationFailure(
      { error: "Widget failed validation" },
      422,
    );
    assert.equal(failure.message, "Widget failed validation");
    assert.match(failure.hint ?? "", /Fix the errors/);
    assert.deepEqual(failure.issues, []);
  });

  it("reads top-level issues when present", () => {
    const failure = parseDownloadValidationFailure({
      message: "Blocked",
      issues: [{ severity: "error", message: "Name too long", line: 3 }],
    });
    assert.equal(failure.issues.length, 1);
    assert.equal(failure.issues[0]?.line, 3);
  });
});
