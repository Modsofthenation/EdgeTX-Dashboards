/**
 * Whether the Cursor local agent sandbox should be enabled.
 * Default ON; set CURSOR_SANDBOX_ENABLED=0|false to disable.
 * Packaged desktop sidecars set CURSOR_SANDBOX_ENABLED=0 explicitly
 * (Windows sandbox needs WSL2) — do not infer from WIDGET_GEN_REPO_ROOT.
 */
export function isCursorSandboxEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.CURSOR_SANDBOX_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") {
    return true;
  }
  return true;
}
