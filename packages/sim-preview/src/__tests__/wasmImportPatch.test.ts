import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { patchEnvImports } from "../wasmImportPatch.js";

describe("patchEnvImports", () => {
  it("adds simu* stubs for missing env function imports", () => {
    const module = {} as WebAssembly.Module;
    const originalImports = WebAssembly.Module.imports;
    WebAssembly.Module.imports = (m) => {
      if (m !== module) return originalImports(m);
      return [{ module: "env", name: "simuAuxSerialStart", kind: "function" }];
    };

    try {
      const patched = patchEnvImports(module, { env: {} });
      assert.equal(typeof (patched.env as WebAssembly.ModuleImports).simuAuxSerialStart, "function");
    } finally {
      WebAssembly.Module.imports = originalImports;
    }
  });

  it("preserves existing env functions", () => {
    const module = {} as WebAssembly.Module;
    const originalImports = WebAssembly.Module.imports;
    const existing = () => 42;
    WebAssembly.Module.imports = (m) => {
      if (m !== module) return originalImports(m);
      return [{ module: "env", name: "simuAuxSerialStart", kind: "function" }];
    };

    try {
      const patched = patchEnvImports(module, { env: { simuAuxSerialStart: existing } });
      assert.equal((patched.env as WebAssembly.ModuleImports).simuAuxSerialStart, existing);
    } finally {
      WebAssembly.Module.imports = originalImports;
    }
  });
});
