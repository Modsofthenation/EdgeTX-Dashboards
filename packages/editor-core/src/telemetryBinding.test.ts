import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bindTextRecordToSensor,
  interpretDocument,
  createStarterSource,
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
});
