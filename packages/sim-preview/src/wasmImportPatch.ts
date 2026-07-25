/**
 * Env import helpers for EdgeTX 2.11 WASM.
 * Runtime patching is handled by scripts/patch-simulator-ui.mjs (postinstall).
 */

function noop(): void {}
function zero(): number {
  return 0;
}

/** Add no-op stubs for any missing `env` function imports (unit tests / reference). */
export function patchEnvImports(
  module: WebAssembly.Module,
  imports: WebAssembly.Imports,
): WebAssembly.Imports {
  const env: WebAssembly.ModuleImports = {
    ...((imports.env as WebAssembly.ModuleImports | undefined) ?? {}),
  };
  const out: WebAssembly.Imports = { ...imports, env };

  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.module !== "env" || imp.kind !== "function") continue;
    const existing = env[imp.name];
    if (typeof existing === "function") continue;
    env[imp.name] = imp.name.startsWith("simu") ? noop : zero;
  }

  out.env = env;
  return out;
}
