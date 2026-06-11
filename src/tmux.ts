import { spawnSync } from "node:child_process";
import { SESSION_PREFIX } from "./constants";
import type { RunResult, TmuxSessionInfo } from "./types";

const RUN_TIMEOUT_MS = 10_000;

/** Run an external command, capturing its output. */
export function run(cmd: string, args: string[]): RunResult {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: RUN_TIMEOUT_MS,
  });
  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    code: result.status ?? null,
  };
}

/** Whether a tmux session with this name exists. */
export function sessionExists(name: string): boolean {
  return run("tmux", ["has-session", "-t", name]).code === 0;
}

/** Create a detached tmux session running `command` in `cwd`. */
export function newSession(
  name: string,
  cwd: string,
  command: string[]
): RunResult {
  return run("tmux", ["new-session", "-d", "-s", name, "-c", cwd, ...command]);
}

/** Kill a tmux session by name. */
export function killSession(name: string): RunResult {
  return run("tmux", ["kill-session", "-t", name]);
}

/**
 * Attach to a tmux session interactively.
 *
 * Unlike `run()`, this MUST inherit stdio: tmux needs a real terminal to
 * attach, and there is no sensible timeout for an interactive session.
 * When already inside tmux ($TMUX set), attaching would nest sessions,
 * so switch the current client instead.
 */
export function attachSession(name: string): number | null {
  const args = process.env.TMUX
    ? ["switch-client", "-t", name]
    : ["attach-session", "-t", name];
  const result = spawnSync("tmux", args, { stdio: "inherit" });
  return result.status;
}

/**
 * Detach all clients from a session without stopping it.
 * Useful when the user wants to background the session programmatically.
 */
export function detachSession(name: string): number | null {
  const result = run("tmux", ["detach-client", "-s", name]);
  return result.code;
}

/** Capture the last 50 lines of the session's pane. */
export function getPaneContent(name: string): string {
  const result = run("tmux", [
    "capture-pane",
    "-t",
    name,
    "-p",
    "-S",
    "-50",
    "-J",
  ]);
  return result.stdout.replace(/\r/g, "");
}

/** First pane PID of a session, or "—" when unavailable. */
export function getPanePid(name: string): string {
  const result = run("tmux", ["list-panes", "-t", name, "-F", "#{pane_pid}"]);
  return result.stdout || "—";
}

/** Parse `tmux list-sessions` output into crctl-managed sessions only. */
export function parseSessionList(stdout: string): TmuxSessionInfo[] {
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+(\/.*)$/, 2);
      return { name: parts[0], path: parts[1] || "unknown" };
    })
    .filter((s) => s.name.startsWith(SESSION_PREFIX + "-"));
}

/** List crctl-managed tmux sessions directly from tmux. */
export function listCrctlSessions(): TmuxSessionInfo[] {
  const result = run("tmux", [
    "list-sessions",
    "-F",
    "#{session_name} #{pane_current_path}",
  ]);
  return parseSessionList(result.stdout || "");
}
