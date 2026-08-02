/**
 * Whether the Cursor local agent sandbox should be enabled.
 *
 * Explicit CURSOR_SANDBOX_ENABLED wins. Otherwise:
 * - Packaged desktop (`WIDGET_GEN_REPO_ROOT` set) defaults OFF — Windows sandbox
 *   needs WSL2 and fights the app-data workspace.
 * - Dev/web defaults ON.
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
  if (env.WIDGET_GEN_REPO_ROOT?.trim()) {
    return false;
  }
  return true;
}
