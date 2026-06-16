// ─── Shared types & interfaces ──────────────────────────────

/** A single registered remote-control session. */
export interface SessionEntry {
  /** tmux session name, e.g. `claude-rc-<hash>` */
  name: string;
  /** Absolute path of the project directory the session was started in. */
  cwd: string;
  /** PIDs recorded at start time (informational). */
  pids: number[];
  /** Browser link captured from the claude output, if found. */
  link?: string | null;
  /** Spawn mode passed to `claude remote-control --spawn`. */
  spawn?: "same-dir" | "worktree";
  /** Extra flags forwarded verbatim to `claude remote-control` (after `--`). */
  args?: string[];
}

/** Shape of the on-disk session registry (`sessions.json`). */
export interface SessionsData {
  sessions: Record<string, SessionEntry>;
}

/** Result of running an external command synchronously. */
export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** A tmux session as reported by `tmux list-sessions`. */
export interface TmuxSessionInfo {
  name: string;
  path: string;
}

/** Result of a single `crctl doctor` check. */
export interface CheckResult {
  ok: boolean;
  info: string;
}

/** A named dependency check for `crctl doctor`. */
export interface DoctorCheck {
  name: string;
  check: () => CheckResult;
}

/** Shells supported by completion generation. */
export type Shell = "bash" | "fish" | "zsh";
