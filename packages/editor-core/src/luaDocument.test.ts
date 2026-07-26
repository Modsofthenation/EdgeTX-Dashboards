import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePreviewDimensions,
  getSimulateLayoutProfile,
} from "@widget-gen/shared";
import {
  interpretDocument,
  patchRecordArgs,
  translateRecord,
  removeRecordLine,
  removeRecordLines,
  remapRecordIdsAfterLineRemoval,
  insertDrawLine,
  insertDrawLineWithId,
  createStarterSource,
  setRecordColor,
  duplicateRecordLine,
  moveRecordLine,
} from "./luaDocument.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const goldExample = readFileSync(
  join(repoRoot, "examples/tx15-minimal-dashboard.lua"),
  "utf8",
);

function zoneFor(source: string) {
  const dims = resolvePreviewDimensions(
    source,
    getSimulateLayoutProfile("tx15"),
  );
  return {
    zoneX: dims.zoneX,
    zoneY: dims.zoneY,
    zoneW: dims.zoneW,
    zoneH: dims.zoneH,
  };
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
  const title = records.find(
    (r) => r.kind === "text" && r.text === "TX15 Dash",
  );
  assert.ok(title);
  const beforeLine = goldExample.split("\n")[title!.sourceLine! - 1];
  const after = translateRecord(goldExample, title!, 12, 0, zone);
  const afterLine = after.split("\n")[title!.sourceLine! - 1];
  assert.notEqual(beforeLine, afterLine);
  assert.match(afterLine, /drawText/);
  const otherLines = after
    .split("\n")
    .filter((_, i) => i + 1 !== title!.sourceLine);
  const origOther = goldExample
    .split("\n")
    .filter((_, i) => i + 1 !== title!.sourceLine);
  assert.deepEqual(otherLines, origOther);
});

test("patchRecordArgs updates width on a filled rectangle", () => {
  const zone = zoneFor(goldExample);
  const records = interpretDocument(goldExample);
  const header = records.find(
    (r) => r.kind === "filledRect" && (r.h ?? 0) === 40,
  );
  assert.ok(header);
  const patched = patchRecordArgs(
    goldExample,
    header!,
    { w: 500, h: header!.h!, x: header!.x!, y: header!.y! },
    zone,
  );
  const line = patched.split("\n")[header!.sourceLine! - 1];
  assert.match(line, /500/);
});

test("removeRecordLine deletes anchored line", () => {
  const records = interpretDocument(goldExample);
  const title = records.find(
    (r) => r.kind === "text" && r.text === "TX15 Dash",
  );
  assert.ok(title);
  const beforeCount = goldExample.split("\n").length;
  const after = removeRecordLine(goldExample, title!);
  assert.equal(after.split("\n").length, beforeCount - 1);
  assert.ok(!interpretDocument(after).some((r) => r.text === "TX15 Dash"));
});

test("patchRecordArgs applies multi-arg patches without corrupting later spans", () => {
  const zone = zoneFor(goldExample);
  const records = interpretDocument(goldExample);
  const title = records.find(
    (r) => r.kind === "text" && r.text === "TX15 Dash",
  );
  assert.ok(title);
  // pad (3 chars) → 24 (2 chars) while also rewriting y — classic span-shift bug.
  const patched = translateRecord(goldExample, title!, 12, 0, zone);
  const line = patched.split("\n")[title!.sourceLine! - 1]!;
  assert.match(line, /lcd\.drawText\(24,\s*12,\s*"TX15 Dash"/);
  const after = interpretDocument(patched).find((r) => r.id === title!.id);
  assert.equal(after?.x, 24);
  assert.equal(after?.y, 12);
  assert.equal(after?.text, "TX15 Dash");
});

test("removeRecordLines deletes multiple lines without shifting targets", () => {
  const records = interpretDocument(goldExample);
  const texts = records.filter((r) => r.kind === "text").slice(0, 3);
  assert.equal(texts.length, 3);
  const after = removeRecordLines(goldExample, texts);
  const remaining = interpretDocument(after);
  for (const t of texts) {
    assert.ok(!remaining.some((r) => r.text === t.text && r.kind === "text"));
  }
});

test("remapRecordIdsAfterLineRemoval shifts later L-ids", () => {
  assert.deepEqual(
    remapRecordIdsAfterLineRemoval(["L10", "L12", "L15"], [12]),
    ["L10", "L14"],
  );
});

test("insertDrawLineWithId returns the new record id", () => {
  const { source, insertedId } = insertDrawLineWithId(goldExample, "rect");
  assert.ok(insertedId);
  const rec = interpretDocument(source).find((r) => r.id === insertedId);
  assert.equal(rec?.kind, "rect");
});

test("insertDrawLine keeps a newline before the refresh end keyword", () => {
  const after = insertDrawLine(createStarterSource(), "annulus");
  const line = after.split("\n").find((l) => l.includes("drawAnnulus"));
  assert.ok(line);
  assert.match(line!, /BRIGHTGREEN\)\s*$/);
  assert.ok(!line!.includes(")end"));
});

test("setRecordColor patches annulus color on 7-arg drawAnnulus", () => {
  const zone = zoneFor(createStarterSource());
  const source = insertDrawLine(createStarterSource(), "annulus");
  const record = interpretDocument(source).find((r) => r.kind === "annulus");
  assert.ok(record);
  const colored = setRecordColor(source, record!, "RED", zone);
  const line = colored.split("\n")[record!.sourceLine! - 1]!;
  assert.match(line, /RED/);
  assert.doesNotMatch(line, /BRIGHTGREEN/);
});

test("duplicateRecordLine copies an anchored draw line into refresh", () => {
  const source = insertDrawLine(createStarterSource(), "rect");
  const record = interpretDocument(source).find((r) => r.kind === "rect");
  assert.ok(record);
  const before = source
    .split("\n")
    .filter((l) => l.includes("drawRectangle")).length;
  const duped = duplicateRecordLine(source, record!);
  const after = duped
    .split("\n")
    .filter((l) => l.includes("drawRectangle")).length;
  assert.equal(after, before + 1);
});

test("moveRecordLine reorders within refresh body", () => {
  const minimal = `---@type WidgetScript
---@simulate Layout1x1 zone=0
local name = "T"
local function create(zone, opts) return { zone = zone, options = opts } end
local function refresh(widget, event, touchState)
  lcd.clear(BLACK)
end
return { name = name, create = create, refresh = refresh }
`;
  let source = insertDrawLine(minimal, "rect");
  source = insertDrawLine(source, "circle");
  const records = interpretDocument(source);
  const circle = records.find((r) => r.kind === "circle");
  assert.ok(circle);
  const moved = moveRecordLine(source, circle!, -1);
  const lines = moved
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("lcd.draw"));
  const rectIdx = lines.findIndex((l) => l.includes("drawRectangle"));
  const circleIdx = lines.findIndex((l) => l.includes("drawCircle"));
  assert.ok(rectIdx >= 0 && circleIdx >= 0);
  assert.ok(circleIdx < rectIdx);
});
