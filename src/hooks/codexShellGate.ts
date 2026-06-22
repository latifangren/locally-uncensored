// H2 security gate — shared, pure, testable.
//
// The coding agent (useCodex) auto-runs tools unattended by design. These are
// the arbitrary-code-execution tools — the prompt-injection RCE surface (a tool
// result or a read file steering the model into running a command). When the
// user enables `settings.codexConfirmShell`, each of these pauses for an
// explicit confirm before dispatch.
//
// file_write is deliberately NOT here: it is path-jailed to the workspace (C2)
// and has its own Stage-and-Approve mode, so it is not part of this gate.
export const CODEX_CONFIRM_TOOLS: ReadonlySet<string> = new Set([
  'shell_execute',
  'code_execute',
  'shell_execute_background',
])

/** True when this tool call must be confirmed: the gate is enabled AND the tool
 *  is one of the arbitrary-exec tools. */
export function codexNeedsConfirm(toolName: string, confirmEnabled: boolean): boolean {
  return confirmEnabled && CODEX_CONFIRM_TOOLS.has(toolName)
}
