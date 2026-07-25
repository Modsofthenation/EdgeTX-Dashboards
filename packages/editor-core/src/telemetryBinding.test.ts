import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bindTextRecordToSensor,
  bindTextRecordToSensorDetailed,
  interpretDocument,
  createStarterSource,
  insertDrawLine,
} from "./index.ts";

describe("bindTextRecordToSensor", () => {
  it("rewrites drawText to telemetry expression and caches sensor", () => {
    const source = createStarterSource();
    const records = interpretDocument(source);
    const text = records.find((r) => r.kind === "text");
    assert.ok(text);

    const next = bindTextRecordToSensor(source, text!, "RQLY", "percent");
    assert.match(next, /cacheSource\("RQLY"\)/);
    assert.match(next, /local\s+v_rqly\s*=\s*telem\(widget\.src\.rqly\)/);
    assert.match(next, /tostring\(v_rqly\)\s*\.\.\s*"%"/);
  });

  it("adds a new sensor to src table when missing", () => {
    const source = createStarterSource();
    const records = interpretDocument(source);
    const text = records.find((r) => r.kind === "text");
    assert.ok(text);

    const next = bindTextRecordToSensor(source, text!, "Capa", "raw");
    assert.match(next, /capa\s*=\s*cacheSource\("Capa"\)/);
    assert.match(next, /local\s+v_capa\s*=/);
    assert.match(next, /tostring\(v_capa\)/);
  });

  it("honors an explicit format override", () => {
    const withText = insertDrawLine(createStarterSource(), "text");
    const texts = interpretDocument(withText).filter((r) => r.kind === "text");
    const text = texts[texts.length - 1];
    assert.ok(text);

    const next = bindTextRecordToSensor(withText, text!, "Curr", "percent");
    assert.match(next, /tostring\(v_curr\)\s*\.\.\s*"%"/);
    assert.doesNotMatch(next, /string\.format\("%.1f A"/);
  });

  it("returns a stable record id after inserting cache/local lines", () => {
    const withText = insertDrawLine(createStarterSource(), "text");
    const texts = interpretDocument(withText).filter((r) => r.kind === "text");
    const text = texts[texts.length - 1];
    assert.ok(text);
    const beforeId = text!.id;

    const result = bindTextRecordToSensorDetailed(
      withText,
      text!,
      "Capa",
      "raw",
    );
    assert.ok(result.recordId);
    assert.notEqual(result.recordId, beforeId);
    const live = interpretDocument(result.source).find(
      (r) => r.id === result.recordId,
    );
    assert.ok(live);
    assert.equal(live!.kind, "text");
  });
});
