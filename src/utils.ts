import { createHash } from "node:crypto";
import { SESSION_PREFIX } from "./constants";

/** Short stable hash of a directory path, used to derive the session name. */
export function dirHash(dir: string): string {
  return createHash("md5").update(dir).digest("hex").slice(0, 8);
}

/** tmux session name for a given project directory. */
export function sessionName(dir: string): string {
  return `${SESSION_PREFIX}-${dirHash(dir)}`;
}

/** Extract the claude.ai remote-control browser link from terminal output. */
export function extractLink(content: string): string | null {
  const match = content.match(
    /https:\/\/claude\.ai\/code\?environment=[A-Za-z0-9_-]+/
  );
  return match ? match[0] : null;
}

/** Synchronous, dependency-free sleep (no external `sleep` binary needed). */
export function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Detect the user's shell from the SHELL environment variable. */
export function detectShell(shellEnv: string): "bash" | "fish" | "zsh" {
  if (shellEnv.includes("fish")) return "fish";
  if (shellEnv.includes("zsh")) return "zsh";
  return "bash";
}
