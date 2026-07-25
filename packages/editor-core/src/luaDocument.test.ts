import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePreviewDimensions, getSimulateLayoutProfile } from "@widget-gen/shared";
import {
  interpretDocument,
  patchRecordArgs,
  translateRecord,
  removeRecordLine,
  insertDrawLine,
  patchWidgetName,
} from "./luaDocument.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const goldExample = readFileSync(
  join(repoRoot, "examples/tx15-minimal-dashboard.lua"),
  "utf8"
);

function zoneFor(source: string) {
  const dims = resolvePreviewDimensions(source, getSimulateLayoutProfile("tx15"));
  return { zoneX: dims.zoneX, zoneY: dims.zoneY, zoneW: dims.zoneW, zoneH: dims.zoneH };
}

test("interpretDocument attaches sourceLine and sourceRef to draw records", () => {
  const records = interpretDocument(goldExample);
  assert.ok(records.length > 5);
  const text = records.find((r) => r.kind === "text" && r.text === "TX15 Dash");
  assert.ok(text?.sourceLine);
  assert.ok(text?.sourceRef?.args.length);
});

test("translateRecord patches only the targeted line x/y args", () => {
  const zone = zoneFor(goldExample);
  const records = interpretDocument(goldExample);
  const title = records.find((r) => r.kind === "text" && r.text === "TX15 Dash");
  assert.ok(title);
  const beforeLine = goldExample.split("\n")[title!.sourceLine! - 1];
  const after = translateRecord(goldExample, title!, 12, 0, zone);
  const afterLine = after.split("\n")[title!.sourceLine! - 1];
  assert.notEqual(beforeLine, afterLine);
  assert.match(afterLine, /drawText/);
  const otherLines = after.split("\n").filter((_, i) => i + 1 !== title!.sourceLine);
  const origOther = goldExample.split("\n").filter((_, i) => i + 1 !== title!.sourceLine);
  assert.deepEqual(otherLines, origOther);
});

test("patchRecordArgs updates width on a filled rectangle", () => {
  const zone = zoneFor(goldExample);
  const records = interpretDocument(goldExample);
  const header = records.find((r) => r.kind === "filledRect" && (r.h ?? 0) === 40);
  assert.ok(header);
  const patched = patchRecordArgs(
    goldExample,
    header!,
    { w: 500, h: header!.h!, x: header!.x!, y: header!.y! },
    zone
  );
  const line = patched.split("\n")[header!.sourceLine! - 1];
  assert.match(line, /500/);
});

test("removeRecordLine deletes anchored line", () => {
  const records = interpretDocument(goldExample);
  const title = records.find((r) => r.kind === "text" && r.text === "TX15 Dash");
  assert.ok(title);
  const beforeCount = goldExample.split("\n").length;
  const after = removeRecordLine(goldExample, title!);
  assert.equal(after.split("\n").length, beforeCount - 1);
  assert.ok(!interpretDocument(after).some((r) => r.text === "TX15 Dash"));
});

test("insertDrawLine appends inside refresh body", () => {
  const starter = patchWidgetName(goldExample, "Test");
  const after = insertDrawLine(starter, "text");
  assert.match(after, /lcd\.drawText\(12, 12, "Text"/);
  const records = interpretDocument(after);
  assert.ok(records.some((r) => r.kind === "text" && r.text === "Text"));
});
