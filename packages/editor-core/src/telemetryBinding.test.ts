import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bindTextRecordToSensor,
  bindTextRecordToSensorDetailed,
  interpretDocument,
  createStarterSource,
  insertDrawLine,
  listSrcBindings,
  remapSrcSensor,
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

describe("remapSrcSensor", () => {
  it("changes catalog sensor while keeping src key stable", () => {
    const source = `local name = "T"
local function create(zone, opts)
  return {
    src = {
      hspd = cacheSource("HSpd"),
      tspd = cacheSource("Tspd"),
    },
  }
end
local function refresh(widget)
  local hspd = telem(widget.src.hspd)
  lcd.drawText(10, 10, tostring(hspd), WHITE)
end
return {
  name = name,
  create = create,
  refresh = refresh,
}
`;
    const next = remapSrcSensor(source, "hspd", "RPM");
    assert.match(next, /hspd\s*=\s*cacheSource\("RPM"\)/);
    assert.match(next, /tspd\s*=\s*cacheSource\("Tspd"\)/);
    assert.match(next, /widget\.src\.hspd/);
    const bindings = listSrcBindings(next);
    assert.deepEqual(
      bindings.find((b) => b.key === "hspd"),
      { key: "hspd", sensor: "RPM" },
    );
  });

  it("no-ops when key is missing", () => {
    const source = `src = { hspd = cacheSource("HSpd") }`;
    assert.equal(remapSrcSensor(source, "missing", "RPM"), source);
  });

  it("ignores duplicate keys outside create() when listing and remapping", () => {
    const source = `local decoy = {
  hspd = cacheSource("RPM"),
}
local function create(zone, opts)
  return {
    src = {
      hspd = cacheSource("HSpd"),
      tspd = cacheSource("Tspd"),
    },
  }
end
local function refresh(widget)
  lcd.drawText(0, 0, tostring(telem(widget.src.hspd)), WHITE)
end
return { name = "T", create = create, refresh = refresh }
`;
    const bindings = listSrcBindings(source);
    assert.deepEqual(
      bindings.find((b) => b.key === "hspd"),
      { key: "hspd", sensor: "HSpd" },
    );
    assert.equal(
      bindings.some((b) => b.sensor === "RPM"),
      false,
    );

    const next = remapSrcSensor(source, "hspd", "Curr");
    assert.match(next, /hspd\s*=\s*cacheSource\("Curr"\)/);
    assert.match(next, /decoy[\s\S]*hspd\s*=\s*cacheSource\("RPM"\)/);
    assert.doesNotMatch(
      next.slice(0, next.indexOf("local function create")),
      /cacheSource\("Curr"\)/,
    );
  });
});
