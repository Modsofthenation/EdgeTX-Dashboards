import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHttpTools } from "./httpTools.ts";

describe("httpTools path safety", () => {
  it("rejects path traversal in writeWidgetFile", async () => {
    const tools = createHttpTools({
      widgetInstanceId: "00000000-0000-4000-8000-000000000001",
      widgetName: "TestDash",
    });
    const write = tools.find((t) => t.name === "writeWidgetFile");
    assert.ok(write);
    const result = await write!.execute({
      relativePath: "../escape.lua",
      contents: "-- nope",
    });
    assert.equal(result.isError, true);
    assert.match(result.text, /Unsafe|path/i);
  });
});
