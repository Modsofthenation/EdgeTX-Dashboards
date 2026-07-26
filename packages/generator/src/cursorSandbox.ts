/**
 * Whether the Cursor local agent sandbox should be enabled.
 * Default ON; set CURSOR_SANDBOX_ENABLED=0|false to disable for local tooling.
 */
export function isCursorSandboxEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.CURSOR_SANDBOX_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}
