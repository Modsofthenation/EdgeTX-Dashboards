import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSimDir } from "../server/simFirmware.ts";

describe("resolveSimDir standalone layout", () => {
  it("uses WIDGET_GEN_SIM_DIR when set", () => {
    const root = mkdtempSync(join(tmpdir(), "edgetx-sim-"));
    const sim = join(root, "public", "sim");
    mkdirSync(sim, { recursive: true });
    writeFileSync(join(sim, "manifest.json"), "{}\n");
    const prev = process.env.WIDGET_GEN_SIM_DIR;
    process.env.WIDGET_GEN_SIM_DIR = sim;
    try {
      assert.equal(resolveSimDir(), sim);
    } finally {
      if (prev === undefined) delete process.env.WIDGET_GEN_SIM_DIR;
      else process.env.WIDGET_GEN_SIM_DIR = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds apps/web/public/sim under a standalone-style root via env", () => {
    const root = mkdtempSync(join(tmpdir(), "edgetx-standalone-"));
    const sim = join(root, "apps", "web", "public", "sim");
    mkdirSync(sim, { recursive: true });
    writeFileSync(
      join(sim, "manifest.json"),
      JSON.stringify({ defaultVersion: "2.11.0" }),
    );
    const prev = process.env.WIDGET_GEN_SIM_DIR;
    process.env.WIDGET_GEN_SIM_DIR = sim;
    try {
      assert.equal(resolveSimDir(), sim);
    } finally {
      if (prev === undefined) delete process.env.WIDGET_GEN_SIM_DIR;
      else process.env.WIDGET_GEN_SIM_DIR = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
